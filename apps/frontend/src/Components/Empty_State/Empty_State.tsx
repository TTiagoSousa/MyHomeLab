import './Empty_State.scss';

interface Empty_State_Props {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

const Empty_State = ({ title, text, actionLabel, onAction }: Empty_State_Props) => (
  <div className='Empty_State'>
    <span className='Empty_State_title'>{title}</span>
    <span>{text}</span>
    {actionLabel && onAction && (
      <button type='button' onClick={onAction}>
        {actionLabel}
      </button>
    )}
  </div>
);

export default Empty_State;
