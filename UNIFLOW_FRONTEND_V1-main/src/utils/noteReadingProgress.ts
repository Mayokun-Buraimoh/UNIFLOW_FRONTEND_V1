const storageKey = (noteId: string) => `uniflow_note_read_progress_${noteId}`;

export interface NoteReadingProgress {
  maxPercent: number;
}

export function loadNoteReadingProgress(noteId: string | undefined): NoteReadingProgress {
  if (!noteId) return { maxPercent: 0 };
  try {
    const raw = localStorage.getItem(storageKey(noteId));
    if (!raw) return { maxPercent: 0 };
    const parsed = JSON.parse(raw) as { maxPercent?: number };
    const n =
      typeof parsed?.maxPercent === 'number' ? parsed.maxPercent : Number.parseFloat(raw);
    if (Number.isNaN(n)) return { maxPercent: 0 };
    return { maxPercent: Math.min(100, Math.max(0, Math.round(n))) };
  } catch {
    return { maxPercent: 0 };
  }
}

export function getNoteReadingProgressPercent(noteId: string | undefined): number {
  return loadNoteReadingProgress(noteId).maxPercent;
}

/** Percent of document height that has been scrolled into view (0–100); only increases. */
export function saveNoteReadingProgressIfGreater(noteId: string | undefined, viewedPercent: number) {
  if (!noteId) return;
  const next = Math.min(100, Math.max(0, Math.round(viewedPercent)));
  const prev = loadNoteReadingProgress(noteId).maxPercent;
  if (next <= prev) return;
  localStorage.setItem(storageKey(noteId), JSON.stringify({ maxPercent: next }));
}
