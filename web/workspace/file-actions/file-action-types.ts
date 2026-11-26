import type { Icon } from "@tabler/icons-react";

export type FileActionId = "open" | "newFile" | "newFolder" | "upload" | "paste" | "rename" | "duplicate" | "copy" | "cut" | "copyPath" | "download" | "toggleHidden" | "refresh" | "delete";

/** How one action shows in the menu (and the phone sheet); `active*` replace them while the toggle is on. */
export type FileActionView = { label: string; short?: string; icon: Icon; danger?: boolean; activeLabel?: string; activeShort?: string; activeIcon?: Icon };
