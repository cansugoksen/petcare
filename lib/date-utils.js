export function toDate(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value?.toDate === 'function') {
    return value.toDate();
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateOnly(value) {
  const date = toDate(value);
  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat('tr-TR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function toInputDateTime(value) {
  const date = toDate(value) ?? new Date();
  const pad = (n) => `${n}`.padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function parseInputDateTime(text) {
  if (!text?.trim()) {
    return null;
  }

  const normalized = text.trim().replace('T', ' ');
  const [datePart, timePart = '00:00'] = normalized.split(' ');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);

  if ([y, m, d, h, min].some((v) => Number.isNaN(v))) {
    return null;
  }

  const parsed = new Date(y, m - 1, d, h, min, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sortByCreatedAtDesc(items) {
  return [...items].sort((a, b) => {
    const aTime = toDate(a.createdAt)?.getTime() ?? 0;
    const bTime = toDate(b.createdAt)?.getTime() ?? 0;
    return bTime - aTime;
  });
}
