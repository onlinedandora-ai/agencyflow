import { z } from "zod";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getAgencyProfile, updateAgencyProfile } from "@/lib/server/settings";

export const runtime = "nodejs";

const WRITE_ROLES = ["ADMIN", "CLIENT_MANAGER"] as const;

const updateAgencyProfileSchema = z.object({
  name: z.string().optional(),
  tagline: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  website: z.string().optional(),
  gstin: z.string().optional(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  defaultTermsAndConditions: z.string().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  return jsonOk(await getAgencyProfile());
}

export async function PATCH(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRoles(auth, WRITE_ROLES);
  if (forbidden) return forbidden;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = updateAgencyProfileSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  return jsonOk(await updateAgencyProfile(parsed.data));
}
