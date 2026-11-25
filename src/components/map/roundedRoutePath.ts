type Pixel = { x: number; y: number };

/** Matches the driver app's `roundedRoute`: each turn curves `radius` display pixels either side of the corner
 * (at most 45% of either segment), keeping road shape and endpoints intact. Dense road geometry is first simplified
 * within `tolerance` pixels so a turn drawn from many short segments rounds as the single corner it looks like. */
export function roundedRoutePath(points: Pixel[], radius = 22, tolerance = radius / 8): string {
  const route = simplify(points.filter((point, index) => !index || point.x !== points[index - 1].x || point.y !== points[index - 1].y), tolerance);
  if (route.length < 2) return '';
  let path = `M${route[0].x},${route[0].y}`;
  for (let index = 1; index < route.length - 1; index++) {
    const before = route[index - 1], corner = route[index], after = route[index + 1];
    const incoming = Math.hypot(corner.x - before.x, corner.y - before.y);
    const outgoing = Math.hypot(after.x - corner.x, after.y - corner.y);
    const cut = Math.min(radius, incoming * 0.45, outgoing * 0.45);
    const start = { x: corner.x + (before.x - corner.x) * cut / incoming, y: corner.y + (before.y - corner.y) * cut / incoming };
    const end = { x: corner.x + (after.x - corner.x) * cut / outgoing, y: corner.y + (after.y - corner.y) * cut / outgoing };
    path += `L${start.x},${start.y}Q${corner.x},${corner.y} ${end.x},${end.y}`;
  }
  const last = route[route.length - 1];
  return `${path}L${last.x},${last.y}`;
}

/** Douglas–Peucker, keeping both endpoints. */
function simplify(points: Pixel[], tolerance: number): Pixel[] {
  if (points.length < 3 || tolerance <= 0) return points;
  const keep = points.map((_, index) => !index || index === points.length - 1);
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!, a = points[first], b = points[last], length = Math.hypot(b.x - a.x, b.y - a.y);
    let farthest = -1, distance = tolerance;
    for (let index = first + 1; index < last; index++) {
      const point = points[index];
      const offset = length ? Math.abs((b.x - a.x) * (a.y - point.y) - (a.x - point.x) * (b.y - a.y)) / length : Math.hypot(point.x - a.x, point.y - a.y);
      if (offset > distance) { distance = offset; farthest = index; }
    }
    if (farthest >= 0) { keep[farthest] = true; stack.push([first, farthest], [farthest, last]); }
  }
  return points.filter((_, index) => keep[index]);
}
