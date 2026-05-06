import React, { useState, useRef } from 'react';
import { IonPage, IonIcon, IonAlert } from '@ionic/react';
import { searchOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { usePlans } from '../contexts/PlanContext';
import BottomNavigation from '../components/BottomNavigation';
import BackButton from '../components/BackButton';
import './Plans.css';

const SWIPE_THRESHOLD = 50;

interface SwipeState {
    startX: number;
    startY: number;
    deltaX: number;
    locked: boolean;
    isHorizontal: boolean;
}

const Plans: React.FC = () => {
    const history = useHistory();
    const { plans, addPlan, deletePlan } = usePlans();
    const [showNameAlert, setShowNameAlert] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const displayPlans = plans.filter(p => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.trim().toLowerCase()));

    const [openId, setOpenId] = useState<string | null>(null);
    const [liveOffset, setLiveOffset] = useState(0);
    const [draggingId, setDraggingId] = useState<string | null>(null);

    const swipeRef = useRef<SwipeState | null>(null);

    const closeAll = () => { setOpenId(null); setDraggingId(null); setLiveOffset(0); };

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        deletePlan(id);
        closeAll();
    };

    /* ── touch ── */
    const onTouchStart = (e: React.TouchEvent, id: string) => {
        if (openId && openId !== id) closeAll();
        swipeRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, deltaX: 0, locked: false, isHorizontal: false };
        setDraggingId(id);
    };
    const onTouchMove = (e: React.TouchEvent, id: string) => {
        if (!swipeRef.current) return;
        const s = swipeRef.current;
        const dx = e.touches[0].clientX - s.startX;
        const dy = e.touches[0].clientY - s.startY;
        if (!s.locked) {
            if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
            s.locked = true;
            s.isHorizontal = Math.abs(dx) >= Math.abs(dy);
        }
        if (!s.isHorizontal) return;
        e.preventDefault();
        s.deltaX = dx;
        const base = openId === id ? -70 : 0;
        setLiveOffset(Math.max(-70, Math.min(0, base + dx)));
    };
    const onTouchEnd = (_e: React.TouchEvent, id: string) => {
        if (!swipeRef.current?.isHorizontal) { swipeRef.current = null; setDraggingId(null); return; }
        const base = openId === id ? -70 : 0;
        const total = base + swipeRef.current.deltaX;
        setOpenId(total < -SWIPE_THRESHOLD ? id : null);
        swipeRef.current = null;
        setDraggingId(null);
        setLiveOffset(0);
    };

    /* ── mouse ── */
    const onMouseDown = (e: React.MouseEvent, id: string) => {
        if (openId && openId !== id) closeAll();
        swipeRef.current = { startX: e.clientX, startY: e.clientY, deltaX: 0, locked: true, isHorizontal: true };
        setDraggingId(id);
    };
    const onMouseMove = (e: React.MouseEvent, id: string) => {
        if (!swipeRef.current?.isHorizontal) return;
        const dx = e.clientX - swipeRef.current.startX;
        swipeRef.current.deltaX = dx;
        const base = openId === id ? -70 : 0;
        setLiveOffset(Math.max(-70, Math.min(0, base + dx)));
    };
    const onMouseUp = (_e: React.MouseEvent, id: string) => {
        if (!swipeRef.current) return;
        const base = openId === id ? -70 : 0;
        setOpenId(base + swipeRef.current.deltaX < -SWIPE_THRESHOLD ? id : null);
        swipeRef.current = null;
        setDraggingId(null);
        setLiveOffset(0);
    };

    const deletePanelWidth = (id: string) => {
        if (draggingId === id) return Math.max(0, -liveOffset);
        if (openId === id) return 70;
        return 0;
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
                        style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, padding: '0 8px', fontSize: '18px', color: '#2c5f2c', fontWeight: 600 }}
                    />
                )}
                <div className="plans-header-actions">
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
            </div>

            {/* Hint */}
            {plans.length > 0 && (
                <p className="swipe-hint">← Swipe left to delete</p>
            )}

            {/* Content */}
            <div className="plans-content" onClick={closeAll}>
                {displayPlans.length === 0 ? (
                    <div className="empty-state">
                        <p>{searchQuery ? "No plans match your search" : "Tap the + button above to create your first plan"}</p>
                    </div>
                ) : (
                    <div className="plans-list">
                        {displayPlans.map(plan => {
                            const panelW = deletePanelWidth(plan.id);
                            const dragging = draggingId === plan.id;
                            return (
                                <div key={plan.id} className="swipe-row" onClick={e => e.stopPropagation()}>
                                    {/* Card */}
                                    <div
                                        className="plan-card"
                                        style={{
                                            marginRight: panelW > 0 ? `${panelW + 10}px` : '0px',
                                            transition: dragging ? 'none' : 'margin-right 0.28s cubic-bezier(0.25,0.46,0.45,0.94)',
                                        }}
                                        onTouchStart={e => onTouchStart(e, plan.id)}
                                        onTouchMove={e => onTouchMove(e, plan.id)}
                                        onTouchEnd={e => onTouchEnd(e, plan.id)}
                                        onMouseDown={e => onMouseDown(e, plan.id)}
                                        onMouseMove={e => onMouseMove(e, plan.id)}
                                        onMouseUp={e => onMouseUp(e, plan.id)}
                                        onMouseLeave={e => onMouseUp(e, plan.id)}
                                        onClick={() => {
                                            if (openId === plan.id) { closeAll(); return; }
                                            if (!openId) history.push(`/plans/${plan.id}`);
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
                                    </div>

                                    {/* Delete pill */}
                                    <div
                                        className="delete-panel"
                                        style={{
                                            width: `${panelW}px`,
                                            opacity: panelW > 10 ? 1 : 0,
                                            transition: dragging ? 'none' : 'width 0.28s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.2s ease',
                                        }}
                                    >
                                        <button className="delete-panel-btn" onClick={e => handleDelete(e, plan.id)} aria-label="Delete plan">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="20" height="20">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6l-1 14H6L5 6" />
                                                <path d="M10 11v6M14 11v6" />
                                                <path d="M9 6V4h6v2" />
                                            </svg>
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Plan alert — same IonAlert style as Courses */}
            <IonAlert
                isOpen={showNameAlert}
                onDidDismiss={() => setShowNameAlert(false)}
                cssClass="custom-ui-alert"
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
                            }
                            setShowNameAlert(false);
                        }
                    }
                ]}
            />

            <BottomNavigation />
        </IonPage>
    );
};

export default Plans;
