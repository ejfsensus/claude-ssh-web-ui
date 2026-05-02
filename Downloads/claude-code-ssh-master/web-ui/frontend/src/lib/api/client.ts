/**
 * API client for communicating with the FastAPI backend.
 */

import type { AttachmentDescriptor, RuntimeStatus, WorkspaceFile } from '@/lib/store/chatStore';

const getBaseURL = () => {
  const configuredURL = process.env.NEXT_PUBLIC_API_URL;
  if (configuredURL) {
    return configuredURL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return 'http://localhost:8080';
};

const getWSURL = () => {
  const configuredURL = process.env.NEXT_PUBLIC_WS_URL;
  if (configuredURL) {
    return configuredURL.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

  return 'ws://localhost:8080';
};

export class APIClient {
  private baseURL: string;
  private wsURL: string;

  constructor() {
    this.baseURL = getBaseURL();
    this.wsURL = getWSURL();
  }

  private apiEndpoint(endpoint: string) {
    const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const apiBaseURL = this.baseURL.endsWith('/api') ? this.baseURL : `${this.baseURL}/api`;
    return `${apiBaseURL}${normalized}`;
  }

  private async request(endpoint: string, init?: RequestInit) {
    const response = await fetch(this.apiEndpoint(endpoint), init);
    if (!response.ok) {
      let detail = response.statusText;
      try {
        const body = await response.json();
        detail = body.detail || body.message || detail;
      } catch {
        // Keep the HTTP status text.
      }
      throw new Error(detail);
    }
    return response.json();
  }

  async get(endpoint: string) {
    return this.request(endpoint);
  }

  async post(endpoint: string, data?: unknown) {
    return this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  connectWebSocket(): WebSocket {
    return new WebSocket(`${this.wsURL}/api/ws/chat`);
  }

  async healthCheck() {
    return this.get('/health');
  }

  async getStatus(): Promise<RuntimeStatus> {
    return this.get('/status');
  }

  async listSessions() {
    return this.get('/sessions');
  }

  async createSession(title = 'New Session') {
    return this.post('/sessions', { title });
  }

  async deleteSession(sessionId: string) {
    return this.delete(`/sessions/${sessionId}`);
  }

  async getSessionMessages(sessionId: string) {
    return this.get(`/sessions/${sessionId}/messages`);
  }

  async listFiles(path = ''): Promise<{ path: string; files: WorkspaceFile[] }> {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    const query = params.toString();
    return this.get(`/workspace/tree${query ? `?${query}` : ''}`);
  }

  async previewFile(path: string) {
    const params = new URLSearchParams({ path });
    return this.get(`/workspace/file?${params.toString()}`);
  }

  async uploadFile(file: File): Promise<{ file: AttachmentDescriptor }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.apiEndpoint('/files/upload'), {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let detail = 'Upload failed';
      try {
        const body = await response.json();
        detail = body.detail || detail;
      } catch {
        // Keep the generic upload error.
      }
      throw new Error(detail);
    }
    return response.json();
  }

  async listProcesses() {
    return this.get('/processes');
  }
}

export const apiClient = new APIClient();
