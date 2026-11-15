const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export const matchesSearch = (query: string, texts: string[]) => {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const haystack = normalize(texts.join(' '));
  return words.every((word) => haystack.includes(word));
};
