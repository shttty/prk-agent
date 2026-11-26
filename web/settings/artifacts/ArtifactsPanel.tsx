import type { FormEvent } from "react";
import type { PageActions } from "../../shell/page/page-types.ts";
import type { ArtifactForm, ArtifactList } from "./artifact-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { formatArtifactBytes as bytes } from "./format-artifact-bytes.ts";
import { useState } from "react";
import { useRef } from "react";
import { useCallback } from "react";
import { useEffect } from "react";
import { Stack } from "@mantine/core";
import { Group } from "@mantine/core";
import { Button } from "@mantine/core";
import InlineAlert from "../../design-system/inline-alert/InlineAlert.tsx";
import { TextInput } from "@mantine/core";
import { NativeSelect } from "@mantine/core";
import { FileInput } from "@mantine/core";
import { Text } from "@mantine/core";
import { Badge } from "@mantine/core";
import { Modal } from "@mantine/core";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { useRelink } from "../list-page/use-relink.ts";
import { LinkWait } from "../list-page/LinkWait.tsx";
import "./artifacts.css";
const EMPTY_FORM: ArtifactForm = { name: "", version: "", platform: "x86_64", sha256: "" };

export default function ArtifactsPanel({ actions }: { actions: PageActions }) {
  const [data, setData] = useState<ArtifactList | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState<ArtifactForm>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [deletion, setDeletion] = useState<{ name: string; version: string } | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useRelink(() => setAttempt((value) => value + 1), waiting);
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    const current = ++generation.current;
    setBusy(true);
    actions.api.get<ArtifactList>("/artifacts").then((result) => {
      if (current === generation.current) { setData(result); setWaiting(false); }
    }).catch((cause: unknown) => {
      if (current !== generation.current) return;
      if (isConnectionFailure(cause)) setWaiting(true);
      else setError(toFailure(cause).message);
    }).finally(() => { if (current === generation.current) setBusy(false); });
    return invalidate;
  }, [actions, invalidate, attempt]);

  const mutate = async (operation: () => Promise<ArtifactList>, after?: () => void) => {
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const result = await operation();
      if (current !== generation.current) return;
      setData(result); after?.();
    } catch (cause) {
      if (current === generation.current) setError(pageErrorMessage(cause));
    } finally { if (current === generation.current) setBusy(false); }
  };
  const upload = (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const query = new URLSearchParams({ name: form.name, version: form.version, platform: form.platform, ...(form.sha256 ? { sha256: form.sha256 } : {}) });
    void mutate(() => actions.api.upload<ArtifactList>(`/artifacts/upload?${query}`, file), () => { setUploading(false); setFile(null); setForm(EMPTY_FORM); });
  };
  const field = (key: keyof ArtifactForm) => ({ value: form[key], onChange: (event: { currentTarget: { value: string } }) => setForm({ ...form, [key]: event.currentTarget.value }) });

  return <Stack id="artifacts-manager" gap="lg" aria-busy={busy}>
    <Group justify="space-between" gap="xs" className="artifacts-toolbar">
      <h3 className="artifacts-heading">远程工具</h3>
      <Button id="artifacts-open-upload" size="xs" variant="default" disabled={busy} onClick={() => setUploading(!uploading)}>上传新版本</Button>
    </Group>
    {waiting && !data ? <LinkWait /> : null}
    {error && !deletion ? <InlineAlert id="artifacts-error" size="sm">{error}</InlineAlert> : null}
    {uploading ? <form id="artifacts-upload-form" onSubmit={upload}>
      <Stack gap="sm">
        <div className="artifacts-form-grid">
          <TextInput id="artifact-name" label="工具名" required {...field("name")} />
          <TextInput id="artifact-version" label="版本号" required {...field("version")} />
          <NativeSelect id="artifact-platform" label="平台" data={[{ value: "x86_64", label: "Linux · x86_64" }, { value: "aarch64", label: "Linux · aarch64" }]} {...field("platform")} />
          <FileInput id="artifact-file" label="文件" required value={file} onChange={setFile} clearable />
        </div>
        <TextInput id="artifact-sha256" label="期望 SHA256" placeholder="可选" {...field("sha256")} />
        <Group justify="space-between" gap="xs">
          {data ? <Text size="xs" c="dimmed">上限 {bytes(data.maxUploadBytes)}</Text> : <span />}
          <Group gap="xs"><Button id="artifacts-cancel-upload" size="xs" variant="subtle" disabled={busy} onClick={() => setUploading(false)}>取消</Button><Button id="artifacts-upload" size="xs" type="submit" loading={busy} disabled={!file}>上传</Button></Group>
        </Group>
      </Stack>
    </form> : null}
    {data && Object.keys(data.tools).length === 0 ? <Text id="artifacts-empty" c="dimmed" size="sm">暂无远程工具。</Text> : null}
    <div className="artifacts-tools">
      {Object.entries(data?.tools || {}).sort(([a], [b]) => a.localeCompare(b)).map(([name, tool]) => <section key={name} className="artifact-tool" data-artifact-tool={name} data-current={tool.current}>
        <header className="artifact-tool-header">
          <h4>{name}</h4>
          <NativeSelect data-action="artifact-current" aria-label={`${name} 当前版本`} value={tool.current} disabled={busy} data={Object.keys(tool.versions)} onChange={(event) => { const version = event.currentTarget.value; void mutate(() => actions.api.post("/artifacts/current", { name, version })); }} />
        </header>
        {Object.entries(tool.versions).map(([version, entry]) => <div key={version} className="artifact-version" data-artifact-version={version} data-current={String(version === tool.current)}>
          <div className="artifact-version-header">
            <Group gap="xs"><span className="artifact-version-name">{version}</span>{version === tool.current ? <Badge size="xs" variant="light" color="gray">当前</Badge> : null}</Group>
            {version !== tool.current ? <Button data-action="artifact-delete" size="compact-xs" variant="subtle" color="red" disabled={busy} onClick={() => { setError(""); setDeletion({ name, version }); }}>删除</Button> : null}
          </div>
          {Object.entries(entry.platforms).map(([platform, asset]) => <div key={platform} className="artifact-platform" data-artifact-platform={platform} data-sha256={asset.sha256}>
            <span>{platform}</span><code title={asset.sha256}>{asset.sha256.slice(0, 12)}</code><span className="artifact-size">{bytes(asset.size)}</span>
            <time dateTime={asset.addedAt}>{new Date(asset.addedAt).toLocaleDateString()}</time>
          </div>)}
        </div>)}
      </section>)}
    </div>
    <Modal id="artifacts-delete-dialog" opened={Boolean(deletion)} onClose={() => { if (!busy) setDeletion(null); }} title="删除版本" centered size="sm">
      <Stack gap="md">
        <Text size="sm">{deletion?.name} · {deletion?.version}</Text>
        <Text size="sm" c="dimmed">未被其他版本引用的文件会一并删除。</Text>
        {error ? <InlineAlert size="sm">{error}</InlineAlert> : null}
        <Group justify="flex-end"><Button id="artifacts-cancel-delete" variant="default" disabled={busy} onClick={() => setDeletion(null)}>取消</Button><Button id="artifacts-confirm-delete" color="red" loading={busy} onClick={() => void mutate(() => actions.api.post("/artifacts/delete", deletion), () => setDeletion(null))}>删除</Button></Group>
      </Stack>
    </Modal>
  </Stack>;
}
