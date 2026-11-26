import { Box } from "@mantine/core";
import { Text } from "@mantine/core";
import { Button } from "@mantine/core";
import InlineAlert from "../../../design-system/inline-alert/InlineAlert.tsx";
import type { ComposerModel } from "../composer-model-types.ts";
import { referenceAvailable } from "./reference-available.ts";
export function ReferenceMenu({ model }: { model: ComposerModel }) {
  const { referenceMenuOpen, referenceListRef, references, referenceCandidates, referenceIndex, setReferenceIndex, selectReference } = model;
  return (
    referenceMenuOpen ? <Box id="native-reference-list" ref={referenceListRef} className="pi-candidates pi-reference-candidates-menu" role="listbox" aria-label="目标文件引用候选" data-status={referenceCandidates.loading ? "loading" : referenceCandidates.error ? "error" : references.length ? "ready" : "empty"}>
                {referenceCandidates.loading ? <Text size="xs" c="dimmed">正在查找目标文件…</Text>
                  : referenceCandidates.error ? <InlineAlert id="native-reference-error" data-reason={referenceCandidates.error.reason}>{referenceCandidates.error.text}</InlineAlert>
                  : references.length ? references.map((reference, index) => <Button key={`${reference.path || reference.name || index}`} id={`native-reference-option-${index}`} className={index === referenceIndex ? "is-active" : undefined} variant="subtle" size="compact-sm" type="button" role="option" aria-selected={index === referenceIndex} aria-disabled={!referenceAvailable(reference) || undefined} data-path={reference.path} data-kind={reference.navigable === true ? "directory" : reference.selectable === true ? "file" : "other"} onMouseDown={(event) => event.preventDefault()} onMouseMove={() => { if (referenceAvailable(reference)) setReferenceIndex(index); }} onClick={() => selectReference(reference)}><strong>@{reference.name || reference.path}{reference.navigable === true ? "/" : ""}</strong><span>{referenceAvailable(reference) ? "" : "不可引用"}</span></Button>)
                  : <Text size="xs" c="dimmed">没有匹配的目标文件引用。</Text>}
                {!referenceCandidates.loading && !referenceCandidates.error && referenceCandidates.truncated ? <Text id="native-reference-truncated" size="xs" c="dimmed" data-state="truncated">目录过大，只列出部分条目。</Text> : null}
              </Box> : null
  );
}
