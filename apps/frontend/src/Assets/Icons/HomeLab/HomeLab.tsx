interface HomeLabProps {
    color?: string;
  }
  
  const HomeLab = ({ color = 'currentColor' }: HomeLabProps) => (
        <svg data-dc-tpl="11" width="26" height="26" viewBox="0 0 24 24" fill={color} stroke={color} stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" data-om-id="de6cf6c7:16">
            <rect data-dc-tpl="12" x="3" y="3" width="7" height="7" rx="1.4" data-om-id="de6cf6c7:17" fill={color}></rect>
            <rect data-dc-tpl="13" x="14" y="3" width="7" height="7" rx="1.4" data-om-id="de6cf6c7:18" fill={color}></rect>
            <rect data-dc-tpl="14" x="3" y="14" width="7" height="7" rx="1.4" data-om-id="de6cf6c7:19" fill={color}></rect>
            <rect data-dc-tpl="15" x="14" y="14" width="7" height="7" rx="1.4" data-om-id="de6cf6c7:20" fill={color}></rect>
        </svg>
  );
  
  export default HomeLab;
  