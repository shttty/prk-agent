import { createContext, useContext, type Dispatch, type SetStateAction } from "react";
import type { ThemeEntry, ThemeLibrary } from "../../../src/gateway/wire/web-types.ts";

/** The Gateway call the provider makes; settings pages call the other /themes/* routes on the same `api`. */
export type ThemeApi = { post: (path: "/themes/list") => Promise<ThemeLibrary> };

export type ThemeLibraryState = {
  api: ThemeApi;
  themes: ThemeEntry[];
  setThemes: Dispatch<SetStateAction<ThemeEntry[]>>;
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: ThemeEntry | undefined;
  refresh: () => Promise<void>;
  error: string;
};

export const ThemeLibraryContext = createContext<ThemeLibraryState | null>(null);

export const useThemeLibrary = () => useContext(ThemeLibraryContext);
