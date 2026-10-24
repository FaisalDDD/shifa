import { describe, expect, it } from "vitest";
import { nextDeliveryOrderStatus } from "@/services/delivery/state";

describe("delivery order status transitions", () => {
  it("allows customer cancellation only before delivery", () => {
    expect(nextDeliveryOrderStatus("REQUESTED", "cancel")).toBe("CANCELLED");
    expect(nextDeliveryOrderStatus("ACCEPTED", "cancel")).toBe("CANCELLED");
    expect(() => nextDeliveryOrderStatus("DELIVERED", "cancel")).toThrow();
  });

  it("does not treat receipt upload as payment confirmation", () => {
    expect(nextDeliveryOrderStatus("REQUESTED", "submit_receipt")).toBe("REQUESTED");
  });
});
