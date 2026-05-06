import React, { useState, useRef, useEffect } from 'react';
import './GlassyTimePicker.css';

interface DropdownOption {
  value: string;
  label: string;
}

interface GlassySelectProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  hasError?: boolean;
}

const GlassySelect: React.FC<GlassySelectProps> = ({ value, onChange, options, placeholder = 'Select option', hasError = false }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayValue = selectedOption ? selectedOption.label : '';

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div className="gtp-wrapper" ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      <div 
        className={`gtp-trigger ${open ? 'gtp-trigger--open' : ''}`}
        style={hasError ? { border: '1px solid rgba(239, 78, 58, 0.5)', background: 'rgba(239, 78, 58, 0.05)' } : {}}
        onClick={() => setOpen(!open)}
      >
        <input
          type="text"
          className="gtp-trigger-input"
          value={displayValue}
          readOnly
          placeholder={placeholder}
          style={{ cursor: 'pointer', paddingLeft: '14px', color: displayValue ? '#111' : 'rgba(0,0,0,0.5)' }}
        />

        <svg
          className={`gtp-chevron ${open ? 'gtp-chevron--up' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="#333"
          style={{ marginRight: '8px' }}
        >
          <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
        </svg>
      </div>

      {open && (
        <div className="gtp-popup" style={{ top: 'calc(100% + 6px)', bottom: 'auto', left: 0, minWidth: '100%', maxWidth: '100%', transform: 'none', animation: 'none', opacity: 1 }}>
          <div className="gtp-popup-inner" style={{ padding: '6px', gap: '2px', background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(20px)' }}>
            {options.map((opt) => (
              <div 
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: opt.value === value ? 'rgba(62, 225, 133, 0.15)' : 'transparent',
                  color: opt.value === value ? '#14532d' : '#333',
                  fontWeight: opt.value === value ? '600' : '400',
                  fontSize: '13.5px',
                  transition: 'all 0.2s',
                  textAlign: 'left'
                }}
                onMouseEnter={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (opt.value !== value) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassySelect;
