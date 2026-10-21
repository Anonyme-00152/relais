import { json } from "@/lib/server/http";
import { publicConfig } from "@/lib/server/folders";

export const dynamic = "force-dynamic";

export function GET() {
  return json(publicConfig(), 200, { "Cache-Control": "public, max-age=300" });
}
