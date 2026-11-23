import { useLocalStorage } from "@mantine/hooks";
import { TERMINAL_FONT_SIZE } from "../terminal-constants.js";

const { initial, min, max, key } = TERMINAL_FONT_SIZE;
const deserialize = (text) => { const size = Number(text); return Number.isInteger(size) && size >= min && size <= max ? size : initial; };

/** The saved terminal font size `[size, setSize]` (px, shared by every shell and the settings field; invalid → default). */
export function useTerminalFontSize() {
  const [size, setSize] = useLocalStorage({ key, defaultValue: initial, getInitialValueInEffect: false, serialize: String, deserialize });
  return [size, setSize];
}
