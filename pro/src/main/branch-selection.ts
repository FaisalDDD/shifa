import type { BranchOption } from "../shared/types";

export type { BranchOption } from "../shared/types";

export type BranchSelection =
  | { kind: "selected"; branch: BranchOption }
  | { kind: "needs-selection"; branches: BranchOption[] };

/**
 * Resolve a branch only from the already-authorized membership list.
 * An explicit branch id never widens access; it must be present in that list.
 */
export function resolveBranchSelection(
  branches: readonly BranchOption[],
  requestedBranchId?: string | null,
): BranchSelection {
  if (requestedBranchId) {
    const branch = branches.find((candidate) => candidate.id === requestedBranchId);
    if (!branch) throw new Error("The selected branch is not assigned to this account.");
    return { kind: "selected", branch };
  }
  if (branches.length === 1) return { kind: "selected", branch: branches[0] };
  return { kind: "needs-selection", branches: [...branches] };
}
