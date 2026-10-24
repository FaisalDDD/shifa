import { describe, expect, it } from "vitest";
import { resolveBranchSelection, type BranchOption } from "../src/main/branch-selection";

const branch = (id: string, businessId = "business-1"): BranchOption => ({
  id,
  business_id: businessId,
  name: `Branch ${id}`,
  membership_role: "owner",
});

describe("branch selection", () => {
  it("selects the only branch without prompting", () => {
    expect(resolveBranchSelection([branch("north")])).toEqual({
      kind: "selected",
      branch: branch("north"),
    });
  });

  it("requires an explicit choice for a multi-branch business", () => {
    expect(resolveBranchSelection([branch("north"), branch("south")])).toEqual({
      kind: "needs-selection",
      branches: [branch("north"), branch("south")],
    });
  });

  it("accepts only a member branch when an explicit choice is supplied", () => {
    expect(resolveBranchSelection([branch("north"), branch("south")], "south")).toEqual({
      kind: "selected",
      branch: branch("south"),
    });
    expect(() => resolveBranchSelection([branch("north")], "other")).toThrow("branch");
  });
});
