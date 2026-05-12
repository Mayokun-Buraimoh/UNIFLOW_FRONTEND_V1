import { useState, useEffect, useCallback } from 'react';
import { taskService, Task, TaskStats } from '../api/services';
import { createLocalFirst, deleteLocalFirst, updateLocalFirst } from '../localfirst/syncQueue';

const TASK_STORAGE_KEY = 'uniflow_tasks';
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

const readLocalTasks = (): Task[] => {
  try {
    const raw = localStorage.getItem(TASK_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalTasks = (tasks: Task[]) => {
  localStorage.setItem(TASK_STORAGE_KEY, JSON.stringify(tasks));
};

const applyTaskFilters = (
  tasks: Task[],
  filters?: { status?: string; priority?: string; limit?: number; offset?: number }
) => {
  let next = [...tasks];
  if (filters?.status) {
    next = next.filter((task) => task.status === filters.status);
  }
  if (filters?.priority) {
    next = next.filter((task) => task.priority === filters.priority);
  }
  const offset = filters?.offset || 0;
  const limit = filters?.limit;
  if (offset || limit) {
    next = next.slice(offset, typeof limit === 'number' ? offset + limit : undefined);
  }
  return next;
};

const computeTaskStats = (tasks: Task[]): TaskStats => {
  const completed = tasks.filter((task) => task.status === 'completed').length;
  const total = tasks.length;
  return {
    total,
    completed,
    pending: total - completed,
    critical: tasks.filter((task) => task.priority === 'critical' && task.status !== 'completed').length,
    completionRate: total ? (completed / total) * 100 : 0,
  };
};

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);

  // Fetch tasks with optional filters.
  //
  // Server is the source of truth for synced tasks, but we must preserve any
  // local optimistic items whose sync to the server is still in flight
  // (those have `lf-temp-` ids). Without this merge, Ruby-created tasks
  // (which are written server-side and only signalled to the client via the
  // `uniflow_tasks_updated` event) never showed up locally, because the
  // previous guard `if (!local.length && ...)` ignored the response whenever
  // there was already anything in localStorage.
  const fetchTasks = useCallback(async (filters?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }) => {
    const local = readLocalTasks();
    setTasks(applyTaskFilters(local, filters));
    try {
      setLoading(true);
      setError(null);
      const response = await taskService.getTasks(filters);
      const remote = response.data || [];
      const remoteIds = new Set(remote.map((t) => String(t.id)));
      const pendingLocalOnly = local.filter(
        (t) => typeof t.id === 'string' && t.id.startsWith('lf-temp-') && !remoteIds.has(String(t.id))
      );
      const merged = [...pendingLocalOnly, ...remote];
      writeLocalTasks(merged);
      setTasks(applyTaskFilters(merged, filters));
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch task statistics
  const fetchStats = useCallback(async () => {
    try {
      const local = readLocalTasks();
      setStats(computeTaskStats(local));
    } catch (err: unknown) {
      console.error('Error fetching task stats:', err);
    }
  }, []);

  // Create a new task
  const createTask = useCallback(async (taskData: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'critical';
    status?: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
  }) => {
    try {
      const nowIso = new Date().toISOString();
      const optimisticTask = createLocalFirst(
        'tasks',
        {
          userId: 'local-user',
          title: taskData.title,
          description: taskData.description,
          priority: taskData.priority || 'low',
          status: taskData.status || 'pending',
          dueDate: taskData.dueDate,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        (payload) => {
          const next = [payload as Task, ...readLocalTasks()];
          writeLocalTasks(next);
          setTasks(next);
        }
      ) as Task;
      await fetchStats();
      return optimisticTask;
    } catch (err: unknown) {
      console.error('Error in useTasks createTask:', err);
      setError(getErrorMessage(err) || 'Failed to create task');
      throw err;
    }
  }, [fetchStats]);

  // Update a task
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      setError(null);
      let updatedTask: Task | undefined;
      updateLocalFirst('tasks', id, updates, (entityId, patch) => {
        const next = readLocalTasks().map((task) => {
          if (task.id !== entityId) return task;
          updatedTask = { ...task, ...(patch as Partial<Task>), updatedAt: new Date().toISOString() };
          return updatedTask;
        });
        writeLocalTasks(next);
        setTasks(next);
      });
      await fetchStats(); // Refresh stats
      return updatedTask as Task;
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to update task');
      throw err;
    }
  }, [fetchStats]);

  // Toggle task status (pending <-> completed)
  const toggleTaskStatus = useCallback(async (id: string) => {
    try {
      let updatedTask: Task | undefined;
      const local = readLocalTasks();
      const target = local.find((task) => task.id === id);
      if (!target) {
        throw new Error('Task not found');
      }
      const nextStatus = target.status === 'completed' ? 'pending' : 'completed';
      updateLocalFirst('tasks', id, { status: nextStatus }, (entityId, patch) => {
        const next = readLocalTasks().map((task) => {
          if (task.id !== entityId) return task;
          updatedTask = { ...task, ...(patch as Partial<Task>), updatedAt: new Date().toISOString() };
          return updatedTask;
        });
        writeLocalTasks(next);
        setTasks(next);
      });
      await fetchStats();
      return updatedTask as Task;
    } catch (err: unknown) {
      console.error('Error in useTasks toggleTaskStatus:', err);
      setError(getErrorMessage(err) || 'Failed to toggle task status');
      throw err;
    }
  }, [fetchStats]);

  // Delete a task
  const deleteTask = useCallback(async (id: string) => {
    try {
      deleteLocalFirst('tasks', id, (entityId) => {
        const next = readLocalTasks().filter((task) => task.id !== entityId);
        writeLocalTasks(next);
        setTasks(next);
      });
      await fetchStats();
    } catch (err: unknown) {
      console.error('Error in useTasks deleteTask:', err);
      setError(getErrorMessage(err) || 'Failed to delete task');
      throw err;
    }
  }, [fetchStats]);

  // Clear multiple tasks at once
  const clearAllTasks = useCallback(async (ids: string[]) => {
    try {
      console.log('useTasks clearAllTasks (optimistic) called for:', ids.length, 'tasks');
      // Single optimistic update for the whole batch
      ids.forEach((id) => {
        deleteLocalFirst('tasks', id, (entityId) => {
          const next = readLocalTasks().filter((task) => task.id !== entityId);
          writeLocalTasks(next);
          setTasks(next);
        });
      });

      // Single stats refresh
      await fetchStats();
    } catch (err: unknown) {
      console.error('Error in useTasks clearAllTasks:', err);
      setError(getErrorMessage(err) || 'Failed to clear some tasks');
      throw err;
    }
  }, [fetchStats]);

  // Get a single task
  const getTask = useCallback(async (id: string) => {
    try {
      const local = readLocalTasks();
      const found = local.find((task) => task.id === id);
      if (found) return found;
      return await taskService.getTask(id);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to fetch task');
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load tasks and stats on mount
  useEffect(() => {
    fetchTasks();
    fetchStats();
  }, [fetchTasks, fetchStats]);

  return {
    tasks,
    loading,
    error,
    stats,
    fetchTasks,
    fetchStats,
    createTask,
    updateTask,
    toggleTaskStatus,
    deleteTask,
    clearAllTasks,
    getTask,
    clearError
  };
};
