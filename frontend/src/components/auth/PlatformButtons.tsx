import { connection } from "next/server";
import { startPlatform } from "@/app/[lang]/auth/actions";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import { interpolate } from "@/i18n/format";
import { getLocale, getMessages } from "@/i18n/server";
import { getPlatforms } from "@/lib/api/accounts";
import { SubmitButton } from "./FormParts";
import { PlatformIcon } from "./PlatformIcon";
import { platformNames } from "./platformNames";

/** "Continue with Discord / GitHub" buttons for the sign-in and sign-up pages. Only platforms the
 *  API has configured are shown; if the list can't be loaded, the buttons are simply left out and
 *  email sign-in still works. Render inside <Suspense>: the list comes from the API.
**/
export async function PlatformButtons() {
  await connection();
  const locale = await getLocale();
  const { auth } = await getMessages();

  let available: Awaited<ReturnType<typeof getPlatforms>>;
  try {
    available = await getPlatforms();
  } catch (error) {
    console.error("Loading sign-in platforms failed", error);
    return null;
  }
  if (available.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        {available.map((platform) => {
          const label = interpolate(auth.platformButton, { platform: platformNames[platform] });
          return (
            <form key={platform} action={startPlatform}>
              <input type="hidden" name="platform" value={platform} />
              <input type="hidden" name="mode" value="sign-in" />
              <input type="hidden" name="locale" value={locale} />
              <SubmitButton variant="secondary" icon={<PlatformIcon platform={platform} />} label={label} pendingLabel={label} className="w-full" />
            </form>
          );
        })}
      </div>
      <p className={dividerClasses}>
        {auth.or}
      </p>
    </div>
  );
}

const dividerClasses =
  "flex items-center gap-3 text-sm text-subtle before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border";

/** Same size as the two platform buttons and the "or" divider, so the email form below doesn't move
 *  when they arrive. If the API offers no platforms, the space closes once loading ends.
**/
export function PlatformButtonsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="min-h-11 w-full rounded-lg" />
        <Skeleton className="min-h-11 w-full rounded-lg" />
      </div>
      <p aria-hidden="true" className={dividerClasses}>
        <SkeletonText widths={["w-4"]} className="text-sm" />
      </p>
    </div>
  );
}
