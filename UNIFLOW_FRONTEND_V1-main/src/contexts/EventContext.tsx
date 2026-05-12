import React, { createContext, useContext, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useEvents } from '../hooks/useEvents';

type EventApi = ReturnType<typeof useEvents>;

const EventContext = createContext<EventApi | null>(null);

/**
 * One shared event list + refetch on `uniflow_events_updated` (voice, socket
 * merges) so the home calendar / overview / productivity score all see new
 * events the instant Ruby (or any other producer) creates one server-side.
 *
 * After the server refetch lands, we also dispatch `uniflow_events_synced`
 * so storage-driven readers (e.g. `useProductivityScore`, `Overview`) re-read
 * localStorage *after* it has been refreshed — the original
 * `uniflow_events_updated` fires before the async fetch completes, so those
 * readers would otherwise pick up stale data and miss the new event.
 */
export function EventProvider({ children }: { children: React.ReactNode }) {
  const eventsApi = useEvents();

  useEffect(() => {
    let cancelled = false;
    const onEventsUpdated = async () => {
      try {
        await eventsApi.fetchEvents();
      } finally {
        if (!cancelled) {
          try {
            window.dispatchEvent(new Event('uniflow_events_synced'));
          } catch {
            /* noop — non-browser env */
          }
        }
      }
    };
    window.addEventListener('uniflow_events_updated', onEventsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener('uniflow_events_updated', onEventsUpdated);
    };
  }, [eventsApi.fetchEvents]);

  return <EventContext.Provider value={eventsApi}>{children}</EventContext.Provider>;
}

/**
 * Wraps routes when there is no signed-in user — no event store (protected
 * pages are not shown). Gated on `isAuthenticated` (the same flag
 * `ProtectedRoute` uses) so the provider is guaranteed to be mounted
 * whenever a protected page can render — preventing a `useEventContext`
 * throw during the brief async window between auth state flipping true and
 * `user` being hydrated.
 */
export function EventProviderGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  return <EventProvider>{children}</EventProvider>;
}

export function useEventContext(): EventApi {
  const ctx = useContext(EventContext);
  if (!ctx) {
    throw new Error('useEventContext must be used within EventProvider (signed-in shell)');
  }
  return ctx;
}
