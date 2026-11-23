import { createContext } from "react";
import { useContext } from "react";
export const ThemeLibraryContext = createContext(null);

export const useThemeLibrary = () => useContext(ThemeLibraryContext);

