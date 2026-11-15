import { useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.scss';

interface Tooltip_Props {
  text: ReactNode;
  children: ReactNode;
}

const Tooltip = ({ text, children }: Tooltip_Props) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  const show = () => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (rect) setPosition({ left: rect.left + rect.width / 2, top: rect.top });
  };
  const hide = () => setPosition(null);

  return (
    <>
      <span
        className='Tooltip_Anchor'
        ref={anchorRef}
        tabIndex={0}
        aria-label={typeof text === 'string' ? text : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {position &&
        createPortal(
          <span className='Tooltip_Bubble' role='tooltip' style={{ left: position.left, top: position.top }}>
            {text}
          </span>,
          document.body,
        )}
    </>
  );
};

export default Tooltip;
