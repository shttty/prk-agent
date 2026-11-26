import type { PageApi } from "../../shell/page/page-types.ts";
import type { MemoryDeletion, MemoryEditor, MemoryListing } from "./memory-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { useRelink } from "../list-page/use-relink.ts";

/**
 * The memory listing and its edits through `/api/memory/*`. `editor` and `deletion` hold the document scope
 * (`target`, `instance`, `project`) plus `old_text` when an existing entry is replaced or removed.
 */
export function useMemoryListing(api: PageApi) {
  const [listing, setListing] = useState<MemoryListing>({ enabled: true, layers: [], memories: [] });
  const [editor, setEditor] = useState<MemoryEditor | null>(null);
  const [deletion, setDeletion] = useState<MemoryDeletion | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const reload = useCallback(() => {
    const current = ++generation.current;
    setBusy(true);
    api.post<MemoryListing>("/memory/list", {}).then((result) => {
      if (current === generation.current) { setListing(result); setWaiting(false); }
    }).catch((cause: unknown) => {
      if (current !== generation.current) return;
      if (isConnectionFailure(cause)) setWaiting(true);
      else setError(toFailure(cause).message);
    }).finally(() => { if (current === generation.current) setBusy(false); });
  }, [api]);
  useEffect(() => {
    setEditor(null); setDeletion(null); setError("");
    reload();
    return invalidate;
  }, [reload, invalidate]);
  useRelink(reload, waiting);

  const mutate = async (path: string, request: object) => {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const result = await api.post<MemoryListing>(path, request);
      if (current !== generation.current) return;
      setListing(result); setEditor(null); setDeletion(null);
    } catch (cause) {
      if (current === generation.current) setError(pageErrorMessage(cause));
    } finally { if (current === generation.current) setBusy(false); }
  };
  const save = () => {
    if (!editor) return;
    const { target, old_text, content, ...scope } = editor;
    const operation = old_text === undefined ? { target, action: "add", content } : { target, action: "replace", content, old_text };
    void mutate("/memory/change", { ...scope, operations: [operation] });
  };
  const remove = () => {
    if (!deletion) return;
    const { old_text, target, ...scope } = deletion;
    void mutate(old_text === undefined ? "/memory/delete-instance" : "/memory/change", old_text === undefined
      ? { instance: scope.instance, confirm: true }
      : { ...scope, operations: [{ target, action: "remove", old_text }] });
  };
  return { listing, busy, error, waiting, setError, editor, setEditor, deletion, setDeletion, reload, save, remove };
}
