import { AchievementRowSkeleton } from "@/components/game/AchievementRow";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

const achievementRows = 6;
const infoRows = 5;

/** Placeholder for a game page while its data loads. It uses the real page's grid and sizes
 *  (portrait cover, header text, details card, preview notice, achievement rows), so nothing moves
 *  when the game arrives; on phones the card follows the header, as on the real page.
**/
export function GamePageSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-10">
      <SkeletonText widths={["w-24"]} className="text-sm" />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr]">
        <div className="grid gap-6 sm:grid-cols-[12rem_1fr] sm:items-center lg:col-start-1 lg:row-start-1">
          <Skeleton className="aspect-[2/3] w-40 rounded-xl sm:w-full" />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[30px] w-32 rounded-full" />
            <SkeletonText widths={["w-3/4", "w-1/2 sm:hidden"]} className="font-display text-4xl leading-tight sm:text-5xl" />
            <SkeletonText widths={["w-full", "w-full", "w-full sm:w-2/3", "w-1/2 sm:hidden"]} className="text-lg leading-relaxed" />
            <SkeletonText widths={["w-48"]} className="font-mono text-sm" />
          </div>
        </div>

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20 shrink-0 rounded-lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <SkeletonText widths={["w-3/4"]} className="font-display text-lg leading-snug" />
                <SkeletonText widths={["w-1/2"]} className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-11 rounded-lg" />
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="px-4 py-3">
                    <SkeletonText widths={["w-1/2"]} className="text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-[106px] rounded-xl" />
            <div className="flex flex-col">
              {/** The first row stands in for the platform badges, which usually wrap onto two lines. **/}
              <div className="flex justify-between gap-4 border-t border-border py-3">
                <SkeletonText widths={["w-16"]} className="text-sm" />
                <div className="flex flex-col items-end gap-1.5">
                  <Skeleton className="h-[22px] w-28" />
                  <Skeleton className="h-[22px] w-20" />
                </div>
              </div>
              {Array.from({ length: infoRows - 1 }, (_, index) => (
                <div key={index} className="flex justify-between gap-4 border-t border-border py-3">
                  <SkeletonText widths={["w-20"]} className="text-sm" />
                  <SkeletonText widths={["w-16"]} className="text-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1 lg:row-start-2">
          <Skeleton className="h-[106px] rounded-xl" />
          <div className="flex flex-col gap-4">
            <SkeletonText widths={["w-40"]} className="font-display text-2xl" />
            <ul className="flex flex-col gap-3">
              {Array.from({ length: achievementRows }, (_, index) => (
                <AchievementRowSkeleton key={index} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
