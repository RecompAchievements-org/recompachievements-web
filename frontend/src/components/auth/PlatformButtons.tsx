import { connection } from "next/server";
import { startPlatform } from "@/app/[lang]/auth/actions";
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
      <p className="flex items-center gap-3 text-sm text-subtle before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
        {auth.or}
      </p>
    </div>
  );
}
