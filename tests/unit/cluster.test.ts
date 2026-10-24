import { describe, it, expect } from "vitest";
import { clusterPoints } from "@/services/maps/cluster";

describe("clusterPoints", () => {
  it("returns empty for no points", () => {
    expect(clusterPoints([], 10)).toEqual([]);
  });

  it("does not cluster at high zoom", () => {
    const points = [
      { id: "a", latitude: 52.52, longitude: 13.4 },
      { id: "b", latitude: 52.521, longitude: 13.401 },
    ];
    const clusters = clusterPoints(points, 16);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it("clusters nearby points at low zoom", () => {
    const points = [
      { id: "a", latitude: 52.52, longitude: 13.4 },
      { id: "b", latitude: 52.521, longitude: 13.401 },
      { id: "c", latitude: 52.9, longitude: 13.9 },
    ];
    const clusters = clusterPoints(points, 8);
    expect(clusters).toHaveLength(2);
    const counts = clusters.map((c) => c.count).sort((a, b) => a - b);
    expect(counts).toEqual([1, 2]);
  });

  it("computes cluster centroids within bounds", () => {
    const points = [
      { id: "a", latitude: 52.52, longitude: 13.4 },
      { id: "b", latitude: 52.521, longitude: 13.401 },
    ];
    const clusters = clusterPoints(points, 8);
    const c = clusters.find((x) => x.count === 2)!;
    expect(c.latitude).toBeCloseTo(52.5205, 3);
    expect(c.longitude).toBeCloseTo(13.4005, 3);
  });
});
