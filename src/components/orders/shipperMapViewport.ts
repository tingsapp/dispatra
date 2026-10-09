type Rect = Pick<DOMRectReadOnly, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

/** Reserve the larger usable rectangle beside or below the floating card. */
export function shipperMapPadding(view: Rect, card?: Rect): google.maps.Padding {
  // Captions extend beyond the 24px stop glyph; reserve their half-width plus a gap.
  const horizontal = Math.min(96, view.width / 4);
  const base = { top: Math.min(176, view.height / 4), right: horizontal, bottom: Math.min(152, view.height / 4), left: horizontal };
  if (!card) return base;
  const beside = { ...base, left: Math.max(base.left, card.right - view.left + horizontal) };
  const below = { ...base, top: Math.max(base.top, card.bottom - view.top + 128) };
  const usableArea = (padding: google.maps.Padding) => Math.max(0, view.width - padding.left - padding.right)
    * Math.max(0, view.height - padding.top - padding.bottom);
  return usableArea(beside) > usableArea(below) ? beside : below;
}
