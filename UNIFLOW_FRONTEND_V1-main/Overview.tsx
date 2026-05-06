import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import { useTasks } from '../hooks/useTasks';
import { usePlans } from '../contexts/PlanContext';
import BottomNavigation from '../components/BottomNavigation';
import type { Task } from '../api/services';
import BackButton from '../components/BackButton';
import './Overview.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActivityType = 'task' | 'event' | 'plan';

interface Activity {
  id: string;
  title: string;
  subtitle?: string;   // time range, e.g. "8:00 - 10:00"
  duration?: string;   // e.g. "2hrs"
  completed: boolean;
  type: ActivityType;
  sourceId?: string;   // planId for plan-targets
  subtype?: 'target' | 'task'; // to know which toggle function to call
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(dateString: string | undefined): boolean {
  if (!dateString) return false;
  const target = new Date(dateString);
  const today = new Date();
  return (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate()
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function navigateDays(date: Date, delta: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function isDateToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const Overview: React.FC = () => {
  const history = useHistory();
  const { tasks: backendTasks, loading: tasksLoading } = useTasks();
  const { plans } = usePlans();

  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<Array<{ id: string; title: string; time: string; duration?: string; date: string; completed?: boolean }>>(() => {
    try {
      const raw = localStorage.getItem('uniflow_events');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [cachedTasks, setCachedTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem('uniflow_tasks');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Load events from localStorage (same storage as Home.tsx)
  const loadEvents = useCallback(() => {
    try {
      const raw = localStorage.getItem('uniflow_events');
      if (raw) setEvents(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  const loadCachedTasks = useCallback(() => {
    try {
      const raw = localStorage.getItem('uniflow_tasks');
      setCachedTasks(raw ? JSON.parse(raw) : []);
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    loadEvents();
    loadCachedTasks();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'uniflow_events') loadEvents();
      if (e.key === 'uniflow_tasks') loadCachedTasks();
    };
    const onEventsUpdated = () => loadEvents();
    const onTasksUpdated = () => loadCachedTasks();
    window.addEventListener('storage', onStorage);
    window.addEventListener('uniflow_events_updated', onEventsUpdated);
    window.addEventListener('uniflow_tasks_updated', onTasksUpdated);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('uniflow_events_updated', onEventsUpdated);
      window.removeEventListener('uniflow_tasks_updated', onTasksUpdated);
    };
  }, [loadCachedTasks, loadEvents]);

  const activityTasks = tasksLoading && cachedTasks.length > 0
    ? cachedTasks
    : (backendTasks.length > 0 ? backendTasks : cachedTasks);

  // ── Derive activities for viewDate ─────────────────────────────────────────

  const viewDateStr = viewDate.toLocaleDateString(); // matches event.date format
  const isToday = isDateToday(viewDate);

  const taskActivities = useMemo<Activity[]>(() => {
    if (!isToday) return [];
    return activityTasks
      .filter(t => isSameDay(t.dueDate || t.createdAt))
      .map(t => {
        let timeStr = '';
        const dateRaw = t.dueDate || t.createdAt;
        if (dateRaw) {
          const d = new Date(dateRaw);
          timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return {
          id: t.id,
          title: t.title,
          subtitle: timeStr,
          duration: t.description,
          completed: t.status === 'completed',
          type: 'task' as ActivityType,
        };
      });
  }, [activityTasks, isToday]);

  const eventActivities = useMemo<Activity[]>(() => {
    return events
      .filter(e => {
        if (e.date === viewDate.toLocaleDateString()) return true;

        let eDate = new Date(e.date);
        if (isNaN(eDate.getTime()) && e.date.includes('/')) {
          const parts = e.date.split('/');
          if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]);
            const y = parseInt(parts[2]);
            if (m <= 12 && d <= 31) {
              eDate = new Date(y, m - 1, d);
            }
          }
        }
        if (isNaN(eDate.getTime())) return false;
        
        return eDate.getDate() === viewDate.getDate() &&
               eDate.getMonth() === viewDate.getMonth() &&
               eDate.getFullYear() === viewDate.getFullYear();
      })
      .map(e => ({
        id: e.id,
        title: e.title,
        subtitle: e.time,
        duration: e.duration,
        completed: !!e.completed,
        type: 'event' as ActivityType,
      }));
  }, [events, viewDate]);

  const planActivities = useMemo<Activity[]>(() => {
    if (!isToday) return [];
    return plans.flatMap(plan => {
      const targetRoutines = plan.targets
        .filter(t => t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily')
        .map(t => ({ ...t, subtype: 'target' as const }));
      
      const taskRoutines = plan.tasks
        .filter(t => t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily')
        .map(t => ({ ...t, subtype: 'task' as const }));

      return [...targetRoutines, ...taskRoutines].map(item => ({
        id: item.id,
        title: item.title,
        completed: item.completed,
        type: 'plan' as ActivityType,
        subtype: item.subtype,
        sourceId: plan.id,
      }));
    });
  }, [plans, isToday]);

  const allActivities = useMemo(() => [
    ...taskActivities,
    ...eventActivities,
    ...planActivities,
  ], [taskActivities, eventActivities, planActivities]);

  // ── Progress ────────────────────────────────────────────────────────────────

  const total = allActivities.length;
  const completed = allActivities.filter(a => a.completed).length;
  const progressPercent = total === 0 ? 0 : Math.round((completed / total) * 100);

  // SVG ring
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (progressPercent / 100) * circumference;

  const handleOpenActivity = useCallback((activity: Activity) => {
    if (activity.type === 'task') {
      history.push('/home', { scrollToTaskId: activity.id });
      return;
    }
    if (activity.type === 'event') {
      history.push('/home', { openCalendarForEventId: activity.id });
      return;
    }
    if (activity.type === 'plan' && activity.sourceId) {
      const tab = activity.subtype === 'target' ? 'goals' : 'tasks';
      history.push(`/plans/${activity.sourceId}`, { focusPlanItemId: activity.id, focusPlanTab: tab });
    }
  }, [history]);

  // ── Render ──────────────────────────────────────────────────────────────────

  const renderSection = (label: string, items: Activity[], icon: React.ReactNode) => {
    if (items.length === 0) return null;
    return (
      <div className="ov-section">
        <div className="ov-section-label">
          {icon}
          <span>{label}</span>
        </div>
        <div className="ov-cards">
          {items.map(activity => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onOpen={handleOpenActivity}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ov-screen">
        {/* Status Bar Spacer */}
        <div className="ov-status-bar" />

        {/* Header */}
        <div className="ov-header">
          <BackButton />
          <h1 className="ov-title">Overview</h1>
          <div className="ov-date-nav">
            <button className="ov-nav-btn" onClick={() => setViewDate(d => navigateDays(d, -1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button className="ov-today-btn" onClick={() => setViewDate(new Date())}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1" />
              </svg>
              {isToday ? 'Today' : formatDate(viewDate)}
            </button>
            <button className="ov-nav-btn" onClick={() => setViewDate(d => navigateDays(d, 1))}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Progress Banner */}
        <div className="ov-banner">
          <div className="ov-banner-text">
            <h2 className="ov-banner-count">
              {total === 0
                ? 'No activities'
                : `${total} ${total === 1 ? 'Activity' : 'Activities'} for the day`}
            </h2>
            {total > 0 && (
              <>
                <p className="ov-banner-sub">Complete every mission to move<br />one step closer to your goals</p>
                <span className="ov-banner-fraction">{completed}/{total}</span>
              </>
            )}
          </div>
          {total > 0 && (
            <div className="ov-ring-wrap">
              <svg className="ov-ring" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r={radius}
                  fill="none"
                  stroke="rgba(68,112,85,0.15)"
                  strokeWidth="8"
                />
                <circle
                  cx="50" cy="50" r={radius}
                  fill="none"
                  stroke="url(#ringGradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  style={{ transition: 'stroke-dashoffset 0.6s ease', transformOrigin: 'center', transform: 'rotate(-90deg)' }}
                />
                <defs>
                  <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#4CAF50" />
                    <stop offset="100%" stopColor="#81C784" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="ov-ring-label">
                <span className="ov-ring-day">Today</span>
                <span className="ov-ring-pct">{progressPercent}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity List */}
        <div className="ov-body">
          {total === 0 ? (
            <div className="ov-empty">
              <div className="ov-empty-icon">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="ov-empty-title">No activities for the day</p>
              <p className="ov-empty-sub">Add tasks, events or plan targets to see them here</p>
            </div>
          ) : (
            <>
              {renderSection(
                "Today's tasks",
                taskActivities,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              )}
              {renderSection(
                'Events',
                eventActivities,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              )}
              {renderSection(
                'Plans',
                planActivities,
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              )}
            </>
          )}
        </div>

        <div className="ov-bottom-space" />
        <BottomNavigation />
      </IonContent>
    </IonPage>
  );
};

// ─── Activity Card ─────────────────────────────────────────────────────────────

interface CardProps {
  activity: Activity;
  onOpen: (a: Activity) => void;
}

const ActivityCard: React.FC<CardProps> = ({ activity, onOpen }) => {
  const { completed, title, subtitle, duration, type } = activity;

  const typeIcon = (() => {
    if (type === 'task') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M14,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V10L14,3M5,19V5H13V11H19V19H5Z" />
      </svg>
    );
    if (type === 'event') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1" />
      </svg>
    );
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3,3H21V5H3V3M3,7H15V9H3V7M3,11H21V13H3V11M3,15H15V17H3V15M3,19H21V21H3V19Z" />
      </svg>
    );
  })();

  return (
    <div
      className={`ov-card ${completed ? 'ov-card--done' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(activity)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(activity);
        }
      }}
    >
      {/* Checkbox (Read-only) */}
      <div
        className={`ov-checkbox ${completed ? 'ov-checkbox--checked' : ''}`}
      >
        {completed && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="ov-card-content">
        <div className="ov-card-top">
          <span className="ov-card-type-icon">{typeIcon}</span>
          <span className={`ov-card-title ${completed ? 'ov-card-title--done' : ''}`}>{title}</span>
        </div>
        {(subtitle || duration) && (
          <div className="ov-card-meta">
            {subtitle && (
              <span className="ov-card-meta-item">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                  <path d="M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z" />
                </svg>
                {subtitle}
              </span>
            )}
            {duration && <span className="ov-card-bullet">•</span>}
            {duration && <span className="ov-card-duration">{duration}</span>}
          </div>
        )}
        {/* Progress bar */}
        <div className="ov-card-bar">
          <div className={`ov-card-bar-fill ${completed ? 'ov-card-bar-fill--done' : ''}`} />
        </div>
      </div>
    </div>
  );
};

export default Overview;
