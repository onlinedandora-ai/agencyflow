import { isAuthError, requireAuth } from "@/lib/server/auth";
import { jsonError, jsonOk } from "@/lib/server/http";
import {
  createLead,
  createLeadSchema,
  findAllLeads,
  handleLeadError,
} from "@/lib/server/leads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  try {
    return jsonOk(await findAllLeads());
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (isAuthError(auth)) return auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid JSON body", 400);
  }

  const parsed = createLeadSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      parsed.error.issues.map((issue) => issue.message),
      400,
    );
  }

  try {
    return jsonOk(await createLead(parsed.data), 201);
  } catch (error) {
    const handled = handleLeadError(error);
    return jsonError(handled.message, handled.status);
  }
}
