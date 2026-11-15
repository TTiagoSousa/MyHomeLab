import './Global_Input.scss';

interface Global_Input_Props {
  id?: string;
  type?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  autoComplete?: string;
  list?: string;
  min?: string;
  max?: string;
}

const Global_Input = ({
  id,
  type = 'text',
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  maxLength,
  disabled,
  autoComplete,
  list,
  min,
  max,
}: Global_Input_Props) => {
  return (
    <div className='Global_Input'>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoComplete={autoComplete}
        list={list}
        min={min}
        max={max}
      />
    </div>
  );
};

export default Global_Input;
