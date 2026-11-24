import { connection } from "next/server";
import { SavedComments } from "@/components/comments/SavedComments";
import { getLocale, getMessages } from "@/i18n/server";
import { getCommentPage } from "@/lib/api/comments";
import { getCurrentAccount, visitor } from "@/lib/auth/session";

/** A game page's saved comments. They depend on who is looking (delete and report buttons), so they
 *  load per request inside their own <Suspense>, while the game itself stays cached.
**/
export async function GameCommentsSection({ slug }: { slug: string }) {
  await connection();
  const locale = await getLocale();
  const { comments, auth, moderation } = await getMessages();
  const thread = { kind: "game", slug } as const;

  let first;
  try {
    const result = await getCommentPage(thread, null, locale, await visitor());
    if (!result.ok) throw new Error(`Loading game comments failed with status ${result.status}.`);
    first = result.data;
  } catch (error) {
    console.error("Game comments unavailable", error);
    return <p className="text-muted">{comments.unavailable}</p>;
  }

  const viewer = await getCurrentAccount();
  return (
    <SavedComments
      thread={thread}
      heading={comments.game.heading}
      intro={comments.game.intro}
      placeholder={comments.game.placeholder}
      locale={locale}
      first={first}
      access={!viewer ? "signIn" : viewer.canCollectAchievements ? "post" : "email"}
      messages={comments}
      errors={auth.errors}
      authorLabels={comments.author}
      viewerUsername={viewer?.username ?? null}
      mutedNotice={viewer?.isMuted ? comments.muted : null}
      reportLabels={{ ...moderation.report, reasons: moderation.reasons }}
    />
  );
}
