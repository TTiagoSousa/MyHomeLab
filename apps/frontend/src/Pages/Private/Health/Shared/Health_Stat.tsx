interface Health_Stat_Props {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

const Health_Stat = ({ label, value, sub, highlight = false }: Health_Stat_Props) => (
  <div className={`Health_Stat ${highlight ? 'highlight' : ''}`}>
    <span>{label}</span>
    <em>{value}</em>
    {sub && <small>{sub}</small>}
  </div>
);

export default Health_Stat;
