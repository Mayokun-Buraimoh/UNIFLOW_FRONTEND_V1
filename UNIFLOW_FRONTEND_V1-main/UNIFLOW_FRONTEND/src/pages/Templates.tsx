import React, { useState, useRef, useEffect } from 'react';
import { IonIcon, IonPage } from '@ionic/react';
import { search, trash, arrowBack } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { usePlans } from '../hooks/usePlans';
import './Templates.css';
import BackButton from '../components/BackButton';

const Templates: React.FC = () => {
  const history = useHistory();
  const [activeFilter, setActiveFilter] = useState('all');
  const [showDeleteOption, setShowDeleteOption] = useState<number | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Track which template titles are already in active plans
  const [activePlanTitles, setActivePlanTitles] = useState<Set<string>>(() => {
    const saved = JSON.parse(localStorage.getItem('activePlans') || '[]');
    return new Set(saved.map((p: any) => p.title as string));
  });

  // Sync whenever activePlans changes (e.g. navigating back here)
  useEffect(() => {
    const sync = () => {
      const saved = JSON.parse(localStorage.getItem('activePlans') || '[]');
      setActivePlanTitles(new Set(saved.map((p: any) => p.title as string)));
    };
    window.addEventListener('activePlansUpdated', sync);
    window.addEventListener('focus', sync);
    return () => {
      window.removeEventListener('activePlansUpdated', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  // Auto-hide toast after 2.5 s
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // Use the plans hook for API integration
  const {
    plans: customPlans,
    loading: plansLoading,
    error: plansError,
    deletePlan
  } = usePlans();

  const defaultPlans = [
    {
      id: 2,
      title: 'Personal Growth Plans',
      icon: '/assets/icons/personal-growth.png',
      progress: 30,
      pinned: false,
      type: 'default'
    },
    {
      id: 4,
      title: 'Fitness Plans',
      icon: '/assets/icons/health.png',
      progress: 25,
      pinned: false,
      type: 'default'
    },
    {
      id: 5,
      title: 'Financial Plans',
      icon: '/assets/icons/finance.png',
      progress: 45,
      pinned: false,
      type: 'default'
    }
  ];

  // Filter plans based on search query or default list
  const allPlans = defaultPlans.filter(plan => 
    !searchQuery.trim() || plan.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const handleFilterChange = (filter: string) => {
    setActiveFilter(filter);
  };

  const handleDeletePlan = async (planId: number) => {
    try {
      await deletePlan(planId);
      setShowDeleteOption(null);
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  };

  const handleLongPress = (planId: number) => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDeleteOption(planId);
    }, 1000);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePlanClick = (plan: any) => {
    console.log('Template selected:', plan.title);

    // Remove focus from any focused element before navigation
    const focusedElement = document.activeElement as HTMLElement;
    if (focusedElement) {
      focusedElement.blur();
    }

    // Add template to active plans
    addTemplateToActivePlans(plan);
  };

  const addTemplateToActivePlans = (template: any) => {
    try {
      // Guard: already added (checked via state for instant feedback)
      if (activePlanTitles.has(template.title)) return;

      const existingActivePlans = JSON.parse(localStorage.getItem('activePlans') || '[]');

      const activePlan = {
        ...template,
        id: Date.now(),
        templateId: template.id,
        type: 'active',
        addedAt: new Date().toISOString(),
        progress: 0
      };

      const updatedActivePlans = [activePlan, ...existingActivePlans];
      localStorage.setItem('activePlans', JSON.stringify(updatedActivePlans));

      // Update local state so card instantly shows as added
      setActivePlanTitles(prev => new Set(prev).add(template.title));

      window.dispatchEvent(new Event('activePlansUpdated'));

      setToastMessage(`"${template.title}" added to your plans!`);

      // Navigate back after a short delay so user sees the toast
      setTimeout(() => history.push('/plans-page'), 1200);

      console.log('Template added to active plans:', activePlan);
    } catch (error) {
      console.error('Error adding template to active plans:', error);
      setToastMessage('Failed to add template. Please try again.');
    }
  };

  return (
    <IonPage>
      <div className="templates-page">
        {/* Status Bar Spacer */}
        <div className="status-bar-spacer"></div>

        {/* Templates Header */}
        <div className="templates-header">
          <BackButton />
          <h1 className="templates-title">Templates</h1>
        </div>

        {/* Filter Div */}
        <div className="templates-filters">
          {activeFilter !== 'search' ? (
            <>
              <button
                className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => handleFilterChange('all')}
              >
                All Templates
              </button>
              <button
                className={`filter-btn ${activeFilter === 'search' ? 'active' : ''}`}
                onClick={() => handleFilterChange('search')}
              >
                <IonIcon icon={search} />
                Search
              </button>
            </>
          ) : (
            <div className="template-search-wrapper" style={{ display: 'flex', width: '100%', alignItems: 'center', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', padding: '4px 12px' }}>
              <IonIcon icon={search} style={{ color: '#2c5f2c', opacity: 0.7 }} />
              <input 
                type="text" 
                autoFocus 
                placeholder="Search templates..." 
                value={searchQuery}
                style={{ flex: 1, border: 'none', background: 'none', outline: 'none', padding: '8px', color: '#333', fontSize: '15px' }}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                onClick={() => { handleFilterChange('all'); setSearchQuery(''); }} 
                style={{ background: 'none', border: 'none', color: '#999', fontSize: '24px', padding: '0 4px', lineHeight: 1 }}
              >×</button>
            </div>
          )}
        </div>

        {/* Templates List */}
        <div className="templates-container">
          <div className="templates-list">
            {allPlans.map((plan) => {
              const alreadyAdded = activePlanTitles.has(plan.title);
              return (
                <div
                  key={plan.id}
                  className={`template-card ${alreadyAdded ? 'template-card--added' : ''}`}
                  onClick={() => !alreadyAdded && handlePlanClick(plan)}
                  style={{ cursor: alreadyAdded ? 'default' : 'pointer' }}
                >
                  <img className="template-icon" src={plan.icon} alt={plan.title} />
                  <div className="template-content">
                    <div className="template-title-wrapper">
                      <h3 className="template-title">{plan.title}</h3>
                    </div>
                  </div>
                  <div className="add-to-plans-indicator">
                    {alreadyAdded ? (
                      <span className="added-badge">✓ Added</span>
                    ) : (
                      <span>Tap to add to your plans</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Toast notification */}
        {toastMessage && (
          <div className="template-toast">{toastMessage}</div>
        )}

        {/* Bottom Navigation */}
        <BottomNavigation />
      </div>
    </IonPage>
  );
};

export default Templates;
