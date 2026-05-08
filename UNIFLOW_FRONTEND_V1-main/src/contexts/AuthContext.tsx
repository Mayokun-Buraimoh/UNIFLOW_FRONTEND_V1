import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useHistory } from 'react-router-dom';
import apiService from '../services/apiService';
import {
  clearUserScopedLocalStorage,
  clearUserScopedStorageIfUserChanged,
  readUserIdFromStorage,
} from '../utils/clearUserScopedStorage';

export interface User {
  id: string;
  name?: string;
  email: string;
  avatar?: string;
  streak?: number;
  createdAt: string;
  updatedAt?: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
}

export interface LoginData {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  register: (data: RegisterData) => Promise<void>;
  login: (data: LoginData) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => void;
  logoutWithConfirmation: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  clearError: () => void;
  refreshUser: () => Promise<void>;
  adminBypass: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

// Real API-based authentication service
class ApiAuthService {
  private static readonly STORAGE_KEY = 'uniflow_user';
  private static readonly TOKEN_KEY = 'uniflow_token';

  // Register new user
  async register(data: RegisterData): Promise<{ user: User; token: string }> {
    try {
      const response = await apiService.register(data);

      // Store user and token
      this.setCurrentUser(response.user);
      this.setToken(response.token);

      return { user: response.user, token: response.token };
    } catch (error: any) {
      throw new Error(error.message || 'Registration failed');
    }
  }

  // Login user
  async login(data: LoginData): Promise<{ user: User; token: string }> {
    try {
      const response = await apiService.login(data);

      // Store current user and token
      this.setCurrentUser(response.user);
      this.setToken(response.token);

      return { user: response.user, token: response.token };
    } catch (error: any) {
      throw new Error(error.message || 'Login failed');
    }
  }

  // Get current user profile
  async getProfile(): Promise<User> {
    try {
      const user = await apiService.getProfile();
      this.setCurrentUser(user);
      return user;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to get profile');
    }
  }

  // Update user profile
  async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const updatedUser = await apiService.updateProfile(data);
      this.setCurrentUser(updatedUser);
      return updatedUser;
    } catch (error: any) {
      throw new Error(error.message || 'Failed to update profile');
    }
  }

  // Change password
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await apiService.changePassword({ currentPassword, newPassword });
    } catch (error: any) {
      throw new Error(error.message || 'Failed to change password');
    }
  }

  // Apple Sign In
  async signInWithApple(): Promise<{ user: User; token: string }> {
    // For now, throw an error as Apple OAuth is not implemented
    throw new Error('Apple Sign In is not yet implemented');
  }

  // Google Sign In
  async signInWithGoogle(): Promise<{ user: User; token: string }> {
    try {
      // Redirect to Google OAuth
      apiService.googleAuth();
      // This will redirect, so we won't reach here
      throw new Error('Redirecting to Google OAuth');
    } catch (error: any) {
      throw new Error(error.message || 'Google Sign In failed');
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    const token = this.getToken();
    const user = this.getCurrentUser();
    const isAuth = !!token && !!user;

    console.log('ApiAuthService.isAuthenticated():', {
      hasToken: !!token,
      hasUser: !!user,
      isAuthenticated: isAuth
    });

    return isAuth;
  }

  // Get current user from storage
  getCurrentUser(): User | null {
    try {
      const userStr = localStorage.getItem(ApiAuthService.STORAGE_KEY);
      if (!userStr) return null;

      const user = JSON.parse(userStr);
      console.log('ApiAuthService.getCurrentUser(): Parsed user:', user);
      return user;
    } catch (error) {
      console.error('ApiAuthService.getCurrentUser(): Error parsing user data:', error);
      return null;
    }
  }

  // Set current user in storage
  setCurrentUser(user: User): void {
    localStorage.setItem(ApiAuthService.STORAGE_KEY, JSON.stringify(user));
  }

  // Get token from storage
  getToken(): string | null {
    return localStorage.getItem(ApiAuthService.TOKEN_KEY);
  }

  // Set token in storage
  setToken(token: string): void {
    localStorage.setItem(ApiAuthService.TOKEN_KEY, token);
  }

  // Logout user
  logout(): void {
    localStorage.removeItem(ApiAuthService.STORAGE_KEY);
    localStorage.removeItem(ApiAuthService.TOKEN_KEY);
  }
}

const apiAuthService = new ApiAuthService();

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const history = useHistory();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authState, setAuthState] = useState<boolean>(false);
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize auth state on app load
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('AuthContext: Initializing auth...');
        const token = localStorage.getItem('uniflow_token');
        const userData = localStorage.getItem('uniflow_user');

        console.log('AuthContext: Token exists:', !!token);
        console.log('AuthContext: User data exists:', !!userData);

        // If we have both token and user data, set the user immediately
        if (token && userData) {
          try {
            const parsedUser = JSON.parse(userData);
            console.log('AuthContext: Setting user from localStorage:', parsedUser);
            setUser(parsedUser);
            setAuthState(true); // Set auth state immediately
            console.log('AuthContext: User set successfully');
          } catch (parseError) {
            console.error('AuthContext: Error parsing user data:', parseError);
            // If parsing fails, try to get fresh data
            if (apiAuthService.isAuthenticated()) {
              try {
                const profile = await apiAuthService.getProfile();
                setUser(profile);
                setAuthState(true);
                console.log('AuthContext: User set from API after parse error');
              } catch (apiError) {
                console.error('AuthContext: API call failed during initialization:', apiError);
                // Don't fail the entire app, just set auth state to false
                setAuthState(false);
              }
            }
          }
        } else if (apiAuthService.isAuthenticated()) {
          console.log('AuthContext: User is authenticated but no user data in localStorage');
          const currentUser = apiAuthService.getCurrentUser();
          console.log('AuthContext: Current user:', currentUser);

          if (currentUser) {
            setUser(currentUser);
            setAuthState(true);
            console.log('AuthContext: User set from localStorage');
          } else {
            console.log('AuthContext: No user in localStorage, fetching from API...');
            // Try to get fresh user data
            try {
              const profile = await apiAuthService.getProfile();
              setUser(profile);
              setAuthState(true);
              console.log('AuthContext: User set from API');
            } catch (apiError) {
              console.error('AuthContext: API call failed during initialization:', apiError);
              // Don't fail the entire app, just set auth state to false
              setAuthState(false);
            }
          }
        } else {
          console.log('AuthContext: User is not authenticated');
          setAuthState(false);
        }
      } catch (error) {
        console.error('AuthContext: Auth initialization error:', error);
        // Don't logout immediately - let's see what the error is
        console.log('AuthContext: Error details:', error);
        setAuthState(false);
        setError(null); // Clear any previous errors
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const register = async (data: RegisterData) => {
    try {
      setLoading(true);
      setError(null);

      // Clear any existing authentication before registering
      console.log('AuthContext: Clearing existing auth before register');
      localStorage.removeItem('uniflow_token');
      localStorage.removeItem('uniflow_user');
      localStorage.removeItem('refreshToken');

      const response = await apiAuthService.register(data);
      clearUserScopedLocalStorage();
      setUser(response.user);
      setAuthState(true); // Ensure auth state is set immediately
      console.log('AuthContext: Registration successful, user set:', response.user);
    } catch (error: any) {
      setError(error.message);
      setAuthState(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const login = async (data: LoginData) => {
    try {
      setLoading(true);
      setError(null);

      const previousUserId = readUserIdFromStorage();
      // Clear any existing authentication before logging in
      console.log('AuthContext: Clearing existing auth before login');
      localStorage.removeItem('uniflow_token');
      localStorage.removeItem('uniflow_user');
      localStorage.removeItem('refreshToken');

      const response = await apiAuthService.login(data);
      clearUserScopedStorageIfUserChanged(previousUserId, response.user.id);
      setUser(response.user);
      setAuthState(true); // Ensure auth state is set immediately
      console.log('AuthContext: Login successful, user set:', response.user);
    } catch (error: any) {
      setError(error.message);
      setAuthState(false);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiAuthService.signInWithApple();
      setUser(response.user);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiAuthService.signInWithGoogle();
      setUser(response.user);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiAuthService.logout();
    clearUserScopedLocalStorage();
    setUser(null);
    setError(null);
    setAuthState(false);
  };

  const logoutWithConfirmation = () => {
    setShowLogoutConfirmation(true);
  };

  const handleLogoutConfirm = () => {
    setShowLogoutConfirmation(false);
    logout();
  };

  const handleLogoutCancel = () => {
    setShowLogoutConfirmation(false);
  };

  const updateProfile = async (data: Partial<User>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedUser = await apiAuthService.updateProfile(data);
      setUser(updatedUser);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiAuthService.changePassword(currentPassword, newPassword);
    } catch (error: any) {
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const refreshUser = async () => {
    try {
      setLoading(true);
      setError(null);
      const profile = await apiAuthService.getProfile();
      setUser(profile);
      setAuthState(true);
      console.log('AuthContext: User refreshed successfully from API');
    } catch (error: any) {
      console.error('Failed to refresh user:', error);
      // Don't set error state or logout on API failure
      // The user might still be valid in localStorage
      console.log('AuthContext: API refresh failed, but keeping current auth state');
    } finally {
      setLoading(false);
    }
  };

  const adminBypass = () => {
    const dummyUser: User = {
      id: 'admin_bypass_id',
      name: 'Admin Bypass',
      email: 'admin@bypass.com',
      createdAt: new Date().toISOString()
    };

    // Set admin in localStorage
    localStorage.setItem('uniflow_user', JSON.stringify(dummyUser));
    localStorage.setItem('uniflow_token', 'admin_bypass_token');

    setUser(dummyUser);
    setAuthState(true);
  };

  // Update authentication state when user or localStorage changes
  useEffect(() => {
    const checkAuth = () => {
      // If user is set in state, we're authenticated
      if (user) {
        setAuthState(true);
        return;
      }

      // If user is not set but we have token and user data in localStorage, we're authenticated
      const token = localStorage.getItem('uniflow_token');
      const userData = localStorage.getItem('uniflow_user');

      if (token && userData) {
        try {
          JSON.parse(userData); // Verify user data is valid JSON
          setAuthState(true);
          return;
        } catch (error) {
          console.error('Invalid user data in localStorage:', error);
          setAuthState(false);
          return;
        }
      }

      setAuthState(false);
    };

    checkAuth();
  }, [user]);

  // Listen for localStorage changes (for OAuth callbacks)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'uniflow_token' || e.key === 'uniflow_user') {
        console.log('AuthContext: localStorage changed, re-checking auth state');
        const token = localStorage.getItem('uniflow_token');
        const userData = localStorage.getItem('uniflow_user');

        if (token && userData) {
          try {
            const parsedUser = JSON.parse(userData);
            console.log('AuthContext: Setting user from localStorage change:', parsedUser);
            setUser(parsedUser);
            setAuthState(true);
          } catch (error) {
            console.error('AuthContext: Error parsing user data from storage change:', error);
            setAuthState(false);
          }
        } else {
          console.log('AuthContext: No token/user data, setting auth state to false');
          setUser(null);
          setAuthState(false);
        }
      }
    };

    // Check localStorage periodically for changes (since storage events don't fire for same-tab changes)
    const checkLocalStorage = () => {
      const token = localStorage.getItem('uniflow_token');
      const userData = localStorage.getItem('uniflow_user');

      if (token && userData && !user) {
        try {
          const parsedUser = JSON.parse(userData);
          console.log('AuthContext: Setting user from localStorage check:', parsedUser);
          setUser(parsedUser);
          setAuthState(true);
        } catch (error) {
          console.error('AuthContext: Error parsing user data from localStorage check:', error);
        }
      } else if (!token && !userData && user) {
        // If localStorage is cleared but we still have user in state, clear it
        console.log('AuthContext: localStorage cleared, clearing user state');
        setUser(null);
        setAuthState(false);
      }
    };

    // Check immediately and set up periodic checks
    checkLocalStorage();
    const interval = setInterval(checkLocalStorage, 500); // Check every 500ms
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [user]);

  const value: AuthContextType = {
    user,
    loading,
    error,
    isAuthenticated: authState,
    register,
    login,
    signInWithApple,
    signInWithGoogle,
    logout,
    logoutWithConfirmation,
    updateProfile,
    changePassword,
    clearError,
    refreshUser,
    adminBypass,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {/* Logout Loading Overlay */}
      {isLoggingOut && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 10000
        }}>
          <div style={{
            textAlign: 'center',
            padding: '20px',
            backgroundColor: 'white',
            borderRadius: '10px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 15px'
            }}></div>
            <p style={{ margin: 0, color: '#333' }}>Logging out...</p>
          </div>
        </div>
      )}
      {/* Logout Confirmation Alert */}
      {showLogoutConfirmation && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            maxWidth: '300px',
            textAlign: 'center'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#333' }}>Logout</h3>
            <p style={{ margin: '0 0 20px 0', color: '#666' }}>
              Are you sure you want to logout? You'll be redirected to the signup page.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={handleLogoutCancel}
                style={{
                  padding: '10px 20px',
                  border: '1px solid #ccc',
                  borderRadius: '5px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Close the modal first
                  setShowLogoutConfirmation(false);
                  // Set logging out state
                  setIsLoggingOut(true);
                  // Logout immediately
                  logout();
                  // Small delay to ensure logout state is cleared, then navigate smoothly
                  setTimeout(() => {
                    try {
                      if (history && history.replace) {
                        history.replace('/signup');
                      } else {
                        window.location.href = '/signup';
                      }
                    } catch (e) {
                      console.error('Routing failed during logout:', e);
                      window.location.href = '/signup';
                    } finally {
                      setIsLoggingOut(false);
                    }
                  }, 100);
                }}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '5px',
                  backgroundColor: '#f44336',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};