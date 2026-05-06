import React, { useState, useRef, useEffect } from 'react';
import './GlassyTimePicker.css';

interface GlassyDatePickerProps {
  value: string; // "YYYY-MM-DD" format
  onChange: (value: string) => void;
  placeholder?: string;
  minDate?: string;
}

const months = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

function getDaysInMonth(monthIndex: number, year: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function parseDateStr(value: string): { year: string; month: string; day: string } {
  if (!value) {
    const today = new Date();
    return {
      year: String(today.getFullYear()),
      month: months[today.getMonth()],
      day: String(today.getDate()).padStart(2, '0')
    };
  }
  
  const [y, m, d] = value.split('-');
  const monthIndex = parseInt(m, 10) - 1;
  return {
    year: y,
    month: months[monthIndex] || months[0],
    day: String(parseInt(d, 10) || 1).padStart(2, '0')
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

const GlassyDatePicker: React.FC<GlassyDatePickerProps> = ({ value, onChange, placeholder = 'Select date' }) => {
  const parsed = parseDateStr(value);
  const [open, setOpen] = useState(false);
  
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);
  const [inputValue, setInputValue] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate wheel options
  const currentYear = new Date().getFullYear();
  const yearsList = Array.from({ length: 15 }, (_, i) => String(currentYear + i));
  
  const monthIndex = months.indexOf(month);
  const maxDays = getDaysInMonth(monthIndex !== -1 ? monthIndex : 0, parseInt(year, 10));
  const daysList = Array.from({ length: maxDays }, (_, i) => String(i + 1).padStart(2, '0'));

  // Ensure day doesn't exceed max days in month when month/year changes
  useEffect(() => {
    const dInt = parseInt(day, 10);
    if (dInt > maxDays) {
      setDay(String(maxDays).padStart(2, '0'));
    }
  }, [month, year, maxDays, day]);

  useEffect(() => {
    const p = parseDateStr(value);
    setYear(p.year);
    setMonth(p.month);
    setDay(p.day);
    if (!open && value) {
      const dInt = parseInt(p.day, 10);
      setInputValue(`${p.month} ${dInt}, ${p.year}`);
    } else if (!open && !value) {
      setInputValue('');
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
  }, [open, year, month, day, onChange]);

  const handleConfirm = () => {
    const mIndex = String(months.indexOf(month) + 1).padStart(2, '0');
    const isoString = `${year}-${mIndex}-${day.padStart(2, '0')}`;
    onChange(isoString);
    setInputValue(`${month} ${parseInt(day, 10)}, ${year}`);
    setOpen(false);
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
            <path d="M19,4H18V2H16V4H8V2H6V4H5C3.89,4 3,4.9 3,6V20C3,21.1 3.9,22 5,22H19C20.1,22 21,21.1 21,20V6C21,4.9 20.1,4 19,4M19,20H5V10H19V20Z" />
        </svg>
        
        <input
          ref={inputRef}
          type="text"
          className="gtp-trigger-input"
          value={inputValue}
          readOnly
          placeholder={placeholder}
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
            <div className="gtp-wheels-container">
              <div className="gtp-wheel-highlight" style={{ left: '16px', right: '16px', width: 'auto' }} />
              <Wheel items={months} value={month} onChange={(val) => setMonth(val)} />
              <Wheel items={daysList} value={day} onChange={(val) => setDay(val)} />
              <Wheel items={yearsList} value={year} onChange={(val) => setYear(val)} />
            </div>

            <button type="button" className="gtp-confirm-btn" onClick={handleConfirm}>
              Confirm Date
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GlassyDatePicker;
