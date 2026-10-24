// Reservation state machine — pure transition rules (unit-testable).
//
// REQUESTED -> CONFIRMED -> FULFILLED
//           -> REJECTED
//           -> CANCELLED (customer/pharmacy/admin)
//           -> EXPIRED   (system)
// CONFIRMED -> FULFILLED
//           -> CANCELLED
// Terminal: REJECTED, FULFILLED, CANCELLED, EXPIRED

import type { ReservationStatus } from "@/types";

export type ReservationAction = "confirm" | "reject" | "cancel" | "fulfill" | "expire";
export type ActorKind = "customer" | "pharmacy" | "admin" | "system";

interface Transition {
  from: ReservationStatus;
  action: ReservationAction;
  to: ReservationStatus;
}

const TRANSITIONS: Transition[] = [
  { from: "REQUESTED", action: "confirm", to: "CONFIRMED" },
  { from: "REQUESTED", action: "reject", to: "REJECTED" },
  { from: "REQUESTED", action: "cancel", to: "CANCELLED" },
  { from: "REQUESTED", action: "expire", to: "EXPIRED" },
  { from: "CONFIRMED", action: "fulfill", to: "FULFILLED" },
  { from: "CONFIRMED", action: "cancel", to: "CANCELLED" },
];

export const TERMINAL_STATUSES: ReservationStatus[] = [
  "REJECTED",
  "FULFILLED",
  "CANCELLED",
  "EXPIRED",
];

export function transitionStatus(
  from: ReservationStatus,
  action: ReservationAction,
): ReservationStatus | null {
  const t = TRANSITIONS.find((x) => x.from === from && x.action === action);
  return t ? t.to : null;
}

export function canTransition(
  from: ReservationStatus,
  action: ReservationAction,
): boolean {
  return transitionStatus(from, action) !== null;
}

/** Which actor kinds may perform a given action. */
export function allowedActors(action: ReservationAction): ActorKind[] {
  switch (action) {
    case "confirm":
    case "reject":
    case "fulfill":
      // Only a pharmacy (or an admin acting on its behalf) may confirm.
      return ["pharmacy", "admin"];
    case "cancel":
      return ["customer", "pharmacy", "admin"];
    case "expire":
      return ["system", "admin"];
  }
}

export function actorCanPerform(
  action: ReservationAction,
  actor: ActorKind,
): boolean {
  return allowedActors(action).includes(actor);
}
