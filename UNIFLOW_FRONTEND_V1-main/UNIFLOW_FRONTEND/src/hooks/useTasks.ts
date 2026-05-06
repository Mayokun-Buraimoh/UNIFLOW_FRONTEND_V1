import { useState, useEffect, useCallback } from 'react';
import { taskService, Task, TaskStats } from '../api/services';

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<TaskStats | null>(null);

  // Fetch tasks with optional filters
  const fetchTasks = useCallback(async (filters?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await taskService.getTasks(filters);
      setTasks(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch tasks');
      console.error('Error fetching tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch task statistics
  const fetchStats = useCallback(async () => {
    try {
      const statsData = await taskService.getTaskStats();
      setStats(statsData);
    } catch (err: any) {
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
    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticTask: Task = {
      id: tempId,
      userId: 'pending',
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || 'low',
      status: taskData.status || 'pending',
      dueDate: taskData.dueDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      console.log('useTasks createTask (optimistic) called');
      // Optimistically update the UI
      setTasks(prev => [optimisticTask, ...prev]);

      const newTask = await taskService.createTask(taskData);

      // Replace the optimistic task with the real one from the server
      setTasks(prev => prev.map(t => t.id === tempId ? newTask : t));
      await fetchStats();
      return newTask;
    } catch (err: any) {
      console.error('Error in useTasks createTask:', err);
      // Revert optimistic update on failure
      setTasks(prev => prev.filter(t => t.id !== tempId));
      setError(err.message || 'Failed to create task');
      throw err;
    }
  }, [fetchStats]);

  // Update a task
  const updateTask = useCallback(async (id: string, updates: Partial<Task>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedTask = await taskService.updateTask(id, updates);
      setTasks(prev => prev.map(task =>
        task.id === id ? updatedTask : task
      ));
      await fetchStats(); // Refresh stats
      return updatedTask;
    } catch (err: any) {
      setError(err.message || 'Failed to update task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchStats]);

  // Toggle task status (pending <-> completed)
  const toggleTaskStatus = useCallback(async (id: string) => {
    let originalTasks: Task[] = [];

    try {
      console.log('useTasks toggleTaskStatus (optimistic) called for:', id);
      setTasks(prev => {
        originalTasks = prev;
        return prev.map(task => {
          if (task.id === id) {
            const newStatus = task.status === 'completed' ? 'pending' : 'completed';
            return {
              ...task,
              status: newStatus,
              updatedAt: new Date().toISOString()
            };
          }
          return task;
        });
      });

      const updatedTask = await taskService.toggleTaskStatus(id);

      // Update with the definitive server version
      setTasks(prev => prev.map(task =>
        task.id === id ? updatedTask : task
      ));
      await fetchStats();
      return updatedTask;
    } catch (err: any) {
      console.error('Error in useTasks toggleTaskStatus:', err);
      // Revert to original state on failure
      setTasks(originalTasks);
      setError(err.message || 'Failed to toggle task status');
      throw err;
    }
  }, [fetchStats]);

  // Delete a task
  const deleteTask = useCallback(async (id: string) => {
    // Store task to revert if needed
    let deletedTask: Task | undefined;

    try {
      setTasks(prev => {
        const index = prev.findIndex(t => t.id === id);
        if (index !== -1) deletedTask = prev[index];
        return prev.filter(task => task.id !== id);
      });

      await taskService.deleteTask(id);
      await fetchStats();
    } catch (err: any) {
      console.error('Error in useTasks deleteTask:', err);
      // Revert optimistic deletion on failure
      if (deletedTask) {
        setTasks(prev => [deletedTask!, ...prev]); // Simple revert
      }
      setError(err.message || 'Failed to delete task');
      throw err;
    }
  }, [fetchStats]);

  // Clear multiple tasks at once
  const clearAllTasks = useCallback(async (ids: string[]) => {
    try {
      console.log('useTasks clearAllTasks (optimistic) called for:', ids.length, 'tasks');
      // Single optimistic update for the whole batch
      setTasks(prev => prev.filter(task => !ids.includes(task.id)));

      // Fire all API calls in parallel
      await Promise.all(ids.map(id => taskService.deleteTask(id)));

      // Single stats refresh
      await fetchStats();
    } catch (err: any) {
      console.error('Error in useTasks clearAllTasks:', err);
      // Fallback: fetch tasks from scratch on failure to sync
      await fetchTasks();
      setError(err.message || 'Failed to clear some tasks');
      throw err;
    }
  }, [fetchStats, fetchTasks]);

  // Get a single task
  const getTask = useCallback(async (id: string) => {
    try {
      return await taskService.getTask(id);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch task');
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
