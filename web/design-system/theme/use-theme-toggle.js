import { useMantineColorScheme } from "@mantine/core";
import { useThemeLibrary } from "./use-theme-library.js";
// Light/dark toggle: leaves any selected color theme first. Called by the control that shows the toggle (Mantine's
// toggle changes identity on every render, so it is not passed down as a prop).
export function useThemeToggle() {
  const { toggleColorScheme } = useMantineColorScheme();
  const themeLibrary = useThemeLibrary();
  return () => { themeLibrary?.setSelectedId(""); toggleColorScheme(); };
}
