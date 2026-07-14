import { jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET() {
  return jsonOk({
    status: "ok",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT ?? null,
    runtime: "next",
  });
}
