interface GoogleDriveProps {
  color?: string;
}

const GoogleDrive = ({ color = '#1FA463' }: GoogleDriveProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path d="M8.2 3h7.6l6.7 11.6-3.8 6.4H5.3L1.5 14.6 8.2 3Z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M8.2 3l3.8 6.6M15.8 3 8.6 15.4M1.5 14.6h13.4M18.7 21l-3.8-6.4" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

export default GoogleDrive;
