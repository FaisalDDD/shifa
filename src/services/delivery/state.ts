export type DeliveryOrderStatus = "REQUESTED" | "ACCEPTED" | "REJECTED" | "CANCELLED" | "EXPIRED" | "DELIVERED";
export type DeliveryAction = "accept" | "reject" | "cancel" | "submit_receipt" | "deliver";

export function nextDeliveryOrderStatus(status: DeliveryOrderStatus, action: DeliveryAction): DeliveryOrderStatus {
  if (action === "submit_receipt") return status;
  if (action === "cancel" && (status === "REQUESTED" || status === "ACCEPTED")) return "CANCELLED";
  if (action === "accept" && status === "REQUESTED") return "ACCEPTED";
  if (action === "reject" && status === "REQUESTED") return "REJECTED";
  if (action === "deliver" && status === "ACCEPTED") return "DELIVERED";
  throw new Error(`Cannot ${action} a delivery order in state ${status}.`);
}
