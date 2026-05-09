import { useState, useEffect, useRef, useCallback } from 'react';

const STREAK_KEY = 'uniflow_streak';
const STREAK_DATE_KEY = 'uniflow_streak_date';   // last day the streak was counted
const STREAK_LONGEST_KEY = 'uniflow_streak_longest';
const SESSION_START_KEY = 'uniflow_session_start'; // when today's active session started
const REQUIRED_MS = 5 * 60 * 1000; // 5 minutes
export const STREAK_UPDATED_EVENT = 'uniflow_streak_updated';

function getTodayString() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`; // local date, not UTC
}

function getDayDelta(fromDateStr: string, toDateStr: string): number {
    const from = new Date(`${fromDateStr}T00:00:00`);
    const to = new Date(`${toDateStr}T00:00:00`);
    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

function loadStreak(): number {
    const stored = localStorage.getItem(STREAK_KEY);
    if (stored === null) {
        localStorage.setItem(STREAK_KEY, '0');
        return 0;
    }
    const parsed = parseInt(stored, 10);
    return isNaN(parsed) ? 0 : parsed;
}

function saveStreak(value: number) {
    localStorage.setItem(STREAK_KEY, String(value));
}

export function readLongestStreak(): number {
    const raw = localStorage.getItem(STREAK_LONGEST_KEY);
    if (raw === null) {
        const current = loadStreak();
        localStorage.setItem(STREAK_LONGEST_KEY, String(current));
        return current;
    }
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
}

function writeLongestIfHigher(currentStreak: number) {
    const prev = readLongestStreak();
    if (currentStreak > prev) {
        localStorage.setItem(STREAK_LONGEST_KEY, String(currentStreak));
    }
}

type UseStreakOptions = {
    trackActivity?: boolean;
};

export function useStreak(options: UseStreakOptions = {}) {
    const { trackActivity = true } = options;
    const [streak, setStreak] = useState<number>(loadStreak);
    // Tracks how many ms the user has been active today
    const accumulatedMs = useRef<number>(0);
    const sessionStartRef = useRef<number | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const streakAwardedRef = useRef<boolean>(false);

    // Check if we have already awarded the streak today
    useEffect(() => {
        const lastDate = localStorage.getItem(STREAK_DATE_KEY);
        const today = getTodayString();
        if (lastDate === today) {
            streakAwardedRef.current = true;
        } else if (lastDate) {
            const delta = getDayDelta(lastDate, today);
            // If user missed at least one full day, reset current streak.
            if (delta > 1) {
                saveStreak(0);
                localStorage.removeItem(STREAK_DATE_KEY);
                setStreak(0);
                streakAwardedRef.current = false;
                window.dispatchEvent(new Event(STREAK_UPDATED_EVENT));
            } else {
                streakAwardedRef.current = false;
            }
        }

        // Keep longest streak in sync with stored current (e.g. after upgrades or manual edits)
        const cur = loadStreak();
        writeLongestIfHigher(cur);

        if (trackActivity) {
            // Restore accumulated time from this session if page was refreshed
            const sessionStart = localStorage.getItem(SESSION_START_KEY);
            if (sessionStart) {
                const started = parseInt(sessionStart, 10);
                if (!isNaN(started)) {
                    const today = getTodayString();
                    const startedDate = new Date(started).toISOString().slice(0, 10);
                    if (startedDate === today) {
                        accumulatedMs.current = Date.now() - started;
                    }
                }
            }
        }
    }, [trackActivity]);

    useEffect(() => {
        const handleStreakUpdated = () => {
            setStreak(loadStreak());
        };
        window.addEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated);
        return () => window.removeEventListener(STREAK_UPDATED_EVENT, handleStreakUpdated);
    }, []);

    const startCounting = useCallback(() => {
        if (streakAwardedRef.current) return; // already awarded today
        if (sessionStartRef.current !== null) return; // already counting
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }

        sessionStartRef.current = Date.now();
        localStorage.setItem(SESSION_START_KEY, String(sessionStartRef.current));

        timerRef.current = setInterval(() => {
            if (sessionStartRef.current === null) return;
            localStorage.setItem('uniflow_last_active_time', String(Date.now()));

            const elapsed = accumulatedMs.current + (Date.now() - sessionStartRef.current);

            if (elapsed >= REQUIRED_MS && !streakAwardedRef.current) {
                // Award the streak!
                streakAwardedRef.current = true;
                const today = getTodayString();
                const lastDate = localStorage.getItem(STREAK_DATE_KEY);
                const prevStreak = loadStreak();
                const dayDelta = lastDate ? getDayDelta(lastDate, today) : Number.POSITIVE_INFINITY;
                const newStreak = dayDelta === 1 ? prevStreak + 1 : 1;
                saveStreak(newStreak);
                writeLongestIfHigher(newStreak);
                localStorage.setItem(STREAK_DATE_KEY, today);
                setStreak(newStreak);
                window.dispatchEvent(new Event(STREAK_UPDATED_EVENT));

                // Stop the timer
                if (timerRef.current) {
                    clearInterval(timerRef.current);
                    timerRef.current = null;
                }
            }
        }, 5000); // check every 5 seconds
    }, []);

    const pauseCounting = useCallback(() => {
        if (sessionStartRef.current !== null) {
            accumulatedMs.current += Date.now() - sessionStartRef.current;
            localStorage.setItem('uniflow_last_active_time', String(Date.now()));
            sessionStartRef.current = null;
        }
        localStorage.removeItem(SESSION_START_KEY);
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // Activity listeners — start/pause counting based on visibility & focus
    useEffect(() => {
        if (!trackActivity) {
            return;
        }

        const lastActive = parseInt(localStorage.getItem('uniflow_last_active_time') || '0', 10);
        if (lastActive > 0 && Date.now() - lastActive > 25 * 60 * 60 * 1000) {
            localStorage.setItem(STREAK_KEY, '0');
            localStorage.removeItem(STREAK_DATE_KEY);
            setStreak(0);
            window.dispatchEvent(new Event(STREAK_UPDATED_EVENT));
        }

        const handleVisible = () => {
            if (!document.hidden) {
                startCounting();
            } else {
                pauseCounting();
            }
        };

        const handleFocus = () => startCounting();
        const handleBlur = () => pauseCounting();

        // Start immediately if page is visible
        if (!document.hidden) {
            startCounting();
        }

        document.addEventListener('visibilitychange', handleVisible);
        window.addEventListener('focus', handleFocus);
        window.addEventListener('blur', handleBlur);

        return () => {
            pauseCounting();
            if (timerRef.current) clearInterval(timerRef.current);
            document.removeEventListener('visibilitychange', handleVisible);
            window.removeEventListener('focus', handleFocus);
            window.removeEventListener('blur', handleBlur);
        };
    }, [startCounting, pauseCounting, trackActivity]);

    return streak;
}
