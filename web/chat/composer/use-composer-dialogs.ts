import { useState } from "react";
import type { ComposerCommand } from "./composer-types.ts";
export function useComposerDialogs() {
  const [helpCommand, setHelpCommand] = useState<ComposerCommand | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  return { helpCommand, setHelpCommand, shortcutsOpen, setShortcutsOpen };
}
