// Deterministic color from user ID (matches server-side)
export function userColor(userId: string): string {
  const colors = [
    '#ef4444', '#f97316', '#eab308', '#22c55e',
    '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
    '#14b8a6', '#f43f5e',
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash |= 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function getLanguageIcon(language: string): string {
  const icons: Record<string, string> = {
    javascript: 'JS',
    typescript: 'TS',
    python: 'PY',
    go: 'GO',
    cpp: 'C++',
    java: 'JV',
  };
  return icons[language] ?? '??';
}

export function getLanguageColor(language: string): string {
  const colors: Record<string, string> = {
    javascript: '#f7df1e',
    typescript: '#3178c6',
    python: '#3572A5',
    go: '#00ADD8',
    cpp: '#f34b7d',
    java: '#b07219',
  };
  return colors[language] ?? '#888888';
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return date.toLocaleDateString();
}

const _rawWsUrl = import.meta.env.VITE_WS_URL || `ws://${window.location.host}`;
// Normalise: if the env var uses http(s):// convert it to ws(s)://
const WS_BASE = _rawWsUrl
  .replace(/^https:\/\//, 'wss://')
  .replace(/^http:\/\//, 'ws://');

export function buildWsUrl(
  path: string,
  params: Record<string, string>
): string {
  const base = WS_BASE.endsWith('/') ? WS_BASE.slice(0, -1) : WS_BASE;
  const url = new URL(path, base.startsWith('ws') ? base.replace(/^ws/, 'http') : base);
  // Put back the ws:// scheme
  const wsUrl = url.toString().replace(/^https:\/\//, 'wss://').replace(/^http:\/\//, 'ws://');
  const urlObj = new URL(wsUrl);
  Object.entries(params).forEach(([k, v]) => urlObj.searchParams.set(k, v));
  return urlObj.toString();
}
