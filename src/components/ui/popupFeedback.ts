/** Route action feedback to the topmost open popup before using page feedback. */
export function showPopupFeedback(message: string, tone: 'default' | 'error' = 'default'): boolean {
  const panels = document.querySelectorAll<HTMLElement>('[data-popup-feedback]');
  const panel = panels.item(panels.length - 1);
  if (!panel) return false;
  panel.dispatchEvent(new CustomEvent('popup-feedback', { detail: { message, tone } }));
  return true;
}
