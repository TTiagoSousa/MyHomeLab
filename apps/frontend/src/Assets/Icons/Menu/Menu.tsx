interface MenuProps {
  color?: string;
}

const Menu = ({ color = 'currentColor' }: MenuProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M4 7H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 12H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M4 17H20" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export default Menu;
