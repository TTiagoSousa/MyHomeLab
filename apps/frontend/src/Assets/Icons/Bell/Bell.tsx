interface BellProps {
  color?: string;
}

const Bell = ({ color = 'currentColor' }: BellProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path
      d="M6 10a6 6 0 1 1 12 0v3.5l1.5 2.5h-15L6 13.5V10Z"
      stroke={color}
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
    <path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Bell;
