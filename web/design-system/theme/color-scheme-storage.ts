import { localStorageColorSchemeManager } from "@mantine/core";

/** Where Mantine keeps the light/dark choice (the MantineProvider `colorSchemeManager` prop). */
export const colorSchemeStorage = localStorageColorSchemeManager({ key: "pi-session-theme" });
