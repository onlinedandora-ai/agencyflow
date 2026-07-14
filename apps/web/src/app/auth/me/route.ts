import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const user = await prisma.user.findUnique({
    where: { id: auth.sub },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) {
    return jsonError("Unauthorized", 401);
  }

  return jsonOk(user);
}
