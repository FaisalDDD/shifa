// Domain types used across the application (not tied to DB row shape).
import type { Pharmacy, Product, PharmacyInventory } from "./db";

export type {
  UserRole,
  VerificationStatus,
  MembershipRole,
  AvailabilityStatus,
  StockSource,
  ReservationStatus,
  PrescriptionClass,
  ReportStatus,
  Profile,
  Pharmacy,
  OpeningHour,
  PharmacyMember,
  Product,
  PharmacyInventory,
  Reservation,
  Favorite,
  SavedSearch,
  Notification,
  StockReport,
  AuditLog,
  PurchaseRequestStatus,
  PurchaseRequest,
  ISODateString,
} from "./db";

/** Freshness classification for a stock record. */
export type FreshnessState = "recent" | "older" | "stale" | "unknown";

export interface StockDisplay {
  /** Raw availability as stored. */
  availability: "AVAILABLE" | "OUT_OF_STOCK" | "UNKNOWN";
  /** How fresh the report is. */
  freshness: FreshnessState;
  /** Human label, e.g. "Recently confirmed available". */
  label: string;
  /** Short hint, e.g. "Last updated 3 hours ago". */
  hint: string | null;
  /** Translation key for the label (English `label` is the fallback). */
  labelKey?: string;
  /** Translation key for the hint (may include an `{age}` placeholder). */
  hintKey?: string;
  /** ISO timestamp used to localize the relative age in the hint. */
  hintTimestamp?: string | null;
  /** "availability may have changed — call to confirm" when true. */
  callToConfirm: boolean;
  /** Machine key for the icon: available | unknown | out | stale */
  icon: "available" | "unknown" | "out";
  /** True when we have a usable (non-UNKNOWN) status for this product here. */
  hasUsableData: boolean;
}

/** A pharmacy enriched with distance from the selected location (meters). */
export interface PharmacyWithDistance extends Pharmacy {
  distance_m: number | null;
}

/** A product match in search results, with availability + pharmacy context. */
export interface ProductSearchHit {
  product: Product;
  /** Pharmacies near the search location that carry this product, sorted by relevance. */
  pharmacies: PharmacyWithInventory[];
  /** Best availability across the matched pharmacies. */
  best: StockDisplay | null;
  /** Distance of the nearest carrying pharmacy (meters). */
  nearest_distance_m: number | null;
  /** Relevance score (higher = better match). */
  score: number;
}

export interface PharmacyWithInventory extends PharmacyWithDistance {
  inventory: PharmacyInventory | null;
  stock: StockDisplay | null;
}

/** Standard JSON envelope for API routes. */
export interface ApiOk<T> {
  ok: true;
  data: T;
  meta?: { total?: number; page?: number; pageSize?: number; hasMore?: boolean };
}

export interface ApiErr {
  ok: false;
  error: {
    code: string;
    message: string;
    /** Optional per-field validation errors. */
    fields?: Record<string, string>;
  };
}

export type ApiResponse<T> = ApiOk<T> | ApiErr;

export type SortOption =
  | "relevance"
  | "distance"
  | "freshness";

/** Geo location used across search. */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}
