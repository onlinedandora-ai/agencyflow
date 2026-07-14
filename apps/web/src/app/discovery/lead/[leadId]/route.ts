import { z } from "zod";
import { isAuthError, requireAuth } from "@/lib/server/auth";
import {
  DiscoveryNotFoundError,
  findByLead,
  upsertDiscovery,
} from "@/lib/server/discovery";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

const upsertDiscoverySchema = z.object({
  researchNotes: z.string().optional(),
  callNotes: z.string().optional(),
  scheduledAt: z.string().optional(),
  answers: z.record(z.string(), z.string()).optional(),
});

type RouteContext = { params: Promise<{ leadId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  try {
    return jsonOk(await findByLead(leadId));
  } catch (error) {
    if (error instanceof DiscoveryNotFoundError) {
      return jsonError(error.message, 404);
    }
    throw error;
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  const { leadId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = upsertDiscoverySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await upsertDiscovery(leadId, parsed.data));
  } catch (error) {
    if (error instanceof DiscoveryNotFoundError) {
      return jsonError(error.message, 404);
    }
    throw error;
  }
}
