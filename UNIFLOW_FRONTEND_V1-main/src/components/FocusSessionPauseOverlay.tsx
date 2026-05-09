import React from 'react';
import './FocusSessionPauseOverlay.css';

interface Props {
  open: boolean;
  remainingLabel: string;
  onResume: () => void;
}

const FocusSessionPauseOverlay: React.FC<Props> = ({ open, remainingLabel, onResume }) => {
  if (!open) return null;

  return (
    <div className="fsp-overlay" role="dialog" aria-modal="true" aria-labelledby="fsp-heading">
      <div className="fsp-glow" aria-hidden="true" />
      <div className="fsp-orbs" aria-hidden="true">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="fsp-orb" style={{ '--i': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="fsp-panel">
        <p className="fsp-eyebrow">Session paused</p>
        <h2 id="fsp-heading" className="fsp-title">
          Take a calm breath
        </h2>
        <p className="fsp-message">Timer is paused at {remainingLabel}. Resume whenever you are ready.</p>
        <button type="button" className="fsp-resume" onClick={onResume}>
          Resume session
        </button>
      </div>
    </div>
  );
};

export default FocusSessionPauseOverlay;
