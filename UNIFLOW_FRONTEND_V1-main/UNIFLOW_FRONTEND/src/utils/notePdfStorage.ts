/** Fired on the same window after `uniflow_note_data_${noteId}` is written (FileReader / fetch are async). */
export const NOTE_PDF_UPDATED_EVENT = 'uniflow_note_pdf_updated';

export function notifyNotePdfUpdated(noteId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTE_PDF_UPDATED_EVENT, { detail: { noteId } }));
}

export function setNotePdfDataInStorage(noteId: string, dataUrl: string): void {
  localStorage.setItem(`uniflow_note_data_${noteId}`, dataUrl);
  notifyNotePdfUpdated(noteId);
}
