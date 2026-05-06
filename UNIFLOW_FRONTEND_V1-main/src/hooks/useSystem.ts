import { useState, useCallback } from 'react';
import { systemService } from '../api/services';

export interface SystemHealth {
  status: string;
  message: string;
  database?: string;
  userCount?: number;
}

export const useSystem = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check system health
  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const healthData = await systemService.healthCheck();
      setHealth(healthData);
      return healthData;
    } catch (err: any) {
      setError(err.message || 'Failed to check system health');
      console.error('Error checking system health:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    health,
    loading,
    error,
    checkHealth
  };
};
