const Inline_Markdown = ({ text }: { text: string }) => (
  <>
    {text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={index}>{part.slice(1, -1)}</code>;
      return part;
    })}
  </>
);

export default Inline_Markdown;
