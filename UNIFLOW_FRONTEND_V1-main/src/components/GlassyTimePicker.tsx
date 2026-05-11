import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import './GlassyTimePicker.css';

interface GlassyTimePickerProps {
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  placeholder?: string;
}

const hours24 = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes60 = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

function parseTime24(value: string): { hour: string; minute: string } {
  if (!value) return { hour: '00', minute: '00' };

  const hasPM = /PM/i.test(value);
  const hasAM = /AM/i.test(value);
  const timePart = value.replace(/[^\d:]/g, '');
  const [hStr, mStr] = timePart.split(':');

  let h = parseInt(hStr, 10);
  let m = parseInt(mStr, 10);
  if (isNaN(h)) h = 0;
  if (isNaN(m)) m = 0;

  // Backward-compatible parsing if old 12-hour values are still present.
  if (hasAM || hasPM) {
    h = Math.min(12, Math.max(1, h));
    if (hasPM && h < 12) h += 12;
    if (hasAM && h === 12) h = 0;
  }

  h = Math.min(23, Math.max(0, h));
  m = Math.min(59, Math.max(0, m));

  return {
    hour: String(h).padStart(2, '0'),
    minute: String(m).padStart(2, '0'),
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
  const LOOP_MULTIPLIER = 24;
  const SAFE_EDGE_CYCLES = 2;
  const middleCycle = Math.floor(LOOP_MULTIPLIER / 2);

  const virtualItems = useMemo(
    () => Array.from({ length: items.length * LOOP_MULTIPLIER }, (_, i) => items[i % items.length]),
    [items]
  );

  const normalizeIndex = (index: number) => {
    return ((index % items.length) + items.length) % items.length;
  };

  const getMiddleIndexForValue = (val: string) => {
    const baseIndex = items.indexOf(val);
    const safeBase = baseIndex >= 0 ? baseIndex : 0;
    return middleCycle * items.length + safeBase;
  };

  useLayoutEffect(() => {
    if (!isScrollingInternal.current && scrollRef.current) {
      const targetIndex = getMiddleIndexForValue(value);
      const targetTop = targetIndex * ITEM_HEIGHT;
      if (Math.abs(scrollRef.current.scrollTop - targetTop) > 5) {
        // Hard snap to selected value to avoid opening "spin" animation.
        scrollRef.current.scrollTop = targetTop;
      }
    }
  }, [value, items]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    isScrollingInternal.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    const scrollTop = e.currentTarget.scrollTop;
    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const normalizedIndex = normalizeIndex(rawIndex);
    const selectedValue = items[normalizedIndex];

    const minSafeIndex = SAFE_EDGE_CYCLES * items.length;
    const maxSafeIndex = (LOOP_MULTIPLIER - SAFE_EDGE_CYCLES) * items.length;

    // Recenter quietly to keep scrolling infinite without ever hitting list edges.
    if (rawIndex < minSafeIndex || rawIndex > maxSafeIndex) {
      const recenteredIndex = middleCycle * items.length + normalizedIndex;
      e.currentTarget.scrollTop = recenteredIndex * ITEM_HEIGHT;
    }
    
    scrollTimeout.current = setTimeout(() => {
      if (selectedValue && selectedValue !== value) {
        onChange(selectedValue);
      }
      setTimeout(() => {
        isScrollingInternal.current = false;
      }, 50);
    }, 150);
  };

  return (
    <div className="gtp-wheel" ref={scrollRef} onScroll={handleScroll}>
      <div className="gtp-wheel-spacer" />
      {virtualItems.map((item, index) => (
        <div
          key={`${item}-${index}`}
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
  const parsed = parseTime24(value);
  const [open, setOpen] = useState(false);
  
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [inputValue, setInputValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = parseTime24(value);
    setHour(p.hour);
    setMinute(p.minute);
    if (!open) {
      setInputValue(`${p.hour}:${p.minute}`);
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
  }, [open, hour, minute, onChange, inputValue]);

  const handleConfirm = () => {
    const formatted = `${hour}:${minute}`;
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
    setInputValue(formatted);

    // 5. Update state only if complete
    if (formatted.length === 5) {
      const finalH = formatted.slice(0, 2);
      const finalM = formatted.slice(3, 5);
      setHour(finalH);
      setMinute(finalM);
      onChange(`${finalH}:${finalM}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
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
          maxLength={5}
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
              <Wheel items={hours24} value={hour} onChange={(val) => { setHour(val); onChange(`${val}:${minute}`); }} />
              <span className="gtp-colon">:</span>
              <Wheel items={minutes60} value={minute} onChange={(val) => { setMinute(val); onChange(`${hour}:${val}`); }} />
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
