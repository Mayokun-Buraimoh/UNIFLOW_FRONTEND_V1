import React, { useEffect } from 'react';
import { Route, RouteProps, useHistory, useLocation } from 'react-router-dom';
import { IonSpinner } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps extends RouteProps {
  component: React.ComponentType<any>;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  component: Component,
  ...rest
}) => {
  const { isAuthenticated, loading } = useAuth();
  const history = useHistory();
  const location = useLocation();
  
  useEffect(() => {
    // Only redirect if we are not loading, not authenticated, and the exact path matches.
    // This prevents inactive tabs/pages held by IonRouterOutlet from triggering loops.
    if (!loading && !isAuthenticated && location.pathname === rest.path) {
      history.replace({
        pathname: "/signup",
        state: { from: location }
      });
    }
  }, [loading, isAuthenticated, location.pathname, rest.path, history]);

  if (loading) {
    // Show loading spinner while checking authentication
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f5f5f5'
      }}>
        <IonSpinner name="crescent" style={{ marginBottom: '20px' }} />
        <p style={{ fontSize: '16px', color: '#666' }}>Checking authentication...</p>
      </div>
    );
  }

  return (
    <Route
      {...rest}
      render={props => {
        // Return null instead of Redirect to avoid IonRouterOutlet infinite loop issues
        return isAuthenticated ? <Component {...props} /> : null;
      }}
    />
  );
};

export default ProtectedRoute;
