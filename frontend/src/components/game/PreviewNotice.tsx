import { Card } from "@/components/ui/Card";

// Explains that a preview set can't be earned yet and isn't endorsed by the recomp's developers.
export function PreviewNotice({ title, text }: { title: string; text: string }) {
  return (
    <Card className="flex items-start gap-3 border-info/40">
      <svg viewBox="0 0 20 20" aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info">
        <circle cx="10" cy="10" r="8.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <circle cx="10" cy="6.25" r="1.1" fill="currentColor" />
      </svg>
      <div className="flex flex-col gap-1">
        <p className="font-semibold text-info">{title}</p>
        <p className="text-sm leading-relaxed text-muted">{text}</p>
      </div>
    </Card>
  );
}
