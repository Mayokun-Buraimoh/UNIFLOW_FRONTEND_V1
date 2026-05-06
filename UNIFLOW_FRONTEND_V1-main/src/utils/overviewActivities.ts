import type { Task } from '../api/services';
import type { Plan } from '../contexts/PlanContext';

export type OverviewActivityType = 'task' | 'event' | 'plan';

export interface OverviewActivity {
  id: string;
  title: string;
  subtitle?: string;
  duration?: string;
  completed: boolean;
  type: OverviewActivityType;
  sourceId?: string;
  subtype?: 'target' | 'task';
}

export interface OverviewCalendarEvent {
  id: string;
  title: string;
  time: string;
  duration?: string;
  date: string;
  completed?: boolean;
}

export function isOverviewSameDay(dateString: string | undefined): boolean {
  if (!dateString) return false;
  const target = new Date(dateString);
  const today = new Date();
  return (
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate()
  );
}

export function isOverviewDateToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/** Same merge rule as Overview: prefer API tasks unless still loading with cache. */
export function mergeOverviewTaskSources(
  backendTasks: Task[],
  cachedTasks: Task[],
  tasksLoading: boolean
): Task[] {
  return tasksLoading && cachedTasks.length > 0
    ? cachedTasks
    : backendTasks.length > 0
      ? backendTasks
      : cachedTasks;
}

export function readOverviewEventsFromStorage(): OverviewCalendarEvent[] {
  try {
    const raw = localStorage.getItem('uniflow_events');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function readOverviewCachedTasksFromStorage(): Task[] {
  try {
    const raw = localStorage.getItem('uniflow_tasks');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function computeOverviewActivities(input: {
  activityTasks: Task[];
  events: OverviewCalendarEvent[];
  plans: Plan[];
  viewDate: Date;
}): {
  taskActivities: OverviewActivity[];
  eventActivities: OverviewActivity[];
  planActivities: OverviewActivity[];
  allActivities: OverviewActivity[];
} {
  const { activityTasks, events, plans, viewDate } = input;
  const isToday = isOverviewDateToday(viewDate);

  const taskActivities: OverviewActivity[] = !isToday
    ? []
    : activityTasks
        .filter((t) => isOverviewSameDay(t.dueDate || t.createdAt))
        .map((t) => {
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
            type: 'task' as const,
          };
        });

  const eventActivities: OverviewActivity[] = events
    .filter((e) => {
      if (e.date === viewDate.toLocaleDateString()) return true;

      let eDate = new Date(e.date);
      if (isNaN(eDate.getTime()) && e.date.includes('/')) {
        const parts = e.date.split('/');
        if (parts.length === 3) {
          const d = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          const y = parseInt(parts[2], 10);
          if (m <= 12 && d <= 31) {
            eDate = new Date(y, m - 1, d);
          }
        }
      }
      if (isNaN(eDate.getTime())) return false;

      return (
        eDate.getDate() === viewDate.getDate() &&
        eDate.getMonth() === viewDate.getMonth() &&
        eDate.getFullYear() === viewDate.getFullYear()
      );
    })
    .map((e) => ({
      id: e.id,
      title: e.title,
      subtitle: e.time,
      duration: e.duration,
      completed: !!e.completed,
      type: 'event' as const,
    }));

  const planActivities: OverviewActivity[] = !isToday
    ? []
    : plans.flatMap((plan) => {
        const targetRoutines = plan.targets
          .filter((t) => (t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily'))
          .map((t) => ({ ...t, subtype: 'target' as const }));

        const taskRoutines = plan.tasks
          .filter((t) => (t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily'))
          .map((t) => ({ ...t, subtype: 'task' as const }));

        return [...targetRoutines, ...taskRoutines].map((item) => ({
          id: item.id,
          title: item.title,
          completed: item.completed,
          type: 'plan' as const,
          subtype: item.subtype,
          sourceId: plan.id,
        }));
      });

  const allActivities = [...taskActivities, ...eventActivities, ...planActivities];

  return { taskActivities, eventActivities, planActivities, allActivities };
}
