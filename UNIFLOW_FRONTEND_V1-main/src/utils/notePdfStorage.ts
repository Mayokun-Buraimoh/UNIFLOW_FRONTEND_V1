import {
  idbClearAllPdfBlobs,
  idbGetPdfBlob,
  idbRemovePdfBlob,
  idbSetPdfBlob,
  isNotePdfIndexedDbAvailable,
} from './notePdfIndexedDb';

/** Fired when an optimistic `local-*` note id is mapped to a server `course_files` UUID after upload. */
export const UNIFLOW_PENDING_NOTE_ROUTE_EVENT = 'uniflow_pending_route_ready';

/** Fired on the same window after a PDF is written to IndexedDB (async). */
export const NOTE_PDF_UPDATED_EVENT = 'uniflow_note_pdf_updated';

const LEGACY_KEY_PREFIX = 'uniflow_note_data_';

function legacyStorageKey(noteId: string): string {
  return `${LEGACY_KEY_PREFIX}${noteId}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/pdf';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

function removeLegacyLocalStoragePdf(noteId: string): void {
  try {
    localStorage.removeItem(legacyStorageKey(noteId));
  } catch {
    /* ignore */
  }
}

function readLegacyLocalStoragePdf(noteId: string): Blob | null {
  try {
    const raw = localStorage.getItem(legacyStorageKey(noteId));
    if (!raw?.startsWith('data:')) return null;
    return dataUrlToBlob(raw);
  } catch {
    return null;
  }
}

export function notifyNotePdfUpdated(noteId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTE_PDF_UPDATED_EVENT, { detail: { noteId } }));
}

/** Lets `/note/local-*` redirect to `/note/<serverUuid>` once upload finishes (same tab or after reload). */
export function rememberPendingNoteRouteMapping(localOptimisticId: string, serverFileId: string): void {
  if (typeof window === 'undefined' || !localOptimisticId || !serverFileId) return;
  if (!localOptimisticId.startsWith('local-')) return;
  try {
    localStorage.setItem(`uniflow_pending_route_${localOptimisticId}`, serverFileId);
    window.dispatchEvent(
      new CustomEvent(UNIFLOW_PENDING_NOTE_ROUTE_EVENT, {
        detail: { localId: localOptimisticId, serverId: serverFileId },
      }),
    );
  } catch {
    /* quota / private mode */
  }
}

/** Store PDF bytes in IndexedDB (large files; not localStorage). */
export async function setNotePdfBlobInStorage(noteId: string, blob: Blob): Promise<void> {
  if (!isNotePdfIndexedDbAvailable()) {
    throw new Error('PDF cache is not available in this browser');
  }
  await idbSetPdfBlob(noteId, blob);
  removeLegacyLocalStoragePdf(noteId);
  notifyNotePdfUpdated(noteId);
}

/** @deprecated Prefer setNotePdfBlobInStorage — converts data URL then stores in IndexedDB. */
export function setNotePdfDataInStorage(noteId: string, dataUrl: string): void {
  void (async () => {
    try {
      await setNotePdfBlobInStorage(noteId, dataUrlToBlob(dataUrl));
    } catch (e) {
      console.warn('setNotePdfDataInStorage failed', e);
    }
  })();
}

/** Read PDF from IndexedDB; migrates one legacy localStorage entry if present. */
export async function getNotePdfFromStorage(noteId: string): Promise<Blob | null> {
  const id = String(noteId || '').trim();
  if (!id) return null;

  try {
    const cached = await idbGetPdfBlob(id);
    if (cached) return cached;
  } catch (e) {
    console.warn('IndexedDB PDF read failed', e);
  }

  const legacy = readLegacyLocalStoragePdf(id);
  if (legacy) {
    try {
      await idbSetPdfBlob(id, legacy);
      removeLegacyLocalStoragePdf(id);
    } catch {
      /* return legacy blob even if migration write fails */
    }
    return legacy;
  }

  return null;
}

/** Copy cached PDF from optimistic/local id to server `course_files` UUID after upload. */
export async function migrateNotePdfDataInStorage(fromId: string, toId: string): Promise<void> {
  if (typeof window === 'undefined' || !fromId || !toId || fromId === toId) return;

  let blob: Blob | null = null;
  try {
    blob = await idbGetPdfBlob(fromId);
  } catch {
    /* ignore */
  }
  if (!blob) {
    blob = readLegacyLocalStoragePdf(fromId);
  }
  if (!blob) return;

  try {
    await idbSetPdfBlob(toId, blob);
    await idbRemovePdfBlob(fromId);
    removeLegacyLocalStoragePdf(fromId);
    removeLegacyLocalStoragePdf(toId);
    notifyNotePdfUpdated(toId);
  } catch (e) {
    console.warn('migrateNotePdfDataInStorage failed', e);
  }
}

export function removeNotePdfFromStorage(noteId: string): void {
  void idbRemovePdfBlob(noteId);
  removeLegacyLocalStoragePdf(noteId);
}

/** Wipe all cached PDFs (logout / account switch). */
export async function clearAllNotePdfStorage(): Promise<void> {
  try {
    await idbClearAllPdfBlobs();
  } catch (e) {
    console.warn('clearAllNotePdfStorage: IndexedDB clear failed', e);
  }
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(LEGACY_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    /* ignore */
  }
}
