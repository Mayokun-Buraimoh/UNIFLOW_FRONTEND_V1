import React from 'react';
import { Route, Redirect, RouteProps } from 'react-router-dom';
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
  
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated);
  console.log('ProtectedRoute - loading:', loading);
  console.log('ProtectedRoute - path:', rest.path);

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
        console.log('ProtectedRoute render - isAuthenticated:', isAuthenticated);
        console.log('ProtectedRoute render - path:', rest.path);
        
        return isAuthenticated ? (
          <Component {...props} />
        ) : (
          <Redirect
            to={{
              pathname: "/signup",
              state: { from: props.location }
            }}
          />
        );
      }}
    />
  );
};

export default ProtectedRoute;
