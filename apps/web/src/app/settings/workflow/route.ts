import { z } from "zod";
import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import { getWorkflowSettings, updateWorkflowSettings } from "@/lib/server/settings";

export const runtime = "nodejs";

const WRITE_ROLES = ["ADMIN", "CLIENT_MANAGER"] as const;

const updateWorkflowSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  leadSlaScan: z.boolean().optional(),
  proposalFollowUp: z.boolean().optional(),
  invoiceOverdue: z.boolean().optional(),
  deliverableReviewNudge: z.boolean().optional(),
});

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  return jsonOk(await getWorkflowSettings());
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

  const parsed = updateWorkflowSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  return jsonOk(await updateWorkflowSettings(parsed.data));
}
