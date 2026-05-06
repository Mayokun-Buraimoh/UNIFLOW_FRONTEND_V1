import { IonContent, IonPage, IonButton, IonToast } from '@ionic/react';
import { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { useSwipeBack } from '../hooks/useSwipeBack';
import './StudySession.css';

const StudySession: React.FC = () => {
  const history = useHistory();
  const [selectedTechnique, setSelectedTechnique] = useState('Pomodoro Technique');
  const [totalStudyTime, setTotalStudyTime] = useState('1:30');
  const [studyInterval, setStudyInterval] = useState('30:00');
  const [selectedNote, setSelectedNote] = useState('BUS111 - week 4');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isEditingTotalTime, setIsEditingTotalTime] = useState(false);
  const [isEditingInterval, setIsEditingInterval] = useState(false);
  const [tempTotalTime, setTempTotalTime] = useState('1:30');
  const [tempInterval, setTempInterval] = useState('30:00');
  const [isTechniqueDropdownOpen, setIsTechniqueDropdownOpen] = useState(false);
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);

  // Enable swipe to go back unless the user is actively using a dropdown or editing time
  useSwipeBack(!isTechniqueDropdownOpen && !isNoteDropdownOpen && !isEditingTotalTime && !isEditingInterval);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.dropdown-container')) {
        setIsTechniqueDropdownOpen(false);
        setIsNoteDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const studyTechniques = [
    'Pomodoro Technique',
    'Study your way',
    'Active Recall',
    'Spaced Repetition',
    'Mind Mapping'
  ];

  const availableNotes = [
    'BUS111 - week 4',
    'GEC104 - week 3',
    'HSE101 - week 2',
    'BFN111 - week 5',
    'Custom Notes'
  ];

  // Helper function to convert time string to minutes
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to convert minutes to time string
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}:${mins.toString().padStart(2, '0')}`;
  };

  // Calculate break time (1/6th of interval time)
  const calculateBreakTime = (): string => {
    const intervalMinutes = timeToMinutes(studyInterval);
    const breakMinutes = Math.round(intervalMinutes / 6);
    return minutesToTime(breakMinutes);
  };

  // Calculate number of intervals
  const calculateIntervals = (): number => {
    const totalMinutes = timeToMinutes(totalStudyTime);
    const intervalMinutes = timeToMinutes(studyInterval);
    return Math.floor(totalMinutes / intervalMinutes);
  };

  const handleTotalTimeClick = () => {
    setIsEditingTotalTime(true);
    setTempTotalTime(totalStudyTime);
  };

  const handleIntervalClick = () => {
    setIsEditingInterval(true);
    setTempInterval(studyInterval);
  };

  const handleTotalTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTotalTime(e.target.value);
  };

  const handleIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempInterval(e.target.value);
  };

  const handleSetTotalTime = () => {
    // Validate time format (H:MM or HH:MM)
    const timeRegex = /^([0-9]|1[0-9]):([0-5][0-9])$/;
    if (!timeRegex.test(tempTotalTime)) {
      setToastMessage('Please enter time in H:MM format (e.g., 1:30)');
      setShowToast(true);
      return;
    }

    setTotalStudyTime(tempTotalTime);
    setIsEditingTotalTime(false);
    setToastMessage(`Total study time set to ${tempTotalTime}`);
    setShowToast(true);
  };

  const handleSetInterval = () => {
    // Validate time format (MM:SS)
    const timeRegex = /^([0-5]?[0-9]):([0-5][0-9])$/;
    if (!timeRegex.test(tempInterval)) {
      setToastMessage('Please enter interval in MM:SS format (e.g., 30:00)');
      setShowToast(true);
      return;
    }

    setStudyInterval(tempInterval);
    setIsEditingInterval(false);
    setToastMessage(`Study interval set to ${tempInterval}`);
    setShowToast(true);
  };

  const handleCancelTotalTime = () => {
    setIsEditingTotalTime(false);
    setTempTotalTime(totalStudyTime);
  };

  const handleCancelInterval = () => {
    setIsEditingInterval(false);
    setTempInterval(studyInterval);
  };

  const handleProceed = () => {
    // Navigate to study session timer or next step
    console.log('Starting study session with:', {
      technique: selectedTechnique,
      totalStudyTime: totalStudyTime,
      studyInterval: studyInterval,
      breakTime: calculateBreakTime(),
      intervals: calculateIntervals(),
      note: selectedNote
    });
    // You can add navigation logic here
  };

  return (
    <IonPage>
      <IonContent className="study-session-content">
        {/* Header Section with Background */}
        <div className="study-session-header">
          <div className="header-overlay">
            <h1 className="header-title">Study Session</h1>
            <p className="header-subtitle">Let's get to Work :)</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="study-session-main">
          {/* Select Study Technique Section */}
          <div className="input-section">
            <label className="section-label">Select study technique</label>
            <div className="dropdown-container">
              <div
                className="dropdown-select"
                onClick={() => {
                  console.log('Dropdown clicked!');
                  setIsTechniqueDropdownOpen(!isTechniqueDropdownOpen);
                }}
              >
                {selectedTechnique}
                <div className="dropdown-arrow">▼</div>
              </div>
              {isTechniqueDropdownOpen && (
                <div className="dropdown-options">
                  {studyTechniques.map((technique) => (
                    <div
                      key={technique}
                      className={`dropdown-option ${selectedTechnique === technique ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedTechnique(technique);
                        setIsTechniqueDropdownOpen(false);
                      }}
                    >
                      {technique}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Total Study Time Section */}
          <div className="input-section">
            <label className="section-label">Total Study Time</label>
            <div className="timer-container">
              {isEditingTotalTime ? (
                <div className="timer-edit-mode">
                  <input
                    type="text"
                    className="timer-input"
                    value={tempTotalTime}
                    onChange={handleTotalTimeChange}
                    placeholder="H:MM"
                    maxLength={5}
                  />
                  <div className="timer-edit-buttons">
                    <button className="timer-cancel-button" onClick={handleCancelTotalTime}>
                      Cancel
                    </button>
                    <button className="timer-set-button" onClick={handleSetTotalTime}>
                      Set
                    </button>
                  </div>
                </div>
              ) : (
                <div className="timer-display-mode">
                  <div className="timer-display" onClick={handleTotalTimeClick}>
                    {totalStudyTime}
                  </div>
                  <button className="timer-set-button" onClick={handleTotalTimeClick}>
                    Set
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Study Time Interval Section */}
          <div className="input-section">
            <label className="section-label">Study Time Interval</label>
            <div className="timer-container">
              {isEditingInterval ? (
                <div className="timer-edit-mode">
                  <input
                    type="text"
                    className="timer-input"
                    value={tempInterval}
                    onChange={handleIntervalChange}
                    placeholder="MM:SS"
                    maxLength={5}
                  />
                  <div className="timer-edit-buttons">
                    <button className="timer-cancel-button" onClick={handleCancelInterval}>
                      Cancel
                    </button>
                    <button className="timer-set-button" onClick={handleSetInterval}>
                      Set
                    </button>
                  </div>
                </div>
              ) : (
                <div className="timer-display-mode">
                  <div className="timer-display" onClick={handleIntervalClick}>
                    {studyInterval}
                  </div>
                  <button className="timer-set-button" onClick={handleIntervalClick}>
                    Set
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Study Session Summary */}
          <div className="input-section">
            <label className="section-label">Session Summary</label>
            <div className="session-summary">
              <div className="summary-item">
                <span className="summary-label">Break Time:</span>
                <span className="summary-value">{calculateBreakTime()}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Intervals:</span>
                <span className="summary-value">{calculateIntervals()}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Total Session:</span>
                <span className="summary-value">{totalStudyTime}</span>
              </div>
            </div>
          </div>

          {/* Select Note/Attachment Section */}
          <div className="input-section">
            <label className="section-label">Select Note /attachment to read</label>
            <div className="dropdown-container">
              <div
                className="dropdown-select"
                onClick={() => {
                  console.log('Note dropdown clicked!');
                  setIsNoteDropdownOpen(!isNoteDropdownOpen);
                }}
              >
                {selectedNote}
                <div className="dropdown-arrow">▼</div>
              </div>
              {isNoteDropdownOpen && (
                <div className="dropdown-options">
                  {availableNotes.map((note) => (
                    <div
                      key={note}
                      className={`dropdown-option ${selectedNote === note ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedNote(note);
                        setIsNoteDropdownOpen(false);
                      }}
                    >
                      {note}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Proceed Button */}
          <div className="proceed-section">
            <button className="proceed-button" onClick={handleProceed}>
              Proceed
            </button>
          </div>

          {/* Bottom Spacer */}
          <div className="bottom-spacer"></div>
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation />

        {/* Toast Notification */}
        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={2000}
          position="top"
          color="success"
        />
      </IonContent>
    </IonPage>
  );
};

export default StudySession;
