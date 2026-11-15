import { Navigate, useLocation, useParams } from 'react-router-dom';

const Legacy_Board_Redirect = () => {
  const { taskId } = useParams();
  const location = useLocation();
  return <Navigate to={`/MyHomeLab/Projects${taskId ? `/${taskId}` : ''}${location.search}`} replace />;
};

export default Legacy_Board_Redirect;
