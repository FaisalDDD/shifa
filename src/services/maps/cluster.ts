// Pure marker clustering (grid-based). Unit-testable, no Leaflet dependency.

export interface ClusterInput {
  id: string;
  latitude: number;
  longitude: number;
}

export interface Cluster {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  members: ClusterInput[];
}

/**
 * Group points into grid cells sized by zoom level (≈60px cluster radius).
 * At high zoom levels points are returned un-clustered.
 */
export function clusterPoints(
  points: ClusterInput[],
  zoom: number,
): Cluster[] {
  if (points.length === 0) return [];

  const CLUSTER_PIXELS = 60;
  const SINGLE_ZOOM = 15;

  if (zoom >= SINGLE_ZOOM) {
    return points.map((p) => ({
      id: p.id,
      latitude: p.latitude,
      longitude: p.longitude,
      count: 1,
      members: [p],
    }));
  }

  const cellDeg = (CLUSTER_PIXELS * 360) / (256 * 2 ** zoom);
  const groups = new Map<string, ClusterInput[]>();

  for (const p of points) {
    const x = Math.floor(p.longitude / cellDeg);
    const y = Math.floor(p.latitude / cellDeg);
    const key = `${x}:${y}`;
    const existing = groups.get(key);
    if (existing) existing.push(p);
    else groups.set(key, [p]);
  }

  return Array.from(groups.entries()).map(([key, members]) => {
    const lat = members.reduce((s, m) => s + m.latitude, 0) / members.length;
    const lng = members.reduce((s, m) => s + m.longitude, 0) / members.length;
    return {
      id: `cluster-${key}`,
      latitude: lat,
      longitude: lng,
      count: members.length,
      members,
    };
  });
}
