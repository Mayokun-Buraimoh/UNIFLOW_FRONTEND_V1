import React, { useState, useEffect } from 'react';
import { Joyride, STATUS, Step, TooltipRenderProps, EventData, EVENTS, ACTIONS } from 'react-joyride';
import { useHistory } from 'react-router-dom';
import { usePlans } from '../contexts/PlanContext';
import './ProductTour.css';

const TOUR_COMPLETED_KEY = 'uniflow_product_tour_completed';

const Tooltip = ({
  continuous,
  index,
  step,
  backProps,
  closeProps,
  primaryProps,
  tooltipProps,
}: TooltipRenderProps) => {
  return (
    <div className="flo-tooltip" {...tooltipProps}>
      <div className="flo-tooltip-body">
        <img src="/assets/flo/flo_nobg.png" alt="Ruby the Robot" className="flo-avatar" />
        <div className="flo-tooltip-content">
          {step.title && <h3 className="flo-tooltip-title">{step.title}</h3>}
          <div className="flo-tooltip-text">{step.content}</div>
        </div>
      </div>
      <div className="flo-tooltip-footer">
        <div className="flo-tooltip-skip">
          <button {...closeProps} className="flo-btn-skip">Skip Tour</button>
        </div>
        <div className="flo-tooltip-controls">
          {index > 0 && (
            <button {...backProps} className="flo-btn-back">Back</button>
          )}
          {continuous && (
            <button {...primaryProps} className="flo-btn-next">
              {index === 8 ? 'Done' : 'Next'}
            </button>
          )}
          {!continuous && (
            <button {...closeProps} className="flo-btn-next">Got it!</button>
          )}
        </div>
      </div>
    </div>
  );
};

export const ProductTour: React.FC = () => {
  const history = useHistory();
  const location = useHistory().location; // Or import useLocation
  const { addPlan } = usePlans();
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [createdPlanId, setCreatedPlanId] = useState<string | null>(null);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem(TOUR_COMPLETED_KEY);
    if (!hasSeenTour && location.pathname === '/home' && stepIndex === 0) {
      // Delay to ensure components are rendered after arriving on home
      const timer = setTimeout(() => setRun(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, stepIndex]);

  // Aggressive fallback to instantly bypass any beacons that Joyride mistakenly renders
  useEffect(() => {
    if (!run) return;
    const interval = setInterval(() => {
      const beacons = document.querySelectorAll<HTMLButtonElement>(
        'button[title="Open the dialog"], button[aria-label="Open the dialog"], [data-test-id="button-beacon"]'
      );
      beacons.forEach((btn) => btn.click());
    }, 50);
    return () => clearInterval(interval);
  }, [run]);

  const steps: Step[] = [
    {
      target: '#tour-welcome',
      content: 'Hi! I am Ruby, your new study buddy. Let me show you around!',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-ruby-assistant',
      title: 'Meet Ruby!',
      content: 'I am Ruby, your voice agentic AI. You can activate me by just saying "Hey Ruby" and telling me what you want to do.',
      disableBeacon: true,
      placement: 'top',
    },
    {
      target: '#tour-schedule-card',
      title: 'Your Schedule',
      content: 'Click here to set up your weekly timetable and classes!',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-add-course',
      title: 'Upload Notes',
      content: 'This is the courses section. Click here to create course folders and upload your notes.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-add-plan',
      title: 'Set Plans',
      content: 'Welcome to Plans! Use this to set up your study plans and track your progress.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-plan-goals',
      title: 'Goals',
      content: 'This is where you set the big picture. Add the major milestones you want to achieve for this plan.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-plan-tasks',
      title: 'Tasks',
      content: 'Tasks are the actionable steps. You can link them directly to your goals and set them to repeat daily or weekly.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-plan-progress',
      title: 'Progress',
      content: 'Watch your success grow! Check here to see your completion rates, streaks, and a breakdown of your activity.',
      disableBeacon: true,
      placement: 'bottom',
    },
    {
      target: '#tour-welcome',
      title: 'You\'re All Set!',
      content: 'We are done with the guide! If you ever need my help, just say my name.',
      disableBeacon: true,
      placement: 'bottom',
    }
  ];

  const handleJoyrideCallback = (data: EventData) => {
    const { action, index, status, type } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
      setRun(false);
      return;
    }

    if (type === EVENTS.TOOLTIP) {
      const step = steps[index];
      if (step && typeof step.content === 'string') {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(step.content);
          
          // Attempt to find a natural-sounding female voice
          const voices = window.speechSynthesis.getVoices();
          const preferredNames = [
            'Aria', // Microsoft Aria Online (Natural) - sounds amazing on Windows
            'Google UK English Female',
            'Google US English',
            'Samantha', // Mac natural
            'Zira', // Windows fallback female
            'Karen',
            'Tessa'
          ];
          
          let selectedVoice = null;
          for (const name of preferredNames) {
             selectedVoice = voices.find(v => v.name.includes(name));
             if (selectedVoice) break;
          }
          
          if (!selectedVoice) {
             selectedVoice = voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female'));
          }
          
          if (selectedVoice) {
            utterance.voice = selectedVoice;
          }

          utterance.rate = 1.0;
          // Slightly higher pitch for a friendly assistant tone
          utterance.pitch = 1.15;
          window.speechSynthesis.speak(utterance);
        }
      }
    }

    if (type === EVENTS.STEP_AFTER || type === EVENTS.TARGET_NOT_FOUND) {
      if (action === ACTIONS.NEXT) {
        if (index === 2) {
          // Going from Home to Courses
          setRun(false);
          history.push('/courses');
          setTimeout(() => { setStepIndex(3); setRun(true); }, 600);
        } else if (index === 3) {
          // Going from Courses to Plans
          setRun(false);
          history.push('/plans');
          setTimeout(() => { setStepIndex(4); setRun(true); }, 600);
        } else if (index === 4) {
          // Going from Plans to Plan Details
          setRun(false);
          const newPlanId = addPlan('My First Plan', true);
          setCreatedPlanId(newPlanId);
          history.push('/plans/' + newPlanId);
          setTimeout(() => { setStepIndex(5); setRun(true); }, 600);
        } else if (index === 7) {
          // Going from Plan Details Progress back to Home
          setRun(false);
          history.push('/home');
          setTimeout(() => { setStepIndex(8); setRun(true); }, 600);
        } else {
          setStepIndex(index + 1);
        }
      } else if (action === ACTIONS.PREV) {
        if (index === 3) {
          // Going from Courses back to Home
          setRun(false);
          history.push('/home');
          setTimeout(() => { setStepIndex(2); setRun(true); }, 600);
        } else if (index === 4) {
          // Going from Plans back to Courses
          setRun(false);
          history.push('/courses');
          setTimeout(() => { setStepIndex(3); setRun(true); }, 600);
        } else if (index === 5) {
          // Going from Plan Details back to Plans
          setRun(false);
          history.push('/plans');
          setTimeout(() => { setStepIndex(4); setRun(true); }, 600);
        } else if (index === 8) {
          // Going from Home back to Plan Details Progress
          if (createdPlanId) {
            setRun(false);
            history.push('/plans/' + createdPlanId);
            setTimeout(() => { setStepIndex(7); setRun(true); }, 600);
          } else {
            setStepIndex(index - 1);
          }
        } else {
          setStepIndex(index - 1);
        }
      }
    }
  };

  return (
    <Joyride
      stepIndex={stepIndex}
      onEvent={handleJoyrideCallback}
      continuous
      run={run}
      steps={steps}
      disableBeacon={true}
      disableOverlayClose={true}
      scrollToFirstStep
      tooltipComponent={Tooltip}
      styles={{
        options: {
          zIndex: 10000,
          arrowColor: 'transparent',
        },
      }}
    />
  );
};
