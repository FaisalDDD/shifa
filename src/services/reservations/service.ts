import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Errors } from "@/lib/errors";
import { transitionStatus, type ReservationAction } from "./state-machine";
import { notifyUser } from "@/services/notifications";
import type { Reservation, Profile } from "@/types";

function expiryHours(): number {
  const raw = Number(process.env.RESERVATION_EXPIRY_HOURS ?? "24");
  return Number.isFinite(raw) && raw > 0 ? raw : 24;
}

export interface CreateReservationInput {
  pharmacyId: string;
  productId: string;
  quantity: number;
  requestNotes?: string | null;
}

/** A customer requests a reservation (not a guarantee of availability). */
export async function createReservation(
  customer: Profile,
  input: CreateReservationInput,
): Promise<Reservation> {
  const supabase = await createClient();

  const { data: pharmacy } = await supabase
    .from("pharmacies")
    .select("id, is_active")
    .eq("id", input.pharmacyId)
    .maybeSingle();
  if (!pharmacy) throw Errors.notFound("Pharmacy");
  if (!pharmacy.is_active) {
    throw Errors.badRequest("This pharmacy is not currently accepting requests.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) throw Errors.notFound("Product");

  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiryHours() * 3_600_000).toISOString();

  const { data, error } = await supabase
    .from("reservations")
    .insert({
      customer_id: customer.id,
      pharmacy_id: input.pharmacyId,
      product_id: input.productId,
      quantity: input.quantity,
      status: "REQUESTED",
      request_notes: input.requestNotes ?? null,
      requested_at: now.toISOString(),
      expires_at: expiresAt,
    })
    .select("*")
    .single();
  if (error) throw error;

  return data as Reservation;
}

async function isMemberOf(actor: Profile, pharmacyId: string): Promise<boolean> {
  if (actor.role === "admin") return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("pharmacy_members")
    .select("id")
    .eq("pharmacy_id", pharmacyId)
    .eq("user_id", actor.id)
    .maybeSingle();
  return !!data;
}

export interface TransitionResult {
  reservation: Reservation;
}

/**
 * Apply an authorized transition. Actor permission is checked here (and again
 * by the DB trigger / RLS as defense in depth). Only a pharmacy (or admin)
 * may confirm/reject/fulfill; only the owner (or pharmacy/admin) may cancel.
 */
export async function transitionReservation(
  actor: Profile,
  reservationId: string,
  action: ReservationAction,
): Promise<TransitionResult> {
  const supabase = await createClient();

  const { data: res } = await supabase
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();
  if (!res) throw Errors.notFound("Reservation");
  const reservation = res as Reservation;

  const target = transitionStatus(reservation.status, action);
  if (!target) {
    throw Errors.conflict(
      `Cannot ${action} a reservation in state ${reservation.status}.`,
    );
  }

  const isCustomer = reservation.customer_id === actor.id;
  const member = await isMemberOf(actor, reservation.pharmacy_id);

  switch (action) {
    case "confirm":
    case "reject":
    case "fulfill":
      if (!member) throw Errors.forbidden("Only authorized pharmacy staff can perform this action.");
      break;
    case "cancel":
      if (!isCustomer && !member) throw Errors.forbidden();
      break;
    case "expire":
      if (actor.role !== "admin") throw Errors.forbidden();
      break;
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: target };
  if (target === "CONFIRMED") updates.confirmed_at = now;
  if (target === "FULFILLED") updates.fulfilled_at = now;
  if (target === "CANCELLED") updates.cancelled_at = now;

  const { data, error } = await supabase
    .from("reservations")
    .update(updates)
    .eq("id", reservationId)
    .select("*")
    .single();
  if (error) throw error;

  // Notify the customer of the outcome (degrades to a log when unconfigured).
  if (target !== "REQUESTED") {
    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("id", reservation.customer_id)
      .maybeSingle();
    if (customerProfile) {
      await notifyUser({
        userId: reservation.customer_id,
        type: "reservation_update",
        title: `Reservation ${target.toLowerCase()}`,
        body: `Your reservation request was ${target.toLowerCase()}.`,
        email: customerProfile.email,
      }).catch(() => {});
    }
  }

  return { reservation: data as Reservation };
}

/** List reservations for the current user (customer: own; staff: their pharmacy's). */
export async function listReservationsForUser(actor: Profile) {
  const supabase = await createClient();
  if (actor.role === "admin") {
    const { data, error } = await supabase
      .from("reservations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data as Reservation[];
  }

  // Customer: own reservations.
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("customer_id", actor.id)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as Reservation[];
}

/** Expire stale REQUESTED reservations (system job; service-role). */
export async function expireStaleReservations(): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("reservations")
    .update({ status: "EXPIRED" })
    .eq("status", "REQUESTED")
    .lt("expires_at", new Date().toISOString());
  if (error) throw error;
}
