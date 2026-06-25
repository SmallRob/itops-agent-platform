import { formatDistanceToNow, isValid } from 'date-fns';

const TZ = 'Asia/Shanghai';

export function safeFormatDistance(dateValue: string | Date | null | undefined, fallback = '未知时间'): string {
  if (!dateValue) return fallback;
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
  if (!isValid(date)) return fallback;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return fallback;
  }
}

export function formatTime(dateStr: string | null | undefined, fallback = '-'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (!isValid(date)) return fallback;
  return date.toLocaleString('zh-CN', {
    timeZone: TZ,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(dateStr: string | null | undefined, fallback = '-'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (!isValid(date)) return fallback;
  return date.toLocaleString('zh-CN', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDate(dateStr: string | null | undefined, fallback = '-'): string {
  if (!dateStr) return fallback;
  const date = new Date(dateStr);
  if (!isValid(date)) return fallback;
  return date.toLocaleString('zh-CN', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatDuration(ms: number | null | undefined, fallback = '-'): string {
  if (!ms) return fallback;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
