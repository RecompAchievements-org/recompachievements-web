import "server-only";
import { headers } from "next/headers";

// The visitor's IP as reported by the hosting proxy (first entry of X-Forwarded-For).
export async function getClientIp(): Promise<string | null> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    null
  );
}
