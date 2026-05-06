import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTasks } from './useTasks';
import { usePlans } from '../contexts/PlanContext';

export function useProductivityScore() {
  const { tasks: backendTasks } = useTasks();
  const { plans } = usePlans();
  const [events, setEvents] = useState<any[]>([]);

  const loadEvents = useCallback(() => {
    try {
      const raw = localStorage.getItem('uniflow_events');
      if (raw) setEvents(JSON.parse(raw));
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    loadEvents();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'uniflow_events') loadEvents();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [loadEvents]);

  const score = useMemo(() => {
    const today = new Date();
    const todayString = today.toLocaleDateString();

    const isSameDay = (dateString: string | undefined): boolean => {
      if (!dateString) return false;
      const target = new Date(dateString);
      return (
        target.getFullYear() === today.getFullYear() &&
        target.getMonth() === today.getMonth() &&
        target.getDate() === today.getDate()
      );
    };

    let total = 0;
    let completed = 0;

    // Tasks
    const todayTasks = backendTasks.filter(t => isSameDay(t.dueDate || t.createdAt));
    total += todayTasks.length;
    completed += todayTasks.filter(t => t.status === 'completed').length;

    // Events
    const todayEvents = events.filter(e => e.date === todayString);
    total += todayEvents.length;
    completed += todayEvents.filter(e => e.completed).length;

    // Plans
    const planItems = plans.flatMap(plan => {
      const targetRoutines = plan.targets.filter(t => t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily');
      const taskRoutines = plan.tasks.filter(t => t.frequency === 'weekly' ? !t.completed : t.frequency === 'daily');
      return [...targetRoutines, ...taskRoutines];
    });

    total += planItems.length;
    completed += planItems.filter(p => p.completed).length;

    return total === 0 ? 0 : Math.round((completed / total) * 100);
  }, [backendTasks, events, plans]);

  return score;
}
