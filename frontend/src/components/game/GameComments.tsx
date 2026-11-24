import { formatDate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { CommentsPreview } from "./CommentsPreview";

// Passes only the signed-in player's public name and join date to the browser-only preview.
export async function GameComments() {
  const locale = await getLocale();
  const { comments } = await getMessages();
  const account = await getCurrentAccount();
  const viewer = account && {
    username: account.username,
    avatar: account.avatar,
    joined: formatDate(locale, new Date(account.createdAt), { dateStyle: "medium", timeZone: "UTC" }),
  };

  return <CommentsPreview labels={comments} locale={locale} viewer={viewer} muted={account?.isMuted ?? false} />;
}
