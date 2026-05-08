import { IonContent, IonPage, IonButton } from '@ionic/react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BottomNavigation from '../components/BottomNavigation';
import GlassyTimePicker from '../components/GlassyTimePicker';
import { useTasks } from '../hooks/useTasks';
import { useEvents } from '../hooks/useEvents';
import { useStreak, readLongestStreak } from '../hooks/useStreak';
import { useProductivityScore } from '../hooks/useProductivityScore';
import { useProfile } from '../hooks/useProfile';
import { useTranslation } from 'react-i18next';
import { getCurrentWeekFocusSessions } from '../utils/focusSessionAnalytics';
import { NotificationService } from '../services/NotificationService';
import './Home.css';

type HomeLocationState = {
  scrollToTaskId?: string;
  openCalendarForEventId?: string;
};

const Home: React.FC = () => {
  const history = useHistory();
  const location = useLocation<HomeLocationState>();
  const { user, logoutWithConfirmation, refreshUser } = useAuth();
  const streak = useStreak({ trackActivity: false });
  const productivityScore = useProductivityScore();
  const { profile } = useProfile();
  const showStreak = profile?.preferences?.streakCount ?? true;
  const { t } = useTranslation();

  // Refresh user data on component mount if needed
  useEffect(() => {
    const checkAndRefreshUser = async () => {
      const token = localStorage.getItem('uniflow_token');
      const storedUser = localStorage.getItem('uniflow_user');

      console.log('Home: Checking user state...');
      console.log('Home: Token exists:', !!token);
      console.log('Home: Stored user exists:', !!storedUser);
      console.log('Home: Current user state:', !!user);

      // If we have both token and user data but no user in state, don't call refreshUser
      // The AuthContext should handle this automatically via localStorage listener
      if (token && storedUser && !user) {
        console.log('Home: User data exists in localStorage, AuthContext should handle this automatically');
        // Don't call refreshUser here as it might cause unnecessary API calls
        // The AuthContext localStorage listener will handle setting the user
        return;
      }

      // Only refresh from API if we have a token but no user data at all
      if (token && !storedUser && !user) {
        console.log('Home: Refreshing user from API...');
        try {
          await refreshUser();
        } catch (error) {
          console.error('Home: Failed to refresh user from API:', error);
          // Don't logout on API failure, just log the error
        }
      }
    };

    checkAndRefreshUser();
  }, [user, refreshUser]);

  // Backend task integration
  const {
    tasks: backendTasks,
    loading: tasksLoading,
    error: tasksError,
    createTask: createBackendTask,
    updateTask: updateBackendTask,
    deleteTask: deleteBackendTask,
    clearAllTasks: clearAllBackendTasks,
    toggleTaskStatus: toggleBackendTaskStatus
  } = useTasks();
  const {
    events,
    createEvent: createBackendEvent,
    deleteEvent: deleteBackendEvent,
  } = useEvents();

  // UI Enhancement states
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [todayClassesCount, setTodayClassesCount] = useState<number>(0);

  // Calendar states
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventTime, setEventTime] = useState('');

  const [currentMonth, setCurrentMonth] = useState(new Date());
  // Task states
  const [showTaskPopup, setShowTaskPopup] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskTime, setTaskTime] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showStreakSummary, setShowStreakSummary] = useState(false);

  // Refs
  const tasksSectionRef = useRef<HTMLDivElement | null>(null);

  // Long press states for task actions
  const [longPressedTaskId, setLongPressedTaskId] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const [appPrefsTick, setAppPrefsTick] = useState(0);
  useEffect(() => {
    const onPrefs = () => setAppPrefsTick((n) => n + 1);
    window.addEventListener('uniflow_app_preferences_updated', onPrefs);
    return () => window.removeEventListener('uniflow_app_preferences_updated', onPrefs);
  }, []);

  const getStartOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const parseEventDate = (dateString: string) => {
    let parsedDate = new Date(dateString);

    if (isNaN(parsedDate.getTime()) && dateString.includes('/')) {
      const parts = dateString.split('/');
      if (parts.length === 3) {
        const first = parseInt(parts[0], 10);
        const second = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        if (Number.isFinite(first) && Number.isFinite(second) && Number.isFinite(year)) {
          parsedDate = new Date(year, second - 1, first);
        }
      }
    }

    return isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
  };

  const isPastCalendarDate = (date: Date) => getStartOfDay(date).getTime() < getStartOfDay(new Date()).getTime();
  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  useEffect(() => {
    const state = location.state as HomeLocationState | null;
    if (!state?.scrollToTaskId && !state?.openCalendarForEventId) return;

    if (state.scrollToTaskId) {
      const taskId = state.scrollToTaskId;
      history.replace('/home', {});
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          const el = document.querySelector(`[data-task-id="${taskId}"]`);
          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el?.classList.add('home-task-highlight');
          window.setTimeout(() => el?.classList.remove('home-task-highlight'), 2200);
        }, 80);
      });
      return;
    }

    if (state.openCalendarForEventId) {
      const eventId = state.openCalendarForEventId;

      const tryResolveEvent = (): { date: string } | undefined => {
        const fromState = events.find((e) => e.id === eventId);
        if (fromState) return fromState;
        try {
          const raw = localStorage.getItem('uniflow_events');
          const parsed = raw ? JSON.parse(raw) : [];
          return Array.isArray(parsed) ? parsed.find((e: { id: string }) => e.id === eventId) : undefined;
        } catch {
          return undefined;
        }
      };

      const openForEvent = (ev: { date: string }) => {
        const eventDate = parseEventDate(ev.date);
        setSelectedDate(eventDate);
        setCurrentMonth(eventDate);
        setShowEventModal(true);
      };

      const ev = tryResolveEvent();
      if (ev) {
        history.replace('/home', {});
        openForEvent(ev);
        return;
      }

      const t = window.setTimeout(() => {
        const evRetry = tryResolveEvent();
        history.replace('/home', {});
        if (evRetry) openForEvent(evRetry);
      }, 600);
      return () => window.clearTimeout(t);
    }
  }, [location.state, history, events]);


  // Calendar functions
  const handleAddEvent = () => {
    setSelectedDate(new Date());
    setShowEventModal(true);
  };

  const handleDateClick = (date: Date) => {
    if (isPastCalendarDate(date)) {
      return;
    }
    setSelectedDate(date);
    setShowEventModal(true);
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      await deleteBackendEvent(eventId);
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  // Sort upcoming events by date and get the closest 2
  const sortedEvents = useMemo(() => {
    return [...events]
      .map((event) => ({
        ...event,
        parsedDate: parseEventDate(event.date)
      }))
      .filter((event) => !isPastCalendarDate(event.parsedDate))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
  }, [events]);

  const closestEvents = sortedEvents.slice(0, 2);
  const remainingEvents = sortedEvents.slice(2);

  const mostUrgentEvent = useMemo(() => {
    if (sortedEvents.length === 0) return null;
    return sortedEvents[0];
  }, [sortedEvents]);

  const handleDateSelect = (date: Date) => {
    if (isPastCalendarDate(date)) {
      return;
    }
    setSelectedDate(date);
  };

  // Handle View button click to navigate to calendar with specific event
  const handleViewEvent = () => {
    if (mostUrgentEvent) {
      // Use parsed date if available, otherwise parse the original date
      const eventDate = mostUrgentEvent.parsedDate || new Date(mostUrgentEvent.date);
      setSelectedDate(eventDate);
      setCurrentMonth(eventDate);
      setShowEventModal(true);
    }
  };

  // UI Enhancement functions
  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return t('greeting_morning');
    if (hour < 17) return t('greeting_afternoon');
    return t('greeting_evening');
  };

  const getCurrentTimeString = () => {
    return currentTime.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getLastRefreshString = () => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastRefresh.getTime()) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setLastRefresh(new Date());
    // Simulate refresh
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
  };

  const handleWeeklyScheduleClick = () => {
    console.log('Home: Weekly Schedule clicked');
    console.log('Current location:', window.location.pathname);

    // Remove focus from any focused element before navigation
    const focusedElement = document.activeElement as HTMLElement;
    if (focusedElement) {
      focusedElement.blur();
    }

    // Try React Router first, then fallback to window.location
    try {
      history.push('/weekly-schedule');
      console.log('Home: React Router navigation attempted');
    } catch (error) {
      console.error('Home: React Router failed, using window.location:', error);
      window.location.href = '/weekly-schedule';
    }
  };

  const isSameDay = (dateString: string | undefined) => {
    if (!dateString) return false;
    const target = new Date(dateString);
    const today = new Date();
    return (
      target.getFullYear() === today.getFullYear() &&
      target.getMonth() === today.getMonth() &&
      target.getDate() === today.getDate()
    );
  };

  const todayTasks = useMemo(() => {
    return backendTasks.filter((task) =>
      isSameDay(task.dueDate || task.createdAt)
    );
  }, [backendTasks]);

  const completedTodayCount = useMemo(() => {
    return todayTasks.filter(
      (task) => task.status === 'completed'
    ).length;
  }, [todayTasks]);

  const todayEvents = useMemo(() => {
    return events.filter((event) => {
      const eventDate = parseEventDate(event.date);
      const today = new Date();

      return (
        eventDate.getFullYear() === today.getFullYear() &&
        eventDate.getMonth() === today.getMonth() &&
        eventDate.getDate() === today.getDate()
      );
    });
  }, [events]);

  const completedTodayEventsCount = useMemo(() => {
    return todayEvents.filter((event) => !!(event as any).completed).length;
  }, [todayEvents]);

  const totalTodayActivityCount = todayTasks.length + todayEvents.length;
  const completedTodayActivityCount = completedTodayCount + completedTodayEventsCount;

  const weeklyFocusMinutes = useMemo(() => {
    return getCurrentWeekFocusSessions().reduce((sum, session) => sum + session.minutesRead, 0);
  }, [currentTime, appPrefsTick]);

  const streakSummaryStats = useMemo(() => {
    const lastStreakDateRaw = localStorage.getItem('uniflow_streak_date');
    let lastLabel = '—';
    if (lastStreakDateRaw) {
      try {
        const d = new Date(`${lastStreakDateRaw}T12:00:00`);
        if (!Number.isNaN(d.getTime())) {
          lastLabel = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
        }
      } catch {
        /* noop */
      }
    }
    return {
      longest: readLongestStreak(),
      lastStreakDayLabel: lastLabel,
    };
  }, [streak, currentTime]);

  useEffect(() => {
    const staleTaskIds = backendTasks
      .filter((task) => {
        const dateRaw = task.dueDate || task.createdAt;
        if (!dateRaw) return false;
        return getStartOfDay(new Date(dateRaw)).getTime() < getStartOfDay(new Date()).getTime();
      })
      .map((task) => task.id);

    if (staleTaskIds.length === 0) {
      return;
    }

    clearAllBackendTasks(staleTaskIds).catch((error) => {
      console.error('Failed to clear stale daily tasks:', error);
    });
  }, [backendTasks, clearAllBackendTasks]);

  useEffect(() => {
    if (!longPressedTaskId) {
      return;
    }

    const handleOutsidePress = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.task-item.task-actions-open') || target?.closest('.task-actions-overlay')) {
        return;
      }
      setLongPressedTaskId(null);
    };

    document.addEventListener('mousedown', handleOutsidePress);
    document.addEventListener('touchstart', handleOutsidePress);

    return () => {
      document.removeEventListener('mousedown', handleOutsidePress);
      document.removeEventListener('touchstart', handleOutsidePress);
    };
  }, [longPressedTaskId]);

  // Effects for UI enhancements
  useEffect(() => {
    // Update time every minute
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    // Compute today's classes count initially and when localStorage changes
    const computeTodayClassesCount = () => {
      try {
        const saved = localStorage.getItem('weeklySchedule');
        if (!saved) {
          setTodayClassesCount(0);
          return;
        }
        const data = JSON.parse(saved) as Record<string, string[]>;
        const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
        const todayKey = dayMap[new Date().getDay()];
        const entries = data?.[todayKey] || [];
        const count = entries.filter((v) => typeof v === 'string' && v.trim().length > 0).length;
        setTodayClassesCount(count);
      } catch (e) {
        console.error('Home: failed to compute today classes count', e);
        setTodayClassesCount(0);
      }
    };

    computeTodayClassesCount();

    const hasSeenScheduleOnboarding = localStorage.getItem('uniflow_has_seen_schedule_onboarding');
    if (!hasSeenScheduleOnboarding) {
      setTimeout(() => setShowOnboarding(true), 1000);
      // Clear legacy local storage schedule to start completely fresh
      localStorage.removeItem('weeklySchedule');
      localStorage.removeItem('weeklyScheduleVenues');
      computeTodayClassesCount();
    }

    const onStorage = (e: StorageEvent) => {
      if (e.key === 'weeklySchedule') {
        computeTodayClassesCount();
      }
    };
    const onCustomUpdate = () => computeTodayClassesCount();
    const onFocus = () => computeTodayClassesCount();
    const onVisibility = () => { if (!document.hidden) computeTodayClassesCount(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener('weeklyScheduleUpdated', onCustomUpdate as EventListener);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      clearInterval(timeInterval);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('weeklyScheduleUpdated', onCustomUpdate as EventListener);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const handleSaveEvent = () => {
    if (selectedDate && !isPastCalendarDate(selectedDate) && eventTitle && eventTime) {
      const dateIso = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate())
        .toISOString()
        .slice(0, 10);
      createBackendEvent({
          title: eventTitle,
          time: eventTime,
          date: dateIso,
          priority: 'low'
        })
        .catch((error) => {
          console.error('Failed to save event:', error);
        });

      setShowEventModal(false);
      setSelectedDate(null);
      setEventTitle('');
      setEventTime('');
    }
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setSelectedDate(null);
    setEventTitle('');
    setEventTime('');
  };

  const getMonthName = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'long' });
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameCalendarDay(parseEventDate(event.date), date));
  };


  // Task functions
  const handleAddTask = () => {
    setShowTaskPopup(true);
  };

  const handleSaveTask = async () => {
    if (taskTitle.trim() && taskTime) {
      const editingId = editingTaskId;
      const existingTask = editingId ? backendTasks.find((task) => task.id === editingId) : null;
      let finalDueDate = new Date();
      if (taskTime) {
        const [hours, minutes] = taskTime.split(':');
        finalDueDate.setHours(parseInt(hours, 10));
        finalDueDate.setMinutes(parseInt(minutes, 10));
        finalDueDate.setSeconds(0);
      }

      const taskToSave = {
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        priority: existingTask?.priority || 'low' as const,
        status: existingTask?.status || 'pending' as const,
        dueDate: finalDueDate.toISOString()
      };

      // Close modal and clear inputs immediately for better UX
      setShowTaskPopup(false);
      setTaskTitle('');
      setTaskDescription('');
      setTaskTime('');
      setEditingTaskId(null);

      try {
        if (editingId) {
          await updateBackendTask(editingId, taskToSave);
        } else {
          const newTask = await createBackendTask(taskToSave);
          if (newTask && newTask.id && finalDueDate) {
            // Generate an ID by turning string into number hash for Capacitor
            const numId = Math.abs(newTask.id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0));
            try {
              const hasPerm = await NotificationService.requestPermissions();
              if (hasPerm) NotificationService.scheduleTask(numId, taskToSave.title, finalDueDate.toISOString());
            } catch (e) { }
          }
        }
      } catch (error) {
        console.error('Failed to create task:', error);
      }
    }
  };

  const handleClearAllTasks = async () => {
    try {
      console.log('Home: Clearing all tasks using batch optimization...');
      const idsToClear = todayTasks.map(task => task.id);
      if (idsToClear.length > 0) {
        await clearAllBackendTasks(idsToClear);
      }
    } catch (error) {
      console.error('Failed to clear tasks:', error);
    }
  };

  const handleCloseTaskPopup = () => {
    setShowTaskPopup(false);
    setTaskTitle('');
    setTaskDescription('');
    setTaskTime('');
    setEditingTaskId(null);
  };

  const handleToggleTask = async (taskId: string, e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation(); // CRITICAL: Prevents parent long-press handlers from firing
    }
    try {
      await toggleBackendTaskStatus(taskId);
    } catch (error) {
      console.error('Failed to toggle task status:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteBackendTask(taskId);
      setLongPressedTaskId((current) => (current === taskId ? null : current));
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  // Long press handlers for task actions
  const handleTaskMouseDown = (taskId: string) => {
    const timer = setTimeout(() => {
      setLongPressedTaskId(taskId);
    }, 500); // 500ms long press
    setLongPressTimer(timer);
  };

  const handleTaskMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTaskMouseLeave = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleCloseTaskActions = () => {
    setLongPressedTaskId(null);
  };

  const handleEditTask = (taskId: string) => {
    const task = backendTasks.find((entry) => entry.id === taskId);
    if (!task) {
      return;
    }

    const taskDate = new Date(task.dueDate || task.createdAt);
    const hours = taskDate.getHours().toString().padStart(2, '0');
    const minutes = taskDate.getMinutes().toString().padStart(2, '0');

    setEditingTaskId(taskId);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskTime(`${hours}:${minutes}`);
    setLongPressedTaskId(null);
    setShowTaskPopup(true);
  };




  const handleTasksCompletedClick = () => {
    tasksSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };







  return (
    <IonPage>
      <IonContent fullscreen className="dashboard-screen">
        {/* Status Bar Spacer */}
        <div className="status-bar-spacer"></div>

        {/* Header Section */}
        <div className="dashboard-header">
          <div className="greeting">
            <h1>{getGreeting()},</h1>
            <h2>{user?.name || 'User'}</h2>
            <div className="time-info">
              <span className="current-time">{getCurrentTimeString()}</span>
              <span className="last-refresh">Last updated: {getLastRefreshString()}</span>
            </div>
          </div>
          <div className="header-icons">
            <button
              className={`refresh-btn ${isLoading ? 'loading' : ''}`}
              onClick={handleRefresh}
              title="Refresh dashboard"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z" />
              </svg>
            </button>
            {showStreak && (
              <button
                type="button"
                className="streak-icon"
                onClick={() => setShowStreakSummary(true)}
                aria-label="View streak summary"
              >
                <img src="/assets/icons/fire_streak.png" alt="" className="flame-icon" />
                <span>{streak}</span>
              </button>
            )}
          </div>
        </div>





        {/* Due Card - Only show if there are calendar events */}
        {mostUrgentEvent && (
          <div className="assignment-card">
            <div className="assignment-info">
              <div className="assignment-details">
                <h3 className="course-code">{mostUrgentEvent.title}</h3>
                <h4 className="assignment-title">Event</h4>
                <p className="assignment-time">{mostUrgentEvent.time}</p>
              </div>
              <div className="assignment-date">
                <div className="date-display">
                  {(() => {
                    // Use parsed date if available, otherwise parse the original date
                    const eventDate = mostUrgentEvent.parsedDate || new Date(mostUrgentEvent.date);
                    const day = eventDate.getDate();
                    const dayStr = day.toString().padStart(2, '0');
                    return dayStr.split('').map((digit, index) => (
                      <div key={index} className="date-digit">{digit}</div>
                    ));
                  })()}
                </div>
                <p className="date-text">
                  {(() => {
                    const eventDate = mostUrgentEvent.parsedDate || new Date();
                    return eventDate.toLocaleDateString('en-US', {
                      month: 'long',
                      year: 'numeric'
                    });
                  })()}
                </p>
              </div>
            </div>
            <div className="assignment-actions">
              <button className="view-btn" onClick={handleViewEvent}>View</button>
            </div>
          </div>
        )}

        {/* Metrics Grid */}
        <div className={`metrics-grid ${showOnboarding ? 'onboarding-active' : ''}`}>
          <div className={`metric-card ${showOnboarding ? 'onboarding-highlight' : ''}`} onClick={() => {
            if (showOnboarding) {
              setShowOnboarding(false);
              localStorage.setItem('uniflow_has_seen_schedule_onboarding', 'true');
            }
            console.log('Today\'s Classes card clicked!');
            console.log('About to call handleWeeklyScheduleClick');
            try {
              handleWeeklyScheduleClick();
              console.log('handleWeeklyScheduleClick completed successfully');
            } catch (error) {
              console.error('Error in handleWeeklyScheduleClick:', error);
            }
          }}>
            <div className="metric-icon">
              <img src="/assets/icons/calendar.png" alt="Calendar" />
            </div>
            <div className="metric-content">
              <h3>Today's Classes</h3>
              <p>{todayClassesCount} scheduled</p>
            </div>
            <div className="card-arrow">→</div>
          </div>
          <div className="metric-card" onClick={() => history.push('/overview')}>
            <div className="metric-icon clipboard-icon">
              <img src="/assets/icons/clipboard.png" alt="Tasks" />
            </div>
            <div className="metric-content">
              <h3>Tasks Completed</h3>
              <p>{backendTasks.filter(t => t.status === 'completed').length}/{backendTasks.length}</p>
            </div>
            <div className="card-arrow">→</div>
          </div>
          <div className="metric-card" onClick={() => history.push('/analytics')}>
            <div className="metric-icon">
              <img src="/assets/icons/books.png" alt="Analytics" />
            </div>
            <div className="metric-content">
              <h3>Analytics</h3>
              <p>{weeklyFocusMinutes > 0 ? `${weeklyFocusMinutes} mins this week` : 'No focus data yet'}</p>
            </div>
            <div className="card-arrow">→</div>
          </div>
          <div className="metric-card">
            <div className="metric-icon">
              <img src="/assets/icons/bar_chart.png" alt="Productivity" />
            </div>
            <div className="metric-content">
              <h3>Productivity Score</h3>
              <p>{productivityScore}%</p>
            </div>
          </div>
        </div>


        {/* Today's Tasks Section */}
        <div className="tasks-section-container" ref={tasksSectionRef}>
          <div className="tasks-section">
            <div className="tasks-header">
              <h3>Today's Tasks</h3>
              {todayTasks.length > 0 && (
                <button className="clear-all-btn" onClick={handleClearAllTasks}>
                  Clear All
                </button>
              )}
            </div>
            <div className="tasks-content">
              {todayTasks.length === 0 ? (
                <div className="no-tasks">
                  <p>No tasks yet</p>
                </div>
              ) : (
                <div className="task-list">
                  {todayTasks.map((task) => {
                    let timeStr = '';
                    const dateRaw = task.dueDate || task.createdAt;
                    if (dateRaw) {
                      const d = new Date(dateRaw);
                      timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }

                    return (
                      <div
                        key={task.id}
                        data-task-id={task.id}
                        className={`task-item ${task.status === 'completed' ? 'completed' : ''} ${longPressedTaskId === task.id ? 'task-actions-open' : ''}`}
                        onMouseDown={() => handleTaskMouseDown(task.id)}
                        onMouseUp={handleTaskMouseUp}
                        onMouseLeave={handleTaskMouseLeave}
                        onTouchStart={() => handleTaskMouseDown(task.id)}
                        onTouchEnd={handleTaskMouseUp}
                      >
                        <div
                          className={`task-checkbox ${task.status === 'completed' ? 'completed' : ''}`}
                          onMouseDown={(e) => e.stopPropagation()}
                          onTouchStart={(e) => e.stopPropagation()}
                          onClick={(e) => handleToggleTask(task.id, e)}
                        >
                          {task.status === 'completed' && '✓'}
                        </div>
                        <div className="task-content">
                          <span className={`task-title ${task.status === 'completed' ? 'completed' : ''}`}>{task.title}</span>
                          {task.description && (
                            <div className="task-meta-row">
                              <span className="task-description">{task.description}</span>
                            </div>
                          )}
                        </div>

                        {timeStr && (
                          <div className="task-time-badge">
                            <span className="task-time">
                              {timeStr}
                            </span>
                          </div>
                        )}


                        {/* Long press action buttons */}
                        {longPressedTaskId === task.id && (
                          <div
                            className="task-actions-overlay"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onTouchStart={(e) => e.stopPropagation()}
                          >
                            <button
                              className="task-action-btn edit-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTask(task.id);
                              }}
                              title="Rename task"
                            >
                              <svg key="edit-pencil-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#ffffff" stroke="none" style={{ minWidth: '20px', display: 'block', stroke: 'none' }}>
                                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                              </svg>
                            </button>
                            <button
                              className="task-action-btn delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              title="Delete task"
                            >
                              <span>Delete</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              <button type="button" className="add-task-button" onClick={handleAddTask} aria-label="Add task">+</button>
            </div>
          </div>
        </div>

        {/* Calendar Section */}
        <div className="calendar-section-container">
          <div className="section-card calendar-section">
            <div className="section-header">
              <div className="section-title">
                <img src="/assets/icons/icons2/calendar_icon.svg" alt="Calendar" className="section-icon" />
                <h3>Calendar</h3>
              </div>
              <div className="section-options">
              </div>
            </div>
            <div className="section-content">
              {/* Upcoming Events */}
              {sortedEvents.length > 0 && (
                <div className="upcoming-events">
                  <h4>Upcoming Events</h4>
                  <div className="events-list">
                    {sortedEvents.slice(0, 3).map((event) => (
                      <div key={event.id} className="event-item">

                        <div className="event-details">
                          <h5>{event.title}</h5>
                          <p>{event.date} at {event.time}</p>
                        </div>
                        <button
                          className="delete-event-btn"
                          onClick={() => handleDeleteEvent(event.id)}
                          title="Delete event"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Open Calendar Button */}
              <button className="open-calendar-btn" onClick={handleAddEvent}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1" />
                </svg>
                Open Calendar
              </button>
            </div>
          </div>
        </div>

        {/* Bottom spacer div */}
        <div className="bottom-spacer"></div>

        {/* Spacer div to fix scrolling issue */}
        <div className="scroll-spacer"></div>

        {/* Bottom Navigation */}
        <BottomNavigation />



        {/* Task Popup */}
        {showTaskPopup && (
          <div className="modern-modal-overlay">
            <div className="modern-modal-content">
              <div className="modal-header">
                <div className="modal-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
                  </svg>
                </div>
                <h2>{editingTaskId ? 'Rename Task' : 'Add New Task'}</h2>
                <p>{editingTaskId ? 'Update today\'s task details' : 'Create a new task to stay organized'}</p>
                <button className="close-btn" onClick={handleCloseTaskPopup}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                <div className="input-group">
                  <label>Task Description</label>
                  <div className="input-wrapper">
                    <textarea
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="What needs to be done?"
                      rows={3}
                      maxLength={100}
                      className="modern-textarea"
                    />
                    <div className="input-counter">
                      {taskTitle.length}/100
                    </div>
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: '16px' }}>
                  <label>Time</label>
                  <div className="input-wrapper">
                    <GlassyTimePicker
                      value={taskTime}
                      onChange={(val) => setTaskTime(val)}
                      placeholder="Select time"
                    />
                  </div>
                </div>              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={handleCloseTaskPopup}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSaveTask}
                  disabled={!taskTitle.trim() || !taskTime}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
                  </svg>
                  {editingTaskId ? 'Save Task' : 'Add Task'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showStreakSummary && (
          <div
            className="modern-modal-overlay streak-summary-overlay"
            onClick={() => setShowStreakSummary(false)}
            role="presentation"
          >
            <div
              className="modern-modal-content streak-summary-modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="streak-summary-title"
            >
              <div className="modal-header">
                <div className="modal-icon streak-summary-icon">
                  <img src="/assets/icons/fire_streak.png" alt="" width={32} height={32} />
                </div>
                <h2 id="streak-summary-title">Streak summary</h2>
                <p>Your momentum at a glance.</p>
                <button
                  type="button"
                  className="close-btn"
                  onClick={() => setShowStreakSummary(false)}
                  aria-label="Close streak summary"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              </div>

              <div className="modal-body streak-summary-body">
                <div className="streak-summary-row">
                  <span className="streak-summary-label">Current streak</span>
                  <span className="streak-summary-value">{streak} day{streak !== 1 ? 's' : ''}</span>
                </div>
                <div className="streak-summary-row">
                  <span className="streak-summary-label">Longest streak</span>
                  <span className="streak-summary-value">
                    {streakSummaryStats.longest} day{streakSummaryStats.longest !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="streak-summary-row">
                  <span className="streak-summary-label">Last streak day</span>
                  <span className="streak-summary-value">{streakSummaryStats.lastStreakDayLabel}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Calendar Modal */}
        {showEventModal && (
          <div className="modern-modal-overlay">
            <div className="calendar-modal-content">
              <div className="modal-header">
                <div className="modal-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1" />
                  </svg>
                </div>
                <h2>Calendar</h2>
                <p>Select a date and add your event</p>
                <button className="close-btn" onClick={handleCloseEventModal}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
                  </svg>
                </button>
              </div>

              <div className="modal-body">
                {/* Calendar View */}
                <div className="calendar-modal-section">
                  {/* Calendar Header */}
                  <div className="calendar-header">
                    <button className="month-nav-btn" onClick={handlePreviousMonth}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z" />
                      </svg>
                    </button>
                    <h3 className="month-year">{getMonthName(currentMonth)} {currentMonth.getFullYear()}</h3>
                    <button className="month-nav-btn" onClick={handleNextMonth}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z" />
                      </svg>
                    </button>
                  </div>

                  {/* Day Headers */}
                  <div className="calendar-day-headers">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                      <div key={day} className="day-header">{day}</div>
                    ))}
                  </div>

                  {/* Calendar Grid */}
                  <div className="calendar-grid">
                    {/* Empty cells for days before the first day of the month */}
                    {Array.from({ length: getFirstDayOfMonth(currentMonth) }, (_, i) => (
                      <div key={`empty-${i}`} className="calendar-day empty"></div>
                    ))}

                    {/* Days of the month */}
                    {Array.from({ length: getDaysInMonth(currentMonth) }, (_, i) => {
                      const day = i + 1;
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                      const isToday = date.toDateString() === new Date().toDateString();
                      const isPast = isPastCalendarDate(date);
                      const dayEvents = getEventsForDate(date);
                      const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

                      return (
                        <div
                          key={day}
                          className={`calendar-day ${isToday ? 'today' : ''} ${isPast ? 'past' : ''} ${dayEvents.length > 0 ? 'has-events' : ''} ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            if (!isPast) {
                              handleDateClick(date);
                            }
                          }}
                        >
                          <span className="day-number">{day}</span>
                          {dayEvents.length > 0 && (
                            <div className="event-indicators">
                              {dayEvents.slice(0, 3).map((event: any, index: number) => (
                                <div
                                  key={event.id}
                                  className={`event-dot ${event.priority}-priority`}
                                  title={event.title}
                                />
                              ))}
                              {dayEvents.length > 3 && (
                                <div className="more-events">+{dayEvents.length - 3}</div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Event Form */}
                {selectedDate && (
                  <div className="event-form-section">
                    <h4>Add Event for {selectedDate.toLocaleDateString()}</h4>

                    <div className="input-group">
                      <label>Event Title</label>
                      <input
                        type="text"
                        placeholder="What's the event about?"
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        className="modern-input"
                        maxLength={100}
                      />
                      <div className="input-counter">
                        {eventTitle.length}/100
                      </div>
                    </div>

                    <div className="input-group">
                      <label>Time</label>
                      <GlassyTimePicker
                        value={eventTime}
                        onChange={(val) => setEventTime(val)}
                        placeholder="Select time"
                      />
                    </div>


                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button
                  className="btn-secondary"
                  onClick={handleCloseEventModal}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary"
                  onClick={handleSaveEvent}
                  disabled={!eventTitle.trim() || !selectedDate || !eventTime}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z" />
                  </svg>
                  Save Event
                </button>
              </div>
            </div>
          </div>
        )}
        {showOnboarding && (
          <div className="home-onboarding-overlay" onClick={() => {
            setShowOnboarding(false);
            localStorage.setItem('uniflow_has_seen_schedule_onboarding', 'true');
          }}>
            <svg className="home-onboarding-arrow" width="80" height="80" viewBox="0 0 100 100" fill="none" stroke="white" strokeWidth="4">
              <path d="M20,80 Q50,40 20,20" strokeLinecap="round" fill="none" />
              <path d="M10,40 L20,20 L40,30" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            <div className="home-onboarding-text">
              <h3>Set up your schedule!</h3>
              <p>Click here to fill out your weekly classes. We'll automatically create course folders for you!</p>
              <span className="onboarding-dismiss">Tap anywhere to dismiss</span>
            </div>
          </div>
        )}

      </IonContent>
    </IonPage>
  );
};

export default Home;
