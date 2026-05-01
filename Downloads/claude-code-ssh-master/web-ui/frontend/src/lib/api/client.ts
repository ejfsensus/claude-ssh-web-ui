/**
 * API client for communicating with FastAPI backend
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';

export class APIClient {
  private baseURL: string;
  private wsURL: string;

  constructor(baseURL: string = API_URL, wsURL: string = WS_URL) {
    this.baseURL = baseURL;
    this.wsURL = wsURL;
  }

  async get(endpoint: string) {
    const response = await fetch(`${this.baseURL}${endpoint}`);
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  async post(endpoint: string, data?: any) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  async delete(endpoint: string) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    return response.json();
  }

  // WebSocket connection
  connectWebSocket(): WebSocket {
    const ws = new WebSocket(`${this.wsURL}/api/ws/chat`);

    return ws;
  }

  // Sessions
  async listSessions() {
    return this.get('/sessions');
  }

  async createSession(title: string = 'New Session') {
    return this.post('/sessions', { title });
  }

  async deleteSession(sessionId: string) {
    return this.delete(`/sessions/${sessionId}`);
  }

  async getSessionMessages(sessionId: string) {
    return this.get(`/sessions/${sessionId}/messages`);
  }

  // Files
  async listFiles() {
    return this.get('/files/list');
  }

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${this.baseURL}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  // Processes
  async listProcesses() {
    return this.get('/processes');
  }

  async startProcess(command: string, name: string) {
    return this.post('/processes/start', { command, name });
  }

  async stopProcess(processId: string) {
    return this.delete(`/processes/${processId}`);
  }

  // Health check
  async healthCheck() {
    return this.get('/api/health');
  }
}

export const apiClient = new APIClient();
