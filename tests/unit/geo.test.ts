import { describe, it, expect } from "vitest";
import {
  haversineDistanceM,
  isValidCoordinate,
  isValidLatitude,
  isValidLongitude,
  kmToMeters,
} from "@/services/geo";

describe("coordinate validation", () => {
  it("accepts valid coordinates", () => {
    expect(isValidCoordinate(52.52, 13.405)).toBe(true);
    expect(isValidLatitude(0)).toBe(true);
    expect(isValidLongitude(0)).toBe(true);
  });

  it("rejects out-of-range coordinates", () => {
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLatitude(-91)).toBe(false);
    expect(isValidLongitude(181)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
  });

  it("rejects non-finite coordinates", () => {
    expect(isValidCoordinate(NaN, 0)).toBe(false);
    expect(isValidCoordinate(0, Infinity)).toBe(false);
  });
});

describe("haversineDistanceM", () => {
  it("returns 0 for identical points", () => {
    expect(haversineDistanceM(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });

  it("returns a plausible distance for nearby points", () => {
    // ~1.2 km apart in central Berlin.
    const d = haversineDistanceM(52.52, 13.405, 52.528, 13.415);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1400);
  });

  it("is symmetric", () => {
    const a = haversineDistanceM(52.52, 13.405, 52.528, 13.415);
    const b = haversineDistanceM(52.528, 13.415, 52.52, 13.405);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("kmToMeters", () => {
  it("converts kilometers to meters", () => {
    expect(kmToMeters(10)).toBe(10000);
  });

  it("falls back to 10 km for invalid input", () => {
    expect(kmToMeters(0)).toBe(10000);
    expect(kmToMeters(-5)).toBe(10000);
    expect(kmToMeters(NaN)).toBe(10000);
  });
});

describe("distance sorting", () => {
  it("sorts points by distance", () => {
    const origin = { lat: 52.52, lng: 13.405 };
    const points = [
      { lat: 52.528, lng: 13.415 },
      { lat: 52.522, lng: 13.407 },
      { lat: 52.54, lng: 13.42 },
    ];
    const sorted = [...points].sort(
      (a, b) =>
        haversineDistanceM(origin.lat, origin.lng, a.lat, a.lng) -
        haversineDistanceM(origin.lat, origin.lng, b.lat, b.lng),
    );
    const distances = sorted.map((p) =>
      Math.round(haversineDistanceM(origin.lat, origin.lng, p.lat, p.lng)),
    );
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });
});
