// Normalize the site's former misspelling in assistant output and restored conversations.
export function correctSiteName(text: string) {
  return text.replaceAll('九恒', '九衡');
}
