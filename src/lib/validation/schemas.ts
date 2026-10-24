import { z } from "zod";

// ---- Shared primitives ----

export const geoPointSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

/** Radius in kilometers. Bounded to prevent unbounded geo queries. */
export const radiusKmSchema = z.coerce.number().min(0.5).max(200).default(10);

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers and hyphens.")
  .max(120);

// ---- Auth ----

export const signUpSchema = z.object({
  email: z.email("A valid email address is required."),
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const signInSchema = z.object({
  email: z.email("A valid email address is required."),
  password: z.string().min(1, "Password is required.").max(128),
});

export const resetPasswordSchema = z.object({
  email: z.email("A valid email address is required."),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters.").max(128),
});

// ---- Product catalog ----

export const productCreateSchema = z.object({
  canonical_name: z.string().trim().min(1).max(200),
  brand_name: z.string().trim().max(200).nullish(),
  strength: z.string().trim().max(80).nullish(),
  dosage_form: z.string().trim().max(80).nullish(),
  barcode: z.string().trim().max(64).nullish(),
  product_identifier: z.string().trim().max(120).nullish(),
  prescription_classification: z
    .enum(["otc", "prescription", "unknown"])
    .default("unknown"),
  active_ingredients: z.array(z.string().trim().min(1).max(120)).max(50).default([]),
});

export const productUpdateSchema = productCreateSchema.partial();

// ---- Pharmacy catalog ----

export const pharmacyCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  slug: slugSchema,
  description: z.string().trim().max(2000).nullish(),
  address: z.string().trim().min(1).max(400),
  city: z.string().trim().max(120).nullish(),
  postal_code: z.string().trim().max(32).nullish(),
  country_code: z.string().trim().length(2).nullish(),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  phone: z.string().trim().max(40).nullish(),
  website: z.url("Website must be a valid URL.").max(400).nullish().or(z.literal("")),
});

export const pharmacyUpdateSchema = pharmacyCreateSchema
  .omit({ slug: true })
  .partial()
  .extend({
    opening_hours: z
      .array(
        z.object({
          day: z.number().int().min(0).max(6),
          open: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          close: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
          closed: z.boolean().default(false),
        }),
      )
      .max(7)
      .nullish(),
    services: z.array(z.string().trim().min(1).max(80)).max(40).nullish(),
  });

// ---- Inventory ----

export const inventoryUpsertSchema = z.object({
  product_id: z.string().uuid(),
  availability_status: z.enum(["AVAILABLE", "LOW_STOCK", "OUT_OF_STOCK", "UNKNOWN"]),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000000).optional(),
  quantity: z.coerce.number().int().min(0).max(1000000).nullish(),
  price: z.coerce.number().min(0).max(10000000).nullish(),
  currency: z.string().trim().toUpperCase().length(3).nullish(),
});

export const deliveryOrderCreateSchema = z.object({
  pharmacy_id: z.string().uuid(),
  delivery_address: z.string().trim().min(5).max(500),
  contact_phone: z.string().trim().min(5).max(40),
  notes: z.string().trim().max(1000).nullish(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.coerce.number().int().min(1).max(100),
  })).min(1).max(50),
});

export const deliveryReceiptSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});

export const deliveryRejectSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

export const deliveryPaymentConfirmationSchema = z.object({
  reference: z.string().trim().min(1).max(200),
});

export const deliverySettingsSchema = z.object({
  enabled: z.boolean(),
  delivery_fee: z.coerce.number().min(0).max(10000000),
  bank_name: z.string().trim().max(200).nullish(),
  bank_account_name: z.string().trim().max(200).nullish(),
  bank_account_number: z.string().trim().max(200).nullish(),
  transfer_instructions: z.string().trim().max(2000).nullish(),
});

// ---- Reservations ----

export const reservationCreateSchema = z.object({
  pharmacy_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100),
  request_notes: z.string().trim().max(1000).nullish(),
});

export const reservationRejectSchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});

// ---- Favorites / saved searches ----

export const favoriteCreateSchema = z.object({
  pharmacy_id: z.string().uuid(),
});

export const savedSearchCreateSchema = z.object({
  normalized_query: z.string().trim().min(1).max(200),
  product_id: z.string().uuid().nullish(),
  notification_enabled: z.boolean().default(false),
});

// ---- Search ----

export const productSearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  radius: radiusKmSchema.optional(),
  strength: z.string().trim().max(80).optional(),
  dosage_form: z.string().trim().max(80).optional(),
  open_now: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["relevance", "distance", "freshness"]).default("relevance"),
});

export const nearbyPharmaciesSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radius: radiusKmSchema.optional(),
  product_id: z.string().uuid().optional(),
  open_now: z.coerce.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});

// ---- Stock reports ----

export const stockReportCreateSchema = z.object({
  pharmacy_id: z.string().uuid(),
  product_id: z.string().uuid(),
  reported_status: z.enum(["AVAILABLE", "OUT_OF_STOCK", "UNKNOWN"]),
});

// ---- Pharmacy management (staff) ----

export const pharmacyInventoryUpsertSchema = inventoryUpsertSchema.extend({
  pharmacy_id: z.string().uuid(),
});

// ---- Administration ----

export const adminPharmacyUpdateSchema = pharmacyUpdateSchema.extend({
  verification_status: z
    .enum(["pending", "verified", "rejected", "suspended"])
    .optional(),
  is_active: z.boolean().optional(),
});

export const adminPharmacyCreateSchema = pharmacyCreateSchema.extend({
  verification_status: z
    .enum(["pending", "verified", "rejected", "suspended"])
    .optional(),
  is_active: z.boolean().optional(),
});

// ---- Self-serve pharmacy registration ----

export const pharmacyRegisterSchema = pharmacyCreateSchema.omit({ slug: true });

export const pharmacyBranchRegisterSchema = pharmacyCreateSchema
  .omit({ slug: true })
  .extend({
    business_id: z.string().uuid(),
    branch_name: z.string().trim().min(1).max(120),
    branch_code: z.string()
      .trim()
      .min(2)
      .max(32)
      .regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, "Branch code must use letters, numbers and hyphens.")
      .transform((value) => value.toUpperCase()),
  });


// ---- B2B purchase requests ----

export const purchaseRequestCreateSchema = z.object({
  buyer_pharmacy_id: z.string().uuid(),
  seller_pharmacy_id: z.string().uuid(),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(100000),
  notes: z.string().trim().max(1000).nullish(),
});
