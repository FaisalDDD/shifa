import { describe, it, expect } from "vitest";
import {
  purchaseTransition,
  canPurchaseTransition,
  purchaseActorCan,
} from "@/services/purchases/state-machine";

describe("purchase request state machine", () => {
  it("allows REQUESTED -> ACCEPTED / REJECTED / CANCELLED", () => {
    expect(purchaseTransition("REQUESTED", "accept")).toBe("ACCEPTED");
    expect(purchaseTransition("REQUESTED", "reject")).toBe("REJECTED");
    expect(purchaseTransition("REQUESTED", "cancel")).toBe("CANCELLED");
  });

  it("rejects transitions from terminal states", () => {
    expect(canPurchaseTransition("ACCEPTED", "cancel")).toBe(false);
    expect(canPurchaseTransition("REJECTED", "accept")).toBe(false);
    expect(canPurchaseTransition("CANCELLED", "accept")).toBe(false);
  });

  it("only the seller (or admin) can accept/reject", () => {
    expect(purchaseActorCan("accept", "seller")).toBe(true);
    expect(purchaseActorCan("reject", "admin")).toBe(true);
    expect(purchaseActorCan("accept", "buyer")).toBe(false);
    expect(purchaseActorCan("reject", "buyer")).toBe(false);
  });

  it("only the buyer (or admin) can cancel", () => {
    expect(purchaseActorCan("cancel", "buyer")).toBe(true);
    expect(purchaseActorCan("cancel", "admin")).toBe(true);
    expect(purchaseActorCan("cancel", "seller")).toBe(false);
  });
});
