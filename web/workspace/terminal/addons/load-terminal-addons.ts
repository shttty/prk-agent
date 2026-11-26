import type { Terminal } from "@xterm/xterm";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { SearchAddon } from "@xterm/addon-search";
import { ImageAddon } from "@xterm/addon-image";

/** Loads the xterm addons every shell has: Unicode 11 widths (emoji, CJK), clickable URLs (opened in a new tab by the
 * addon's default handler), search, and inline images (Sixel, iTerm2 IIP, Kitty graphics; the Kitty part is alpha
 * upstream). Images draw on the addon's own 2D canvas layer over the DOM renderer, so no GPU / WebGL is needed.
 * Search highlights at most 100 matches, so a long log or one-line JSON never stalls the page on decorations. Returns
 * the search addon. */
export function loadTerminalAddons(terminal: Terminal) {
  terminal.loadAddon(new Unicode11Addon());
  terminal.unicode.activeVersion = "11";
  terminal.loadAddon(new WebLinksAddon());
  terminal.loadAddon(new ImageAddon({ sixelSupport: true, iipSupport: true, kittySupport: true }));
  const search = new SearchAddon({ highlightLimit: 100 });
  terminal.loadAddon(search);
  return search;
}
