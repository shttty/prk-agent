import { useState } from "react";
export function useComposerDialogs() {
  const [helpCommand, setHelpCommand] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  return { helpCommand, setHelpCommand, shortcutsOpen, setShortcutsOpen };
}
