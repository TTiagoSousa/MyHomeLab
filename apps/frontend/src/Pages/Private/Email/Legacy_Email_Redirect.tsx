import { Navigate, useParams } from 'react-router-dom';

interface Legacy_Email_Redirect_Props {
  to: 'rules' | 'proposals';
}

const Legacy_Email_Redirect = ({ to }: Legacy_Email_Redirect_Props) => {
  const { accountId } = useParams<{ accountId: string }>();
  const target =
    to === 'rules' ? `/MyHomeLab/Apps/Gmail/Rules?account=${accountId}` : `/MyHomeLab/Apps/Gmail/${accountId}/proposals`;
  return <Navigate to={target} replace />;
};

export default Legacy_Email_Redirect;
