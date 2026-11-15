import type { SkinTemperatureDay } from '../../../../Hooks/Health/healthTypes';
import { formatDay } from '../Shared/healthFormat';
import Skin_Range_Bar from './Skin_Range_Bar';
import { formatTemp } from './skinFormat';

interface Skin_Day_Row_Props {
  temperatureDay: SkinTemperatureDay;
  selected: boolean;
  onSelect: () => void;
}

const Skin_Day_Row = ({ temperatureDay, selected, onSelect }: Skin_Day_Row_Props) => (
  <button type='button' className={`Health_Table_Row ${selected ? 'selected' : ''}`} onClick={onSelect}>
    <span className='Health_Table_Day'>{formatDay(temperatureDay.day)}</span>
    <span className='Health_Table_Strong'>{formatTemp(temperatureDay.nightAvg)}</span>
    <span>{formatTemp(temperatureDay.avgTemp)}</span>
    <span className='Health_Table_Optional'>{formatTemp(temperatureDay.minTemp)}</span>
    <span className='Health_Table_Optional'>{formatTemp(temperatureDay.maxTemp)}</span>
    <span className='Health_Table_Optional'>{`${(temperatureDay.maxTemp - temperatureDay.minTemp).toFixed(1)} °C`}</span>
    <span>{temperatureDay.samples}</span>
    <span className='Health_Table_Bar'>
      <Skin_Range_Bar ranges={temperatureDay.ranges} />
    </span>
  </button>
);

export default Skin_Day_Row;
