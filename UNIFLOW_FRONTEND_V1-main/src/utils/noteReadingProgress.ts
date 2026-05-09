const storageKey = (noteId: string) => `uniflow_note_read_progress_${noteId}`;

export interface NoteReadingProgress {
  currentPercent: number;
  maxPercent: number;
  hasCurrentPercent: boolean;
}

export function loadNoteReadingProgress(noteId: string | undefined): NoteReadingProgress {
  if (!noteId) return { currentPercent: 0, maxPercent: 0, hasCurrentPercent: false };
  try {
    const raw = localStorage.getItem(storageKey(noteId));
    if (!raw) return { currentPercent: 0, maxPercent: 0, hasCurrentPercent: false };

    const parsed = JSON.parse(raw) as { currentPercent?: number; maxPercent?: number };
    const legacyPercent =
      typeof parsed?.maxPercent === 'number' ? parsed.maxPercent : Number.parseFloat(raw);
    const hasCurrentPercent = typeof parsed?.currentPercent === 'number';

    const currentRaw =
      hasCurrentPercent ? parsed.currentPercent : 0;
    const maxRaw =
      typeof parsed?.maxPercent === 'number'
        ? parsed.maxPercent
        : (Number.isNaN(legacyPercent) ? 0 : legacyPercent);

    const currentPercent = Math.min(100, Math.max(0, Math.round(currentRaw)));
    const maxPercent = Math.min(100, Math.max(currentPercent, Math.round(maxRaw)));
    return { currentPercent, maxPercent, hasCurrentPercent };
  } catch {
    return { currentPercent: 0, maxPercent: 0, hasCurrentPercent: false };
  }
}

export function getNoteReadingProgressPercent(noteId: string | undefined): number {
  return loadNoteReadingProgress(noteId).maxPercent;
}

/** Save current position while preserving max milestone reached. */
export function saveNoteReadingProgress(noteId: string | undefined, viewedPercent: number) {
  if (!noteId) return;
  const next = Math.min(100, Math.max(0, Math.round(viewedPercent)));
  const prev = loadNoteReadingProgress(noteId);
  localStorage.setItem(
    storageKey(noteId),
    JSON.stringify({
      currentPercent: next,
      maxPercent: Math.max(prev.maxPercent, next),
    })
  );
}

/** Backward-compat helper used by older call sites. */
export function saveNoteReadingProgressIfGreater(noteId: string | undefined, viewedPercent: number) {
  saveNoteReadingProgress(noteId, viewedPercent);
}
