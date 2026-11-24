import "server-only";
import { notFound } from "next/navigation";
import { getCurrentAccount } from "./session";

// Moderation pages don't exist for anyone else. The API enforces the same rule on every request.
export async function requireStaff() {
  const account = await getCurrentAccount();
  if (!account || (account.role !== "moderator" && account.role !== "admin")) notFound();
  return account;
}

// Admin-only pages (such as the forum editor) don't exist for anyone else; the API checks again.
export async function requireAdmin() {
  const account = await getCurrentAccount();
  if (!account || account.role !== "admin") notFound();
  return account;
}
