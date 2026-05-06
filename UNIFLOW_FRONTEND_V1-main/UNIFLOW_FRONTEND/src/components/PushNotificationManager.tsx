import React, { useCallback, useEffect, useRef } from 'react';
import { useHistory } from 'react-router-dom';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import {
  PushNotifications,
  PushNotificationSchema,
  ActionPerformed,
  Token,
} from '@capacitor/push-notifications';
import { useIonAlert } from '@ionic/react';
import { useAuth } from '../contexts/AuthContext';
import { pushTokenService } from '../api/services';

function readRoutingPayload(data: Record<string, string> | undefined): {
  type?: string;
  eventId?: string;
  taskId?: string;
} {
  if (!data) return {};
  return {
    type: data.type,
    eventId: data.eventId,
    taskId: data.taskId,
  };
}

function navigateFromPushData(
  history: ReturnType<typeof useHistory>,
  data: Record<string, string> | undefined
): void {
  const { type, eventId, taskId } = readRoutingPayload(data);
  if (type === 'EVENT_REMINDER' && eventId) {
    history.push(`/events/${eventId}`);
    return;
  }
  if (type === 'TASK_REMINDER' && taskId) {
    history.push(`/home?highlightTask=${encodeURIComponent(taskId)}`);
  }
}

const PushNotificationManager: React.FC = () => {
  const history = useHistory();
  const { isAuthenticated } = useAuth();
  const [presentAlert] = useIonAlert();
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

  const navigateFromNotification = useCallback(
    (data: Record<string, string> | undefined) => {
      navigateFromPushData(history, data);
    },
    [history]
  );

  const showForegroundAlert = useCallback(
    (notification: PushNotificationSchema) => {
      const title = notification.title || 'Notification';
      const body = notification.body || '';
      const data = notification.data as Record<string, string> | undefined;
      void presentAlert({
        header: title,
        message: body,
        buttons: [
          {
            text: 'Open',
            handler: () => {
              navigateFromPushData(history, data);
            },
          },
          { text: 'OK', role: 'cancel' },
        ],
      });
    },
    [history, presentAlert]
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !isAuthenticated) {
      return;
    }

    let cancelled = false;
    const handlesRef: PluginListenerHandle[] = [];

    const run = async () => {
      try {
        handlesRef.push(
          await PushNotifications.addListener('registration', async (t: Token) => {
            if (cancelled || !authRef.current || !t.value) return;
            try {
              await pushTokenService.register({
                token: t.value,
                platform: Capacitor.getPlatform(),
              });
            } catch (e) {
              console.error('Push token register failed:', e);
            }
          })
        );

        handlesRef.push(
          await PushNotifications.addListener('registrationError', (err) => {
            console.error('Push registration error:', err);
          })
        );

        handlesRef.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            showForegroundAlert(notification);
          })
        );

        handlesRef.push(
          await PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
            navigateFromNotification(action.notification.data as Record<string, string> | undefined);
          })
        );

        if (cancelled) {
          await Promise.all(handlesRef.map((h) => h.remove()));
          return;
        }

        const perm = await PushNotifications.requestPermissions();
        if (cancelled || perm.receive !== 'granted') {
          return;
        }

        await PushNotifications.register();
      } catch (error) {
        console.error('Push setup failed:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
      void Promise.all(handlesRef.map((h) => h.remove()));
    };
  }, [isAuthenticated, navigateFromNotification, showForegroundAlert]);

  return null;
};

export default PushNotificationManager;
