export interface Health_Split_Part {
  key: string;
  label: string;
  value: number;
  className: string;
  display?: string;
}

interface Health_Split_Bar_Props {
  parts: Health_Split_Part[];
  showLegend?: boolean;
}

const Health_Split_Bar = ({ parts, showLegend = false }: Health_Split_Bar_Props) => {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  if (total <= 0) return null;

  return (
    <div className='Health_Split_Bar'>
      <div className='Health_Split_Bar_Track'>
        {parts.map((part) => (
          <span key={part.key} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />
        ))}
      </div>

      {showLegend && (
        <div className='Health_Split_Bar_Legend'>
          {parts.map((part) => (
            <span key={part.key}>
              <i className={part.className} />
              {part.label}
              <b>{part.display ?? `${Math.round((part.value / total) * 100)}%`}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default Health_Split_Bar;
