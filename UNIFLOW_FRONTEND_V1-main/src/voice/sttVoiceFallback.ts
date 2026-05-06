/**
 * When Socket.IO voice is unavailable, infer a task title from common phrases
 * so on-device STT can still create tasks + get a speakable confirmation.
 */

function trimEndPunct(s: string): string {
  return s.replace(/[.!?…]+$/u, '').trim();
}

/** If non-null, use this string as the new task title. */
export function inferTaskTitleFromUtterance(raw: string): string | null {
  const t = raw.trim().replace(/\s+/g, ' ');
  if (!t) return null;

  const patterns: RegExp[] = [
    /^i want to\s+(.+)$/i,
    /^i need to\s+(.+)$/i,
    /^i (?:have|must) to\s+(.+)$/i,
    /^remind me to\s+(.+)$/i,
    /^add (?:a )?task:?\s*(.+)$/i,
    /^create (?:a )?task:?\s*(.+)$/i,
    /^todo:?\s*(.+)$/i,
    /^remember to\s+(.+)$/i,
  ];

  for (const p of patterns) {
    const m = t.match(p);
    const inner = m?.[1]?.trim();
    if (inner) return trimEndPunct(inner) || null;
  }

  const lower = t.toLowerCase();
  const looksLikeEvent =
    /\b(meeting|appointment|calendar|schedule|event)\b/i.test(lower) &&
    /\b(at|on|tomorrow|today|next|am|pm|\d{1,2}:\d{2})\b/i.test(lower);
  if (looksLikeEvent) return null;

  if (t.length > 120) return null;

  return trimEndPunct(t) || null;
}
