import { isAuthError, requireAuth, requireRoles } from "@/lib/server/auth";
import {
  isAutomationJobType,
  triggerAutomationJob,
} from "@/lib/server/automations";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

const WRITE_ROLES = ["ADMIN", "CLIENT_MANAGER"] as const;

type RouteContext = { params: Promise<{ jobType: string }> };

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const forbidden = requireRoles(auth, WRITE_ROLES);
  if (forbidden) return forbidden;

  const { jobType } = await context.params;
  if (!isAutomationJobType(jobType)) {
    return jsonError(`Unknown automation job: ${jobType}`, 400);
  }

  return jsonOk(await triggerAutomationJob(jobType));
}
