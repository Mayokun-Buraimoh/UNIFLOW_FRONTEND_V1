import React, { useState, useRef, useEffect, UIEvent } from 'react';
import './GlassyTimePicker.css';

interface GlassyTimePickerProps {
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  placeholder?: string;
}

const hours12 = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const minutes60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parseTime12(value: string): { hour: string; minute: string; period: 'AM' | 'PM' } {
  if (!value) return { hour: '12', minute: '00', period: 'AM' };
  
  // Try to parse "14:30" or "02:30 PM" gracefully if it exists
  const isPM = /PM/i.test(value);
  const isAM = /AM/i.test(value);
  const timePart = value.replace(/[^\d:]/g, '');
  const [hStr, mStr] = timePart.split(':');
  
  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h)) h = 12;
  if (isNaN(m)) m = 0;
  
  let period: 'AM' | 'PM' = isPM ? 'PM' : (isAM ? 'AM' : (h >= 12 ? 'PM' : 'AM'));
  
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  
  return { 
    hour: String(h).padStart(2, '0'), 
    minute: String(Math.min(59, Math.max(0, m))).padStart(2, '0'),
    period
  };
}

const Wheel = ({
  items,
  value,
  onChange
}: {
  items: string[];
  value: string;
  onChange: (val: string) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isScrollingInternal = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ITEM_HEIGHT = 52;

  useEffect(() => {
    if (!isScrollingInternal.current && scrollRef.current) {
      const idx = items.indexOf(value);
      if (idx !== -1) {
        const targetTop = idx * ITEM_HEIGHT;
        if (Math.abs(scrollRef.current.scrollTop - targetTop) > 5) {
          scrollRef.current.scrollTo({
            top: targetTop,
            behavior: 'smooth'
          });
        }
      }
    }
  }, [value, items]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isScrollingInternal.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    const scrollTop = e.currentTarget.scrollTop;
    
    scrollTimeout.current = setTimeout(() => {
      const index = Math.round(scrollTop / ITEM_HEIGHT);
      if (items[index] && items[index] !== value) {
        onChange(items[index]);
      }
      setTimeout(() => {
        isScrollingInternal.current = false;
      }, 50);
    }, 150);
  };

  return (
    <div className="gtp-wheel" ref={scrollRef} onScroll={handleScroll}>
      <div className="gtp-wheel-spacer" />
      {items.map((item) => (
        <div
          key={item}
          className={`gtp-wheel-item ${item === value ? 'gtp-wheel-item--active' : ''}`}
          onClick={() => {
            if (!isScrollingInternal.current) onChange(item);
          }}
        >
          {item}
        </div>
      ))}
      <div className="gtp-wheel-spacer" />
    </div>
  );
};

const GlassyTimePicker: React.FC<GlassyTimePickerProps> = ({ value, onChange, placeholder = 'Select time' }) => {
  const parsed = parseTime12(value);
  const [open, setOpen] = useState(false);
  
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [period, setPeriod] = useState<'AM' | 'PM'>(parsed.period);
  const [inputValue, setInputValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseTime12(value);
    setHour(p.hour);
    setMinute(p.minute);
    setPeriod(p.period);
    if (!open) {
      setInputValue(`${p.hour}:${p.minute} ${p.period}`);
    }
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleConfirm();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, hour, minute, period, onChange, inputValue]);

  const handleConfirm = () => {
    const formatted = `${hour}:${minute} ${period}`;
    onChange(formatted);
    setInputValue(formatted);
    setOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Extract only digits
    let rawDigits = e.target.value.replace(/[^\d]/g, '');
    if (rawDigits.length > 4) rawDigits = rawDigits.slice(0, 4);

    let hStr = rawDigits.slice(0, 2);
    let mStr = rawDigits.slice(2, 4);

    // 2. Validate Hours
    if (hStr.length === 2) {
      let h = parseInt(hStr, 10);
      if (h > 12) hStr = '12';
      if (h === 0) hStr = '01';
    }

    // 3. Validate Minutes
    if (mStr.length === 2) {
      let m = parseInt(mStr, 10);
      if (m > 59) mStr = '59';
    }

    // 4. Reconstruct format correctly
    let formatted = hStr;
    if (rawDigits.length >= 2 || e.target.value.includes(':')) {
      if (hStr.length === 1) hStr = '0' + hStr; // pad if they type 1:
      formatted = hStr + ':' + mStr;
    }

    // Preserve the visual mask
    setInputValue(`${formatted} ${period}`);

    // 5. Update state only if complete
    if (formatted.length === 5) {
      const finalH = formatted.slice(0, 2);
      const finalM = formatted.slice(3, 5);
      setHour(finalH);
      setMinute(finalM);
      onChange(`${finalH}:${finalM} ${period}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Quickly listen for 'A' or 'P' to flip period safely
    if (e.key.toLowerCase() === 'a') {
      e.preventDefault();
      setPeriod('AM');
      setInputValue(`${inputValue.split(' ')[0]} AM`);
      if (inputValue.split(' ')[0].length === 5) onChange(`${inputValue.split(' ')[0]} AM`);
    } else if (e.key.toLowerCase() === 'p') {
      e.preventDefault();
      setPeriod('PM');
      setInputValue(`${inputValue.split(' ')[0]} PM`);
      if (inputValue.split(' ')[0].length === 5) onChange(`${inputValue.split(' ')[0]} PM`);
    }
  };

  return (
    <div className="gtp-wrapper" ref={containerRef}>
      <div 
        className={`gtp-trigger ${open ? 'gtp-trigger--open' : ''}`} 
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
      >
        <svg className="gtp-clock-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z" />
        </svg>
        
        <input
          ref={inputRef}
          type="text"
          className="gtp-trigger-input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={8}
          onFocus={() => setOpen(true)}
        />

        <svg
          className={`gtp-chevron ${open ? 'gtp-chevron--up' : ''}`}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(!open);
          }}
        >
          <path d="M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z" />
        </svg>
      </div>

      {open && (
        <div className="gtp-popup">
          <div className="gtp-popup-inner">
            <h4 className="gtp-popup-label">Set Time</h4>

            <div className="gtp-wheels-container">
              <div className="gtp-wheel-highlight" />
              <Wheel items={hours12} value={hour} onChange={(val) => { setHour(val); onChange(`${val}:${minute} ${period}`); }} />
              <span className="gtp-colon">:</span>
              <Wheel items={minutes60} value={minute} onChange={(val) => { setMinute(val); onChange(`${hour}:${val} ${period}`); }} />
            </div>

            <div className="gtp-period-segmented">
              <div className={`gtp-period-slider ${period === 'PM' ? 'pm' : ''}`} />
              <button
                type="button"
                className={`gtp-period-btn ${period === 'AM' ? 'gtp-period-btn--active' : ''}`}
                onClick={() => { setPeriod('AM'); onChange(`${hour}:${minute} AM`); }}
              >
                AM
              </button>
              <button
                type="button"
                className={`gtp-period-btn ${period === 'PM' ? 'gtp-period-btn--active' : ''}`}
                onClick={() => { setPeriod('PM'); onChange(`${hour}:${minute} PM`); }}
              >
                PM
              </button>
            </div>

            <button type="button" className="gtp-confirm-btn" onClick={handleConfirm}>
              Confirm Time
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassyTimePicker;
