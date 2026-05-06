import React from 'react';
import './FocusSessionCompleteCelebration.css';

export type FocusCelebrationVariant = 'complete' | 'quiz';

interface Props {
  open: boolean;
  variant: FocusCelebrationVariant;
  documentName?: string;
  onDismiss: () => void;
}

const FocusSessionCompleteCelebration: React.FC<Props> = ({
  open,
  variant,
  documentName,
  onDismiss,
}) => {
  if (!open) {
    return null;
  }

  const isQuiz = variant === 'quiz';

  return (
    <div
      className={`fsc-overlay ${open ? 'fsc-open' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fsc-title"
    >
      <div className="fsc-confetti" aria-hidden="true" />
      <div className="fsc-stars" aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className="fsc-star" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="fsc-card">
        <div className="fsc-badge" aria-hidden="true">
          {isQuiz ? '🧠' : '🎯'}
        </div>
        <h2 id="fsc-title" className="fsc-title">
          {isQuiz ? 'Recall round unlocked!' : 'Focus session complete!'}
        </h2>
        <p className="fsc-sub">
          {isQuiz
            ? 'Great work locking in the material. Ready to prove what you remember?'
            : `You stayed with ${documentName ? `“${documentName}”` : 'your note'} until the bell. That counts.`}
        </p>
        <div className="fsc-xp-row" aria-hidden="true">
          <span className="fsc-xp-pill">+1 session</span>
          <span className="fsc-xp-pill fsc-xp-streak">Streak fuel ⛽</span>
        </div>
        <button type="button" className="fsc-cta" onClick={onDismiss}>
          {isQuiz ? 'Bring on the quiz' : 'Claim the win'}
        </button>
      </div>
    </div>
  );
};

export default FocusSessionCompleteCelebration;
