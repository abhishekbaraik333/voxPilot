import { nanoid } from 'nanoid';

/** Generate a short unique ID */
export function generateId(size = 12): string {
  return nanoid(size);
}

/** Format phone number to E.164 */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('1') && digits.length === 11) {
    return `+${digits}`;
  }
  if (digits.length === 10) {
    return `+1${digits}`;
  }
  // Already has country code or international
  if (phone.startsWith('+')) return phone;
  return `+${digits}`;
}

/** Calculate duration in seconds between two dates */
export function durationBetween(start?: Date | string, end?: Date | string): number {
  if (!start || !end) return 0;
  const s = typeof start === 'string' ? new Date(start) : start;
  const e = typeof end === 'string' ? new Date(end) : end;
  return Math.round((e.getTime() - s.getTime()) / 1000);
}

/** Format seconds to MM:SS */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Sleep for ms */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
