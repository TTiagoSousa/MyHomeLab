interface NextcloudProps {
  color?: string;
}

const Nextcloud = ({ color = '#0082C9' }: NextcloudProps) => (
  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <g fill="none" stroke={color} strokeWidth="2.2">
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="3.6" cy="12" r="2.3" />
      <circle cx="20.4" cy="12" r="2.3" />
    </g>
  </svg>
);

export default Nextcloud;
