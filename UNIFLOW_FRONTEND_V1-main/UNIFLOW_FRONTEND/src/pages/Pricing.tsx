import { IonContent, IonPage } from '@ionic/react';
import { useState } from 'react';
import BackButton from '../components/BackButton';
import { SubscriptionPlan, useSubscription } from '../contexts/SubscriptionContext';
import './Pricing.css';

const LIMIT_LABELS: Record<string, string> = {
  aiQuestionsPerMonth: 'AI asks / month',
  audioTranscriptionMinutesPerMonth: 'Audio transcription / month',
  analyticsHistoryDays: 'Analytics history',
  pdfUploads: 'PDF uploads',
  focusSessionsPerDay: 'Focus sessions / day',
};

const formatLimitValue = (value: number | 'unlimited', key: string) => {
  if (value === 'unlimited') {
    return 'Unlimited';
  }

  if (key === 'audioTranscriptionMinutesPerMonth') {
    return `${value} mins`;
  }

  if (key === 'analyticsHistoryDays') {
    return `${value} days`;
  }

  return `${value}`;
};

const Pricing: React.FC = () => {
  const { currentPlan, currentPlanDetails, plans, setPlan } = useSubscription();
  const [feedback, setFeedback] = useState<string | null>(null);

  const premiumPlan = plans.find((plan) => plan.id === 'premium');
  const freePlan = plans.find((plan) => plan.id === 'free');

  const handleSelectPlan = (planId: SubscriptionPlan) => {
    setPlan(planId);
    setFeedback(planId === 'premium' ? 'Premium selected on this device.' : 'Switched back to Free.');

    window.setTimeout(() => {
      setFeedback(null);
    }, 2200);
  };

  return (
    <IonPage className="pricing-page">
      <IonContent fullscreen className="pricing-screen">
        <div className="status-bar-spacer"></div>

        <div className="pricing-body">
          <div className="pricing-header">
            <BackButton />
            <h1 className="pricing-title">Pricing</h1>
          </div>

          <div className="pricing-hero">
            <div className="pricing-hero-glow pricing-hero-glow-left" />
            <div className="pricing-hero-glow pricing-hero-glow-right" />

            <div className="pricing-hero-copy">
              <span className="pricing-current-label">Student plans</span>
              <h2>Pick the tier that fits how seriously you study.</h2>
              <p>
                Stay on Free to get started, or move to Premium when you want heavier AI, longer transcription and fewer limits.
              </p>
            </div>

            <div className="pricing-hero-stack">
              <div className="pricing-hero-mini-card">
                <span>Current</span>
                <strong>{currentPlanDetails.name}</strong>
                <small>{currentPlanDetails.priceLabel}</small>
              </div>

              {premiumPlan && (
                <div className="pricing-hero-mini-card premium">
                  <span>Upgrade</span>
                  <strong>{premiumPlan.name}</strong>
                  <small>{premiumPlan.priceLabel}</small>
                </div>
              )}
            </div>
          </div>

          <div className="pricing-intro-card">
            <div className="pricing-current-row">
              <div>
                <h3>{currentPlanDetails.name} is active</h3>
                <p>{currentPlanDetails.description}</p>
              </div>
              <span className="pricing-current-price">{currentPlanDetails.priceLabel}</span>
            </div>

            <div className="pricing-highlight-grid">
              <div className="pricing-highlight-chip">
                <span>AI asks</span>
                <strong>{formatLimitValue(currentPlanDetails.limits.aiQuestionsPerMonth, 'aiQuestionsPerMonth')}</strong>
              </div>
              <div className="pricing-highlight-chip">
                <span>Transcription</span>
                <strong>{formatLimitValue(currentPlanDetails.limits.audioTranscriptionMinutesPerMonth, 'audioTranscriptionMinutesPerMonth')}</strong>
              </div>
              <div className="pricing-highlight-chip">
                <span>Analytics</span>
                <strong>{formatLimitValue(currentPlanDetails.limits.analyticsHistoryDays, 'analyticsHistoryDays')}</strong>
              </div>
            </div>

            <p className="pricing-intro-note">
              Frontend plan switching is ready here. Backend billing and hard usage enforcement can connect to these same plan IDs next.
            </p>
          </div>

          {feedback && <div className="pricing-feedback">{feedback}</div>}

          {freePlan && premiumPlan && (
            <div className="pricing-compare-strip">
              <div className="pricing-compare-pill">
                <span>Free</span>
                <strong>{freePlan.priceLabel}</strong>
              </div>
              <div className="pricing-compare-divider" />
              <div className="pricing-compare-pill premium">
                <span>Premium</span>
                <strong>{premiumPlan.priceLabel}</strong>
              </div>
            </div>
          )}

          <div className="pricing-cards">
            {plans.map((plan) => {
              const isCurrentPlan = currentPlan === plan.id;

              return (
                <div className={`pricing-card ${isCurrentPlan ? 'current' : ''}`} key={plan.id}>
                  <div className="pricing-card-hero" style={{ background: plan.accent }}>
                    <div>
                      <span className="pricing-plan-name">{plan.name}</span>
                      <h3>{plan.priceLabel}</h3>
                    </div>

                    <div className="pricing-card-badges">
                      {plan.id === 'premium' && <span className="pricing-featured-badge">Most Popular</span>}
                      {isCurrentPlan && <span className="pricing-current-badge">Current</span>}
                    </div>
                  </div>

                  <p className="pricing-plan-description">{plan.description}</p>

                  <div className="pricing-section">
                    <h4>Included features</h4>
                    <div className="pricing-feature-list">
                      {plan.features.map((feature) => (
                        <div key={feature} className="pricing-feature-item">
                          <span className="pricing-feature-dot" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pricing-section">
                    <h4>Limits</h4>
                    <div className="pricing-limit-list">
                      {Object.entries(plan.limits).map(([key, value]) => (
                        <div key={key} className="pricing-limit-row">
                          <span>{LIMIT_LABELS[key]}</span>
                          <strong>{formatLimitValue(value, key)}</strong>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    className={`pricing-action ${isCurrentPlan ? 'current' : ''}`}
                    onClick={() => handleSelectPlan(plan.id)}
                  >
                    {isCurrentPlan ? 'Current Plan' : plan.id === 'premium' ? 'Choose Premium' : 'Choose Free'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Pricing;
