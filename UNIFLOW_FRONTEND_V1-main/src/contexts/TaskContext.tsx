import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTasks } from '../hooks/useTasks';

type TaskApi = ReturnType<typeof useTasks>;

const TaskContext = createContext<TaskApi | null>(null);

/**
 * One shared task list + refetch on `uniflow_tasks_updated` (voice, socket merges) so Home "Today's Tasks"
 * updates even when Home is not mounted (e.g. user on Courses).
 */
export function TaskProvider({ children }: { children: React.ReactNode }) {
  const tasksApi = useTasks();

  useEffect(() => {
    const onTasksUpdated = () => {
      void tasksApi.fetchTasks();
      void tasksApi.fetchStats();
    };
    window.addEventListener('uniflow_tasks_updated', onTasksUpdated);
    return () => window.removeEventListener('uniflow_tasks_updated', onTasksUpdated);
  }, [tasksApi.fetchTasks, tasksApi.fetchStats]);

  return <TaskContext.Provider value={tasksApi}>{children}</TaskContext.Provider>;
}

/** Wraps routes when there is no signed-in user — no task store (protected pages are not shown). */
export function TaskProviderGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <>{children}</>;
  return <TaskProvider>{children}</TaskProvider>;
}

export function useTaskContext(): TaskApi {
  const ctx = useContext(TaskContext);
  if (!ctx) {
    throw new Error('useTaskContext must be used within TaskProvider (signed-in shell)');
  }
  return ctx;
}
