import type { StaffRole } from "@/lib/api/accounts";
import { cx } from "@/lib/cx";

// Admins use the site's purple and moderators its gold, so official accounts stand out at a glance.
const ribbonColors: Record<StaffRole, string> = {
  admin: "bg-accent",
  moderator: "bg-gold",
};

const edgeColors: Record<StaffRole, string> = {
  admin: "border-accent",
  moderator: "border-gold",
};

// Roles are site-wide identifiers, shown with the same name in every language.
const roleNames: Record<StaffRole, string> = {
  admin: "Admin",
  moderator: "Moderator",
};

const tagColors: Record<StaffRole, string> = {
  admin: "border-accent/50 text-accent",
  moderator: "border-gold/50 text-gold",
};

/** A small tab with the account's staff role, hanging from the middle of the profile photo's top
 *  edge (flat on top, rounded below), mirroring the badges on the bottom edge. A thin line in the
 *  same color runs along the photo's top edge and follows its rounded corners, so the tab grows
 *  out of it. Its parent must be `relative` and round its corners like the photo (`rounded-lg`).
**/
export function StaffRibbon({ role }: { role: StaffRole }) {
  return (
    <>
      <span aria-hidden="true" className={cx("pointer-events-none absolute inset-0 rounded-lg border-t-2", edgeColors[role])} />
      <p
        className={cx(
          "absolute top-0 left-1/2 -translate-x-1/2 rounded-b-md px-2 pt-px pb-1 font-display text-xs leading-none font-bold tracking-[0.08em] whitespace-nowrap text-on-accent uppercase shadow-[inset_0_-2px_0_rgb(0_0_0/0.28),0_3px_6px_-1px_rgb(0_0_0/0.65)]",
          ribbonColors[role],
        )}
      >
        {roleNames[role]}
      </p>
    </>
  );
}

// The staff role as a compact tag, for places too small for the ribbon (the profile preview card).
export function StaffTag({ role, className }: { role: StaffRole; className?: string }) {
  return (
    <span className={cx("inline-flex w-fit items-center rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide uppercase", tagColors[role], className)}>
      {roleNames[role]}
    </span>
  );
}
