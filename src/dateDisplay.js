import { datePart } from './todaySchedule.js';

export function formatDateTime(value) {
  if (typeof value !== 'string') return '';
  return value.split(' ~ ').map(part => {
    const day = datePart(part);
    if (!day) return part;
    const time = part.slice(day.length).match(/^[T ]([01]\d|2[0-3]):([0-5]\d)/);
    return time ? `${day} ${time[1]}:${time[2]}` : day;
  }).join(' ~ ');
}

export function formatLocalTimestamp(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = number => String(number).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
