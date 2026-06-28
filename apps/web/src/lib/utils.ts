import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/** Format seconds into MM:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Format timestamp to human readable */
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Format ms offset to MM:SS */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  return formatDuration(totalSeconds);
}

/** Get status badge class */
export function getStatusBadge(status: string): string {
  switch (status) {
    case 'completed': return 'badge-success';
    case 'in-progress': return 'badge-info';
    case 'ringing': return 'badge-warning';
    case 'queued': return 'badge-neutral';
    case 'failed':
    case 'no-answer':
    case 'busy':
    case 'canceled': return 'badge-danger';
    default: return 'badge-neutral';
  }
}
