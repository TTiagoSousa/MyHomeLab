import { useEffect, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Intermediate_Pages from '../Imports/intermediaryPages';
import { useAuth } from '../Contexts/Auth_Context';

interface AuthenticationCheckProps {
  children: ReactNode;
}

const AuthenticationCheck = ({ children }: AuthenticationCheckProps) => {
  const { authenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isLoading && !authenticated) {
      navigate(`/?from=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
    }
  }, [isLoading, authenticated, navigate]);

  if (isLoading) {
    return <Intermediate_Pages.Loading_Page />;
  }

  return authenticated ? <>{children}</> : null;
};

export default AuthenticationCheck;