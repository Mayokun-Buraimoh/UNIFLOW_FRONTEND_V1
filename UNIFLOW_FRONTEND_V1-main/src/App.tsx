import { Redirect, Route, useHistory, useLocation } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { PlanProvider } from './contexts/PlanContext';
import { SubscriptionProvider } from './contexts/SubscriptionContext';
import { TaskProviderGate } from './contexts/TaskContext';
import { EventProviderGate } from './contexts/EventContext';
import ErrorBoundary from './components/ErrorBoundary';
import RubyNavigationBridge from './components/RubyNavigationBridge';
import { RubyVoiceProvider } from './contexts/RubyVoiceContext';
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
import GoogleOAuthAppUrlListener from './components/GoogleOAuthAppUrlListener';
import Dashboard from './pages/Dashboard';
import Analytics from './pages/Analytics';
import CourseDetail from './pages/CourseDetail';
import NoteDetail from './pages/NoteDetail';
import Overview from './pages/Overview';
import Jotting from './pages/Jotting';
import Pricing from './pages/Pricing';
import { useStreak } from './hooks/useStreak';
import { initializeLocalFirstSync, syncNow } from './localfirst/syncQueue';
import { requestTodaysClassNotificationsSync } from './services/scheduleClassNotifications';
import { applyStatusBarStyle, type AppStatusBarStyle } from './utils/statusBar';
import { navigateBackSafely } from './utils/navigation';
import { ProductTour } from './components/ProductTour';
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
    if (!Capacitor.isNativePlatform()) return;
    const sub = CapApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void syncNow();
    });
    return () => {
      void sub.then((h) => h.remove());
    };
  }, []);
  return null;
};

const BACK_SWIPE_MIN_DX = 90;

const GlobalLeftSwipeBack = () => {
  const history = useHistory();
  const location = useLocation();

  useEffect(() => {
    if (location.pathname === '/home') return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const shouldIgnoreTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return Boolean(target.closest('ion-alert, ion-modal, .modern-modal-overlay'));
    };

    const onTouchStart = (event: TouchEvent) => {
      if (shouldIgnoreTarget(event.target)) {
        tracking = false;
        return;
      }
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const onTouchEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;

      const endX = event.changedTouches[0].clientX;
      const endY = event.changedTouches[0].clientY;
      const dx = endX - startX;
      const dy = endY - startY;

      // App rule: only right swipe (left-to-right) should trigger back.
      if (dx <= 0) return; // Ignore right-to-left swipes
      if (startX > 40) return; // Must start from the left edge of the screen (like native iOS)
      if (Math.abs(dx) < BACK_SWIPE_MIN_DX) return;
      if (Math.abs(dx) <= Math.abs(dy) * 2.0) return; // Stricter angle to prevent accidental triggers while scrolling

      navigateBackSafely(history, location.pathname, '/home');
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [history, location.pathname]);

  return null;
};

/**
 * Routes whose top-of-screen artwork is dark/video and therefore need
 * light (white) status-bar content. Every other route defaults to dark
 * content because the rest of the app is forced to a white background
 * (see theme/ionic-global.css).
 */
const LIGHT_CONTENT_PREFIXES = ['/signup', '/login', '/register', '/auth/google/callback'];

const statusBarStyleForPath = (pathname: string): AppStatusBarStyle => {
  for (const prefix of LIGHT_CONTENT_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return 'light-content';
    }
  }
  return 'dark-content';
};

/**
 * Drives the iOS / Android status-bar style from the current route on every
 * navigation. This guarantees the bar is correct after page transitions,
 * swipe-back gestures, hardware back, deep links, and bottom-tab switches —
 * without each page having to remember to set it.
 *
 * Pages may still call `useStatusBarStyle(...)` directly to override locally
 * (e.g. a temporarily dark hero image inside an otherwise light page).
 */
const StatusBarController = () => {
  const location = useLocation();

  useEffect(() => {
    void applyStatusBarStyle(statusBarStyleForPath(location.pathname));
  }, [location.pathname]);

  return null;
};

/** Native: sync “today’s classes” local notifications from weekly schedule in localStorage */
const ClassNotificationSync = () => {
  useEffect(() => {
    const sync = () => requestTodaysClassNotificationsSync();
    sync();
    window.addEventListener('weeklyScheduleUpdated', sync);
    window.addEventListener('focus', sync);
    const onVis = () => {
      if (!document.hidden) sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.removeEventListener('weeklyScheduleUpdated', sync);
      window.removeEventListener('focus', sync);
      document.removeEventListener('visibilitychange', onVis);
    };
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

setupIonicReact({
  swipeBackEnabled: false,
});

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <IonApp>
        <IonReactRouter>
          <AuthProvider>
            <RubyVoiceProvider>
            <StreakActivityTracker />
            <GoogleOAuthAppUrlListener />
            <GlobalLeftSwipeBack />
            <StatusBarController />
            <ClassNotificationSync />
            <RubyNavigationBridge />
            <SubscriptionProvider>
              <PlanProvider>
                <TaskProviderGate>
                <EventProviderGate>
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
                <ProductTour />
                </EventProviderGate>
                </TaskProviderGate>
              </PlanProvider>
            </SubscriptionProvider>
            </RubyVoiceProvider>
          </AuthProvider>
        </IonReactRouter>
      </IonApp>
    </ErrorBoundary>
  );
};

export default App;
