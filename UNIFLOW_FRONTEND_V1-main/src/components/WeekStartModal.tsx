import React from 'react';
import './WeekStartModal.css';

interface WeekStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWeekStart: (weekStart: string) => void;
  currentWeekStart: string;
}

const WeekStartModal: React.FC<WeekStartModalProps> = ({
  isOpen,
  onClose,
  onSelectWeekStart,
  currentWeekStart
}) => {
  const weekStartOptions = [
    'Sunday',
    'Monday'
  ];

  if (!isOpen) return null;

  return (
    <div className="week-start-modal-overlay" onClick={onClose}>
      <div className="week-start-modal" onClick={(e) => e.stopPropagation()}>
        <div className="week-start-modal-header">
          <h3 className="week-start-modal-title">Week Start</h3>
          <button className="close-button" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
            </svg>
          </button>
        </div>
        
        <div className="week-start-options">
          {weekStartOptions.map((weekStart) => (
            <div
              key={weekStart}
              className={`week-start-option ${currentWeekStart === weekStart ? 'selected' : ''}`}
              onClick={() => {
                onSelectWeekStart(weekStart);
                onClose();
              }}
            >
              <span className="week-start-name">{weekStart}</span>
              {currentWeekStart === weekStart && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#4CAF50">
                  <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekStartModal;

