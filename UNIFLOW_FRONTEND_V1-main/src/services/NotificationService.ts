import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

/** Local notification id for “1 hour before 24h since last activity” streak warning */
export const STREAK_INACTIVITY_NOTIFICATION_ID = 92001;

/** Mirror of profile `streakNotification`; updated when user saves Notification preferences */
export const STREAK_NOTIF_PREF_KEY = 'uniflow_streak_notif_enabled';

const MS_24H = 24 * 60 * 60 * 1000;
const MS_1H = 60 * 60 * 1000;

let streakSyncDebounce: ReturnType<typeof setTimeout> | null = null;

/** Debounced so the 5s activity interval does not hammer the native scheduler */
export function requestStreakInactivityReminderSync(): void {
  if (streakSyncDebounce) clearTimeout(streakSyncDebounce);
  streakSyncDebounce = setTimeout(() => {
    streakSyncDebounce = null;
    void NotificationService.syncStreakInactivityReminder();
  }, 2500);
}

export class NotificationService {
  static async requestPermissions() {
    try {
      const { display } = await LocalNotifications.requestPermissions();
      return display === 'granted';
    } catch (e) {
      console.warn('Notification permission error', e);
      return false;
    }
  }

  // Clear all pending notifications
  static async clearAll() {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel(pending);
    }
  }

  // Schedule a notification for 10 minutes before a class
  static async scheduleClass(id: number, title: string, dayOfWeek: number, hour: number, minute: number) {
    // dayOfWeek: 0(Sun) - 6(Sat) in JS Date, but schedule logic might have different
    const at = new Date();
    // find next occurrence of the class
    at.setDate(at.getDate() + (dayOfWeek + 7 - at.getDay()) % 7);
    at.setHours(hour, minute, 0, 0);

    // If it's today but already passed, move to next week
    if (at.getTime() < Date.now()) {
      at.setDate(at.getDate() + 7);
    }

    // 10 minutes before
    at.setMinutes(at.getMinutes() - 10);

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `Class Starting Soon: ${title}`,
          body: `Your ${title} class starts in 10 minutes!`,
          schedule: { 
            at, 
            repeats: true, 
            every: 'week' 
          },
          actionTypeId: '',
          extra: null
        }
      ]
    });
  }

  // Schedule a notification for today's task
  static async scheduleTask(id: number, title: string, dateStr: string | null) {
    if (!dateStr) return; // If no date, we can't schedule precisely. Or we could schedule "daily targets"
    const parsedDate = new Date(dateStr);
    if (parsedDate.getTime() < Date.now()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Task Reminder',
          body: `Time to start: ${title}`,
          schedule: { at: parsedDate },
        }
      ]
    });
  }

  // Schedule for 1 hr before Event
  static async scheduleEvent(id: number, title: string, eventDate: string, eventTime: string) {
    // combine date and time
    const parsed = new Date(`${eventDate} ${eventTime}`);
    if (isNaN(parsed.getTime())) return;

    const alertTime = new Date(parsed.getTime() - 60 * 60 * 1000); // 1 hour before
    if (alertTime.getTime() < Date.now()) return; // Already passed

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: `Event Coming Up: ${title}`,
          body: `${title} is starting in 1 hour.`,
          schedule: { at: alertTime }
        }
      ]
    });
  }

  /**
   * One hour before 24 hours elapse since `uniflow_last_active_time`, remind the user to open the app
   * so their streak logic can run (matches useStreak idle reset window).
   */
  static async syncStreakInactivityReminder(): Promise<void> {
    if (Capacitor.getPlatform() === 'web') {
      return;
    }

    const cancelOnly = async () => {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: STREAK_INACTIVITY_NOTIFICATION_ID }] });
      } catch {
        /* noop */
      }
    };

    const streakNotifEnabled = localStorage.getItem(STREAK_NOTIF_PREF_KEY) !== 'false';
    if (!streakNotifEnabled) {
      await cancelOnly();
      return;
    }

    const streakRaw = localStorage.getItem('uniflow_streak');
    const streak = streakRaw == null ? 0 : parseInt(streakRaw, 10);
    if (!Number.isFinite(streak) || streak <= 0) {
      await cancelOnly();
      return;
    }

    const lastActive = parseInt(localStorage.getItem('uniflow_last_active_time') || '0', 10);
    if (!lastActive || Number.isNaN(lastActive)) {
      await cancelOnly();
      return;
    }

    const notifyAt = lastActive + MS_24H - MS_1H;
    if (notifyAt <= Date.now()) {
      await cancelOnly();
      return;
    }

    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') {
          return;
        }
      }

      await cancelOnly();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: STREAK_INACTIVITY_NOTIFICATION_ID,
            title: 'Keep your streak',
            body: `You have about an hour left—open UniFlow so you do not lose your ${streak}-day streak.`,
            schedule: { at: new Date(notifyAt) },
            actionTypeId: '',
            extra: { type: 'STREAK_INACTIVITY' },
          },
        ],
      });
    } catch (e) {
      console.warn('[notifications] streak inactivity reminder failed', e);
    }
  }

  static async scheduleDailyTargets(id: number, message: string, hour: number, minute: number) {
    const at = new Date();
    at.setHours(hour, minute, 0, 0);

    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: 'Daily Target Reminder',
          body: message,
          schedule: { 
            at, 
            repeats: true, 
            every: 'day' 
          }
        }
      ]
    });
  }
}
