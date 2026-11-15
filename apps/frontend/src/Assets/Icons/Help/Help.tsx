interface HelpProps {
  color?: string;
}

const Help = ({ color = 'currentColor' }: HelpProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth="1.5" />
    <path
      d="M9.75 9.5a2.25 2.25 0 1 1 3.2 2.04c-.6.28-.95.86-.95 1.52V13.5"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <circle cx="12" cy="16.25" r="0.9" fill={color} />
  </svg>
);

export default Help;
