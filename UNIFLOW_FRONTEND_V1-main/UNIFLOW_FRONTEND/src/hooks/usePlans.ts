import { useState, useEffect, useCallback } from 'react';
import { planService } from '../api/services';

export interface Plan {
  id: number;
  title: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export const usePlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch plans
  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const plansData = await planService.getPlans();
      setPlans(plansData);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch plans');
      console.error('Error fetching plans:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new plan
  const createPlan = useCallback(async (planData: { title: string; description?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const newPlan = await planService.createPlan(planData);
      setPlans(prev => [newPlan, ...prev]);
      return newPlan;
    } catch (err: any) {
      setError(err.message || 'Failed to create plan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Update a plan
  const updatePlan = useCallback(async (id: number, planData: Partial<Plan>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedPlan = await planService.updatePlan(id, planData);
      setPlans(prev => prev.map(plan => plan.id === id ? updatedPlan : plan));
      return updatedPlan;
    } catch (err: any) {
      setError(err.message || 'Failed to update plan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete a plan
  const deletePlan = useCallback(async (id: number) => {
    try {
      setLoading(true);
      setError(null);
      await planService.deletePlan(id);
      setPlans(prev => prev.filter(plan => plan.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to delete plan');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Load plans on mount
  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  return {
    plans,
    loading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan
  };
};
