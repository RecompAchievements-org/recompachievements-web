/** Links shown in a game's details card. GitHub repositories also get their releases and issue
 *  pages; other hosts only get the source link.
**/
export function repoLinks(repoUrl: string) {
  const url = new URL(repoUrl);
  if (url.hostname !== "github.com") return { source: repoUrl };
  const base = repoUrl.replace(/\/$/, "");
  return {
    source: base,
    latestRelease: `${base}/releases/latest`,
    releases: `${base}/releases`,
    issues: `${base}/issues`,
  };
}
