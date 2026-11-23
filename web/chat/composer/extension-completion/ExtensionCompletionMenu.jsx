import { Box } from "@mantine/core";
import { stripAnsi } from "../../ansi/strip-ansi.js";
export function ExtensionCompletionMenu({ model }) {
  const { popupDismissed, extensionCompletion, extensionListRef, extensionIndex, setExtensionIndex, applyExtensionCompletion } = model;
  return (
    !popupDismissed && extensionCompletion?.items?.length ? <Box id="extension-autocomplete-list" ref={extensionListRef} className="pi-candidates pi-extension-candidates-menu" role="listbox">{extensionCompletion.items.map((item, index) => <button key={`${item.value}-${index}`} type="button" role="option" aria-selected={index === extensionIndex} className={index === extensionIndex ? "is-active" : undefined} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setExtensionIndex(index)} onClick={() => void applyExtensionCompletion(item)}><strong>{stripAnsi(item.label || item.value)}</strong>{item.description ? <span>{stripAnsi(item.description)}</span> : null}</button>)}</Box> : null
  );
}
