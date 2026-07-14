import bcrypt from "bcrypt";
import { z } from "zod";
import { signAccessToken } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return jsonError("Invalid credentials", 401);
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return jsonError("Invalid credentials", 401);
  }

  const accessToken = await signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });

  return jsonOk({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
