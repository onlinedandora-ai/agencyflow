import { UserRole } from "@prisma/client";
import { z } from "zod";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { createUser, listAll, UserConflictError } from "@/lib/server/users";

export const runtime = "nodejs";

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.nativeEnum(UserRole, {
    message: "role must be one of: ADMIN, CLIENT_MANAGER, DELIVERY_EXEC",
  }),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRoles(auth, ["ADMIN"]);
  if (forbidden) return forbidden;

  const users = await listAll();
  return jsonOk(users);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRoles(auth, ["ADMIN"]);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    const user = await createUser(parsed.data);
    return jsonOk(user);
  } catch (error) {
    if (error instanceof UserConflictError) {
      return jsonError(error.message, 409);
    }
    throw error;
  }
}
