import { useRef } from "react";
import { useState } from "react";
import { useCallback } from "react";
import { addAttachments } from "./add-attachments.js";
import { attachmentAccept } from "./attachment-accept.js";
/**
 * `attachments` is the list this field owns and `onChange` receives its next value. Returns `add(files, replaceAt)`
 * for paste/drop, `open(replaceAt)` to raise the file picker, `inputProps` for the hidden `<input>` and `error` (the
 * last refusal, "" when fine).
 */
export function useAttachmentInput({ attachments, onChange, limits }) {
  const inputRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [error, setError] = useState("");
  const add = useCallback(async (files, replaceAt = null) => {
    if (!Array.from(files || []).length) return;
    try {
      onChange(await addAttachments(attachments, files, limits, { replaceAt }));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "附件读取失败。"); }
  }, [attachments, limits, onChange]);
  const open = (index = null) => {
    setReplaceIndex(index);
    inputRef.current?.click();
  };
  const inputProps = {
    ref: inputRef,
    type: "file",
    hidden: true,
    multiple: true,
    accept: attachmentAccept(limits),
    onChange: (event) => {
      const replaceAt = replaceIndex;
      setReplaceIndex(null);
      void add(event.target.files, replaceAt);
      event.target.value = "";
    },
  };
  return { add, open, inputProps, error };
}
