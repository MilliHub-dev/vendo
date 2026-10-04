export type Point = { lat: number; lng: number };
const same = (a: Point, b: Point) => a.lat === b.lat && a.lng === b.lng;
function cross(a: Point, b: Point, c: Point) { return (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng); }
function on(a: Point, b: Point, c: Point) { return Math.abs(cross(a, b, c)) < 1e-12 && c.lat >= Math.min(a.lat, b.lat) && c.lat <= Math.max(a.lat, b.lat) && c.lng >= Math.min(a.lng, b.lng) && c.lng <= Math.max(a.lng, b.lng); }
function intersects(a: Point, b: Point, c: Point, d: Point) {
  return on(a, b, c) || on(a, b, d) || on(c, d, a) || on(c, d, b) || (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0);
}
export function isSimplePolygon(input: Point[]): boolean {
  const points = input.length > 1 && same(input[0]!, input.at(-1)!) ? input.slice(0, -1) : input;
  if (points.length < 3 || new Set(points.map((p) => `${p.lat}:${p.lng}`)).size !== points.length) return false;
  if (Math.max(...points.map((p) => p.lng)) - Math.min(...points.map((p) => p.lng)) > 180) return false;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    area += a.lng * b.lat - b.lng * a.lat;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (intersects(a, b, points[j]!, points[(j + 1) % points.length]!)) return false;
    }
  }
  return Math.abs(area) > 1e-12;
}
export function bounds(points: Point[]): [number, number, number, number] {
  return [Math.min(...points.map((p) => p.lng)), Math.min(...points.map((p) => p.lat)), Math.max(...points.map((p) => p.lng)), Math.max(...points.map((p) => p.lat))];
}

/** Great-circle distance for offer eligibility; road ETA uses the routing provider. */
export function distanceMeters(a:Point,b:Point):number {
  const radians=(value:number)=>value*Math.PI/180;
  const h=Math.sin(radians(b.lat-a.lat)/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(radians(b.lng-a.lng)/2)**2;
  return 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
}
