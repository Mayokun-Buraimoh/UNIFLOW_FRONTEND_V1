import React, { useEffect } from 'react';
import { Route, RouteProps, useHistory, useLocation, matchPath } from 'react-router-dom';
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
    // Only redirect if we are not loading, not authenticated, and this route actually matches.
    // Using matchPath handles dynamic routes like /course/:id and /note/:id.
    const routePath = typeof rest.path === 'string' ? rest.path : '';
    const isRouteActive = routePath
      ? Boolean(matchPath(location.pathname, { path: routePath, exact: Boolean(rest.exact) }))
      : false;

    if (!loading && !isAuthenticated && isRouteActive) {
      history.replace({
        pathname: "/signup",
        state: { from: location }
      });
    }
  }, [loading, isAuthenticated, location, location.pathname, rest.exact, rest.path, history]);

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
