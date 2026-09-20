export default function courtDate(value, time = false) {
  if (!value) return 'To be announced';
  const date = new Date(value.includes(' ') ? value.replace(' ', 'T') : value);
  if (Number.isNaN(date.getTime())) return 'To be announced';
  return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', ...(time ? { hour: 'numeric', minute: '2-digit' } : {}) });
}
