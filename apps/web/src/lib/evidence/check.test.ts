// Run: node --test src/lib/evidence/check.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { centroid, distanceM, parseBoundary, pointInPolygon, polygonAreaHa } from "./geo.ts";
import { hamming } from "./hash.ts";

const sq = '{"type":"Polygon","coordinates":[[[88,21],[89,21],[89,22],[88,22],[88,21]]]}';

test("boundary validation", () => {
  assert.ok(parseBoundary(sq).ok);
  assert.ok(!parseBoundary("nope").ok);
  assert.ok(!parseBoundary('{"type":"Point","coordinates":[1,2]}').ok);
  assert.ok(!parseBoundary('{"type":"Polygon","coordinates":[[[88,21],[89,21],[89,22],[88,22]]]}').ok); // unclosed
  assert.ok(!parseBoundary('{"type":"Polygon","coordinates":[[[88,91],[89,21],[89,22],[88,22],[88,91]]]}').ok); // lat range
});

test("point in polygon incl. hole", () => {
  const r = parseBoundary(sq);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(pointInPolygon(88.5, 21.5, r.polygon), true);
  assert.equal(pointInPolygon(90, 21.5, r.polygon), false);
  const holed = { ...r.polygon, coordinates: [...r.polygon.coordinates, [[88.4, 21.4], [88.6, 21.4], [88.6, 21.6], [88.4, 21.6], [88.4, 21.4]] as [number, number][]] };
  assert.equal(pointInPolygon(88.5, 21.5, holed), false);
});

test("hamming", () => {
  assert.equal(hamming("0000000000000000", "ffffffffffffffff"), 64);
  assert.equal(hamming("00000000000000ff", "0000000000000000"), 8);
});

test("distance", () => {
  assert.equal(distanceM(21.9, 88.8, 21.9, 88.8), 0);
  const d = distanceM(21.9, 88.8, 21.9 + 1 / 111.2, 88.8); // ~1 km north
  assert.ok(d > 990 && d < 1010, String(d));
});

test("area and centroid", () => {
  // 0.01 deg square at the equator ~ 1113 m x 1106 m ~ 123 ha
  const r = parseBoundary('{"type":"Polygon","coordinates":[[[0,0],[0.01,0],[0.01,0.01],[0,0.01],[0,0]]]}');
  assert.ok(r.ok); if (!r.ok) return;
  const ha = polygonAreaHa(r.polygon);
  assert.ok(ha > 122 && ha < 124, String(ha));
  assert.deepEqual(centroid(r.polygon), { lat: 0.005, lng: 0.005 });
});
