type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'cpp' | 'java';

const EXT_MAP: Record<string, Language> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  go: 'go',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  java: 'java',
};

export function detectLanguage(filename: string): Language {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'javascript';
}

export const LANGUAGE_IMAGES: Record<Language, string> = {
  javascript: 'node:20-alpine',
  typescript: 'node:20-alpine',
  python: 'python:3.12-slim',
  go: 'golang:1.22-alpine',
  cpp: 'gcc:13',
  java: 'eclipse-temurin:21',
};

export const LANGUAGE_RUN_CMD: Record<Language, (file: string) => string[]> = {
  javascript: (f) => ['node', f],
  typescript: (f) => ['npx', '-y', 'ts-node', '--esm', f],
  python: (f) => ['python3', f],
  go: (f) => ['go', 'run', f],
  cpp: (f) => ['sh', '-c', `g++ -o /tmp/out ${f} && /tmp/out`],
  java: (f) => ['sh', '-c', `cd /app && javac ${f} && java ${f.replace('.java', '')}`],
};

export const LANGUAGE_FILE_EXT: Record<Language, string> = {
  javascript: 'js',
  typescript: 'ts',
  python: 'py',
  go: 'go',
  cpp: 'cpp',
  java: 'java',
};

// Deterministic color from user ID
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
