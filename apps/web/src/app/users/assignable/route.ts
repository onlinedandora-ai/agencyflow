import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonOk } from "@/lib/server/http";
import { listAssignable } from "@/lib/server/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const users = await listAssignable();
  return jsonOk(users);
}
