import type { ReactNode } from 'react';
import { foldText } from './ruleSearch';

interface Highlight_Text_Props {
  text: string;
  terms: string[];
}

const Highlight_Text = ({ text, terms }: Highlight_Text_Props) => {
  if (terms.length === 0) return <>{text}</>;

  const folded = foldText(text);
  const termAt = (index: number) => terms.find((term) => folded.startsWith(term, index));

  const parts: ReactNode[] = [];
  let index = 0;

  while (index < text.length) {
    const term = termAt(index);

    if (term) {
      parts.push(<mark key={index}>{text.slice(index, index + term.length)}</mark>);
      index += term.length;
      continue;
    }

    let end = index + 1;
    while (end < text.length && !termAt(end)) end++;
    parts.push(text.slice(index, end));
    index = end;
  }

  return <>{parts}</>;
};

export default Highlight_Text;
