import { api } from '../api/client';

export type LocalFirstEntity = 'courses' | 'schedule' | 'tasks' | 'events';
export type LocalFirstOpType = 'create' | 'update' | 'delete';
export type LocalFirstSyncStatus = 'idle' | 'syncing' | 'error';

export interface LocalFirstQueueItem {
  opId: string;
  entity: LocalFirstEntity;
  opType: LocalFirstOpType;
  payload: unknown;
  localTs: string;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed' | 'synced';
  tempId?: string;
  serverId?: string;
  dedupeKey: string;
  nextRetryAt?: string;
  lastError?: string;
}

type SyncHandlerResult = {
  serverId?: string;
  tempId?: string;
};

type SyncHandler = (item: LocalFirstQueueItem) => Promise<SyncHandlerResult | void>;

const QUEUE_KEY = 'uniflow_localfirst_sync_queue_v1';
const MAX_BACKOFF_MS = 5 * 60 * 1000;
const BASE_BACKOFF_MS = 2000;
const TEMP_ID_PREFIX = 'lf-temp-';

const handlers = new Map<string, SyncHandler>();
let syncStatus: LocalFirstSyncStatus = 'idle';
let isSyncing = false;

const createHandlerKey = (entity: LocalFirstEntity, opType: LocalFirstOpType) => `${entity}:${opType}`;
const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const canUseStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

const readQueue = (): LocalFirstQueueItem[] => {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeQueue = (queue: LocalFirstQueueItem[]) => {
  if (!canUseStorage()) return;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

const createTempId = () => `${TEMP_ID_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createDedupeKey = (
  entity: LocalFirstEntity,
  opType: LocalFirstOpType,
  payload: unknown,
  id?: string
) => {
  const payloadStr = JSON.stringify(payload ?? null);
  return `${entity}:${opType}:${id || ''}:${payloadStr}`;
};

const createOpId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const computeBackoffMs = (retryCount: number) => {
  const ms = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, retryCount - 1));
  return Math.min(ms, MAX_BACKOFF_MS);
};

const isRetryDue = (item: LocalFirstQueueItem) => {
  if (!item.nextRetryAt) return true;
  return Date.now() >= new Date(item.nextRetryAt).getTime();
};

const replaceTempId = (
  entity: LocalFirstEntity,
  tempId: string,
  serverId: string
) => {
  if (!canUseStorage()) return;
  try {
    if (entity === 'courses') {
      const raw = localStorage.getItem('uniflow_courses');
      const courses = raw ? JSON.parse(raw) : [];
      if (Array.isArray(courses)) {
        const next = courses.map((course: Record<string, unknown>) =>
          String(course?.id) === tempId ? { ...course, id: serverId } : course
        );
        localStorage.setItem('uniflow_courses', JSON.stringify(next));
      }
    } else if (entity === 'events') {
      const raw = localStorage.getItem('uniflow_events');
      const events = raw ? JSON.parse(raw) : [];
      if (Array.isArray(events)) {
        const next = events.map((event: Record<string, unknown>) =>
          String(event?.id) === tempId ? { ...event, id: serverId } : event
        );
        localStorage.setItem('uniflow_events', JSON.stringify(next));
      }
    } else if (entity === 'tasks') {
      const raw = localStorage.getItem('uniflow_tasks');
      const tasks = raw ? JSON.parse(raw) : [];
      if (Array.isArray(tasks)) {
        const next = tasks.map((task: Record<string, unknown>) =>
          String(task?.id) === tempId ? { ...task, id: serverId } : task
        );
        localStorage.setItem('uniflow_tasks', JSON.stringify(next));
      }
    }
  } catch {
    // Best effort mapping only.
  }
};

const markSyncStatus = (status: LocalFirstSyncStatus) => {
  syncStatus = status;
};

const processQueueInternal = async () => {
  if (isSyncing) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  const queue = readQueue();
  if (!queue.length) {
    markSyncStatus('idle');
    return;
  }

  isSyncing = true;
  markSyncStatus('syncing');
  const nextQueue = [...queue];

  try {
    for (let i = 0; i < nextQueue.length; i += 1) {
      const item = nextQueue[i];
      if (item.status === 'synced') continue;
      if ((item.status === 'failed' || item.status === 'pending') && !isRetryDue(item)) {
        continue;
      }

      const handler = handlers.get(createHandlerKey(item.entity, item.opType));
      if (!handler) {
        nextQueue[i] = {
          ...item,
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: `No handler for ${item.entity}:${item.opType}`,
          nextRetryAt: new Date(Date.now() + computeBackoffMs(item.retryCount + 1)).toISOString(),
        };
        continue;
      }

      nextQueue[i] = { ...item, status: 'syncing', lastError: undefined };
      writeQueue(nextQueue.filter((entry) => entry.status !== 'synced'));

      try {
        const result = await handler(item);
        const finalServerId = result?.serverId || item.serverId;
        const finalTempId = result?.tempId || item.tempId;
        if (finalServerId && finalTempId && finalServerId !== finalTempId) {
          replaceTempId(item.entity, finalTempId, finalServerId);
        }

        nextQueue[i] = {
          ...nextQueue[i],
          status: 'synced',
          serverId: finalServerId,
          retryCount: 0,
          nextRetryAt: undefined,
          lastError: undefined,
        };
      } catch (error) {
        const retryCount = item.retryCount + 1;
        nextQueue[i] = {
          ...item,
          status: 'failed',
          retryCount,
          lastError: error instanceof Error ? error.message : String(error || 'Sync failed'),
          nextRetryAt: new Date(Date.now() + computeBackoffMs(retryCount)).toISOString(),
        };
      }
    }

    const remaining = nextQueue.filter((item) => item.status !== 'synced');
    writeQueue(remaining);
    markSyncStatus(remaining.some((item) => item.status === 'failed') ? 'error' : 'idle');
  } finally {
    isSyncing = false;
  }
};

const enqueueQueueItem = (item: LocalFirstQueueItem) => {
  const queue = readQueue();
  const duplicate = queue.find(
    (qItem) =>
      qItem.dedupeKey === item.dedupeKey && (qItem.status === 'pending' || qItem.status === 'syncing')
  );
  if (duplicate) {
    return duplicate;
  }
  const nextQueue = [...queue, item];
  writeQueue(nextQueue);
  return item;
};

const toSerializablePayload = (payload: unknown): unknown => {
  if (payload === undefined) return null;
  return payload;
};

export const registerSyncHandler = (
  entity: LocalFirstEntity,
  opType: LocalFirstOpType,
  handler: SyncHandler
) => {
  handlers.set(createHandlerKey(entity, opType), handler);
};

export const syncNow = async () => {
  await processQueueInternal();
};

export const getSyncStatus = (): LocalFirstSyncStatus => syncStatus;

export const createLocalFirst = <T>(
  entity: LocalFirstEntity,
  data: T,
  applyLocal: (payload: T & { id: string }) => void
) => {
  const tempId = createTempId();
  const dataRecord = asRecord(data);
  const payload = { ...dataRecord, id: tempId } as T & { id: string };
  applyLocal(payload);

  const item: LocalFirstQueueItem = {
    opId: createOpId(),
    entity,
    opType: 'create',
    payload: toSerializablePayload(payload),
    localTs: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    tempId,
    dedupeKey: createDedupeKey(entity, 'create', payload),
  };

  enqueueQueueItem(item);
  void processQueueInternal();
  return payload;
};

export const updateLocalFirst = <T>(
  entity: LocalFirstEntity,
  id: string,
  patch: T,
  applyLocal: (entityId: string, payload: T) => void
) => {
  applyLocal(id, patch);

  const item: LocalFirstQueueItem = {
    opId: createOpId(),
    entity,
    opType: 'update',
    payload: toSerializablePayload({ id, patch }),
    localTs: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    serverId: id,
    dedupeKey: createDedupeKey(entity, 'update', patch, id),
  };

  enqueueQueueItem(item);
  void processQueueInternal();
};

export const deleteLocalFirst = (
  entity: LocalFirstEntity,
  id: string,
  applyLocal: (entityId: string) => void
) => {
  applyLocal(id);

  const item: LocalFirstQueueItem = {
    opId: createOpId(),
    entity,
    opType: 'delete',
    payload: toSerializablePayload({ id }),
    localTs: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
    serverId: id,
    dedupeKey: createDedupeKey(entity, 'delete', { id }, id),
  };

  enqueueQueueItem(item);
  void processQueueInternal();
};

const registerDefaultHandlers = () => {
  registerSyncHandler('courses', 'create', async (item) => {
    const payload = asRecord(item.payload);
    const response = await api.post('/courses/', {
      name: payload.name,
      code: payload.name,
    });
    const serverId = String(response?.id || response?.course?.id || item.tempId || '');
    return { tempId: item.tempId, serverId };
  });

  registerSyncHandler('courses', 'update', async (item) => {
    const payload = asRecord(item.payload);
    const courseId = String(payload.id || item.serverId || '');
    const patch = asRecord(payload.patch);
    if (!courseId) return;
    try {
      await api.patch(`/courses/${courseId}`, patch);
    } catch {
      // Rename endpoint may be unavailable on some backends.
    }
  });

  registerSyncHandler('courses', 'delete', async (item) => {
    const payload = asRecord(item.payload);
    const courseId = String(payload.id || item.serverId || '');
    if (!courseId) return;
    await api.delete(`/courses/${courseId}`);
  });

  registerSyncHandler('schedule', 'update', async (item) => {
    const payload = asRecord(item.payload);
    const patch = payload.patch ?? {};
    await api.put('/schedule/', { data: patch });
  });

  registerSyncHandler('events', 'create', async (item) => {
    const payload = asRecord(item.payload);
    const response = await api.post('/events/', {
      title: payload.title,
      time: payload.time,
      date: payload.date,
      priority: payload.priority || 'low',
    });
    const serverId = String(response?.id || item.tempId || '');
    return { tempId: item.tempId, serverId };
  });

  registerSyncHandler('events', 'update', async (item) => {
    const payload = asRecord(item.payload);
    const id = String(payload.id || item.serverId || '');
    if (!id) return;
    await api.put(`/events/${id}`, asRecord(payload.patch));
  });

  registerSyncHandler('events', 'delete', async (item) => {
    const payload = asRecord(item.payload);
    const id = String(payload.id || item.serverId || '');
    if (!id) return;
    await api.delete(`/events/${id}`);
  });

  registerSyncHandler('tasks', 'create', async (item) => {
    const payload = asRecord(item.payload);
    const response = await api.post('/tasks/', payload);
    const serverId = String(response?.id || item.tempId || '');
    return { tempId: item.tempId, serverId };
  });

  registerSyncHandler('tasks', 'update', async (item) => {
    const payload = asRecord(item.payload);
    const id = String(payload.id || item.serverId || '');
    if (!id) return;
    await api.put(`/tasks/${id}`, asRecord(payload.patch));
  });

  registerSyncHandler('tasks', 'delete', async (item) => {
    const payload = asRecord(item.payload);
    const id = String(payload.id || item.serverId || '');
    if (!id) return;
    await api.delete(`/tasks/${id}`);
  });
};

let initialized = false;

export const initializeLocalFirstSync = () => {
  if (initialized) return;
  initialized = true;
  registerDefaultHandlers();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      void processQueueInternal();
    });
  }
  void processQueueInternal();
};
