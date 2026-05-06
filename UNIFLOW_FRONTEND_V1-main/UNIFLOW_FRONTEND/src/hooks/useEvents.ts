import { useState, useEffect, useCallback } from 'react';
import { eventService, Event } from '../api/services';

export const useEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch events with optional date filter
  const fetchEvents = useCallback(async (filters?: { date?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const response = await eventService.getEvents(filters);
      setEvents(response.events || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch events');
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
    // Generate a temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    const optimisticEvent: Event = {
      id: tempId,
      userId: 'pending',
      title: eventData.title,
      time: eventData.time,
      date: eventData.date,
      priority: eventData.priority || 'low',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      // Optimistically update the UI
      setEvents(prev => [...prev, optimisticEvent]);

      const newEvent = await eventService.createEvent(eventData);

      // Replace the optimistic event with the real one from the server
      setEvents(prev => prev.map(e => e.id === tempId ? newEvent : e));
      return newEvent;
    } catch (err: any) {
      console.error('Error in useEvents createEvent:', err);
      // Revert optimistic update on failure
      setEvents(prev => prev.filter(e => e.id !== tempId));
      setError(err.message || 'Failed to create event');
      throw err;
    }
  }, []);

  // Update an event
  const updateEvent = useCallback(async (id: string, updates: Partial<Event>) => {
    try {
      setLoading(true);
      setError(null);
      const updatedEvent = await eventService.updateEvent(id, updates);
      setEvents(prev => prev.map(event =>
        event.id === id ? updatedEvent : event
      ));
      return updatedEvent;
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete an event
  const deleteEvent = useCallback(async (id: string) => {
    let deletedEvent: Event | undefined;

    try {
      setEvents(prev => {
        const index = prev.findIndex(e => e.id === id);
        if (index !== -1) deletedEvent = prev[index];
        return prev.filter(event => event.id !== id);
      });

      await eventService.deleteEvent(id);
    } catch (err: any) {
      console.error('Error in useEvents deleteEvent:', err);
      // Revert optimistic deletion
      if (deletedEvent) {
        setEvents(prev => [...prev, deletedEvent!]); 
      }
      setError(err.message || 'Failed to delete event');
      throw err;
    }
  }, []);

  // Get a single event
  const getEvent = useCallback(async (id: string) => {
    try {
      return await eventService.getEvent(id);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch event');
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
