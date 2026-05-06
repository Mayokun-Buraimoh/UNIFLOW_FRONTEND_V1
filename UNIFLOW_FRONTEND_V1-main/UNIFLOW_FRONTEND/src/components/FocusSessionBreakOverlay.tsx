import React from 'react';
import './FocusSessionBreakOverlay.css';

interface Props {
  open: boolean;
  message: string;
  onContinue: () => void;
}

const FocusSessionBreakOverlay: React.FC<Props> = ({ open, message, onContinue }) => {
  if (!open) {
    return null;
  }

  return (
    <div className="fsb-overlay" role="dialog" aria-modal="true" aria-labelledby="fsb-heading">
      <div className="fsb-sun" aria-hidden="true" />
      <div className="fsb-rain" aria-hidden="true" />
      <div className="fsb-diamonds" aria-hidden="true">
        {Array.from({ length: 18 }).map((_, i) => (
          <span key={i} className="fsb-diamond" style={{ '--d': i } as React.CSSProperties} />
        ))}
      </div>
      <div className="fsb-avatar-track" aria-hidden="true">
        <div className="fsb-avatar">🎧</div>
      </div>
      <div className="fsb-panel">
        <p className="fsb-eyebrow">Break time</p>
        <h2 id="fsb-heading" className="fsb-title">
          Recharge your brain
        </h2>
        <p className="fsb-message">{message}</p>
        <button type="button" className="fsb-continue" onClick={onContinue}>
          Continue session
        </button>
      </div>
    </div>
  );
};

export default FocusSessionBreakOverlay;
