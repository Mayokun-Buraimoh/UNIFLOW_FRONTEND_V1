// API Service for backend communication
import config from '../config/environment';
import { ngrokSkipWarningHeaders } from '../utils/ngrokSkipWarning';

const API_BASE_URL = config.API_BASE_URL;

export interface AuthResponse {
  user: {
    id: string;
    name?: string;
    email: string;
    avatar?: string;
    googleId?: string;
    createdAt: string;
    updatedAt?: string;
  };
  token: string;
  refreshToken?: string;
}

export interface User {
  id: string;
  name?: string;
  email: string;
  avatar?: string;
  googleId?: string;
  createdAt: string;
  updatedAt?: string;
}

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const { headers: optionHeaders, ...restOptions } = options;

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...ngrokSkipWarningHeaders(url),
      ...(optionHeaders instanceof Headers
        ? Object.fromEntries(optionHeaders.entries())
        : ((optionHeaders as Record<string, string> | undefined) ?? {})),
    };

    const requestConfig: RequestInit = {
      ...restOptions,
      headers: mergedHeaders,
    };

    // Add auth token if available (but not for login/register requests)
    const token = localStorage.getItem('uniflow_token');
    const isAuthRequest = endpoint.includes('/auth/login') || endpoint.includes('/auth/register');
    
    if (token && !isAuthRequest) {
      requestConfig.headers = {
        ...(requestConfig.headers as Record<string, string>),
        'Authorization': `Bearer ${token}`,
      };
    }

    try {
      console.log('Making API request to:', url);
      console.log('Request config:', requestConfig);
      
      const response = await fetch(url, requestConfig);
      
      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);
      
      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          console.log('Error response data:', errorData);
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          console.log('Could not parse error response as JSON:', parseError);
          const textResponse = await response.text().catch(() => '');
          console.log('Error response text:', textResponse);
          if (textResponse) {
            errorMessage = textResponse;
          }
        }
        throw new Error(errorMessage);
      }

      const responseData = await response.json();
      console.log('Success response data:', responseData);
      return responseData;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Health check
  async healthCheck() {
    return this.request('/health');
  }

  // Test database connection
  async testDatabase() {
    return this.request('/test-db');
  }

  // Email authentication
  async register(data: { name: string; email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Google OAuth
  async googleAuth() {
    // Redirect to Google OAuth
    window.location.href = `${this.baseURL}/auth/google`;
  }

  // Profile management
  async getProfile(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async updateProfile(data: any): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> {
    return this.request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // User management
  async getUserProfile(): Promise<User> {
    return this.request<User>('/users/me');
  }

  async updateUserProfile(data: Partial<User>): Promise<User> {
    return this.request<User>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(): Promise<{ message: string }> {
    return this.request<{ message: string }>('/users/me', {
      method: 'DELETE',
    });
  }

  // Profile settings
  async getProfileSettings() {
    return this.request('/profiles/');
  }

  async updateProfileSettings(data: any) {
    return this.request('/profiles/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateNotificationSettings(notificationSettings: any) {
    return this.request('/profiles/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationSettings }),
    });
  }

  async updateStudyGoals(studyGoals: any) {
    return this.request('/profiles/study-goals', {
      method: 'PATCH',
      body: JSON.stringify({ studyGoals }),
    });
  }

  async updatePreferences(preferences: any) {
    return this.request('/profiles/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ preferences }),
    });
  }
}

export default new ApiService();