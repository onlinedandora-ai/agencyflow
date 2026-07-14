import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  name: string;
};

const DEV_SECRET = "agencyflow-dev-secret-change-in-production";

function jwtSecretKey() {
  const secret = (process.env.JWT_SECRET || DEV_SECRET).trim();
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    name: payload.name,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(jwtSecretKey());
}

export async function verifyAccessToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, jwtSecretKey());
  const sub = typeof payload.sub === "string" ? payload.sub : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const role = typeof payload.role === "string" ? payload.role : null;
  const name = typeof payload.name === "string" ? payload.name : null;
  if (!sub || !email || !role || !name) {
    throw new Error("Invalid token payload");
  }
  return { sub, email, role, name };
}

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

export async function requireAuth(request: Request): Promise<JwtPayload | NextResponse> {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  try {
    return await verifyAccessToken(token);
  } catch {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
}

export function requireRoles(
  user: JwtPayload,
  roles: readonly string[],
): NextResponse | null {
  if (!roles.includes(user.role)) {
    return NextResponse.json(
      { message: "You do not have permission for this action" },
      { status: 403 },
    );
  }
  return null;
}

export function isAuthError(
  value: JwtPayload | NextResponse,
): value is NextResponse {
  return value instanceof NextResponse;
}
