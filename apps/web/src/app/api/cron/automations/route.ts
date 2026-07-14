import {
  isAutomationJobType,
  runAllAutomationJobs,
  runAutomationJob,
  verifyCronAuth,
} from "@/lib/server/automations";
import { jsonError, jsonOk } from "@/lib/server/http";

export const runtime = "nodejs";

async function handleCron(request: Request) {
  const unauthorized = verifyCronAuth(request);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const job = url.searchParams.get("job");

  if (job) {
    if (!isAutomationJobType(job)) {
      return jsonError(`Unknown automation job: ${job}`, 400);
    }
    const result = await runAutomationJob(job);
    return jsonOk({ job, result });
  }

  const results = await runAllAutomationJobs();
  return jsonOk({ jobs: results });
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}
