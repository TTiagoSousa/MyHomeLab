interface ClockProps {
  color?: string;
}

const Clock = ({ color = 'currentColor' }: ClockProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="12" cy="12" r="8.25" stroke={color} strokeWidth="1.5" />
    <path d="M12 7.5V12l3 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default Clock;
