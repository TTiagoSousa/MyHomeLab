import type { LabResult } from '../../../../Hooks/Health/healthTypes';

interface Lab_Range_Bar_Props {
  result: Pick<LabResult, 'value' | 'refLow' | 'refHigh' | 'flag'>;
}

const clamp = (value: number) => Math.min(Math.max(value, 0.02), 0.98);

const rangeOf = ({ value, refLow, refHigh }: Lab_Range_Bar_Props['result']) => {
  if (value == null || (refLow == null && refHigh == null)) return null;
  if (refLow != null && refHigh != null && refHigh > refLow) {
    const span = refHigh - refLow;
    const min = refLow - span * 0.5;
    const max = refHigh + span * 0.5;
    return { from: (refLow - min) / (max - min), to: (refHigh - min) / (max - min), marker: clamp((value - min) / (max - min)) };
  }
  if (refHigh != null) {
    const max = Math.max(refHigh * 1.5, value * 1.1);
    return { from: 0, to: refHigh / max, marker: clamp(value / max) };
  }
  const low = refLow as number;
  const max = Math.max(low * 2, value * 1.15);
  return { from: low / max, to: 1, marker: clamp(value / max) };
};

const Lab_Range_Bar = ({ result }: Lab_Range_Bar_Props) => {
  const range = rangeOf(result);
  if (!range) return <span className='Lab_Range empty' />;

  return (
    <span className='Lab_Range'>
      <i className='Lab_Range_Zone' style={{ left: `${range.from * 100}%`, width: `${(range.to - range.from) * 100}%` }} />
      <i className={`Lab_Range_Marker ${result.flag ? 'out' : ''}`} style={{ left: `${range.marker * 100}%` }} />
    </span>
  );
};

export default Lab_Range_Bar;
