import React, { useState, useRef } from 'react';
import { IonPage, IonIcon, IonAlert } from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { usePlans } from '../contexts/PlanContext';
import BottomNavigation from '../components/BottomNavigation';
import BackButton from '../components/BackButton';
import './Plans.css';



const Plans: React.FC = () => {
    const history = useHistory();
    const { plans, addPlan, deletePlan, renamePlan } = usePlans();
    const [showNameAlert, setShowNameAlert] = useState(false);
    const [showRenameAlert, setShowRenameAlert] = useState(false);
    const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const displayPlans = plans.filter(p => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()));

    const [longPressedPlanId, setLongPressedPlanId] = useState<string | null>(null);
    const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLongPressState = () => {
        setLongPressedPlanId(null);
    };

    const clearLongPressTimer = () => {
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const startLongPress = (id: string) => {
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
            setLongPressedPlanId(id);
        }, 550);
    };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deletePlan(id);
        clearLongPressState();
    };

    const handleRenameClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setEditingPlanId(id);
        setShowRenameAlert(true);
        clearLongPressState();
    };

    return (
        <IonPage className="plans-page">

            {/* Status bar spacer */}
            <div className="status-bar-spacer" />

            {/* Header */}
            <div className="plans-header">
                <BackButton />
                {!isSearching ? (
                    <h1 className="plans-title">Plans</h1>
                ) : (
                    <input 
                        type="text"
                        autoFocus
                        placeholder="Search plans..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="plans-title"
                        style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, padding: '0 8px', fontSize: '18px', color: '#2f6d4f', fontWeight: 600 }}
                    />
                )}
                <div className="plans-header-actions">
                    <div className="plans-header-actions-top">
                        <button 
                            className="plans-icon-btn plans-search-btn" 
                            onClick={() => {
                                if (isSearching) {
                                    setIsSearching(false);
                                    setSearchQuery('');
                                } else {
                                    setIsSearching(true);
                                }
                            }}
                        >
                            {isSearching ? <span style={{fontSize: '24px', lineHeight: 1, padding: '0 4px'}}>×</span> : <IonIcon icon={searchOutline} />}
                        </button>
                        <div className="plans-add-btn-container">
                            <button
                                className="plans-add-circle-btn"
                                onClick={() => setShowNameAlert(true)}
                                aria-label="Create plan"
                            >
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="12" y1="5" x2="12" y2="19" />
                                    <line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <button
                        className="plans-templates-btn"
                        onClick={() => history.push('/templates')}
                        aria-label="Open templates"
                    >
                        Templates
                    </button>
                </div>
            </div>

            {/* Hint */}
            {plans.length > 0 && (
                <p className="swipe-hint">Hold to edit or delete</p>
            )}

            {/* Content */}
            <div className="plans-content" onClick={() => { clearLongPressState(); }}>
                {displayPlans.length === 0 ? (
                    <div className="empty-state">
                        <p>{searchQuery ? "No plans match your search" : "Tap the + button above to create your first plan"}</p>
                    </div>
                ) : (
                    <div className="plans-list">
                        {displayPlans.map(plan => {
                            const isLongPressed = longPressedPlanId === plan.id;
                            return (
                                <div 
                                    key={plan.id} 
                                    className={`plan-card ${isLongPressed ? 'active-delete' : ''}`}
                                    onContextMenu={(e) => { e.preventDefault(); }}
                                    style={{ WebkitUserSelect: 'none', userSelect: 'none' }}
                                    onTouchStart={() => startLongPress(plan.id)}
                                    onTouchEnd={clearLongPressTimer}
                                    onTouchMove={clearLongPressTimer}
                                    onTouchCancel={clearLongPressTimer}
                                    onMouseDown={() => startLongPress(plan.id)}
                                    onMouseUp={clearLongPressTimer}
                                    onMouseLeave={clearLongPressTimer}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isLongPressed) {
                                            history.push(`/plans/${plan.id}`);
                                        }
                                    }}
                                >
                                    <div className="plan-icon-wrapper">
                                        <img
                                            src={plan.bannerImage || '/assets/icons/clipboard.png'}
                                            alt={plan.title}
                                            className="plan-icon"
                                        />
                                    </div>
                                    <div className="plan-info">
                                        <h3>{plan.title}</h3>
                                        <div className="progress-bar">
                                            <div className="progress-fill" style={{ width: `${plan.progress}%` }} />
                                        </div>
                                    </div>

                                    {/* Inline Options Popup */}
                                    {isLongPressed && (
                                        <div 
                                            className="inline-options-popup" 
                                            onClick={(e) => e.stopPropagation()}
                                            onTouchStart={(e) => e.stopPropagation()}
                                        >
                                            <div 
                                                className="popup-btn rename-btn" 
                                                onClick={(e) => handleRenameClick(e, plan.id)}
                                            >
                                                Rename
                                            </div>
                                            <div className="popup-divider" />
                                            <div 
                                                className="popup-btn delete-btn" 
                                                onClick={(e) => handleDelete(e, plan.id)}
                                            >
                                                Delete Plan
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Popover overlay background click handler */}
                {longPressedPlanId && (
                    <div
                        className="popover-overlay"
                        onClick={() => {
                            clearLongPressState();
                        }}
                    ></div>
                )}
            </div>

            {/* Create Plan alert — glass panel aligned with Home task modal */}
            <IonAlert
                isOpen={showNameAlert}
                onDidDismiss={() => setShowNameAlert(false)}
                cssClass="plans-glass-alert"
                header=""
                message={"Enter your\nplan name"}
                inputs={[
                    {
                        name: 'planName',
                        type: 'text',
                        placeholder: 'e.g. Study Plan',
                        cssClass: 'custom-alert-input'
                    }
                ]}
                buttons={[
                    {
                        text: 'Create',
                        cssClass: 'alert-btn-create',
                        handler: (data) => {
                            if (data.planName?.trim()) {
                                addPlan(data.planName.trim(), true);
                                // Ensure newly created plans are visible immediately,
                                // even if a previous search filter was active.
                                setIsSearching(false);
                                setSearchQuery('');
                            }
                            setShowNameAlert(false);
                        }
                    }
                ]}
            />

            {/* Rename Plan alert */}
            <IonAlert
                isOpen={showRenameAlert}
                onDidDismiss={() => {
                    setShowRenameAlert(false);
                    setEditingPlanId(null);
                }}
                cssClass="plans-glass-alert"
                header=""
                message={"Rename your\nplan"}
                inputs={[
                    {
                        name: 'planName',
                        type: 'text',
                        placeholder: 'New plan name...',
                        value: editingPlanId ? plans.find(p => p.id === editingPlanId)?.title : '',
                        cssClass: 'custom-alert-input'
                    }
                ]}
                buttons={[
                    {
                        text: 'Save',
                        cssClass: 'alert-btn-create',
                        handler: (data) => {
                            if (data.planName?.trim() && editingPlanId) {
                                renamePlan(editingPlanId, data.planName.trim());
                            }
                            setShowRenameAlert(false);
                            setEditingPlanId(null);
                        }
                    }
                ]}
            />

            <BottomNavigation />
        </IonPage>
    );
};

export default Plans;
