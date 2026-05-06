import React, { useState, useEffect, useMemo } from 'react';
import { IonPage, IonContent, IonModal, IonHeader, IonToolbar, IonTitle, IonContent as IonModalContent, IonItem, IonLabel, IonInput, IonButtons, IonButton } from '@ionic/react';
import { useHistory } from 'react-router-dom';

import './WeeklySchedule.css';
import BackButton from '../components/BackButton';
import { scheduleService } from '../api/services';
import {
  DEFAULT_WEEKLY_TIME_SLOTS,
  QUICK_TIME_PRESETS_24,
  migrateLegacyTimeSlots,
  timeSlotStartMinutesForSort,
  parseTimeSlotRangeMinutes,
} from '../utils/weeklyScheduleTime';

const WeeklySchedule: React.FC = () => {
  const history = useHistory();
  const [isEditMode, setIsEditMode] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCell, setEditingCell] = useState<{day: string, timeIndex: number} | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editVenueValue, setEditVenueValue] = useState('');
  
  // Time editing states
  const [showTimeEditModal, setShowTimeEditModal] = useState(false);
  const [editingTimeIndex, setEditingTimeIndex] = useState<number | null>(null);
  const [editTimeValue, setEditTimeValue] = useState('');
  
  // UI Enhancement states
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [selectedView, setSelectedView] = useState<'week' | 'day'>('week');
  const [currentDay, setCurrentDay] = useState<string>('Mon');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    document.documentElement.classList.add('weekly-schedule-white');
    document.body.classList.add('weekly-schedule-white');

    return () => {
      document.documentElement.classList.remove('weekly-schedule-white');
      document.body.classList.remove('weekly-schedule-white');
    };
  }, []);

  const handleBackClick = () => {
    history.goBack();
  };

  const handleEditClick = () => {
    setIsEditMode(!isEditMode);
    if (!isEditMode) {
      setShowSuccessMessage(false);
    }
  };

  // UI Enhancement functions
  const getWeekRange = () => {
    const startOfWeek = new Date(currentWeek);
    startOfWeek.setDate(currentWeek.getDate() - currentWeek.getDay() + 1);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);
    
    return {
      start: startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      end: endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    };
  };

  const handlePreviousWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() - 7);
    setCurrentWeek(newWeek);
  };

  const handleNextWeek = () => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(currentWeek.getDate() + 7);
    setCurrentWeek(newWeek);
  };

  const handleToday = () => {
    setCurrentWeek(new Date());
    // Set current day based on actual day of week
    const today = new Date().getDay();
    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
    setCurrentDay(dayMap[today]);
  };

  const getDiagonalColor = (dayIndex: number, timeIndex: number) => {
    // Calculate diagonal position (top-left to bottom-right)
    const diagonalPosition = dayIndex + timeIndex;
    
    // Use the original gradient colors from the previous weekly schedule
    const diagonalGradients = [
      'linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)',      // TMC Red
      'linear-gradient(135deg, #4ECDC4 0%, #6EDDD5 100%)',      // PHY Teal
      'linear-gradient(135deg, #45B7D1 0%, #67C9E1 100%)',      // FIN Blue
      'linear-gradient(135deg, #96CEB4 0%, #B8DEC4 100%)',      // MIS Green
      'linear-gradient(135deg, #FFEAA7 0%, #FFF2C7 100%)',      // MAT Yellow
      'linear-gradient(135deg, #DDA0DD 0%, #E5B8E5 100%)',      // ENG Purple
      'linear-gradient(135deg, #98D8C8 0%, #BAE8DE 100%)',      // HIS Mint
      'linear-gradient(135deg, #F7DC6F 0%, #F9E699 100%)'       // BIO Gold
    ];
    
    // Map diagonal position to gradient colors (cycling through the array)
    const colorIndex = diagonalPosition % diagonalGradients.length;
    return diagonalGradients[colorIndex];
  };

  const [timeSlots, setTimeSlots] = useState<string[]>([...DEFAULT_WEEKLY_TIME_SLOTS]);

  const days = ['Mon', 'Tue', 'Wed', 'Thur', 'Fri'];

  const orderedTimeSlotEntries = useMemo(() => {
    return timeSlots
      .map((slot, index) => ({
        slot,
        index,
        startMinutes: timeSlotStartMinutesForSort(slot),
      }))
      .sort((a, b) => b.startMinutes - a.startMinutes);
  }, [timeSlots]);
  
  const emptyDay = ['', '', '', '', '', ''];
  const [scheduleData, setScheduleData] = useState({
    'Mon': [...emptyDay],
    'Tue': [...emptyDay],
    'Wed': [...emptyDay],
    'Thur': [...emptyDay],
    'Fri': [...emptyDay]
  });

  const [venuesData, setVenuesData] = useState<Record<string, string[]>>({
    'Mon': [...emptyDay],
    'Tue': [...emptyDay],
    'Wed': [...emptyDay],
    'Thur': [...emptyDay],
    'Fri': [...emptyDay]
  });



  const handleCellClick = (day: string, timeIndex: number) => {
    if (isEditMode) {
      setEditingCell({ day, timeIndex });
      setEditValue(scheduleData[day as keyof typeof scheduleData][timeIndex]);
      setEditVenueValue(venuesData[day]?.[timeIndex] || '');
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = () => {
    if (editingCell) {
      setIsLoading(true);
      
      const newScheduleData = { ...scheduleData };
      newScheduleData[editingCell.day as keyof typeof scheduleData][editingCell.timeIndex] = editValue;
      
      const newVenuesData = { ...venuesData };
      if (!newVenuesData[editingCell.day]) newVenuesData[editingCell.day] = [...emptyDay];
      newVenuesData[editingCell.day][editingCell.timeIndex] = editVenueValue;

      setScheduleData(newScheduleData);
      setVenuesData(newVenuesData);
      localStorage.setItem('weeklySchedule', JSON.stringify(newScheduleData));
      localStorage.setItem('weeklyScheduleVenues', JSON.stringify(newVenuesData));

      // Auto-create course folder if not exists
      if (editValue.trim()) {
        try {
          const savedCoursesStr = localStorage.getItem('uniflow_courses');
          const courses = savedCoursesStr ? JSON.parse(savedCoursesStr) : [];
          const existing = courses.find((c: any) => c.name.toUpperCase() === editValue.trim().toUpperCase());
          if (!existing) {
            const THEMES = ['blue', 'green', 'red', 'purple'];
            courses.push({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
              name: editValue.trim().toUpperCase(),
              notesCount: 0,
              lastOpened: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-'),
              colorTheme: THEMES[courses.length % THEMES.length],
            });
            localStorage.setItem('uniflow_courses', JSON.stringify(courses));
          }
        } catch(e) {}
      }

      // Persist to backend (fire-and-forget)
      try {
        scheduleService.saveMySchedule(newScheduleData).catch(() => {});
      } catch {}
      // Notify other parts of the app in this tab that schedule changed
      try {
        window.dispatchEvent(new Event('weeklyScheduleUpdated'));
      } catch (e) {
        // no-op
      }
      
      // Show success message
      setShowSuccessMessage(true);
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 2000);
      
      // Simulate loading
      setTimeout(() => {
        setIsLoading(false);
        setShowEditModal(false);
        setEditingCell(null);
        setEditValue('');
        setEditVenueValue('');
      }, 500);
    }
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingCell(null);
    setEditValue('');
    setEditVenueValue('');
  };

  // Time editing functions
  const handleTimeClick = (timeIndex: number) => {
    if (isEditMode) {
      setEditingTimeIndex(timeIndex);
      setEditTimeValue(timeSlots[timeIndex]);
      setShowTimeEditModal(true);
    }
  };

  const handleSaveTimeEdit = () => {
    if (editingTimeIndex !== null) {
      setIsLoading(true);
      
      const newTimeSlots = [...timeSlots];
      newTimeSlots[editingTimeIndex] = editTimeValue;
      
      setTimeSlots(newTimeSlots);
      localStorage.setItem('weeklyTimeSlots', JSON.stringify(newTimeSlots));
      
      setTimeout(() => {
        setIsLoading(false);
        setShowTimeEditModal(false);
        setEditingTimeIndex(null);
        setEditTimeValue('');
        setShowSuccessMessage(true);
        setTimeout(() => setShowSuccessMessage(false), 3000);
      }, 1000);
    }
  };

  const handleCancelTimeEdit = () => {
    setShowTimeEditModal(false);
    setEditingTimeIndex(null);
    setEditTimeValue('');
  };

  // Load saved time slots on component mount
  React.useEffect(() => {
    const savedTimeSlots = localStorage.getItem('weeklyTimeSlots');
    if (savedTimeSlots) {
      try {
        const parsedTimeSlots = JSON.parse(savedTimeSlots) as string[];
        if (Array.isArray(parsedTimeSlots) && parsedTimeSlots.length > 0) {
          const { slots: migrated, changed } = migrateLegacyTimeSlots(parsedTimeSlots);
          setTimeSlots(migrated);
          if (changed) {
            localStorage.setItem('weeklyTimeSlots', JSON.stringify(migrated));
          }
        }
      } catch (error) {
        console.error('Failed to parse saved time slots:', error);
      }
    }
  }, []);

  // Load saved schedule on component mount (prefer backend, fallback to localStorage)
  React.useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const apiSchedule = await scheduleService.getMySchedule();
        if (mounted && apiSchedule?.data) {
          const data = apiSchedule.data as any;
          setScheduleData({
            Mon: data.Mon || [],
            Tue: data.Tue || [],
            Wed: data.Wed || [],
            Thur: data.Thur || [],
            Fri: data.Fri || [],
          });
          localStorage.setItem('weeklySchedule', JSON.stringify(data));
          return;
        }
      } catch (e) {
        console.warn('WeeklySchedule: backend not available, using localStorage');
      }
      const savedSchedule = localStorage.getItem('weeklySchedule');
      if (mounted && savedSchedule) {
        try {
          const data = JSON.parse(savedSchedule);
          setScheduleData({
            Mon: data.Mon || [],
            Tue: data.Tue || [],
            Wed: data.Wed || [],
            Thur: data.Thur || [],
            Fri: data.Fri || [],
          });
        } catch (error) {
          console.error('Error loading saved schedule:', error);
        }
      } else if (mounted) {
        // Empty state for first time
        setScheduleData({
          Mon: [...emptyDay],
          Tue: [...emptyDay],
          Wed: [...emptyDay],
          Thur: [...emptyDay],
          Fri: [...emptyDay],
        });
      }

      const savedVenues = localStorage.getItem('weeklyScheduleVenues');
      if (mounted && savedVenues) {
        try {
          setVenuesData(JSON.parse(savedVenues));
        } catch (e) {
          console.warn('Failed to parse venues', e);
        }
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen className="weekly-schedule-screen">
        {/* Status Bar Spacer */}
        <div className="status-bar-spacer"></div>

        <div className="weekly-schedule-panel">
          {/* Header */}
          <div className="weekly-schedule-header">
            <div className="header-left">
              <BackButton />
              <h1 className="weekly-schedule-title">Weekly Schedule</h1>
            </div>
            <div className="header-actions">
              <button className={`view-toggle ${selectedView === 'day' ? 'active' : ''}`} onClick={() => {
                if (selectedView === 'week') {
                  setSelectedView('day');
                  // Set current day when switching to day view
                  const today = new Date().getDay();
                  const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thur', 'Fri', 'Sat'];
                  setCurrentDay(dayMap[today]);
                } else {
                  setSelectedView('week');
                }
              }}>
                {selectedView === 'week' ? 'Week' : 'Day'}
              </button>
              <button className={`edit-button ${isEditMode ? 'active' : ''}`} onClick={handleEditClick}>
                <img src="/assets/icons/icons2/edit-icon.svg" alt="Edit" />
              </button>
            </div>
          </div>

          {/* Week Navigation */}
          <div className="week-navigation">
            <button className="nav-btn" onClick={handlePreviousWeek}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41,16.58L10.83,12L15.41,7.41L14,6L8,12L14,18L15.41,16.58Z"/>
              </svg>
            </button>
            <div className="week-display" onClick={() => setShowWeekSelector(!showWeekSelector)}>
              <span className="week-range">{getWeekRange().start} - {getWeekRange().end}</span>
              <button className="today-btn" onClick={handleToday}>Today</button>
            </div>
            <button className="nav-btn" onClick={handleNextWeek}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z"/>
              </svg>
            </button>
          </div>

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="success-message">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
              </svg>
              <span>Schedule updated successfully!</span>
            </div>
          )}

          {/* Schedule Grid */}
          <div className="schedule-container">
          <div className={`schedule-grid ${selectedView === 'day' ? 'day-view' : ''}`}>
            {/* Time slots and schedule cells */}
            {orderedTimeSlotEntries.map(({ slot: timeSlot, index: timeIndex }) => (
              <React.Fragment key={`slot-row-${timeIndex}`}>
                {/* Time slot header */}
                <div 
                  className={`time-header ${isEditMode ? 'editable-time' : ''}`}
                  onClick={() => handleTimeClick(timeIndex)}
                >
                  <span className="time-text">{timeSlot}</span>
                  {isEditMode && <div className="edit-indicator">✏️</div>}
                </div>

                {/* Schedule cells for each day */}
                {days.map((day) => {
                  const courseCode = scheduleData[day as keyof typeof scheduleData][timeIndex];
                  
                  // Improved current time detection logic
                  const now = new Date();
                  const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  const currentTimeInMinutes = currentHour * 60 + currentMinute;
                  
                  const { start: startTimeInMinutes, end: endTimeInMinutes } = parseTimeSlotRangeMinutes(
                    timeSlots[timeIndex]
                  );
                  
                  // Check if current day matches (Monday = 1, Tuesday = 2, etc.)
                  const dayIndex = days.indexOf(day) + 1; // Convert to 1-based index
                  const isCurrentDayOfWeek = currentDayOfWeek === dayIndex;
                  
                  // Check if current time falls within this time slot
                  const isCurrentTime = isCurrentDayOfWeek && 
                    currentTimeInMinutes >= startTimeInMinutes && 
                    currentTimeInMinutes < endTimeInMinutes;
                  
                  const isCurrentDay = selectedView === 'day' && day === currentDay;
                  
                  return (
                    <div 
                      key={`${day}-${timeIndex}-${courseCode}`} 
                      className={`schedule-cell ${isEditMode ? 'editable' : ''} ${isCurrentTime ? 'current-time' : ''} ${isCurrentDay ? 'current-day' : ''}`}
                      onClick={() => handleCellClick(day, timeIndex)}
                      style={{
                        background: getDiagonalColor(days.indexOf(day), timeIndex),
                        borderLeft: isCurrentTime ? '4px solid #2c5f2c' : undefined,
                        border: selectedView === 'day' && day === currentDay ? '3px solid #2c5f2c' : undefined
                      }}
                    >
                      <span className="course-code">{courseCode}</span>
                      {isCurrentTime && (
                        <>
                          <div className="current-indicator"></div>
                          <div className="live-indicator">
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Bottom-left corner cell */}
            <div className="corner-cell">
              <div className="corner-content">
                <span className="corner-text-vertical">Time</span>
                <span className="corner-text-horizontal">Days</span>
              </div>
            </div>

            {/* Day headers at bottom */}
            {days.map((day) => (
              <div 
                key={day} 
                className={`day-header ${selectedView === 'day' && day === currentDay ? 'current-day-header' : ''}`}
              >
                <span className="day-text">{day}</span>
              </div>
            ))}
          </div>
        </div>
        </div>

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modern-modal-overlay">
            <div className="modern-modal-content">
              <div className="modal-header">
                <div className="modal-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,17.25V21H6.75L17.81,9.94L14.06,6.19L3,17.25M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.13,5.12L18.88,8.87L20.71,7.04Z"/>
                  </svg>
                </div>
                <h2>Edit Schedule</h2>
                <p>Update your course or activity</p>
                <button className="close-btn" onClick={handleCancelEdit}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z"/>
                  </svg>
                </button>
              </div>
              
              <div className="modal-body">
                <div className="input-group">
                  <label>Course/Activity</label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      placeholder="Enter course code or activity..."
                      autoFocus
                      disabled={isLoading}
                      className="modern-input"
                    />
                    <div className="input-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z"/>
                      </svg>
                    </div>
                  </div>
                </div>

                <div className="input-group" style={{ marginTop: '15px' }}>
                  <label>Venue (Optional)</label>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      value={editVenueValue}
                      onChange={(e) => setEditVenueValue(e.target.value)}
                      placeholder="Enter venue..."
                      disabled={isLoading}
                      className="modern-input"
                    />
                    <div className="input-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A8,8 0 0,0 4,10C4,14.22 12,22 12,22C12,22 20,14.22 20,10A8,8 0 0,0 12,2M12,12.5A2.5,2.5 0 0,1 9.5,10A2.5,2.5 0 0,1 12,7.5A2.5,2.5 0 0,1 14.5,10A2.5,2.5 0 0,1 12,12.5Z"/>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="quick-select">
                  <label>Quick Select</label>
                  <div className="quick-options">
                    {['TMC', 'PHY', 'FIN', 'MIS', 'MAT', 'ENG', 'HIS', 'BIO'].map((course) => (
                      <button
                        key={course}
                        className="quick-option"
                        onClick={() => setEditValue(course)}
                        style={{ 
                          background: getDiagonalColor(0, 0),
                          border: editValue === course ? '3px solid #2c5f2c' : 'none'
                        }}
                      >
                        {course}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={handleCancelEdit}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveEdit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                      </svg>
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Time Edit Modal */}
        {showTimeEditModal && (
          <div className="modern-modal-overlay">
            <div className="modern-modal-content">
              <div className="modal-header">
                <div className="modal-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                  </svg>
                </div>
                <h2>Edit Time Slot</h2>
                <p>Update the time for this schedule slot</p>
              </div>
              
              <div className="modal-body">
                <div className="input-group">
                  <label>Time Range</label>
                  <div className="input-wrapper">
                    <div className="input-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M16.2,16.2L11,13V7H12.5V12.2L17,14.9L16.2,16.2Z"/>
                      </svg>
                    </div>
                    <input
                      type="text"
                      className="modern-input"
                      value={editTimeValue}
                      onChange={(e) => setEditTimeValue(e.target.value)}
                      placeholder="e.g., 08:00 - 10:00"
                    />
                  </div>
                  <div className="input-counter">
                    24-hour format: HH:MM - HH:MM
                  </div>
                </div>
                
                <div className="quick-select">
                  <label>Quick Select</label>
                  <div className="quick-options">
                    {QUICK_TIME_PRESETS_24.map((time) => (
                      <button
                        key={time}
                        className="quick-option"
                        onClick={() => setEditTimeValue(time)}
                        style={{ 
                          background: editTimeValue === time ? '#2c5f2c' : '#447055',
                          border: editTimeValue === time ? '3px solid #2c5f2c' : 'none'
                        }}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  className="btn-secondary" 
                  onClick={handleCancelTimeEdit}
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleSaveTimeEdit}
                  disabled={isLoading || !editTimeValue.trim()}
                >
                  {isLoading ? (
                    <div className="loading-spinner"></div>
                  ) : (
                    <>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
                      </svg>
                      Save Time
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}


      </IonContent>
    </IonPage>
  );
};

export default WeeklySchedule;
