import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

export type SubscriptionPlan = 'free' | 'premium';
export type SubscriptionLimitKey =
  | 'aiQuestionsPerMonth'
  | 'audioTranscriptionMinutesPerMonth'
  | 'analyticsHistoryDays'
  | 'pdfUploads'
  | 'focusSessionsPerDay';

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlan;
  name: string;
  price: number;
  priceLabel: string;
  description: string;
  accent: string;
  limits: Record<SubscriptionLimitKey, number | 'unlimited'>;
  features: string[];
}

interface SubscriptionContextType {
  currentPlan: SubscriptionPlan;
  currentPlanDetails: SubscriptionPlanDefinition;
  plans: SubscriptionPlanDefinition[];
  setPlan: (plan: SubscriptionPlan) => void;
  isPremium: boolean;
  getLimit: (key: SubscriptionLimitKey) => number | 'unlimited';
}

const FREE_PLAN: SubscriptionPlanDefinition = {
  id: 'free',
  name: 'Free',
  price: 0,
  priceLabel: '$0',
  description: 'Good for getting started with your core study flow.',
  accent: 'linear-gradient(135deg, #dff5e7 0%, #bde4ca 100%)',
  limits: {
    aiQuestionsPerMonth: 10,
    audioTranscriptionMinutesPerMonth: 15,
    analyticsHistoryDays: 7,
    pdfUploads: 5,
    focusSessionsPerDay: 5,
  },
  features: [
    'Basic notes, tasks and focus sessions',
    '10 AI asks each month',
    '15 minutes of audio transcription each month',
    '7 days of analytics history',
    'Up to 5 PDF uploads',
  ],
};

const PREMIUM_PLAN: SubscriptionPlanDefinition = {
  id: 'premium',
  name: 'Premium',
  price: 6.99,
  priceLabel: '$6.99',
  description: 'For students who want heavier AI, analytics and study support.',
  accent: 'linear-gradient(135deg, #46b46b 0%, #99dab3 100%)',
  limits: {
    aiQuestionsPerMonth: 'unlimited',
    audioTranscriptionMinutesPerMonth: 180,
    analyticsHistoryDays: 'unlimited',
    pdfUploads: 'unlimited',
    focusSessionsPerDay: 'unlimited',
  },
  features: [
    'Unlimited AI asks',
    '180 minutes of audio transcription each month',
    'Unlimited analytics history',
    'Unlimited PDF uploads',
    'Unlimited daily focus sessions',
  ],
};

const PLAN_DEFINITIONS: Record<SubscriptionPlan, SubscriptionPlanDefinition> = {
  free: FREE_PLAN,
  premium: PREMIUM_PLAN,
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const getStorageKey = (userKey?: string) => `uniflow_subscription_plan_${userKey || 'guest'}`;

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const userKey = user?.id || user?.email;
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>('free');

  useEffect(() => {
    const savedPlan = localStorage.getItem(getStorageKey(userKey));
    setCurrentPlan(savedPlan === 'premium' ? 'premium' : 'free');
  }, [userKey]);

  const setPlan = (plan: SubscriptionPlan) => {
    localStorage.setItem(getStorageKey(userKey), plan);
    setCurrentPlan(plan);
  };

  const value = useMemo<SubscriptionContextType>(() => {
    const currentPlanDetails = PLAN_DEFINITIONS[currentPlan];

    return {
      currentPlan,
      currentPlanDetails,
      plans: [FREE_PLAN, PREMIUM_PLAN],
      setPlan,
      isPremium: currentPlan === 'premium',
      getLimit: (key: SubscriptionLimitKey) => currentPlanDetails.limits[key],
    };
  }, [currentPlan]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);

  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }

  return context;
};
