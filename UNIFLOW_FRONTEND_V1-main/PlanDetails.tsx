import React, { useMemo, useRef, useState, useEffect } from 'react';
import { IonPage, IonIcon } from '@ionic/react';
import { checkmarkDoneOutline, discOutline, flashOutline, ribbonOutline, calendarOutline, flagOutline } from 'ionicons/icons';
import { useParams, useHistory, useLocation } from 'react-router-dom';
import { usePlans } from '../contexts/PlanContext';
import BackButton from '../components/BackButton';
import GlassyDatePicker from '../components/GlassyDatePicker';
import GlassySelect from '../components/GlassySelect';
import './PlanDetails.css';
import { useBlockRightSwipe } from '../hooks/useBlockRightSwipe';
import { getStartOfWeek } from '../utils/focusSessionAnalytics';
import { getWeekStartPreference } from '../utils/appPreferences';

const PlanDetails: React.FC = () => {
    const { planId } = useParams<{ planId: string }>();
    const history = useHistory();
    const location = useLocation<{ focusPlanItemId?: string; focusPlanTab?: 'goals' | 'tasks' }>();
    const { getPlan, addTarget, deleteTarget, toggleTarget, addTask, deleteTask, toggleTask } = usePlans();
    const plan = getPlan(planId);

    const [activeTab, setActiveTab] = useState<'goals' | 'tasks' | 'progress'>('goals');
    const [showAddInput, setShowAddInput] = useState(false);
    const [newItemText, setNewItemText] = useState('');
    const [newItemDate, setNewItemDate] = useState('');
    const [newItemFrequency, setNewItemFrequency] = useState<'daily'|'weekly'>('daily');
    const [newItemGoalId, setNewItemGoalId] = useState<string>('');
    const [longPressedGoalId, setLongPressedGoalId] = useState<string | null>(null);
    const [longPressedTaskId, setLongPressedTaskId] = useState<string | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useBlockRightSwipe();

    const [appPrefsTick, setAppPrefsTick] = useState(0);
    useEffect(() => {
        const onPrefs = () => setAppPrefsTick((n) => n + 1);
        window.addEventListener('uniflow_app_preferences_updated', onPrefs);
        return () => window.removeEventListener('uniflow_app_preferences_updated', onPrefs);
    }, []);

    const weekStartsOn = useMemo(() => getWeekStartPreference(), [appPrefsTick]);
    const startOfWeek = useMemo(() => getStartOfWeek(new Date()), [appPrefsTick]);
    const weekDays = useMemo(
        () =>
            weekStartsOn === 'Sunday'
                ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
                : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        [weekStartsOn]
    );

    useEffect(() => {
        if (!plan) return;
        const st = location.state;
        if (!st?.focusPlanItemId) return;
        if (st.focusPlanTab === 'goals' || st.focusPlanTab === 'tasks') {
            setActiveTab(st.focusPlanTab);
        }
        const itemId = st.focusPlanItemId;
        history.replace(`/plans/${planId}`);
        const timer = window.setTimeout(() => {
            document.getElementById(`pd-plan-item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
        return () => window.clearTimeout(timer);
    }, [location.state, plan, planId, history]);

    if (!plan) {
        return (
            <IonPage style={{ background: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' } as any}>
                <p style={{ color: '#2f6d4f' }}>Plan not found.</p>
            </IonPage>
        );
    }

    const handleAdd = () => {
        if (!newItemText.trim()) return;
        if (activeTab === 'goals') {
            addTarget(planId, newItemText.trim(), newItemDate);
        } else if (activeTab === 'tasks') {
            if (!newItemGoalId) return; // Compulsory to select relation
            addTask(planId, newItemText.trim(), newItemFrequency, newItemGoalId);
        }
        setNewItemText('');
        setNewItemDate('');
        setNewItemFrequency('daily');
        setNewItemGoalId('');
        setShowAddInput(false);
    };

    const totalGoals = plan.targets.length;
    const completedGoals = plan.targets.filter(t => t.completed).length;
    const totalTasks = plan.tasks.length;
    const completedTasks = plan.tasks.filter(t => t.completed).length;
    const pendingTasks = Math.max(totalTasks - completedTasks, 0);
    const overallProgress = (totalGoals + totalTasks) === 0
        ? 0
        : Math.round(((completedGoals + completedTasks) / (totalGoals + totalTasks)) * 100);

    const completedItems = useMemo(() => {
        return [
            ...plan.targets
                .filter(target => target.completed && target.completedAt)
                .map(target => ({
                    id: target.id,
                    title: target.title,
                    completedAt: target.completedAt as string,
                    type: 'goal' as const
                })),
            ...plan.tasks
                .filter(task => task.completed && task.completedAt)
                .map(task => ({
                    id: task.id,
                    title: task.title,
                    completedAt: task.completedAt as string,
                    type: 'task' as const,
                    goalTitle: task.goalId ? plan.targets.find(target => target.id === task.goalId)?.title || 'Unknown Goal' : ''
                }))
        ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
    }, [plan.targets, plan.tasks]);

    const weeklyCompletionStats = useMemo(() => {
        return weekDays.map((day, index) => {
            const dayStart = new Date(startOfWeek);
            dayStart.setDate(startOfWeek.getDate() + index);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);

            const count = completedItems.filter(item => {
                const completedDate = new Date(item.completedAt);
                return completedDate >= dayStart && completedDate <= dayEnd;
            }).length;

            return { day, count };
        });
    }, [completedItems, startOfWeek, weekDays]);

    const maxWeeklyCount = Math.max(...weeklyCompletionStats.map(item => item.count), 1);
    const totalWeekCompletions = weeklyCompletionStats.reduce((sum, item) => sum + item.count, 0);

    const currentStreak = useMemo(() => {
        const completionDays = new Set(
            completedItems.map(item => {
                const completedDate = new Date(item.completedAt);
                completedDate.setHours(0, 0, 0, 0);
                return completedDate.toISOString().slice(0, 10);
            })
        );

        const cursor = new Date();
        cursor.setHours(0, 0, 0, 0);

        let streak = 0;
        while (completionDays.has(cursor.toISOString().slice(0, 10))) {
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
        }

        return streak;
    }, [completedItems]);

    const goalProgress = useMemo(() => {
        return plan.targets.map(target => {
            const linkedTasks = plan.tasks.filter(task => task.goalId === target.id);
            const linkedCompletedTasks = linkedTasks.filter(task => task.completed).length;
            const progress = linkedTasks.length > 0
                ? Math.round((linkedCompletedTasks / linkedTasks.length) * 100)
                : (target.completed ? 100 : 0);

            return {
                ...target,
                linkedTasksCount: linkedTasks.length,
                linkedCompletedTasks,
                progress
            };
        });
    }, [plan.targets, plan.tasks]);

    const weekRangeLabel = useMemo(() => {
        const weekEnd = new Date(startOfWeek);
        weekEnd.setDate(startOfWeek.getDate() + 6);

        return `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }, [startOfWeek]);

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const clearLongPressState = () => {
        setLongPressedGoalId(null);
        setLongPressedTaskId(null);
    };

    const startLongPress = (type: 'goal' | 'task', itemId: string) => {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            if (type === 'goal') {
                setLongPressedGoalId(itemId);
                setLongPressedTaskId(null);
                return;
            }

            setLongPressedTaskId(itemId);
            setLongPressedGoalId(null);
        }, 550);
    };

    return (
        <IonPage style={{ background: '#ffffff', '--background': '#ffffff' } as any}>
            <div className="pd-screen" onClick={clearLongPressState}>

                {/* Status Bar Spacer */}
                <div className="pd-status-bar-spacer" />

                {/* Header */}
                <div className="pd-header">
                    <BackButton />
                    <h1 className="pd-title">{plan.title}</h1>
                </div>

                {/* Pill Tabs */}
                <div className="pd-tabs">
                    <button
                        className={`pd-tab ${activeTab === 'goals' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('goals'); setShowAddInput(false); }}
                    >
                        Goals
                    </button>
                    <button
                        className={`pd-tab ${activeTab === 'tasks' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('tasks'); setShowAddInput(false); }}
                    >
                        Tasks
                    </button>
                    <button
                        className={`pd-tab ${activeTab === 'progress' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('progress'); setShowAddInput(false); }}
                    >
                        Progress
                    </button>
                </div>

                {/* Glassy Pop up for Adding */}
                {showAddInput && activeTab !== 'progress' && (
                    <div className="pd-glassy-popup-overlay">
                        <div className="pd-glassy-popup">
                            <input
                                className="pd-glassy-input"
                                placeholder={activeTab === 'goals' ? 'Enter your goal...' : 'Enter your task...'}
                                value={newItemText}
                                onChange={e => setNewItemText(e.target.value)}
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddInput(false); }}
                            />
                            
                            {activeTab === 'goals' && (
                                <div style={!newItemDate ? { borderRadius: '12px', boxShadow: '0 0 0 1px #ff4d4d' } : {}}>
                                    <GlassyDatePicker 
                                        value={newItemDate} 
                                        onChange={(v) => setNewItemDate(v)} 
                                        placeholder={!newItemDate ? "Select Date (Required)" : "Select Date"}
                                    />
                                </div>
                            )}

                            {activeTab === 'tasks' && (
                                <>
                                    <div className="pd-glassy-extra-field">
                                        <label>Task Frequency:</label>
                                        <GlassySelect 
                                            value={newItemFrequency} 
                                            onChange={(val) => setNewItemFrequency(val as any)}
                                            options={[
                                                { value: 'daily', label: 'Daily' },
                                                { value: 'weekly', label: 'Weekly' }
                                            ]}
                                        />
                                    </div>
                                    <div className="pd-glassy-extra-field" style={{ marginTop: '10px' }}>
                                        <label>Linked Goal (Required):</label>
                                        <GlassySelect 
                                            value={newItemGoalId} 
                                            onChange={(val) => setNewItemGoalId(val)}
                                            placeholder="Select a Goal"
                                            hasError={!newItemGoalId}
                                            options={plan.targets.map(g => ({
                                                value: g.id,
                                                label: g.title
                                            }))}
                                        />
                                    </div>
                                </>
                            )}

                            <div className="pd-glassy-actions">
                                <button 
                                    className="pd-glassy-save" 
                                    onClick={handleAdd}
                                    disabled={
                                        !newItemText.trim() || 
                                        (activeTab === 'goals' && !newItemDate) || 
                                        (activeTab === 'tasks' && !newItemGoalId)
                                    }
                                >
                                    Add
                                </button>
                                <button className="pd-glassy-cancel" onClick={() => { setShowAddInput(false); setNewItemText(''); setNewItemDate(''); setNewItemGoalId(''); }}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Scrollable content area */}
                <div className={`pd-content ${activeTab === 'progress' ? 'progress-mode' : ''}`}>

                    {/* GOALS TAB */}
                    {activeTab === 'goals' && (
                        <>
                            <p className="pd-description">Set the big goals you want to achieve this session</p>
                            <div className="pd-list">
                                {plan.targets.map(target => (
                                    <div
                                        key={target.id}
                                        id={`pd-plan-item-${target.id}`}
                                        className={`pd-item ${target.completed ? 'completed' : ''} ${longPressedGoalId === target.id ? 'show-delete' : ''}`}
                                        onTouchStart={() => startLongPress('goal', target.id)}
                                        onTouchEnd={clearLongPressTimer}
                                        onTouchMove={clearLongPressTimer}
                                        onTouchCancel={clearLongPressTimer}
                                        onMouseDown={() => startLongPress('goal', target.id)}
                                        onMouseUp={clearLongPressTimer}
                                        onMouseLeave={clearLongPressTimer}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (longPressedGoalId === target.id) {
                                                setLongPressedGoalId(null);
                                                return;
                                            }
                                            toggleTarget(planId, target.id);
                                        }}
                                    >
                                        <div className={`pd-checkbox ${target.completed ? 'checked' : ''}`}>
                                            {target.completed && <span className="pd-check-mark">✓</span>}
                                        </div>
                                        <div className="pd-item-content">
                                            <span className="pd-item-text">{target.title}</span>
                                            {target.date && (
                                                <span className="pd-item-meta pd-meta-date">
                                                    <IonIcon icon={calendarOutline} /> {new Date(target.date).toLocaleDateString()}
                                                </span>
                                            )}
                                        </div>
                                        {longPressedGoalId === target.id && (
                                            <div className="pd-actions-overlay">
                                                <button
                                                    className="pd-action-btn delete-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteTarget(planId, target.id);
                                                        setLongPressedGoalId(null);
                                                    }}
                                                    title="Delete goal"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="pd-action-btn close-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setLongPressedGoalId(null);
                                                    }}
                                                    title="Close"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {plan.targets.length === 0 && (
                                    <p className="pd-empty">No goals yet. Tap "+ New Target" to add one.</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* TASKS TAB */}
                    {activeTab === 'tasks' && (
                        <>
                            <p className="pd-description">These are the actions that drive progress toward your targets.</p>
                            <div className="pd-list">
                                {plan.tasks.map(task => (
                                    <div
                                        key={task.id}
                                        id={`pd-plan-item-${task.id}`}
                                        className={`pd-item ${task.completed ? 'completed' : ''} ${longPressedTaskId === task.id ? 'show-delete' : ''}`}
                                        onTouchStart={() => startLongPress('task', task.id)}
                                        onTouchEnd={clearLongPressTimer}
                                        onTouchMove={clearLongPressTimer}
                                        onTouchCancel={clearLongPressTimer}
                                        onMouseDown={() => startLongPress('task', task.id)}
                                        onMouseUp={clearLongPressTimer}
                                        onMouseLeave={clearLongPressTimer}
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            if (longPressedTaskId === task.id) {
                                                setLongPressedTaskId(null);
                                                return;
                                            }
                                            toggleTask(planId, task.id);
                                        }}
                                    >
                                        <div className={`pd-checkbox ${task.completed ? 'checked' : ''}`}>
                                            {task.completed && <span className="pd-check-mark">✓</span>}
                                        </div>
                                        <div className="pd-item-content">
                                            <span className="pd-item-text">
                                                {task.title}
                                                {task.goalId && (
                                                    <span style={{ display: 'block', fontSize: '11px', color: '#888', marginTop: '2px', fontWeight: 'normal' }}>
                                                        ↳ {plan.targets.find(t => t.id === task.goalId)?.title || 'Unknown Goal'}
                                                    </span>
                                                )}
                                            </span>
                                            {task.frequency && (
                                                <span className={`pd-item-meta pd-meta-freq pd-freq-${task.frequency}`}>
                                                    {task.frequency.charAt(0).toUpperCase() + task.frequency.slice(1)}
                                                </span>
                                            )}
                                        </div>
                                        {longPressedTaskId === task.id && (
                                            <div className="pd-actions-overlay">
                                                <button
                                                    className="pd-action-btn delete-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        deleteTask(planId, task.id);
                                                        setLongPressedTaskId(null);
                                                    }}
                                                    title="Delete task"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6"></polyline>
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                        <line x1="10" y1="11" x2="10" y2="17"></line>
                                                        <line x1="14" y1="11" x2="14" y2="17"></line>
                                                    </svg>
                                                </button>
                                                <button
                                                    className="pd-action-btn close-btn"
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        setLongPressedTaskId(null);
                                                    }}
                                                    title="Close"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {plan.tasks.length === 0 && (
                                    <p className="pd-empty">No tasks yet. Tap "+ New Task" to add one.</p>
                                )}
                            </div>
                        </>
                    )}

                    {/* PROGRESS TAB */}
                    {activeTab === 'progress' && (
                        <div className="pd-progress-tab-content">
                            <div className="pd-weekly-analytics-header">
                                <h2>Progress Overview</h2>
                                <p>{weekRangeLabel}</p>
                            </div>

                            <div className="pd-analytics-grid">
                                <div className="pd-metric-card">
                                    <div className="pd-metric-icon green-bg">
                                        <IonIcon icon={discOutline} />
                                    </div>
                                    <div className="pd-metric-content">
                                        <span className="pd-metric-title">Plan Completion</span>
                                        <span className="pd-metric-value">{overallProgress}%</span>
                                        <span className="pd-metric-sub">{completedGoals + completedTasks} of {totalGoals + totalTasks} items done</span>
                                    </div>
                                </div>

                                <div className="pd-metric-card">
                                    <div className="pd-metric-icon blue-bg">
                                        <IonIcon icon={checkmarkDoneOutline} />
                                    </div>
                                    <div className="pd-metric-content">
                                        <span className="pd-metric-title">Tasks Done</span>
                                        <span className="pd-metric-value">{completedTasks}</span>
                                        <span className="pd-metric-sub">{pendingTasks} pending</span>
                                    </div>
                                </div>

                                <div className="pd-metric-card">
                                    <div className="pd-metric-icon orange-bg">
                                        <IonIcon icon={flagOutline} />
                                    </div>
                                    <div className="pd-metric-content">
                                        <span className="pd-metric-title">Goals Reached</span>
                                        <span className="pd-metric-value">{completedGoals}</span>
                                        <span className="pd-metric-sub">{Math.max(totalGoals - completedGoals, 0)} left to complete</span>
                                    </div>
                                </div>

                                <div className="pd-metric-card">
                                    <div className="pd-metric-icon purple-bg">
                                        <IonIcon icon={flashOutline} />
                                    </div>
                                    <div className="pd-metric-content">
                                        <span className="pd-metric-title">Current Streak</span>
                                        <span className="pd-metric-value">{currentStreak}</span>
                                        <span className="pd-metric-sub">{currentStreak === 1 ? 'day' : 'days'} in a row</span>
                                    </div>
                                </div>
                            </div>

                            {/* Weekly completion chart */}
                            <div className="pd-bar-chart">
                                {weeklyCompletionStats.map(item => (
                                    <div key={item.day} className="pd-bar-col">
                                        <div className="pd-bar-track">
                                            <div
                                                className="pd-bar-fill"
                                                style={{ height: `${item.count === 0 ? 12 : Math.max((item.count / maxWeeklyCount) * 100, 18)}%` }}
                                            ></div>
                                        </div>
                                        <span className="pd-bar-value">{item.count}</span>
                                        <span className="pd-bar-label">{item.day}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="pd-dashboard-card">
                                <h3 className="pd-card-title"><IonIcon icon={calendarOutline} /> This Week</h3>
                                <div className="pd-summary-grid">
                                    <div className="pd-summary-item">
                                        <span className="pd-summary-label">Completed This Week</span>
                                        <span className="pd-summary-value">{totalWeekCompletions}</span>
                                    </div>
                                    <div className="pd-summary-item">
                                        <span className="pd-summary-label">Goal Completion</span>
                                        <span className="pd-summary-value">{completedGoals}/{totalGoals || 0}</span>
                                    </div>
                                </div>
                                <div className="pd-chart-legend">
                                    <span className="pd-legend-item"><span className="pd-legend-dot pd-green"></span> Completed items this week</span>
                                </div>
                            </div>

                            <div className="pd-dashboard-card">
                                <h3 className="pd-card-title"><IonIcon icon={ribbonOutline} /> Goal Breakdown</h3>
                                <div className="pd-goal-progress-list">
                                    {goalProgress.length === 0 && (
                                        <p className="pd-card-empty">Add goals and tasks to see goal-by-goal progress here.</p>
                                    )}
                                    {goalProgress.map(goal => (
                                        <div key={goal.id} className="pd-goal-progress-item">
                                            <div className="pd-goal-progress-header">
                                                <div>
                                                    <span className="pd-goal-progress-title">{goal.title}</span>
                                                    <span className="pd-goal-progress-meta">
                                                        {goal.linkedCompletedTasks}/{goal.linkedTasksCount} linked tasks done
                                                    </span>
                                                </div>
                                                <span className="pd-goal-progress-percent">{goal.progress}%</span>
                                            </div>
                                            <div className="pd-goal-progress-bar">
                                                <div className="pd-goal-progress-fill" style={{ width: `${goal.progress}%` }} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pd-dashboard-card">
                                <h3 className="pd-card-title"><IonIcon icon={calendarOutline} /> Recent Activity</h3>
                                <div className="pd-activity-list">
                                    {completedItems.length === 0 && (
                                        <p className="pd-card-empty">Completed tasks and goals will appear here once you tick them.</p>
                                    )}
                                    {completedItems.slice(0, 5).map(item => (
                                        <div key={`${item.type}-${item.id}`} className="pd-activity-item">
                                            <div className={`pd-activity-badge ${item.type === 'task' ? 'task' : 'goal'}`}>
                                                {item.type === 'task' ? 'Task' : 'Goal'}
                                            </div>
                                            <div className="pd-activity-copy">
                                                <span className="pd-activity-title">{item.title}</span>
                                                <span className="pd-activity-meta">
                                                    {item.type === 'task' && item.goalTitle ? `${item.goalTitle} • ` : ''}
                                                    {new Date(item.completedAt).toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Floating Add Button (Goals & Tasks only) */}
                {!showAddInput && activeTab !== 'progress' && (
                    <div className="pd-add-area">
                        <button className="pd-fab" onClick={() => setShowAddInput(true)}>
                            <span className="pd-fab-plus">+</span>
                            <span>{activeTab === 'goals' ? 'New Target' : 'New Task'}</span>
                        </button>
                    </div>
                )}

            </div>
        </IonPage>
    );
};

export default PlanDetails;
