/**
 * SSE 服务 - 流式获取生成进度
 */

export interface SSEProgressEvent {
  taskId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep: number;
  totalEpisodes: number;
  completedEpisodes: number;
  stepName: string;
}

export interface SSEEpisodeEvent {
  episodeNumber: number;
  title: string;
  contentPreview: string;
}

export interface SSEDoneEvent {
  status: 'completed' | 'failed';
  message: string;
}

export interface SSELogEvent {
  id: number;
  taskId: string;
  level: 'info' | 'success' | 'warning' | 'error';
  step?: number;
  stepName?: string;
  episodeNumber?: number;
  message: string;
  detail?: string;
  timestamp: string;
}

export interface SSEEventHandlers {
  onStatus?: (data: any) => void;
  onProgress?: (data: SSEProgressEvent) => void;
  onEpisode?: (data: SSEEpisodeEvent) => void;
  onLog?: (data: SSELogEvent) => void;
  onDone?: (data: SSEDoneEvent) => void;
  onError?: (error: { step?: number; stepName?: string; message: string; timestamp?: string }) => void;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

export function connectSSE(taskId: string, handlers: SSEEventHandlers): EventSource {
  const token = localStorage.getItem('auth_token');
  const url = `${API_BASE}/api/pipeline/${taskId}/stream?token=${token}`;

  const eventSource = new EventSource(url);

  eventSource.addEventListener('status', (event) => {
    try {
      const data = JSON.parse(event.data);
      handlers.onStatus?.(data);
    } catch (e) {
      console.error('SSE status parse error:', e);
    }
  });

  eventSource.addEventListener('progress', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEProgressEvent;
      handlers.onProgress?.(data);
    } catch (e) {
      console.error('SSE progress parse error:', e);
    }
  });

  eventSource.addEventListener('episode', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEEpisodeEvent;
      handlers.onEpisode?.(data);
    } catch (e) {
      console.error('SSE episode parse error:', e);
    }
  });

  eventSource.addEventListener('log', (event) => {
    try {
      const data = JSON.parse(event.data) as SSELogEvent;
      handlers.onLog?.(data);
    } catch (e) {
      console.error('SSE log parse error:', e);
    }
  });

  eventSource.addEventListener('error', (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      handlers.onError?.(data);
    } catch {
      if (eventSource.readyState === EventSource.CLOSED) {
        handlers.onError?.({ message: '连接已关闭' });
      }
    }
  });

  eventSource.addEventListener('done', (event) => {
    try {
      const data = JSON.parse(event.data) as SSEDoneEvent;
      handlers.onDone?.(data);
      eventSource.close();
    } catch (e) {
      console.error('SSE done parse error:', e);
    }
  });

  return eventSource;
}

export function closeSSE(eventSource: EventSource | null): void {
  if (eventSource) {
    eventSource.close();
  }
}
