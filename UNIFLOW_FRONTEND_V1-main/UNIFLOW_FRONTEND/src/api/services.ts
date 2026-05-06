import { api } from './client';
import { resolveApiBaseUrl, resolveBackendOrigin } from '../constants/defaults';
import { ngrokSkipWarningHeaders } from '../utils/ngrokSkipWarning';

// Types
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  googleId?: string;
  preferences?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  email: string;
  name?: string;
  profilePicture?: string;
  themeColor?: string;
  school?: string;
  department?: string;
  level?: string;
  academicYear?: string;
  subjects?: any;
  bio?: string;
  phoneNumber?: string;
  notificationSettings?: any;
  studyGoals?: any;
  preferences?: any;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'critical';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskStats {
  total: number;
  completed: number;
  pending: number;
  critical: number;
  completionRate: number;
}

export interface WeeklyScheduleDTO {
  id: string;
  userId: string;
  data: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// Auth Service
export const authService = {
  register: async (data: { name: string; email: string; password: string }) => {
    return await api.post('/auth/register', data);
  },

  login: async (data: { email: string; password: string }) => {
    return await api.post('/auth/login', data);
  },

  getMe: async (): Promise<User> => {
    return await api.get('/auth/me');
  },

  changePassword: async (data: { currentPassword: string; newPassword: string }) => {
    return await api.post('/auth/change-password', data);
  },

  startGoogleOAuth: () => {
    const backendUrl = resolveBackendOrigin();
    window.location.href = `${backendUrl}/api/auth/google`;
  }
};

// User Service
export const userService = {
  getProfile: async (): Promise<User> => {
    return await api.get('/users/me');
  },

  updateProfile: async (data: Partial<User>): Promise<User> => {
    return await api.patch('/users/me', data);
  },

  deleteAccount: async (): Promise<{ message: string }> => {
    return await api.delete('/users/me');
  },

  getAllUsers: async (): Promise<User[]> => {
    return await api.get('/users/');
  }
};

// Profile Service
export const profileService = {
  getProfile: async (): Promise<Profile> => {
    return await api.get('/profiles/');
  },

  updateProfile: async (data: Partial<Profile>): Promise<Profile> => {
    return await api.patch('/profiles/', data);
  },

  updateNotificationSettings: async (notificationSettings: any): Promise<{ message: string }> => {
    return await api.patch('/profiles/notifications', { notificationSettings });
  },

  updateStudyGoals: async (studyGoals: any): Promise<{ message: string }> => {
    return await api.patch('/profiles/study-goals', { studyGoals });
  },

  updatePreferences: async (preferences: any): Promise<{ message: string }> => {
    return await api.patch('/profiles/preferences', { preferences });
  }
};

export interface Event {
  id: string;
  userId: string;
  title: string;
  time: string;
  date: string;
  priority: 'low' | 'medium' | 'critical';
  createdAt: string;
  updatedAt: string;
}

export const eventService = {
  getEvents: async (filters?: { date?: string }): Promise<{ events: Event[] }> => {
    const url = filters?.date
      ? `/events/?date=${encodeURIComponent(filters.date)}`
      : '/events/';
    return await api.get(url);
  },

  createEvent: async (data: {
    title: string;
    time: string;
    date: string;
    priority?: 'low' | 'medium' | 'critical';
  }): Promise<Event> => {
    return await api.post('/events/', data);
  },

  updateEvent: async (
    id: string,
    updates: Partial<Pick<Event, 'title' | 'time' | 'date' | 'priority'>>
  ): Promise<Event> => {
    return await api.put(`/events/${id}`, updates);
  },

  deleteEvent: async (id: string): Promise<{ message: string }> => {
    return await api.delete(`/events/${id}`);
  },

  getEvent: async (id: string): Promise<Event> => {
    return await api.get(`/events/${id}`);
  },
};

export const pushTokenService = {
  register: async (data: { token: string; platform?: string }): Promise<{ id: string; token: string; platform: string | null }> => {
    return await api.post('/push-tokens/', data);
  },

  unregister: async (data: { token: string }): Promise<{ removed: number }> => {
    return await api.delete('/push-tokens/', data);
  },
};

// Task Service
export const taskService = {
  getTasks: async (params?: {
    status?: string;
    priority?: string;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedResponse<Task>> => {
    const queryParams = new URLSearchParams();
    if (params?.status) queryParams.append('status', params.status);
    if (params?.priority) queryParams.append('priority', params.priority);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const url = queryString ? `/tasks/?${queryString}` : '/tasks/';

    try {
      const response = await api.get(url);
      return {
        data: response.tasks || [],
        pagination: response.pagination || {
          total: 0,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      return {
        data: existing,
        pagination: {
          total: existing.length,
          limit: 50,
          offset: 0,
          hasMore: false
        }
      };
    }
  },

  getTask: async (id: string): Promise<Task> => {
    try {
      return await api.get(`/tasks/${id}`);
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      const task = existing.find((t: Task) => t.id === id);
      if (task) return task;
      throw new Error('Task not found');
    }
  },

  createTask: async (data: {
    title: string;
    description?: string;
    priority?: 'low' | 'medium' | 'critical';
    status?: 'pending' | 'in_progress' | 'completed';
    dueDate?: string;
  }): Promise<Task> => {
    try {
      const result = await api.post('/tasks/', data);
      return result;
    } catch (error) {
      const newTask: Task = {
        id: Date.now().toString(),
        userId: 'local-user',
        title: data.title,
        description: data.description,
        priority: data.priority || 'low',
        status: data.status || 'pending',
        dueDate: data.dueDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      existing.unshift(newTask); // Prepend so it shows at the top
      localStorage.setItem('uniflow_tasks', JSON.stringify(existing));
      return newTask;
    }
  },

  updateTask: async (id: string, data: Partial<Task>): Promise<Task> => {
    try {
      return await api.put(`/tasks/${id}`, data);
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      const index = existing.findIndex((t: Task) => t.id === id);
      if (index !== -1) {
        existing[index] = { ...existing[index], ...data, updatedAt: new Date().toISOString() };
        localStorage.setItem('uniflow_tasks', JSON.stringify(existing));
        return existing[index];
      }
      throw new Error('Task not found');
    }
  },

  toggleTaskStatus: async (id: string): Promise<Task> => {
    try {
      return await api.patch(`/tasks/${id}/toggle`);
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      const index = existing.findIndex((t: Task) => t.id === id);
      if (index !== -1) {
        existing[index].status = existing[index].status === 'completed' ? 'pending' : 'completed';
        existing[index].updatedAt = new Date().toISOString();
        localStorage.setItem('uniflow_tasks', JSON.stringify(existing));
        return existing[index];
      }
      throw new Error('Task not found');
    }
  },

  deleteTask: async (id: string): Promise<{ message: string }> => {
    try {
      return await api.delete(`/tasks/${id}`);
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      const filtered = existing.filter((t: Task) => t.id !== id);
      localStorage.setItem('uniflow_tasks', JSON.stringify(filtered));
      return { message: 'Task deleted locally' };
    }
  },

  getTaskStats: async (): Promise<TaskStats> => {
    try {
      return await api.get('/tasks/stats');
    } catch (error) {
      const existing = JSON.parse(localStorage.getItem('uniflow_tasks') || '[]');
      const completed = existing.filter((t: Task) => t.status === 'completed').length;
      return {
        total: existing.length,
        completed: completed,
        pending: existing.length - completed,
        critical: existing.filter((t: Task) => t.priority === 'critical' && t.status !== 'completed').length,
        completionRate: existing.length > 0 ? (completed / existing.length) * 100 : 0
      };
    }
  }
};

// Schedule Service
export const scheduleService = {
  getMySchedule: async (): Promise<WeeklyScheduleDTO | null> => {
    const res = await api.get('/schedule/');
    return res?.data || null;
  },

  saveMySchedule: async (data: Record<string, string[]>): Promise<WeeklyScheduleDTO> => {
    const res = await api.put('/schedule/', { data });
    return res.data;
  }
};

// System Service
export const systemService = {
  healthCheck: async (): Promise<{ status: string; message: string }> => {
    return await api.get('/health');
  }
};

// Course Service (for future school integration)
export const courseService = {
  getCourses: async (): Promise<any[]> => {
    try {
      const res = await api.get('/courses/');
      return res?.courses || [];
    } catch (err) {
      const saved = localStorage.getItem('uniflow_courses');
      return saved ? JSON.parse(saved) : [];
    }
  },

  createCourse: async (data: { code?: string; name: string }) => {
    try {
      const res = await api.post('/courses/', data);
      return res;
    } catch (err) {
      // Fallback: create locally
      const newCourse = {
        id: Date.now().toString(),
        code: data.code || data.name,
        name: data.name,
        notesCount: 0,
        lastOpened: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
        colorTheme: 'blue'
      };
      const existing = JSON.parse(localStorage.getItem('uniflow_courses') || '[]');
      existing.push(newCourse);
      localStorage.setItem('uniflow_courses', JSON.stringify(existing));
      return newCourse;
    }
  },

  deleteCourse: async (id: string) => {
    try {
      const res = await api.delete(`/courses/${id}`);
      return res;
    } catch (err) {
      // Fallback: remove locally
      const existing = JSON.parse(localStorage.getItem('uniflow_courses') || '[]');
      const filtered = existing.filter((c: any) => c.id !== id);
      localStorage.setItem('uniflow_courses', JSON.stringify(filtered));
      // Also remove files metadata
      localStorage.removeItem(`uniflow_files_${id}`);
      return { message: 'Deleted locally' };
    }
  },

  uploadFile: async (courseId: string, file: File) => {
    const token = localStorage.getItem('uniflow_token');
    const apiBase = resolveApiBaseUrl();
    const url = `${apiBase}/courses/${courseId}/files`;
    const form = new FormData();
    form.append('file', file);

    const headers: Record<string, string> = {
      ...ngrokSkipWarningHeaders(url),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(url, { method: 'POST', headers, body: form });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  getFiles: async (courseId: string) => {
    try {
      const res = await api.get(`/courses/${courseId}/files`);
      return res?.files || [];
    } catch (err) {
      const saved = localStorage.getItem(`uniflow_files_${courseId}`);
      return saved ? JSON.parse(saved) : [];
    }
  },

  getNotes: async (courseId: string) => {
    try {
      const res = await api.get(`/courses/${courseId}/notes`);
      return res?.notes || [];
    } catch (err) {
      const saved = localStorage.getItem(`uniflow_notes_${courseId}`);
      return saved ? JSON.parse(saved) : [];
    }
  },

  syncWithSchool: async (schoolUrl: string): Promise<{ message: string }> => {
    // Placeholder for school sync functionality
    return { message: 'School sync not yet implemented' };
  }
};

// Plan Service (for custom plans)
export const planService = {
  getPlans: async (): Promise<any[]> => {
    // Get plans from localStorage for now
    const plans = localStorage.getItem('customPlans');
    return plans ? JSON.parse(plans) : [];
  },

  createPlan: async (planData: { title: string; description?: string }): Promise<any> => {
    // Create plan in localStorage for now
    const plans = JSON.parse(localStorage.getItem('customPlans') || '[]');
    const newPlan = {
      id: Date.now(),
      ...planData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    plans.push(newPlan);
    localStorage.setItem('customPlans', JSON.stringify(plans));
    return newPlan;
  },

  updatePlan: async (id: number, planData: Partial<any>): Promise<any> => {
    // Update plan in localStorage for now
    const plans = JSON.parse(localStorage.getItem('customPlans') || '[]');
    const planIndex = plans.findIndex((plan: any) => plan.id === id);
    if (planIndex !== -1) {
      plans[planIndex] = { ...plans[planIndex], ...planData, updatedAt: new Date().toISOString() };
      localStorage.setItem('customPlans', JSON.stringify(plans));
      return plans[planIndex];
    }
    throw new Error('Plan not found');
  },

  deletePlan: async (id: number): Promise<{ message: string }> => {
    // Delete plan from localStorage for now
    const plans = JSON.parse(localStorage.getItem('customPlans') || '[]');
    const filteredPlans = plans.filter((plan: any) => plan.id !== id);
    localStorage.setItem('customPlans', JSON.stringify(filteredPlans));
    return { message: 'Plan deleted successfully' };
  }
};

// Export all services
export const services = {
  auth: authService,
  user: userService,
  profile: profileService,
  task: taskService,
  schedule: scheduleService,
  system: systemService,
  course: courseService,
  plan: planService
};
