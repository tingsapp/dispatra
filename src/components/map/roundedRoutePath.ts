type Pixel = { x: number; y: number };

/** Round only a few display pixels at turns; keep the road shape and endpoints intact. */
export function roundedRoutePath(points: Pixel[], radius = 10): string {
  const route = points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y);
  if (route.length < 2) return '';
  let path = `M${route[0].x},${route[0].y}`;
  for (let index = 1; index < route.length - 1; index++) {
    const before = route[index - 1], corner = route[index], after = route[index + 1];
    const incoming = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
    const cut = Math.min(radius, incoming / 3, outgoing / 3);
    const start = { x: corner.x + (before.x - corner.x) * cut / incoming, y: corner.y + (before.y - corner.y) * cut / incoming };
    const end = { x: corner.x + (after.x - corner.x) * cut / outgoing, y: corner.y + (after.y - corner.y) * cut / outgoing };
    path += `L${start.x},${start.y}Q${corner.x},${corner.y} ${end.x},${end.y}`;
  }
  const last = route[route.length - 1];
  return `${path}L${last.x},${last.y}`;
}
