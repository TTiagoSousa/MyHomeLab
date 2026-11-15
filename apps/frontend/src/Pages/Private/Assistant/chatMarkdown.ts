const STRUCTURE = /^\s*([-*+]\s|\d+[.)]\s|#{1,6}\s|>|\||```|~~~|-{3,}\s*$)/;

const isPlainLine = (line: string) => line.trim() !== '' && !STRUCTURE.test(line);

export const chatMarkdown = (text: string) => {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let inFence = false;
  return lines
    .map((line, index) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      const next = lines.at(index + 1);
      if (inFence || next === undefined || !isPlainLine(line) || !isPlainLine(next)) return line;
      return `${line.replace(/\s+$/, '')}  `;
    })
    .join('\n');
};
