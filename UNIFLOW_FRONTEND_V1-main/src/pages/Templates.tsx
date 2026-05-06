import React, { useState, useEffect, useMemo } from 'react';
import { IonIcon, IonPage } from '@ionic/react';
import { search } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { usePlans } from '../contexts/PlanContext';
import './Templates.css';
import BackButton from '../components/BackButton';

const Templates: React.FC = () => {
  const history = useHistory();
  const { plans, addPlan } = usePlans();
  const [activeFilter, setActiveFilter] = useState('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const addedTitles = useMemo(() => new Set(plans.map((p) => p.title)), [plans]);

  // Auto-hide toast after 2.5 s
  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2500);
    return () => clearTimeout(t);
  }, [toastMessage]);

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
      if (addedTitles.has(template.title)) return;

      // Same store as Plans page (PlanContext / uniflow_plans)
      addPlan(template.title, false, template.icon || null);

      setToastMessage(`"${template.title}" added to your plans!`);

      setTimeout(() => history.push('/plans'), 1200);
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
            <div className="template-search-wrapper">
              <IonIcon icon={search} className="template-search-icon" />
              <input 
                type="text" 
                autoFocus 
                placeholder="Search templates..." 
                value={searchQuery}
                className="template-search-input"
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="button"
                className="template-search-clear"
                onClick={() => { handleFilterChange('all'); setSearchQuery(''); }}
                aria-label="Close search"
              >×</button>
            </div>
          )}
        </div>

        {/* Templates List */}
        <div className="templates-container">
          <div className="templates-list">
            {allPlans.map((plan) => {
              const alreadyAdded = addedTitles.has(plan.title);
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
