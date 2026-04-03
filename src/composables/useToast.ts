import { reactive } from 'vue';

export interface Toast {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration: number;
}

const toasts = reactive<Toast[]>([]);
let nextId = 0;

function addToast(type: Toast['type'], message: string, duration = 4000) {
  const id = nextId++;
  toasts.push({ id, type, message, duration });

  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

function removeToast(id: number) {
  const index = toasts.findIndex((t) => t.id === id);
  if (index !== -1) toasts.splice(index, 1);
}

export function useToast() {
  return {
    toasts,
    success: (msg: string, duration?: number) => addToast('success', msg, duration),
    error: (msg: string, duration?: number) => addToast('error', msg, duration ?? 6000),
    info: (msg: string, duration?: number) => addToast('info', msg, duration),
    warning: (msg: string, duration?: number) => addToast('warning', msg, duration ?? 5000),
    remove: removeToast,
  };
}
