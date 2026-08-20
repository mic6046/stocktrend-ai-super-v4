export type HelpTopic =
  | 'how-to'
  | 'billing'
  | 'account'
  | 'bug'
  | 'feature'
  | 'other';

export const HELP_TOPICS: { key: HelpTopic; label: string }[] = [
  { key: 'how-to', label: 'How to use the app' },
  { key: 'billing', label: 'Billing / subscription' },
  { key: 'account', label: 'Account / sign-in' },
  { key: 'bug', label: 'Something is broken' },
  { key: 'feature', label: 'Feature request' },
  { key: 'other', label: 'Other' },
];

export const HELP_FORM_HASH = 'support';

export function parseHelpHash(hash = window.location.hash): boolean {
  const h = (hash || '').replace(/^#\/?/, '').toLowerCase();
  return h === HELP_FORM_HASH || h === 'help-form' || h === 'contact';
}

export function openHelpForm() {
  window.location.hash = HELP_FORM_HASH;
}

export function clearHelpHash() {
  const { pathname, search } = window.location;
  window.history.pushState('', document.title, `${pathname}${search}`);
}
