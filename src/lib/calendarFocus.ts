/** One-shot handoff so Add can land the Spend calendar on the saved day. */
let pendingDateKey: string | null = null;

export function queueCalendarFocus(dateKey: string) {
  pendingDateKey = dateKey;
}

export function takeCalendarFocus(): string | null {
  const next = pendingDateKey;
  pendingDateKey = null;
  return next;
}
