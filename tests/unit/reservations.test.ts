import { describe, it, expect } from "vitest";
import {
  canTransition,
  transitionStatus,
  actorCanPerform,
  allowedActors,
  TERMINAL_STATUSES,
} from "@/services/reservations/state-machine";

describe("reservation state machine", () => {
  it("allows REQUESTED -> CONFIRMED", () => {
    expect(transitionStatus("REQUESTED", "confirm")).toBe("CONFIRMED");
  });

  it("allows REQUESTED -> REJECTED / CANCELLED / EXPIRED", () => {
    expect(transitionStatus("REQUESTED", "reject")).toBe("REJECTED");
    expect(transitionStatus("REQUESTED", "cancel")).toBe("CANCELLED");
    expect(transitionStatus("REQUESTED", "expire")).toBe("EXPIRED");
  });

  it("allows CONFIRMED -> FULFILLED / CANCELLED", () => {
    expect(transitionStatus("CONFIRMED", "fulfill")).toBe("FULFILLED");
    expect(transitionStatus("CONFIRMED", "cancel")).toBe("CANCELLED");
  });

  it("rejects invalid transitions", () => {
    expect(canTransition("REQUESTED", "fulfill")).toBe(false);
    expect(canTransition("CONFIRMED", "reject")).toBe(false);
    expect(canTransition("CONFIRMED", "expire")).toBe(false);
  });

  it("rejects all transitions from terminal states", () => {
    for (const status of TERMINAL_STATUSES) {
      expect(canTransition(status, "confirm")).toBe(false);
      expect(canTransition(status, "fulfill")).toBe(false);
      expect(canTransition(status, "cancel")).toBe(false);
    }
  });

  it("only pharmacies (or admin) can confirm/reject/fulfill", () => {
    expect(actorCanPerform("confirm", "pharmacy")).toBe(true);
    expect(actorCanPerform("confirm", "admin")).toBe(true);
    expect(actorCanPerform("confirm", "customer")).toBe(false);
    expect(actorCanPerform("reject", "customer")).toBe(false);
    expect(actorCanPerform("fulfill", "customer")).toBe(false);
  });

  it("customers can cancel their own request", () => {
    expect(actorCanPerform("cancel", "customer")).toBe(true);
  });

  it("only the system (or admin) can expire", () => {
    expect(actorCanPerform("expire", "system")).toBe(true);
    expect(actorCanPerform("expire", "customer")).toBe(false);
    expect(actorCanPerform("expire", "pharmacy")).toBe(false);
  });

  it("lists allowed actors for each action", () => {
    expect(allowedActors("confirm")).toEqual(["pharmacy", "admin"]);
    expect(allowedActors("expire")).toEqual(["system", "admin"]);
  });
});
