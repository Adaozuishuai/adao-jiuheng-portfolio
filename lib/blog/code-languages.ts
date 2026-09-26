export const codeLanguages = [
  ['plaintext', '纯文本'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['python', 'Python'],
  ['json', 'JSON'],
  ['xml', 'HTML'],
  ['css', 'CSS'],
  ['bash', 'Bash'],
  ['sql', 'SQL'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
] as const;

export function normalizeCodeLanguage(value: unknown): string {
  const aliases: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    html: 'xml',
    sh: 'bash',
    shell: 'bash',
    'c++': 'cpp',
    text: 'plaintext',
  };
  const raw = typeof value === 'string' ? value.toLowerCase() : '';
  const language = aliases[raw] ?? raw;
  return codeLanguages.some(([key]) => key === language)
    ? language
    : 'plaintext';
}
