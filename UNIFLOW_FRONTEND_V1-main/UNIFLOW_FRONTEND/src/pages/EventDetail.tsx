import React, { useEffect, useState } from 'react';
import { RouteComponentProps } from 'react-router-dom';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonText,
} from '@ionic/react';
import { eventService, Event as CalendarEvent } from '../api/services';
import './EventDetail.css';

type Params = { eventId: string };

const EventDetail: React.FC<RouteComponentProps<Params>> = ({ match }) => {
  const { eventId } = match.params;
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const e = await eventService.getEvent(eventId);
        if (!cancelled) {
          setEvent(e);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Could not load this event.');
          setEvent(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>Event</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding event-detail-content">
        {loading && (
          <div className="event-detail-center">
            <IonSpinner name="crescent" />
          </div>
        )}
        {!loading && error && <IonText color="danger"><p>{error}</p></IonText>}
        {!loading && event && (
          <div className="event-detail-card">
            <h1 className="event-detail-title">{event.title}</h1>
            <p className="event-detail-meta">{event.date}</p>
            <p className="event-detail-meta">{event.time}</p>
            <p className="event-detail-priority">Priority: {event.priority}</p>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default EventDetail;
