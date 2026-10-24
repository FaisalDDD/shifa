import "server-only";
import { createClient } from "@/lib/supabase/server";
import { Errors } from "@/lib/errors";
import { purchaseTransition, type PurchaseAction } from "./state-machine";
import type { PurchaseRequest, Profile } from "@/types";

export interface CreatePurchaseInput {
  buyerPharmacyId: string;
  sellerPharmacyId: string;
  productId: string;
  quantity: number;
  notes?: string | null;
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

export type PurchaseRequestWithProduct = PurchaseRequest & {
  products: {
    id: string;
    canonical_name: string;
    brand_name: string | null;
    strength: string | null;
  } | null;
};

/** A pharmacy member requests to buy a bulk quantity from another pharmacy. */
export async function createPurchaseRequest(
  actor: Profile,
  input: CreatePurchaseInput,
): Promise<PurchaseRequest> {
  const supabase = await createClient();

  if (!(await isMemberOf(actor, input.buyerPharmacyId))) {
    throw Errors.forbidden("You must be a member of the buyer pharmacy.");
  }
  if (input.sellerPharmacyId === input.buyerPharmacyId) {
    throw Errors.badRequest("You cannot buy from your own pharmacy.");
  }

  const { data: seller } = await supabase
    .from("pharmacies")
    .select("id, is_active")
    .eq("id", input.sellerPharmacyId)
    .maybeSingle();
  if (!seller) throw Errors.notFound("Pharmacy");
  if (!seller.is_active) {
    throw Errors.badRequest("This pharmacy is not currently accepting requests.");
  }

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", input.productId)
    .maybeSingle();
  if (!product) throw Errors.notFound("Product");

  const { data, error } = await supabase
    .from("purchase_requests")
    .insert({
      buyer_pharmacy_id: input.buyerPharmacyId,
      seller_pharmacy_id: input.sellerPharmacyId,
      product_id: input.productId,
      quantity: input.quantity,
      status: "REQUESTED",
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  return data as PurchaseRequest;
}

export async function transitionPurchaseRequest(
  actor: Profile,
  requestId: string,
  action: PurchaseAction,
): Promise<PurchaseRequest> {
  const supabase = await createClient();

  const { data: req } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (!req) throw Errors.notFound("Purchase request");
  const request = req as PurchaseRequest;

  const target = purchaseTransition(request.status, action);
  if (!target) {
    throw Errors.conflict(
      `Cannot ${action} a purchase request in state ${request.status}.`,
    );
  }

  const isSeller = await isMemberOf(actor, request.seller_pharmacy_id);
  const isBuyer = await isMemberOf(actor, request.buyer_pharmacy_id);
  const isAdmin = actor.role === "admin";

  if (action === "accept" || action === "reject") {
    if (!isSeller && !isAdmin) {
      throw Errors.forbidden("Only the seller pharmacy can perform this action.");
    }
  }
  if (action === "cancel") {
    if (!isBuyer && !isAdmin) {
      throw Errors.forbidden("Only the buyer pharmacy can cancel this request.");
    }
  }

  const resolvedAt = target === "REQUESTED" ? null : new Date().toISOString();
  const { data, error } = await supabase
    .from("purchase_requests")
    .update({ status: target, resolved_at: resolvedAt })
    .eq("id", requestId)
    .select("*")
    .single();
  if (error) throw error;

  return data as PurchaseRequest;
}

/** List purchase requests for a pharmacy (incoming = seller, outgoing = buyer). */
export async function listPurchaseRequests(
  actor: Profile,
  pharmacyId: string,
  direction: "incoming" | "outgoing",
): Promise<PurchaseRequestWithProduct[]> {
  const supabase = await createClient();

  if (!(await isMemberOf(actor, pharmacyId))) {
    throw Errors.forbidden("You must be a member of this pharmacy.");
  }

  const column =
    direction === "incoming" ? "seller_pharmacy_id" : "buyer_pharmacy_id";
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*, products:products(id, canonical_name, brand_name, strength)")
    .eq(column, pharmacyId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []) as PurchaseRequestWithProduct[];
}
