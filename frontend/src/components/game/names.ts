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

export const consoleName = (id: string) => consoleNames[id] ?? id;
export const platformName = (id: string) => platformNames[id] ?? id;
