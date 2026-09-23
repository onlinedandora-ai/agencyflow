import { decodeJwt } from "jose";
import bcrypt from "bcrypt";
import { z } from "zod";
import { signAccessToken } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const runtime = "nodejs";

const firebaseAuthSchema = z.object({
  idToken: z.string().min(10),
  email: z.string().email().optional(),
  name: z.string().optional(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = firebaseAuthSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  const { idToken, email: bodyEmail, name: bodyName } = parsed.data;

  let decodedEmail: string | undefined = bodyEmail;
  let decodedName: string | undefined = bodyName;

  try {
    const claims = decodeJwt(idToken) as {
      email?: string;
      name?: string;
      sub?: string;
      aud?: string;
      iss?: string;
    };
    if (claims.email) {
      decodedEmail = claims.email;
    }
    if (claims.name && !decodedName) {
      decodedName = claims.name;
    }
  } catch {
    if (!decodedEmail) {
      return jsonError("Invalid Firebase token", 401);
    }
  }

  if (!decodedEmail) {
    return jsonError("No verified email associated with this account", 400);
  }

  const email = decodedEmail.toLowerCase().trim();
  const displayName = decodedName?.trim() || email.split("@")[0] || "User";

  try {
    // Find or provision user in the database
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      const userCount = await prisma.user.count();
      // First user is Admin; subsequent users are Client Managers
      const initialRole = userCount === 0 ? "ADMIN" : "CLIENT_MANAGER";
      const dummyHash = await bcrypt.hash(`firebase-${Date.now()}-${Math.random()}`, 10);

      user = await prisma.user.create({
        data: {
          email,
          name: displayName,
          passwordHash: dummyHash,
          role: initialRole,
        },
      });
    } else if (!user.name && displayName) {
      // Fill in name if missing
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name: displayName },
      });
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
  } catch (dbErr) {
    console.error("Firebase auth database provisioning error:", dbErr);
    return jsonError("Account provisioning failed. Please try again or contact support.", 500);
  }
}
