/** Structured data (schema.org JSON-LD) for search engines. The `<` escape keeps content from
 *  closing the script tag early, as recommended in the Next.js JSON-LD guide.
**/
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
