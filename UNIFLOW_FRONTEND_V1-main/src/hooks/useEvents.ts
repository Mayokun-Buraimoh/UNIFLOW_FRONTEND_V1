import { useState, useEffect, useCallback } from 'react';
import { eventService, Event } from '../api/services';
import { createLocalFirst, deleteLocalFirst, updateLocalFirst } from '../localfirst/syncQueue';

const EVENT_STORAGE_KEY = 'uniflow_events';
const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected error';

const readLocalEvents = (): Event[] => {
  try {
    const raw = localStorage.getItem(EVENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLocalEvents = (events: Event[]) => {
  localStorage.setItem(EVENT_STORAGE_KEY, JSON.stringify(events));
};

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch events with optional date filter.
  //
  // Server is the source of truth for synced events, but we must preserve any
  // local optimistic items still in flight (`lf-temp-` ids) and any
  // user-applied client-only flags such as `completed` (which lives only in
  // localStorage — the backend Event model does not currently track it).
  // Without this merge, Ruby-created events (which are written server-side
  // and only signalled to the client via the `uniflow_events_updated` event)
  // never showed up in the calendar, because the previous guard
  // `if (!local.length && remote.length)` ignored the response whenever there
  // was already anything in localStorage.
  const fetchEvents = useCallback(async (filters?: { date?: string }) => {
    const local = readLocalEvents();
    const localFiltered = filters?.date ? local.filter((e) => e.date === filters.date) : local;
    setEvents(localFiltered);
    try {
      setLoading(true);
      setError(null);
      const response = await eventService.getEvents(filters);
      const remote = response.events || [];
      const remoteIds = new Set(remote.map((e) => String(e.id)));
      const localById = new Map(local.map((e) => [String(e.id), e]));
      const pendingLocalOnly = local.filter(
        (e) => typeof e.id === 'string' && e.id.startsWith('lf-temp-') && !remoteIds.has(String(e.id))
      );
      const remoteWithLocalFlags = remote.map((r) => {
        const prev = localById.get(String(r.id)) as (Event & { completed?: boolean }) | undefined;
        if (prev && typeof prev.completed === 'boolean') {
          return { ...r, completed: prev.completed } as Event;
        }
        return r;
      });
      const merged = [...pendingLocalOnly, ...remoteWithLocalFlags];
      writeLocalEvents(merged);
      setEvents(filters?.date ? merged.filter((e) => e.date === filters.date) : merged);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to fetch events');
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new event
  const createEvent = useCallback(async (eventData: {
    title: string;
    time: string;
    date: string;
    priority?: 'low' | 'medium' | 'critical';
  }) => {
    try {
      const nowIso = new Date().toISOString();
      const optimisticEvent = createLocalFirst(
        'events',
        {
          userId: 'local-user',
          title: eventData.title,
          time: eventData.time,
          date: eventData.date,
          priority: eventData.priority || 'low',
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        (payload) => {
          const next = [...readLocalEvents(), payload as Event];
          writeLocalEvents(next);
          setEvents(next);
        }
      ) as Event;
      return optimisticEvent;
    } catch (err: unknown) {
      console.error('Error in useEvents createEvent:', err);
      setError(getErrorMessage(err) || 'Failed to create event');
      throw err;
    }
  }, []);

  // Update an event
  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    try {
      setError(null);
      let updatedEvent: Event | undefined;
      updateLocalFirst('events', id, updates, (entityId, patch) => {
        const next = readLocalEvents().map((event) => {
          if (event.id !== entityId) return event;
          updatedEvent = { ...event, ...(patch as Partial<Event>), updatedAt: new Date().toISOString() };
          return updatedEvent;
        });
        writeLocalEvents(next);
        setEvents(next);
      });
      return updatedEvent as Event;
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to update event');
      throw err;
    }
  }, []);

  // Delete an event
  const deleteEvent = useCallback(async (id: string) => {
    try {
      deleteLocalFirst('events', id, (entityId) => {
        const next = readLocalEvents().filter((event) => event.id !== entityId);
        writeLocalEvents(next);
        setEvents(next);
      });
    } catch (err: unknown) {
      console.error('Error in useEvents deleteEvent:', err);
      setError(getErrorMessage(err) || 'Failed to delete event');
      throw err;
    }
  }, []);

  // Get a single event
  const getEvent = useCallback(async (id: string) => {
    try {
      return await eventService.getEvent(id);
    } catch (err: unknown) {
      setError(getErrorMessage(err) || 'Failed to fetch event');
      throw err;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Load events on mount
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getEvent,
    clearError
  };
};
