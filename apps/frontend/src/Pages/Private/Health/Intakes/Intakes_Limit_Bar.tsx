interface Intakes_Limit_Bar_Props {
  label: string;
  value: number;
  limit: number;
  className: string;
}

const Intakes_Limit_Bar = ({ label, value, limit, className }: Intakes_Limit_Bar_Props) => {
  const percent = Math.min(100, (value / limit) * 100);
  const over = value > limit;

  return (
    <div className='Intakes_Limit'>
      <span className='Intakes_Limit_Label'>{label}</span>
      <div className='Intakes_Limit_Track'>
        <span className={over ? 'intakes-over' : className} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

export default Intakes_Limit_Bar;
