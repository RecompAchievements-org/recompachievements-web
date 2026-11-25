export const siteConfig = {
  name: "RecompAchievements",
  url: "https://recompachievements.org",
  description:
    "Community-driven achievement tracking for native static recompilations and PC ports.",
  repoUrl: "https://github.com/RecompAchievements-org/recompachievements-web",
  securityPolicyUrl:
    "https://github.com/RecompAchievements-org/recompachievements-web/blob/main/SECURITY.md",
  licenseUrl:
    "https://github.com/RecompAchievements-org/recompachievements-web/blob/main/LICENSE",
  contactEmail: "contact@recompachievements.org",
  // The forum category shown on the home page, and the post the header's release badge opens.
  newsCategory: "news",
  releasePost: "/forum/news/alpha-v1-0-is-live",
  // Official channels: icon links in the footer and the home page's structured data for search engines.
  social: {
    github: "https://github.com/RecompAchievements-org",
    discord: "https://discord.gg/8pYJtzvN5j",
    reddit: "https://www.reddit.com/user/RecompAchievements/",
    youtube: "https://www.youtube.com/@RecompAchievements",
  },
} as const;
