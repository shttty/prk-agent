import type { Extension } from "@codemirror/state";
import { useState } from "react";
import { useEffect } from "react";
import { LanguageDescription } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
export function useLanguage(name: string) {
  const [extension, setExtension] = useState<Extension | null>(null);
  useEffect(() => {
    let live = true;
    setExtension(null);
    const description = LanguageDescription.matchFilename(languages, name);
    if (description) void description.load().then((support) => { if (live) setExtension(support); }).catch(() => {});
    return () => { live = false; };
  }, [name]);
  return extension;
}
