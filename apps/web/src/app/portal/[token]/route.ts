import { getPortal, handlePortalError } from "@/lib/server/portal";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;

  try {
    return jsonOk(await getPortal(token));
  } catch (error) {
    const handled = handlePortalError(error);
    return jsonError(handled.message, handled.status);
  }
}
