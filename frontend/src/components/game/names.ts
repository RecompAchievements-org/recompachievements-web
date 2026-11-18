// Console and platform names are brand names, shown untranslated in every language.
const consoleNames: Record<string, string> = {
  n64: "Nintendo 64",
  gamecube: "GameCube",
  wii: "Wii",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
  ps3: "PlayStation 3",
  ps4: "PlayStation 4",
  xbox: "Xbox",
  xbox360: "Xbox 360",
};

const platformNames: Record<string, string> = {
  windows: "Windows",
  linux: "Linux",
  macos: "macOS",
  steam_deck: "Steam Deck",
};

// Brand family of each original console, for its color.
export type ConsoleFamily = "playstation" | "nintendo" | "xbox";
const consoleFamilies: Record<string, ConsoleFamily> = {
  n64: "nintendo",
  gamecube: "nintendo",
  wii: "nintendo",
  ps1: "playstation",
  ps2: "playstation",
  ps3: "playstation",
  ps4: "playstation",
  xbox: "xbox",
  xbox360: "xbox",
};

export const consoleName = (id: string) => consoleNames[id] ?? id;
export const consoleFamily = (id: string): ConsoleFamily | undefined => consoleFamilies[id];
export const platformName = (id: string) => platformNames[id] ?? id;
