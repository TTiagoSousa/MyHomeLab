import { useTranslation } from 'react-i18next';
import Global_Dropdown from '../../../../Components/Inputs/Global_Dropdown/Global_Dropdown';
import type { MeasurementDevice } from '../../../../Hooks/Health/healthTypes';

export const NO_DEVICE = 'none';

interface Health_Device_Field_Props {
  id: string;
  devices: MeasurementDevice[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const Health_Device_Field = ({ id, devices, value, onChange, className = 'Health_Form_Field' }: Health_Device_Field_Props) => {
  const { t } = useTranslation('health');

  return (
    <div className={className}>
      <label htmlFor={id}>{t('devices.device')}</label>
      <Global_Dropdown
        id={id}
        value={value}
        onChange={onChange}
        options={[
          { value: NO_DEVICE, label: t('devices.none') },
          ...devices.map((device) => ({ value: device.id, label: device.name })),
        ]}
      />
    </div>
  );
};

export default Health_Device_Field;
