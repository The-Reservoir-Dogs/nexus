export const dynamic = "force-dynamic";
import { getCurrentUser } from "@/lib/auth";
import { ok, fail } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(user);
  } catch (e: any) {
    return fail("UNAUTHORIZED", e.message ?? "Not logged in", 401);
  }
}
