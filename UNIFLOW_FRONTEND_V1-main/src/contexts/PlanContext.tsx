import React, { createContext, useContext, useState, useEffect } from 'react';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';

export interface Objective {
    id: string;
    title: string;
    completed: boolean;
    completedAt?: string;
    date?: string;
    frequency?: 'daily' | 'weekly';
    goalId?: string;
}

export interface Plan {
    id: string;
    title: string;
    isCustom: boolean;
    bannerImage: string | null;
    targets: Objective[];
    tasks: Objective[];
    progress: number;
}

interface PlanContextType {
    plans: Plan[];
    addPlan: (title: string, isCustom: boolean, bannerImage?: string) => string; // returns created plan ID
    deletePlan: (id: string) => void;
    getPlan: (id: string) => Plan | undefined;
    addTarget: (planId: string, title: string, date?: string) => void;
    deleteTarget: (planId: string, targetId: string) => void;
    toggleTarget: (planId: string, targetId: string) => void;
    addTask: (planId: string, title: string, frequency: 'daily' | 'weekly', goalId: string) => void;
    deleteTask: (planId: string, taskId: string) => void;
    toggleTask: (planId: string, taskId: string) => void;
    updateProgress: (planId: string, progress: number) => void;
    renamePlan: (id: string, newTitle: string) => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

const normalizeObjective = (objective: Objective): Objective => {
    if (!objective.completed) {
        return {
            ...objective,
            completedAt: undefined
        };
    }

    return {
        ...objective,
        completedAt: objective.completedAt || new Date().toISOString()
    };
};

const calculatePlanProgress = (targets: Objective[], tasks: Objective[]) => {
    const totalItems = targets.length + tasks.length;

    if (totalItems === 0) {
        return 0;
    }

    const completedItems = targets.filter(target => target.completed).length + tasks.filter(task => task.completed).length;
    return Math.round((completedItems / totalItems) * 100);
};

const withComputedProgress = (plan: Plan): Plan => {
    const targets = plan.targets.map(normalizeObjective);
    const tasks = plan.tasks.map(normalizeObjective);

    return {
        ...plan,
        targets,
        tasks,
        progress: calculatePlanProgress(targets, tasks)
    };
};

const mapLegacyCustomPlan = (legacyPlan: any): Plan => {
    const id = legacyPlan?.id != null ? String(legacyPlan.id) : Date.now().toString();
    return withComputedProgress({
        id,
        title: legacyPlan?.title || 'Untitled Plan',
        isCustom: true,
        bannerImage: legacyPlan?.bannerImage || null,
        targets: Array.isArray(legacyPlan?.targets) ? legacyPlan.targets : [],
        tasks: Array.isArray(legacyPlan?.tasks) ? legacyPlan.tasks : [],
        progress: typeof legacyPlan?.progress === 'number' ? legacyPlan.progress : 0
    });
};

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [plans, setPlans] = useState<Plan[]>(() => {
        const saved = localStorage.getItem('uniflow_plans');
        if (saved) {
            try {
                return JSON.parse(saved).map((plan: Plan) => withComputedProgress(plan));
            } catch (e) {
                // Fall through to legacy storage check below.
            }
        }

        // Backward compatibility: some flows previously wrote plans to `customPlans`.
        const legacySaved = localStorage.getItem('customPlans');
        if (legacySaved) {
            try {
                return JSON.parse(legacySaved).map((plan: any) => mapLegacyCustomPlan(plan));
            } catch (e) {
                return [];
            }
        }

        return [];
    });

    useEffect(() => {
        localStorage.setItem('uniflow_plans', JSON.stringify(plans));
    }, [plans]);

    useEffect(() => {
        const onCleared = () => setPlans([]);
        window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCleared);
        return () => window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCleared);
    }, []);

    useEffect(() => {
        const resetFlag = 'uniflow_plans_hard_reset_v1';
        if (localStorage.getItem(resetFlag)) {
            return;
        }

        // Hard reset old/legacy plan stores so we start from a clean state.
        localStorage.removeItem('uniflow_plans');
        localStorage.removeItem('customPlans');
        setPlans([]);
        localStorage.setItem(resetFlag, 'true');
    }, []);

    // One-time: Templates used to write only to `activePlans`; merge into PlanContext so Plans page shows them.
    useEffect(() => {
        const migrateKey = 'uniflow_migrated_activePlans_v1';
        if (localStorage.getItem(migrateKey)) {
            return;
        }

        const raw = localStorage.getItem('activePlans');
        if (!raw) {
            localStorage.setItem(migrateKey, 'true');
            return;
        }

        try {
            const active = JSON.parse(raw);
            if (Array.isArray(active) && active.length > 0) {
                setPlans((prev) => {
                    const existingTitles = new Set(prev.map((p) => p.title));
                    const merged = [...prev];
                    let i = 0;
                    for (const item of active) {
                        const title = item?.title;
                        if (!title || existingTitles.has(title)) continue;
                        existingTitles.add(title);
                        merged.unshift(
                            withComputedProgress({
                                id: `${Date.now()}-${i++}`,
                                title,
                                isCustom: false,
                                bannerImage: item.icon || item.bannerImage || null,
                                targets: [],
                                tasks: [],
                                progress: typeof item.progress === 'number' ? item.progress : 0
                            })
                        );
                    }
                    return merged;
                });
            }
            localStorage.removeItem('activePlans');
        } catch {
            // ignore corrupt activePlans
        }
        localStorage.setItem(migrateKey, 'true');
    }, []);

    const addPlan = (title: string, isCustom: boolean, bannerImage?: string) => {
        const newId = Date.now().toString();
        const newPlan: Plan = {
            id: newId,
            title,
            isCustom,
            bannerImage: bannerImage || null,
            targets: [],
            tasks: [],
            progress: 0
        };
        setPlans(prev => [withComputedProgress(newPlan), ...prev]);
        return newId;
    };

    const deletePlan = (id: string) => {
        setPlans(prev => prev.filter(p => p.id !== id));
    };

    const renamePlan = (id: string, newTitle: string) => {
        setPlans(prev => prev.map(p => p.id === id ? { ...p, title: newTitle } : p));
    };

    const getPlan = (id: string) => {
        return plans.find(p => p.id === id);
    };

    const addTarget = (planId: string, title: string, date?: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    targets: [...p.targets, { id: Date.now().toString(), title, completed: false, date }]
                });
            }
            return p;
        }));
    };

    const toggleTarget = (planId: string, targetId: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    targets: p.targets.map(t => t.id === targetId
                        ? {
                            ...t,
                            completed: !t.completed,
                            completedAt: !t.completed ? new Date().toISOString() : undefined
                        }
                        : t)
                });
            }
            return p;
        }));
    };

    const deleteTarget = (planId: string, targetId: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    targets: p.targets.filter(t => t.id !== targetId),
                    tasks: p.tasks.filter(t => t.goalId !== targetId)
                });
            }
            return p;
        }));
    };

    const addTask = (planId: string, title: string, frequency: 'daily' | 'weekly', goalId: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    tasks: [...p.tasks, { id: Date.now().toString(), title, completed: false, frequency, goalId }]
                });
            }
            return p;
        }));
    };

    const deleteTask = (planId: string, taskId: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    tasks: p.tasks.filter(t => t.id !== taskId)
                });
            }
            return p;
        }));
    };

    const toggleTask = (planId: string, taskId: string) => {
        setPlans(prev => prev.map(p => {
            if (p.id === planId) {
                return withComputedProgress({
                    ...p,
                    tasks: p.tasks.map(t => t.id === taskId
                        ? {
                            ...t,
                            completed: !t.completed,
                            completedAt: !t.completed ? new Date().toISOString() : undefined
                        }
                        : t)
                });
            }
            return p;
        }));
    };

    const updateProgress = (planId: string, progress: number) => {
        setPlans(prev => prev.map(p => p.id === planId ? { ...withComputedProgress(p), progress } : p));
    };

    return (
        <PlanContext.Provider value={{
            plans, addPlan, deletePlan, renamePlan, getPlan, addTarget, deleteTarget, toggleTarget, addTask, deleteTask, toggleTask, updateProgress
        }}>
            {children}
        </PlanContext.Provider>
    );
};

export const usePlans = () => {
    const context = useContext(PlanContext);
    if (context === undefined) {
        throw new Error('usePlans must be used within a PlanProvider');
    }
    return context;
};
