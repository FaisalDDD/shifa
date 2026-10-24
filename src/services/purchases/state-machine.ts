// B2B purchase-request state machine — pure transition rules (unit-testable).
//
// REQUESTED -> ACCEPTED  (seller)
//           -> REJECTED  (seller)
//           -> CANCELLED (buyer)
// Terminal: ACCEPTED, REJECTED, CANCELLED

import type { PurchaseRequestStatus } from "@/types";

export type PurchaseAction = "accept" | "reject" | "cancel";
export type PurchaseActor = "buyer" | "seller" | "admin";

export function purchaseTransition(
  from: PurchaseRequestStatus,
  action: PurchaseAction,
): PurchaseRequestStatus | null {
  if (from === "REQUESTED") {
    if (action === "accept") return "ACCEPTED";
    if (action === "reject") return "REJECTED";
    if (action === "cancel") return "CANCELLED";
  }
  return null;
}

export function canPurchaseTransition(
  from: PurchaseRequestStatus,
  action: PurchaseAction,
): boolean {
  return purchaseTransition(from, action) !== null;
}

/** Whether a given actor kind may perform an action. */
export function purchaseActorCan(
  action: PurchaseAction,
  actor: PurchaseActor,
): boolean {
  switch (action) {
    case "accept":
    case "reject":
      return actor === "seller" || actor === "admin";
    case "cancel":
      return actor === "buyer" || actor === "admin";
  }
}
