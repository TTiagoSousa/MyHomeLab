interface StirlingPdfProps {
  color?: string;
}

const StirlingPdf = ({ color = '#8E3131' }: StirlingPdfProps) => (
  <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <rect width="512" height="512" rx="80" ry="80" fill={color} />
    <path d="M202 268L432 78V255L202 445V268Z" fill="#FFFFFF" fillOpacity="0.6" />
    <path d="M79 256L309 66V242L79 432V256Z" fill="#FFFFFF" />
  </svg>
);

export default StirlingPdf;
