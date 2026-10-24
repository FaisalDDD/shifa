import { requireUser } from "@/lib/auth/session";
import { registerBranch } from "@/services/pharmacies/register";
import { pharmacyBranchRegisterSchema } from "@/lib/validation/schemas";
import { created, handleError, errorResponse } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return errorResponse(400, "bad_request", "Invalid JSON body.");
    const input = pharmacyBranchRegisterSchema.parse(body);
    const user = await requireUser();
    const branch = await registerBranch(user.id, {
      ...input,
      description: input.description,
    });
    return created(branch);
  } catch (err) {
    return handleError(err);
  }
}
