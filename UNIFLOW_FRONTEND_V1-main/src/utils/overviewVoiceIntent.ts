import type { OverviewActivity } from './overviewActivities';

export type OverviewVoiceIntent = 'summary' | 'unfinished_count' | 'finished_count';

/** Normalize for keyword matching (ASCII-ish, lower). */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Classify user utterances about the Overview screen (today's combined tasks, events, plan items).
 */
export function parseOverviewVoiceIntent(raw: string): OverviewVoiceIntent | null {
  const q = norm(raw);
  if (q.length < 8) return null;

  const unfinishedHints =
    /\b(how many|what'?s? the count|count)\b.*\b(unfinished|incomplete|not done|pending|left|still to do|remain|todo|open)\b/i.test(q) ||
    /\b(unfinished|incomplete|not done|pending|left to do|still to do)\b.*\b(how many|count)\b/i.test(q);

  const finishedHints =
    /\b(how many|what'?s? the count|count)\b.*\b(finish|done|complete)\b/i.test(q) ||
    /\b(finish|completed|done)\b.*\b(how many|count|activities|tasks|plans)\b/i.test(q);

  if (unfinishedHints && !finishedHints) return 'unfinished_count';
  if (finishedHints && !unfinishedHints) return 'finished_count';

  const summaryHints =
    /\b(what are|what'?s|tell me|give me|read|list|show)\b.*\b(my )?(plan|plans|task|tasks|schedule|activities|overview|day)\b/i.test(q) ||
    /\b(my )?(plan|plans|schedule|activities|overview)\b.*\b(for )?today\b/i.test(q) ||
    /\bwhat\b.*\b(for )?today\b/i.test(q) ||
    /\boverview\b/i.test(q) ||
    /\bon my plate\b/i.test(q);

  if (summaryHints) return 'summary';

  return null;
}

function activityLabel(a: OverviewActivity): string {
  if (a.type === 'task') return `task: ${a.title}`;
  if (a.type === 'event') return `event: ${a.title}`;
  return `plan item: ${a.title}`;
}

const MAX_LIST = 8;

export function buildOverviewVoiceReply(intent: OverviewVoiceIntent, allActivities: OverviewActivity[]): string {
  const total = allActivities.length;
  const completed = allActivities.filter((a) => a.completed).length;
  const incomplete = total - completed;

  if (total === 0) {
    return 'You have no activities on your overview for today. Add tasks, events, or plan items to see them there.';
  }

  if (intent === 'unfinished_count') {
    return `You have ${incomplete} unfinished out of ${total} activities today on your overview.`;
  }

  if (intent === 'finished_count') {
    return `You have ${completed} finished out of ${total} activities today on your overview.`;
  }

  const pending = allActivities.filter((a) => !a.completed);
  const done = allActivities.filter((a) => a.completed);

  const parts: string[] = [];
  parts.push(
    `Your overview for today has ${total} activities: ${incomplete} still to do and ${completed} done.`
  );

  if (pending.length > 0) {
    const list = pending
      .slice(0, MAX_LIST)
      .map((a) => activityLabel(a))
      .join('. ');
    parts.push(`Still to do: ${list}.`);
    if (pending.length > MAX_LIST) {
      parts.push(`And ${pending.length - MAX_LIST} more.`);
    }
  }

  if (done.length > 0 && done.length <= 4) {
    parts.push(`Done: ${done.map((a) => activityLabel(a)).join('. ')}.`);
  }

  return parts.join(' ');
}
