import React from 'react';
import './Progress.css';

const Progress: React.FC = () => {
  console.log('Progress component rendered');

  return (
    <div className="progress-container">
      <p className="progress-description">
        Visual and analytical summary of your performance
      </p>
      
      <div className="weekly-streak-tracker">
        <div className="streak-days-row">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
            <div key={index} className="streak-day-item">
              <span className="streak-day-letter">{day}</span>
              <div className="streak-circle">
                {index === 0 ? (
                  <div className="progress-ring" style={{'--progress': '35'} as React.CSSProperties}>
                    <div className="streak-icon question-mark">?</div>
                  </div>
                ) : index < 5 ? (
                  <div className="streak-icon completed">✔</div>
                ) : index === 5 ? (
                  <div className="progress-ring" style={{ '--progress': 70 } as React.CSSProperties}>
                    <div className="streak-icon incomplete"></div>
                  </div>
                ) : (
                  <div className="streak-icon incomplete"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="productivity-report-card">
        <h3 className="report-title">Weekly Productivity Report</h3>
        <p className="report-week">Week - July 1st - 7th</p>
        <p className="report-user">User - Afolabi</p>
        <p className="report-quote">
          You crushed it this week — consistent, focused, and organized!
        </p>
        
        <div className="report-divider"></div>
        
        <div className="overview-section">
          <h4 className="section-title">Overview</h4>
          <div className="overview-grid">
            <div className="overview-item">
              <span className="overview-label">Productivity Score</span>
              <span className="overview-value">91%</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Tasks Completed</span>
              <span className="overview-value">17 / 20</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Streak</span>
              <span className="overview-value">6-day streak maintained</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Study Time Logged</span>
              <span className="overview-value">11 hrs 45 mins</span>
            </div>
          </div>
        </div>

        <div className="report-divider"></div>

        <div className="focused-day-section">
          <div className="focused-day-grid">
            <h4 className="section-title">Most Focused Day</h4>
            <h4 className="section-title">Study Tracker Progress</h4>
            <div className="focused-day-item">
              <span className="focused-day-label">Thursday (July 4th)</span>
            </div>
            <div className="tracker-item">
              <span className="tracker-course">GEC104: Week 5 of 12</span>
            </div>
            <div className="focused-day-item">
              <span className="focused-day-label">3 hr 10 min study session</span>
            </div>
            <div className="tracker-item">
              <span className="tracker-course">BFN111: Week 3 of 10</span>
            </div>
            <div className="focused-day-item">
              <span className="focused-day-label">5 tasks completed</span>
            </div>
            <div className="tracker-item">
              <span className="tracker-course">HSE101: Week 4 of 8</span>
            </div>
            <div className="focused-day-item">
              <span className="focused-day-label">Productivity score: 98%</span>
            </div>
            <div className="tracker-item">
              <span className="tracker-course"></span>
            </div>
          </div>
        </div>

        <div className="final-quote">
          <p className="quote-text">
            "Discipline is choosing between what you want now and what you want most."
          </p>
        </div>
      </div>
      
      <div className="progress-spacer"></div>
    </div>
  );
};

export default Progress;
