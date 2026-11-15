interface HouseProps {
  color?: string;
}

const House = ({ color = 'currentColor' }: HouseProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M3.5 11 12 4l8.5 7" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 9.5V20h13V9.5" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="12" cy="13.5" r="1.6" stroke={color} strokeWidth="1.5" />
    <path d="M12 15.1V20M9.5 17.5 12 16.2l2.5 1.3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default House;
