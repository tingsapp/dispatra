type Rect = Pick<DOMRectReadOnly, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

/** Reserve the larger usable rectangle beside or below the floating card. */
export function shipperMapPadding(view: Rect, card?: Rect): google.maps.Padding {
  const base = { top: Math.min(80, view.height / 5), right: 48, bottom: Math.min(96, view.height / 5), left: 48 };
  if (!card) return base;
  const beside = { ...base, left: Math.max(base.left, card.right - view.left + 32) };
  const below = { ...base, top: Math.max(base.top, card.bottom - view.top + 48) };
  const usableArea = (padding: google.maps.Padding) => Math.max(0, view.width - padding.left - padding.right)
    * Math.max(0, view.height - padding.top - padding.bottom);
  return usableArea(beside) > usableArea(below) ? beside : below;
}
