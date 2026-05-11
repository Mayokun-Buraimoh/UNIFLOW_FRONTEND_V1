/** Fired when an optimistic `local-*` note id is mapped to a server `course_files` UUID after upload. */
export const UNIFLOW_PENDING_NOTE_ROUTE_EVENT = 'uniflow_pending_route_ready';

/** Fired on the same window after `uniflow_note_data_${noteId}` is written (FileReader / fetch are async). */
export const NOTE_PDF_UPDATED_EVENT = 'uniflow_note_pdf_updated';

/** Lets `/note/local-*` redirect to `/note/<serverUuid>` once upload finishes (same tab or after reload). */
export function rememberPendingNoteRouteMapping(localOptimisticId: string, serverFileId: string): void {
  if (typeof window === 'undefined' || !localOptimisticId || !serverFileId) return;
  if (!localOptimisticId.startsWith('local-')) return;
  try {
    localStorage.setItem(`uniflow_pending_route_${localOptimisticId}`, serverFileId);
    window.dispatchEvent(
      new CustomEvent(UNIFLOW_PENDING_NOTE_ROUTE_EVENT, {
        detail: { localId: localOptimisticId, serverId: serverFileId },
      })
    );
  } catch {
    /* quota / private mode */
  }
}

export function notifyNotePdfUpdated(noteId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTE_PDF_UPDATED_EVENT, { detail: { noteId } }));
}

export function setNotePdfDataInStorage(noteId: string, dataUrl: string): void {
  localStorage.setItem(`uniflow_note_data_${noteId}`, dataUrl);
  notifyNotePdfUpdated(noteId);
}

/** Copy cached PDF from optimistic/local id to server `course_files` UUID after upload. */
export function migrateNotePdfDataInStorage(fromId: string, toId: string): void {
  if (typeof window === 'undefined' || !fromId || !toId || fromId === toId) return;
  const keyFrom = `uniflow_note_data_${fromId}`;
  const keyTo = `uniflow_note_data_${toId}`;
  try {
    const data = localStorage.getItem(keyFrom);
    if (!data) return;
    localStorage.setItem(keyTo, data);
    localStorage.removeItem(keyFrom);
    notifyNotePdfUpdated(toId);
  } catch (e) {
    console.warn('migrateNotePdfDataInStorage failed', e);
  }
}
