import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioWaveform, Loader2, Mic2, PhoneOff, Send, Sparkles, X } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useWebSocket } from '@/lib/hooks/useWebSocket';
import { useChatStore } from '@/lib/store/chatStore';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type VoiceState = 'ready' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';
type TranscriptRole = 'user' | 'assistant' | 'system';

interface TranscriptEntry {
  id: string;
  role: TranscriptRole;
  content: string;
  createdAt: string;
}

interface VoiceSocketPayload {
  type: string;
  state?: VoiceState;
  role?: TranscriptRole;
  content?: string;
  message?: string;
}

const TARGET_SAMPLE_RATE = 24000;

const stateCopy: Record<VoiceState, { label: string; detail: string }> = {
  ready: { label: 'Ready', detail: 'Voice channel standing by' },
  connecting: { label: 'Connecting', detail: 'Opening live channel' },
  listening: { label: 'Listening', detail: 'Speak naturally' },
  thinking: { label: 'Thinking', detail: 'Agent is forming a reply' },
  speaking: { label: 'Speaking', detail: 'Audio response playing' },
  error: { label: 'Interrupted', detail: 'Voice channel needs a restart' },
};

function linear16FromFloat32(input: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  const ratio = inputSampleRate / outputSampleRate;
  const outputLength = Math.max(1, Math.floor(input.length / ratio));
  const buffer = new ArrayBuffer(outputLength * 2);
  const view = new DataView(buffer);

  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.min(input.length, Math.floor((index + 1) * ratio));
    let sample = 0;
    let count = 0;

    for (let cursor = start; cursor < end; cursor += 1) {
      sample += input[cursor];
      count += 1;
    }

    sample = count > 0 ? sample / count : input[start] || 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return buffer;
}

function float32FromLinear16(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const samples = new Float32Array(Math.floor(buffer.byteLength / 2));

  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 0x8000;
  }

  return samples;
}

export function VoiceAgent() {
  const [open, setOpen] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('ready');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState('');

  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const voiceSocketRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const captureContextRef = useRef<AudioContext | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);

  const {
    addActivity,
    addConsoleEvent,
    currentSessionId,
  } = useChatStore();
  const { sendMessage, isConnected } = useWebSocket();

  const active = open && ['connecting', 'listening', 'thinking', 'speaking'].includes(voiceState);

  const stopMicrophone = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();
    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    if (captureContextRef.current?.state !== 'closed') {
      captureContextRef.current?.close().catch(() => undefined);
    }
    captureContextRef.current = null;
  }, []);

  const stopVoice = useCallback((notifyServer = true) => {
    stopMicrophone();

    if (notifyServer && voiceSocketRef.current?.readyState === WebSocket.OPEN) {
      voiceSocketRef.current.send(JSON.stringify({ type: 'close' }));
    }

    voiceSocketRef.current?.close();
    voiceSocketRef.current = null;
    setVoiceState('ready');
  }, [stopMicrophone]);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => () => stopVoice(false), [stopVoice]);

  const appendTranscript = useCallback((entry: Omit<TranscriptEntry, 'id' | 'createdAt'>) => {
    setTranscript((current) => {
      const next = [
        ...current,
        {
          ...entry,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        },
      ].slice(-80);
      transcriptRef.current = next;
      return next;
    });
  }, []);

  const playLinear16 = useCallback(async (buffer: ArrayBuffer) => {
    if (!buffer.byteLength) return;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = playbackContextRef.current || new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE });
    playbackContextRef.current = context;

    if (context.state === 'suspended') {
      await context.resume();
    }

    const samples = float32FromLinear16(buffer);
    const audioBuffer = context.createBuffer(1, samples.length, TARGET_SAMPLE_RATE);
    audioBuffer.copyToChannel(samples, 0);

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);

    const startAt = Math.max(context.currentTime + 0.02, playbackTimeRef.current);
    source.start(startAt);
    playbackTimeRef.current = startAt + audioBuffer.duration;
  }, []);

  const startMicrophone = useCallback(async (socket: WebSocket) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass({ sampleRate: TARGET_SAMPLE_RATE });
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(4096, 1, 1);
    const silentGain = context.createGain();

    silentGain.gain.value = 0;
    processor.onaudioprocess = (event) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      socket.send(linear16FromFloat32(input, context.sampleRate, TARGET_SAMPLE_RATE));
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(context.destination);

    mediaStreamRef.current = stream;
    captureContextRef.current = context;
    sourceRef.current = source;
    processorRef.current = processor;
    silentGainRef.current = silentGain;
  }, []);

  const startVoice = useCallback(() => {
    stopVoice(false);
    setOpen(true);
    setError('');
    setTranscript([]);
    transcriptRef.current = [];
    playbackTimeRef.current = 0;
    setVoiceState('connecting');

    const socket = apiClient.connectVoiceWebSocket();
    socket.binaryType = 'arraybuffer';
    voiceSocketRef.current = socket;

    socket.onopen = async () => {
      try {
        await startMicrophone(socket);
        setVoiceState('listening');
        addConsoleEvent({ kind: 'voice', level: 'success', label: 'Voice channel opened' });
      } catch (microphoneError) {
        const message = microphoneError instanceof Error ? microphoneError.message : 'Microphone unavailable';
        setError(message);
        setVoiceState('error');
        addActivity({ label: message, tone: 'danger' });
        addConsoleEvent({ kind: 'voice', level: 'error', label: message });
        stopVoice();
      }
    };

    socket.onmessage = async (event) => {
      if (event.data instanceof ArrayBuffer) {
        setVoiceState('speaking');
        await playLinear16(event.data);
        return;
      }

      if (event.data instanceof Blob) {
        setVoiceState('speaking');
        await playLinear16(await event.data.arrayBuffer());
        return;
      }

      try {
        const payload = JSON.parse(event.data) as VoiceSocketPayload;

        if (payload.type === 'voice_state' && payload.state) {
          setVoiceState(payload.state);
          return;
        }

        if (payload.type === 'voice_ready') {
          setVoiceState('listening');
          return;
        }

        if (payload.type === 'conversation_text' && payload.content) {
          appendTranscript({
            role: payload.role === 'user' ? 'user' : 'assistant',
            content: payload.content,
          });
          setVoiceState(payload.role === 'user' ? 'thinking' : 'speaking');
          return;
        }

        if (payload.type === 'voice_error') {
          const message = payload.message || 'Voice channel error';
          setError(message);
          setVoiceState('error');
          addActivity({ label: message, tone: 'danger' });
          addConsoleEvent({ kind: 'voice', level: 'error', label: message });
        }
      } catch {
        // Ignore unknown non-JSON voice frames.
      }
    };

    socket.onclose = () => {
      stopMicrophone();
      setVoiceState((current) => current === 'error' ? 'error' : 'ready');
    };

    socket.onerror = () => {
      setError('Voice channel failed to connect');
      setVoiceState('error');
      addActivity({ label: 'Voice channel failed to connect', tone: 'danger' });
      addConsoleEvent({ kind: 'voice', level: 'error', label: 'Voice channel failed to connect' });
    };
  }, [
    addActivity,
    addConsoleEvent,
    appendTranscript,
    playLinear16,
    startMicrophone,
    stopMicrophone,
    stopVoice,
  ]);

  const closeOverlay = () => {
    stopVoice();
    setOpen(false);
  };

  const handoffTranscript = async () => {
    const captured = transcriptRef.current.filter((entry) => entry.content.trim());
    stopVoice();

    if (!captured.length) {
      addActivity({ label: 'No voice transcript captured', tone: 'warning' });
      setOpen(false);
      return;
    }

    if (!isConnected) {
      addActivity({ label: 'Agent channel offline, handoff not sent', tone: 'danger' });
      setOpen(false);
      return;
    }

    try {
      const handoff = await apiClient.createVoiceHandoff({
        sessionId: currentSessionId,
        transcript: captured.map(({ role, content, createdAt }) => ({ role, content, createdAt })),
      });

      sendMessage(handoff.prompt, {
        mode: 'execute',
        approved: true,
        clientActionId: crypto.randomUUID(),
      });
      addActivity({ label: 'Voice handoff sent to Claude Code', tone: 'success' });
      addConsoleEvent({
        kind: 'voice',
        level: 'success',
        label: 'Voice handoff sent',
        metadata: { turns: handoff.turnCount },
      });
    } catch (handoffError) {
      const message = handoffError instanceof Error ? handoffError.message : 'Voice handoff failed';
      addActivity({ label: message, tone: 'danger' });
      addConsoleEvent({ kind: 'voice', level: 'error', label: message });
    } finally {
      setOpen(false);
    }
  };

  const copy = stateCopy[voiceState];

  return (
    <>
      <button
        className={cn('voice-orb-button', active && 'voice-orb-button-active')}
        onClick={startVoice}
        aria-label="Open voice agent"
        title="Voice agent"
      >
        <span className="voice-orb-glow" />
        <Mic2 className="h-4 w-4" />
      </button>

      {open && (
        <div className="voice-overlay" role="dialog" aria-modal="true" aria-label="Voice agent">
          <div className="voice-modal">
            <button className="voice-close" onClick={closeOverlay} aria-label="Close voice agent">
              <X className="h-4 w-4" />
            </button>

            <div className={cn('voice-wave-stage', `voice-wave-${voiceState}`)}>
              <div className="voice-wave-ring" />
              <div className="voice-wave-core">
                {voiceState === 'connecting' ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : voiceState === 'thinking' ? (
                  <Sparkles className="h-8 w-8" />
                ) : (
                  <AudioWaveform className="h-8 w-8" />
                )}
              </div>
            </div>

            <div className="voice-status-copy">
              <p>{copy.label}</p>
              <h2>{copy.detail}</h2>
              {error && <span>{error}</span>}
            </div>

            <div className="voice-transcript" aria-live="polite">
              {transcript.length === 0 ? (
                <p className="voice-transcript-empty">Transcript will appear here.</p>
              ) : (
                transcript.map((entry) => (
                  <div key={entry.id} className={cn('voice-turn', `voice-turn-${entry.role}`)}>
                    <strong>{entry.role === 'user' ? 'You' : 'Agent'}</strong>
                    <span>{entry.content}</span>
                  </div>
                ))
              )}
            </div>

            <div className="voice-actions">
              <button className="quiet-action" onClick={closeOverlay}>
                <PhoneOff className="h-4 w-4" />
                End
              </button>
              <button className="primary-action" onClick={handoffTranscript} disabled={transcript.length === 0}>
                <Send className="h-4 w-4" />
                End & hand off
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
