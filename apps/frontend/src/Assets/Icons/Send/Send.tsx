interface SendProps {
  color?: string;
}

const Send = ({ color = 'currentColor' }: SendProps) => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <path
      d="M21 3L11 13"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M21 3L14.5 21C14.4459 21.1338 14.3527 21.2483 14.2325 21.3287C14.1122 21.4091 13.9705 21.4517 13.8256 21.4511C13.6807 21.4505 13.5394 21.4066 13.4198 21.325C13.3002 21.2434 13.208 21.1279 13.155 20.9933L10 13L2.0067 9.845C1.87213 9.79203 1.75656 9.69976 1.67497 9.58019C1.59338 9.46062 1.5495 9.31932 1.5489 9.17441C1.5483 9.02951 1.5909 8.88784 1.6715 8.76759C1.7521 8.64734 1.8669 8.55414 2.0007 8.5L20 3"
      stroke={color}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default Send;
