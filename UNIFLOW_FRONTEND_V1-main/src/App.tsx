import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Splash from './pages/Splash';
import Onboarding from './pages/Onboarding';
import Onboarding2 from './pages/Onboarding2';
import SignUp from './pages/SignUp';
import Register from './pages/Register';
import Login from './pages/Login';
import Home from './pages/Home';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import NotificationPreferences from './pages/NotificationPreferences';
import Plans from './pages/Plans';
import PlanDetails from './pages/PlanDetails';
import AppPreferences from './pages/AppPreferences';
import Templates from './pages/Templates';
import Courses from './pages/Courses';
import WeeklySchedule from './pages/WeeklySchedule';
import SchoolConnection from './pages/SchoolConnection';
import Chatbot from './pages/Chatbot';
import GoogleCallback from './pages/GoogleCallback';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import CourseDetail from './pages/CourseDetail';
import NoteDetail from './pages/NoteDetail';
import Overview from './pages/Overview';
import Jotting from './pages/Jotting';
import Pricing from './pages/Pricing';
import { useStreak } from './hooks/useStreak';
import { initializeLocalFirstSync } from './localfirst/syncQueue';
const RootRoute = () => {
  const { loading } = useAuth();

  if (loading) {
    return null;
  }

  return <Redirect to="/splash" />;
};

const StreakActivityTracker = () => {
  useStreak({ trackActivity: true });
  useEffect(() => {
    initializeLocalFirstSync();
  }, []);
  return null;
};

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';

/* Basic CSS for apps built with Ionic */
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';

/* Optional CSS utils that can be commented out */
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */

/* Theme variables */
import './theme/variables.css';

/* Global transition styles */
import './theme/transitions.css';

/* Ionic global styles */
import './theme/ionic-global.css';

setupIonicReact();

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <IonApp>
        <IonReactRouter>
          <AuthProvider>
            <StreakActivityTracker />
            <SubscriptionProvider>
              <PlanProvider>
                <IonRouterOutlet>
                {/* Public Routes */}
                <Route exact path="/splash">
                  <Splash />
                </Route>
                <Route exact path="/onboarding">
                  <Onboarding />
                </Route>
                <Route exact path="/onboarding2">
                  <Onboarding2 />
                </Route>
                <Route exact path="/signup">
                  <SignUp />
                </Route>
                <Route exact path="/register">
                  <Register />
                </Route>
                <Route exact path="/login">
                  <Login />
                </Route>
                <Route exact path="/dashboard">
                  <Dashboard />
                </Route>

                {/* Google OAuth Callback - high priority */}
                <Route path="/auth/google/callback">
                  <GoogleCallback />
                </Route>

                {/* Protected Routes */}
                <ProtectedRoute exact path="/home" component={Home} />
                <ProtectedRoute exact path="/profile" component={Profile} />
                <ProtectedRoute exact path="/settings" component={Settings} />
                <ProtectedRoute exact path="/notification-preferences" component={NotificationPreferences} />
                <ProtectedRoute exact path="/app-preferences" component={AppPreferences} />
                <ProtectedRoute exact path="/plans" component={Plans} />
                <ProtectedRoute exact path="/plans/:planId" component={PlanDetails} />
                <ProtectedRoute exact path="/templates" component={Templates} />
                <ProtectedRoute exact path="/courses" component={Courses} />
                <ProtectedRoute exact path="/weekly-schedule" component={WeeklySchedule} />
                <ProtectedRoute exact path="/school-connection" component={SchoolConnection} />
                <ProtectedRoute exact path="/pricing" component={Pricing} />
                <ProtectedRoute exact path="/chatbot" component={Chatbot} />
                <ProtectedRoute exact path="/analytics" component={Analytics} />
                <ProtectedRoute exact path="/course/:id" component={CourseDetail} />
                <ProtectedRoute exact path="/note/:id?" component={NoteDetail} />
                <ProtectedRoute exact path="/overview" component={Overview} />
                <ProtectedRoute exact path="/jotting" component={Jotting} />

                {/* Default redirect */}
                <Route exact path="/">
                  <RootRoute />
                </Route>
                </IonRouterOutlet>
              </PlanProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </IonReactRouter>
      </IonApp>
    </ErrorBoundary>
  );
};

export default App;
