import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";

// Same layout as a comment section (heading, intro, composer, two comments), so nothing shifts.
export function CommentsSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <SkeletonText widths={["w-40"]} className="font-display text-2xl" />
        <SkeletonText widths={["w-2/3"]} />
      </div>
      <Skeleton className="h-52 w-full rounded-2xl" />
      {[0, 1].map((index) => (
        <Skeleton key={index} className="h-32 w-full rounded-xl" />
      ))}
    </div>
  );
}
