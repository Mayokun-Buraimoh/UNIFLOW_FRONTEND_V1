import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { planService } from '../api/services';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';
import { isUuid } from '../utils/uuidUtils';

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
    loading: boolean;
    addPlan: (title: string, isCustom: boolean, bannerImage?: string) => string;
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
        return { ...objective, completedAt: undefined };
    }
    return {
        ...objective,
        completedAt: objective.completedAt || new Date().toISOString(),
    };
};

const calculatePlanProgress = (targets: Objective[], tasks: Objective[]) => {
    const totalItems = targets.length + tasks.length;
    if (totalItems === 0) return 0;
    const completedItems =
        targets.filter((target) => target.completed).length +
        tasks.filter((task) => task.completed).length;
    return Math.round((completedItems / totalItems) * 100);
};

const withComputedProgress = (plan: Plan): Plan => {
    const targets = (plan.targets || []).map(normalizeObjective);
    const tasks = (plan.tasks || []).map(normalizeObjective);
    return {
        ...plan,
        targets,
        tasks,
        progress: calculatePlanProgress(targets, tasks),
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
        progress: typeof legacyPlan?.progress === 'number' ? legacyPlan.progress : 0,
    });
};

const mapApiPlan = (raw: any): Plan =>
    withComputedProgress({
        id: String(raw.id),
        title: raw.title || 'Untitled Plan',
        isCustom: raw.isCustom ?? true,
        bannerImage: raw.bannerImage ?? null,
        targets: Array.isArray(raw.targets) ? raw.targets : [],
        tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
        progress: typeof raw.progress === 'number' ? raw.progress : 0,
    });

function readPlansFromLocalStorage(): Plan[] {
    const saved = localStorage.getItem('uniflow_plans');
    if (saved) {
        try {
            return JSON.parse(saved).map((plan: Plan) => withComputedProgress(plan));
        } catch {
            /* fall through */
        }
    }

    const legacySaved = localStorage.getItem('customPlans');
    if (legacySaved) {
        try {
            return JSON.parse(legacySaved).map((plan: any) => mapLegacyCustomPlan(plan));
        } catch {
            return [];
        }
    }

    return [];
}

/** One-time upload of local plans to the server (Ruby reads DB only). Keeps localStorage intact. */
async function migrateLocalPlansToServerIfNeeded(): Promise<Plan[]> {
    const migrateKey = 'uniflow_plans_migrated_to_server_v1';
    if (localStorage.getItem(migrateKey)) return [];

    const localPlans = readPlansFromLocalStorage();
    if (localPlans.length === 0) {
        localStorage.setItem(migrateKey, 'true');
        return [];
    }

    try {
        const created: Plan[] = [];
        for (const p of localPlans) {
            const plan = await planService.createPlan({
                title: p.title || 'Untitled Plan',
                isCustom: p.isCustom ?? true,
                bannerImage: p.bannerImage,
            });
            const withItems = await planService.updatePlan(plan.id, {
                targets: p.targets || [],
                tasks: p.tasks || [],
            });
            created.push(mapApiPlan(withItems));
        }
        localStorage.setItem(migrateKey, 'true');
        return created;
    } catch {
        return [];
    }
}

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [plans, setPlans] = useState<Plan[]>(() => readPlansFromLocalStorage());
    const [loading, setLoading] = useState(false);

    // Client cache — UI reads/writes localStorage; Ruby never touches this.
    useEffect(() => {
        localStorage.setItem('uniflow_plans', JSON.stringify(plans));
    }, [plans]);

    const reloadPlansFromServer = useCallback(async () => {
        try {
            const remote = await planService.getPlans();
            if (Array.isArray(remote)) {
                setPlans(remote.map(mapApiPlan));
            }
        } catch (e) {
            console.warn('Failed to load plans from server', e);
        }
    }, []);

    // Background sync: server is source of truth when online; localStorage remains the client cache.
    useEffect(() => {
        const boot = async () => {
            setLoading(true);
            try {
                const remote = await planService.getPlans();
                if (remote?.length) {
                    setPlans(remote.map(mapApiPlan));
                    return;
                }
                const migrated = await migrateLocalPlansToServerIfNeeded();
                if (migrated.length) {
                    setPlans(migrated);
                }
            } catch (e) {
                console.warn('PlanProvider server sync skipped — using localStorage', e);
            } finally {
                setLoading(false);
            }
        };
        void boot();
    }, []);

    useEffect(() => {
        const onUpdated = () => void reloadPlansFromServer();
        window.addEventListener('uniflow_plans_updated', onUpdated);
        return () => window.removeEventListener('uniflow_plans_updated', onUpdated);
    }, [reloadPlansFromServer]);

    useEffect(() => {
        const onCleared = () => setPlans([]);
        window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCleared);
        return () => window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onCleared);
    }, []);

    // One-time: Templates used to write only to `activePlans`; merge into PlanContext.
    useEffect(() => {
        const migrateKey = 'uniflow_migrated_activePlans_v1';
        if (localStorage.getItem(migrateKey)) return;

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
                                progress: typeof item.progress === 'number' ? item.progress : 0,
                            })
                        );
                    }
                    return merged;
                });
            }
            localStorage.removeItem('activePlans');
        } catch {
            /* ignore corrupt activePlans */
        }
        localStorage.setItem(migrateKey, 'true');
    }, []);

    const persistPlanToServer = useCallback((planId: string, patch: Partial<Plan>) => {
        if (!isUuid(planId)) return;
        void planService.updatePlan(planId, patch).catch((e) => console.warn('Plan sync failed', e));
    }, []);

    const addPlan = (title: string, isCustom: boolean, bannerImage?: string) => {
        const newId = Date.now().toString();
        const newPlan = withComputedProgress({
            id: newId,
            title,
            isCustom,
            bannerImage: bannerImage || null,
            targets: [],
            tasks: [],
            progress: 0,
        });
        setPlans((prev) => [newPlan, ...prev]);
        void (async () => {
            try {
                const created = await planService.createPlan({
                    title,
                    isCustom,
                    bannerImage: bannerImage || null,
                });
                setPlans((prev) =>
                    prev.map((p) => (p.id === newId ? mapApiPlan(created) : p))
                );
            } catch (e) {
                console.warn('Create plan server sync failed — kept in localStorage', e);
            }
        })();
        return newId;
    };

    const deletePlan = (id: string) => {
        setPlans((prev) => prev.filter((p) => p.id !== id));
        if (isUuid(id)) {
            void planService.deletePlan(id).catch((e) => console.warn('Delete plan sync failed', e));
        }
    };

    const renamePlan = (id: string, newTitle: string) => {
        setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, title: newTitle } : p)));
        persistPlanToServer(id, { title: newTitle });
    };

    const getPlan = (id: string) => plans.find((p) => p.id === id);

    const addTarget = (planId: string, title: string, date?: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const targets = [...plan.targets, { id: Date.now().toString(), title, completed: false, date }];
        const updated = withComputedProgress({ ...plan, targets });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { targets: updated.targets });
    };

    const toggleTarget = (planId: string, targetId: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const targets = plan.targets.map((t) =>
            t.id === targetId
                ? {
                      ...t,
                      completed: !t.completed,
                      completedAt: !t.completed ? new Date().toISOString() : undefined,
                  }
                : t
        );
        const updated = withComputedProgress({ ...plan, targets });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { targets: updated.targets });
    };

    const deleteTarget = (planId: string, targetId: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const targets = plan.targets.filter((t) => t.id !== targetId);
        const tasks = plan.tasks.filter((t) => t.goalId !== targetId);
        const updated = withComputedProgress({ ...plan, targets, tasks });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { targets: updated.targets, tasks: updated.tasks });
    };

    const addTask = (planId: string, title: string, frequency: 'daily' | 'weekly', goalId: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const tasks = [
            ...plan.tasks,
            { id: Date.now().toString(), title, completed: false, frequency, goalId },
        ];
        const updated = withComputedProgress({ ...plan, tasks });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { tasks: updated.tasks });
    };

    const deleteTask = (planId: string, taskId: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const tasks = plan.tasks.filter((t) => t.id !== taskId);
        const updated = withComputedProgress({ ...plan, tasks });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { tasks: updated.tasks });
    };

    const toggleTask = (planId: string, taskId: string) => {
        const plan = plans.find((p) => p.id === planId);
        if (!plan) return;
        const tasks = plan.tasks.map((t) =>
            t.id === taskId
                ? {
                      ...t,
                      completed: !t.completed,
                      completedAt: !t.completed ? new Date().toISOString() : undefined,
                  }
                : t
        );
        const updated = withComputedProgress({ ...plan, tasks });
        setPlans((prev) => prev.map((p) => (p.id === planId ? updated : p)));
        persistPlanToServer(planId, { tasks: updated.tasks });
    };

    const updateProgress = (planId: string, progress: number) => {
        setPlans((prev) => prev.map((p) => (p.id === planId ? { ...withComputedProgress(p), progress } : p)));
    };

    return (
        <PlanContext.Provider
            value={{
                plans,
                loading,
                addPlan,
                deletePlan,
                renamePlan,
                getPlan,
                addTarget,
                deleteTarget,
                toggleTarget,
                addTask,
                deleteTask,
                toggleTask,
                updateProgress,
            }}
        >
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
