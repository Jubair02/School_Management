/**
 * Module-scope handoff between parent views (kept deliberately simple —
 * survives view switches within the SPA session, resets on page reload).
 * parent:children sets `resultsChildId` before switching to parent:results,
 * which reads it as the initially selected child.
 */
export const parentSelection: { resultsChildId: string | null } = {
  resultsChildId: null,
};
