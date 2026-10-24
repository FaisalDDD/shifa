// Database row types mirroring the Postgres schema in supabase/migrations/.
// Kept in sync manually until `supabase gen types` can be run against a live project.

export type UserRole = "customer" | "pharmacy_staff" | "admin";
export type VerificationStatus =
  | "pending"
  | "verified"
  | "rejected"
  | "suspended";
export type MembershipRole = "owner" | "staff";
export type AvailabilityStatus = "AVAILABLE" | "OUT_OF_STOCK" | "UNKNOWN";
export type StockSource =
  | "PHARMACY_MANUAL"
  | "VERIFIED_INVENTORY_INTEGRATION"
  | "USER_REPORT"
  | "ADMIN_CORRECTION";
export type ReservationStatus =
  | "REQUESTED"
  | "CONFIRMED"
  | "REJECTED"
  | "FULFILLED"
  | "CANCELLED"
  | "EXPIRED";
export type PrescriptionClass = "otc" | "prescription" | "unknown";
export type ReportStatus = "open" | "reviewed" | "dismissed";

/** ISO-8601 date string (as stored in timestamptz columns). */
export type ISODateString = string;

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  role: UserRole;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string;
  city: string | null;
  postal_code: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
  phone: string | null;
  website: string | null;
  verification_status: VerificationStatus;
  is_active: boolean;
  is_available: boolean;
  is_demo: boolean;
  opening_hours: OpeningHour[] | null;
  services: string[] | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

/** day: 0 = Sunday ... 6 = Saturday (matches JS Date.getDay()). "HH:MM" 24h times. */
export interface OpeningHour {
  day: number;
  open: string | null;
  close: string | null;
  closed: boolean;
}

export interface PharmacyMember {
  id: string;
  pharmacy_id: string;
  user_id: string;
  membership_role: MembershipRole;
  created_at: ISODateString;
}

export interface Product {
  id: string;
  canonical_name: string;
  brand_name: string | null;
  strength: string | null;
  dosage_form: string | null;
  barcode: string | null;
  product_identifier: string | null;
  prescription_classification: PrescriptionClass;
  is_demo: boolean;
  active_ingredients: string[];
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface ProductActiveIngredient {
  product_id: string;
  active_ingredient: string;
}

export interface PharmacyInventory {
  id: string;
  pharmacy_id: string;
  product_id: string;
  availability_status: AvailabilityStatus;
  quantity: number | null;
  price: number | null;
  currency: string | null;
  source: StockSource;
  last_updated_at: ISODateString;
  last_verified_at: ISODateString | null;
  updated_by: string | null;
  expires_at: ISODateString | null;
  created_at: ISODateString;
}

export interface Reservation {
  id: string;
  customer_id: string;
  pharmacy_id: string;
  product_id: string;
  quantity: number;
  status: ReservationStatus;
  request_notes: string | null;
  requested_at: ISODateString;
  confirmed_at: ISODateString | null;
  expires_at: ISODateString | null;
  fulfilled_at: ISODateString | null;
  cancelled_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Favorite {
  id: string;
  user_id: string;
  pharmacy_id: string;
  created_at: ISODateString;
}

export interface SavedSearch {
  id: string;
  user_id: string;
  normalized_query: string;
  product_id: string | null;
  notification_enabled: boolean;
  created_at: ISODateString;
  updated_at: ISODateString;
}

export interface Notification {
  id: string;
  user_id: string;
  notification_type: string;
  title: string;
  body: string;
  read_at: ISODateString | null;
  created_at: ISODateString;
}

export interface StockReport {
  id: string;
  reporter_user_id: string;
  pharmacy_id: string;
  product_id: string;
  reported_status: AvailabilityStatus;
  report_status: ReportStatus;
  created_at: ISODateString;
  reviewed_at: ISODateString | null;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: ISODateString;
}

export type PurchaseRequestStatus =
  | "REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "CANCELLED";

export interface PurchaseRequest {
  id: string;
  buyer_pharmacy_id: string;
  seller_pharmacy_id: string;
  product_id: string;
  quantity: number;
  status: PurchaseRequestStatus;
  notes: string | null;
  requested_at: ISODateString;
  resolved_at: ISODateString | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
