import React, { useMemo, useEffect, useState } from 'react';
import { IonPage, IonContent, IonIcon } from '@ionic/react';
import { bookOutline, ribbonOutline } from 'ionicons/icons';
import {
  getCurrentWeekFocusSessions,
  getFocusSessionRecords,
  getStartOfWeek,
} from '../utils/focusSessionAnalytics';
import BackButton from '../components/BackButton';
import { APP_PREFERENCES_UPDATED_EVENT } from '../utils/appPreferences';
import './Analytics.css';

const PIE_COLORS = ['#2ecc71', '#7c4dff', '#ff9800', '#2196f3', '#e91e63', '#00bcd4', '#8bc34a', '#ff5722'];

const Analytics: React.FC = () => {
  const now = new Date();

  const [appPrefsTick, setAppPrefsTick] = useState(0);
  useEffect(() => {
    const onPrefs = () => setAppPrefsTick((n) => n + 1);
    window.addEventListener(APP_PREFERENCES_UPDATED_EVENT, onPrefs);
    return () => window.removeEventListener(APP_PREFERENCES_UPDATED_EVENT, onPrefs);
  }, []);

  const normalizeCourseName = (value?: string | null) => {
    const trimmed = value?.trim();
    if (!trimmed || trimmed === 'Unknown Course' || trimmed === 'Study Session') {
      return null;
    }
    return trimmed;
  };

  const normalizeDocumentKey = (value?: string | null) => {
    const trimmed = value?.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }

    const withoutExtension = trimmed.replace(/\.[a-z0-9]+$/i, '');
    return [trimmed, withoutExtension];
  };

  const sessions = useMemo(() => getCurrentWeekFocusSessions(now), [now, appPrefsTick]);
  const weekStart = useMemo(() => getStartOfWeek(now), [now, appPrefsTick]);
  const courseLookup = useMemo(() => {
    const byDocumentTitle = new Map<string, string>();
    const byNoteId = new Map<string, string>();
    const byCourseId = new Map<string, string>();
    let courses: Array<{ id: string; name?: string; title?: string; courseName?: string; code?: string }> = [];

    try {
      const rawCourses = localStorage.getItem('uniflow_courses');
      courses = rawCourses ? JSON.parse(rawCourses) : [];
    } catch (error) {
      console.error('Failed to parse courses for analytics lookup', error);
    }

    Object.keys(localStorage)
      .filter((key) => key.startsWith('uniflow_files_'))
      .forEach((key) => {
        try {
          const rawFiles = localStorage.getItem(key);
          const files = rawFiles ? JSON.parse(rawFiles) : [];
          const courseId = key.replace('uniflow_files_', '');
          const matchedCourse = courses.find((course) => course.id === courseId);
          const courseName = normalizeCourseName(
            matchedCourse?.name || matchedCourse?.title || matchedCourse?.courseName || matchedCourse?.code
          );

          if (!courseName || !Array.isArray(files)) {
            return;
          }

          byCourseId.set(courseId, courseName);

          files.forEach((file: { id?: string; title?: string; name?: string; originalName?: string; documentName?: string }) => {
            if (file?.id) {
              byNoteId.set(file.id, courseName);
            }

            [file?.title, file?.name, file?.originalName, file?.documentName].forEach((candidate) => {
              const keys = normalizeDocumentKey(candidate);
              if (!keys) {
                return;
              }

              keys.forEach((documentKey) => byDocumentTitle.set(documentKey, courseName));
            });
          });
        } catch (error) {
          console.error('Failed to build analytics course lookup', error);
        }
      });

    return { byCourseId, byDocumentTitle, byNoteId };
  }, []);

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + index);
      return date;
    });
  }, [weekStart]);

  const normalizedSessions = useMemo(() => {
    return sessions.map((session) => {
      const documentKeys = normalizeDocumentKey(session.documentName);
      const resolvedCourseName =
        normalizeCourseName(session.courseName) ||
        (session.courseId ? courseLookup.byCourseId.get(session.courseId) : undefined) ||
        (session.noteId ? courseLookup.byNoteId.get(session.noteId) : undefined) ||
        documentKeys?.map((documentKey) => courseLookup.byDocumentTitle.get(documentKey)).find(Boolean) ||
        'Unknown Course';

      return {
        ...session,
        resolvedCourseName,
      };
    });
  }, [courseLookup, sessions]);

  const totalMinutes = normalizedSessions.reduce((sum, session) => sum + session.minutesRead, 0);
  const quizSessions = normalizedSessions.filter((session) => session.quizScorePercent !== null);
  const averageQuizScore =
    quizSessions.length > 0
      ? Math.round(quizSessions.reduce((sum, session) => sum + (session.quizScorePercent || 0), 0) / quizSessions.length)
      : null;

  const dailyMinutes = weekDays.map((date) => {
    const total = normalizedSessions
      .filter((session) => new Date(session.endedAt).toDateString() === date.toDateString())
      .reduce((sum, session) => sum + session.minutesRead, 0);

    return {
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      minutes: total,
    };
  });

  const maxDailyMinutes = Math.max(...dailyMinutes.map((day) => day.minutes), 1);

  const courseBreakdown = Object.values(
    normalizedSessions.reduce<Record<string, { courseName: string; minutes: number; sessions: number }>>((acc, session) => {
      const key = session.resolvedCourseName;
      if (!acc[key]) {
        acc[key] = { courseName: key, minutes: 0, sessions: 0 };
      }
      acc[key].minutes += session.minutesRead;
      acc[key].sessions += 1;
      return acc;
    }, {})
  ).sort((a, b) => {
    if (a.courseName === 'Unknown Course' && b.courseName !== 'Unknown Course') {
      return 1;
    }
    if (b.courseName === 'Unknown Course' && a.courseName !== 'Unknown Course') {
      return -1;
    }
    return b.minutes - a.minutes;
  });

  /** Pie slices: same weekly read-time totals as course breakdown (minutesRead per course). */
  const pieSlices = useMemo(() => {
    const withTime = courseBreakdown.filter((c) => c.minutes > 0);
    const total = withTime.reduce((s, c) => s + c.minutes, 0);
    if (total <= 0) {
      return [] as Array<{ courseName: string; minutes: number; pct: number; color: string }>;
    }
    return withTime.map((c, i) => ({
      courseName: c.courseName,
      minutes: c.minutes,
      pct: (c.minutes / total) * 100,
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [courseBreakdown]);

  const pieGradient = useMemo(() => {
    if (pieSlices.length === 0) {
      return 'conic-gradient(#e8ece9 0% 100%)';
    }
    let acc = 0;
    const stops = pieSlices.map((s) => {
      const start = acc;
      acc += s.pct;
      return `${s.color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  }, [pieSlices]);

  const activeDays = dailyMinutes.filter((day) => day.minutes > 0).length;
  const weekRangeLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  const studyStreakDays = useMemo(() => {
    const all = getFocusSessionRecords();
    const daysWithActivity = new Set(
      all.map((s) => {
        const d = new Date(s.endedAt);
        d.setHours(0, 0, 0, 0);
        return d.toISOString().slice(0, 10);
      })
    );
    let streak = 0;
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const key = () => d.toISOString().slice(0, 10);
    while (daysWithActivity.has(key())) {
      streak += 1;
      d.setDate(d.getDate() - 1);
    }
    return streak;
  }, [now]);

  const achievements = useMemo(() => {
    const rows: Array<{ tone: 'green' | 'blue' | 'orange'; text: string }> = [];
    const hours = totalMinutes / 60;

    if (totalMinutes > 0) {
      rows.push({
        tone: 'green',
        text:
          hours >= 1
            ? `Logged ${hours.toFixed(1)} hours of course reading this week`
            : `Logged ${totalMinutes} minutes of course reading this week`,
      });
    } else {
      rows.push({
        tone: 'green',
        text: 'Start a focus session to track reading time by course',
      });
    }

    if (averageQuizScore !== null && quizSessions.length > 0) {
      rows.push({
        tone: 'blue',
        text: `Maintained ${averageQuizScore}% average quiz score (${quizSessions.length} attempt${quizSessions.length === 1 ? '' : 's'})`,
      });
    } else {
      rows.push({
        tone: 'blue',
        text: 'Complete quizzes during sessions to see scores here',
      });
    }

    if (studyStreakDays >= 2) {
      rows.push({
        tone: 'orange',
        text: `${studyStreakDays}-day study streak — keep it going`,
      });
    } else if (activeDays >= 2) {
      rows.push({
        tone: 'orange',
        text: `Studied on ${activeDays} day${activeDays === 1 ? '' : 's'} this week`,
      });
    } else {
      rows.push({
        tone: 'orange',
        text: 'Read on more days this week to grow your streak',
      });
    }

    return rows;
  }, [totalMinutes, averageQuizScore, quizSessions.length, studyStreakDays, activeDays]);

  /** Bar labels: under 1h show minutes; 1h+ show hours with "h" (bare "0.1" was 0.1 hours ≈ 6m). */
  const minutesToHoursLabel = (minutes: number) => {
    if (minutes <= 0) return '';
    const h = minutes / 60;
    if (h < 1) {
      return `${Math.max(1, Math.round(minutes))}m`;
    }
    const rounded = Math.round(h * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
  };

  return (
    <IonPage className="analytics-page">
      <IonContent fullscreen className="analytics-content">
        <div className="analytics-status-spacer" />

        <header className="analytics-top-header">
          <BackButton />
          <h1 className="analytics-page-title">Analytics</h1>
          <span className="analytics-week-range">{weekRangeLabel}</span>
        </header>

        <div className="analytics-stack">
          {/* Card 1 — Courses distribution from weekly read time per course */}
          <section className="analytics-soft-card">
            <div className="analytics-soft-card-head">
              <IonIcon icon={bookOutline} className="analytics-soft-card-icon" />
              <h2 className="analytics-soft-card-title">Courses Distribution</h2>
            </div>
            {pieSlices.length === 0 ? (
              <p className="analytics-soft-empty">No reading time logged this week yet. Start a focus session on a note.</p>
            ) : (
              <>
                <div className="analytics-pie-wrap">
                  <div className="analytics-pie" style={{ background: pieGradient }} aria-hidden />
                  <div className="analytics-pie-hole" />
                </div>
                <ul className="analytics-pie-legend">
                  {pieSlices.map((s) => (
                    <li key={s.courseName} className="analytics-pie-legend-item">
                      <span className="analytics-pie-dot" style={{ background: s.color }} />
                      <span className="analytics-pie-name">{s.courseName}</span>
                      <span className="analytics-pie-pct" style={{ color: s.color }}>
                        {s.pct.toFixed(0)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Card 2 — Daily study hours (horizontal bars) */}
          <section className="analytics-soft-card">
            <div className="analytics-soft-card-head analytics-soft-card-head--solo">
              <h2 className="analytics-soft-card-title">Daily Study Hours</h2>
            </div>
            {normalizedSessions.length === 0 ? (
              <p className="analytics-soft-empty">No sessions this week — bars will fill as you study.</p>
            ) : (
              <div className="analytics-hbars">
                {dailyMinutes.map((day) => {
                  const pct = maxDailyMinutes > 0 ? (day.minutes / maxDailyMinutes) * 100 : 0;
                  const barPct = day.minutes > 0 ? Math.max(pct, 3) : 0;
                  const showInside = pct >= 24 && day.minutes > 0;
                  return (
                    <div key={day.label} className="analytics-hbar-row">
                      <span className="analytics-hbar-day">{day.label}</span>
                      <div className="analytics-hbar-track">
                        <div className="analytics-hbar-fill" style={{ width: `${barPct}%` }}>
                          {showInside && (
                            <span className="analytics-hbar-value">{minutesToHoursLabel(day.minutes)}</span>
                          )}
                        </div>
                        {!showInside && day.minutes > 0 && (
                          <span className="analytics-hbar-value analytics-hbar-value--outside">
                            {minutesToHoursLabel(day.minutes)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Card 3 — Achievements */}
          <section className="analytics-soft-card analytics-soft-card--last">
            <div className="analytics-soft-card-head">
              <IonIcon icon={ribbonOutline} className="analytics-soft-card-icon" />
              <h2 className="analytics-soft-card-title">{"This Week's Achievements"}</h2>
            </div>
            <ul className="analytics-achievements">
              {achievements.map((row, i) => (
                <li key={i} className={`analytics-achievement analytics-achievement--${row.tone}`}>
                  <span className="analytics-achievement-bullet" />
                  <span className="analytics-achievement-text">{row.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Analytics;
