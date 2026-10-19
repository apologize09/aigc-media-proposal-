import { createHealthReport } from "@/server/health";

export function GET() {
  return Response.json(createHealthReport());
}
