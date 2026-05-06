import { LocalNotifications } from '@capacitor/local-notifications';

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
