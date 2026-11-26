import type { PageActions, WorkbenchState } from "../../shell/page/page-types.ts";
import type { CapabilityCatalog } from "../capabilities/capability-types.ts";
import type { DerivationDefaults, DerivationDraft, DerivationReply, ModelOption, RoleConfig, RoleEditorState } from "./subsession-types.ts";
import { toFailure } from "../../shell/page/to-failure.ts";
import { useCallback } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { useWorkbench } from "../../workbench/subscription/use-workbench.js";
import { Loader } from "@mantine/core";
import { buildDerivationPayload } from "./build-derivation-payload.ts";
import { DerivationDefaultsSection } from "./DerivationDefaultsSection.tsx";
import { DerivationRoleEditor } from "./DerivationRoleEditor.tsx";
import { DerivationRolesSection } from "./DerivationRolesSection.tsx";
import "./subsessions.css";
import { isConnectionFailure } from "../../workbench/store/requests/is-connection-failure.js";
import { pageErrorMessage } from "../../workbench/store/requests/page-error-message.js";
import { useRelink } from "../list-page/use-relink.ts";
import { LinkWait } from "../list-page/LinkWait.tsx";

const FALLBACK_DEFAULTS: DerivationDefaults = {
  defaultToolMode: "code",
  defaultIsolated: false,
  maxDepth: 3,
  defaultInstructions:
    "Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions.",
  roles: {},
};

function draftFromDerivation(derivation: DerivationReply["derivation"] | null, defaults: Partial<DerivationDefaults> | undefined): DerivationDraft {
  return {
    defaultToolMode: derivation?.defaultToolMode === "code" || derivation?.defaultToolMode === "direct" ? derivation.defaultToolMode : "",
    defaultIsolated: Boolean(derivation?.defaultIsolated ?? defaults?.defaultIsolated ?? false),
    maxDepth: derivation?.maxDepth !== undefined && Number.isInteger(derivation.maxDepth) ? derivation.maxDepth : (defaults?.maxDepth ?? 3),
    defaultInstructions: typeof derivation?.defaultInstructions === "string"
      ? derivation.defaultInstructions
      : (defaults?.defaultInstructions ?? FALLBACK_DEFAULTS.defaultInstructions),
  };
}

export default function SubsessionSettings({ actions }: { actions: PageActions; mobile?: boolean }) {
  const initialModels = useWorkbench((state: WorkbenchState) => state.modelCatalog?.value?.models);
  const [defaults, setDefaults] = useState(FALLBACK_DEFAULTS);
  const [draft, setDraft] = useState(() => draftFromDerivation(null, FALLBACK_DEFAULTS));
  const [roles, setRoles] = useState<Record<string, RoleConfig>>({});
  // Only the initial list: the page loads its own catalog below.
  const [models, setModels] = useState<ModelOption[]>(() => initialModels || []);
  const [catalog, setCatalog] = useState<CapabilityCatalog | null>(null);
  const [editor, setEditor] = useState<RoleEditorState | null>(null);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useRelink(() => setAttempt((value) => value + 1), waiting);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const applyResponse = useCallback((result: DerivationReply | null | undefined) => {
    const nextDefaults = { ...FALLBACK_DEFAULTS, ...(result?.defaults || {}) };
    const nextDerivation = result?.derivation || {};
    setDefaults(nextDefaults);
    setDraft(draftFromDerivation(nextDerivation, nextDefaults));
    setRoles(nextDerivation.roles ? { ...nextDerivation.roles } : {});
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    Promise.all([
      actions.api.get("/derivation"),
      actions.api.get("/models").catch(() => null),
      actions.api.get("/capabilities").catch(() => null),
    ]).then(([derivationRes, modelsRes, capabilitiesRes]: [DerivationReply, { models?: ModelOption[] } | null, { catalog?: CapabilityCatalog } | null]) => {
      if (current !== generation.current) return;
      applyResponse(derivationRes);
      setWaiting(false);
      if (Array.isArray(modelsRes?.models)) setModels(modelsRes.models);
      if (capabilitiesRes?.catalog) setCatalog(capabilitiesRes.catalog);
    }).catch((cause: unknown) => {
      if (current !== generation.current) return;
      if (isConnectionFailure(cause)) setWaiting(true);
      else setError(toFailure(cause).message || "子会话设置读取失败。");
    }).finally(() => {
      if (current === generation.current) setLoading(false);
    });
    return invalidate;
  }, [actions, applyResponse, invalidate, attempt]);

  const persist = async (nextDraft: DerivationDraft, nextRoles: Record<string, RoleConfig>, onSuccess?: () => void) => {
    const current = generation.current;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const payload = buildDerivationPayload(nextDraft, nextRoles);
      const response: DerivationReply = await actions.api.post("/derivation", { derivation: payload });
      if (current !== generation.current) return;
      applyResponse(response?.derivation ? response : { derivation: payload, defaults });
      onSuccess?.();
    } catch (cause) {
      if (current === generation.current && pageErrorMessage(cause)) setError(toFailure(cause).message || "子会话设置保存失败。");
    } finally {
      if (current === generation.current) setSaving(false);
    }
  };

  if (waiting) return <LinkWait />;
  if (loading) {
    return <div className="capability-loading" data-status="loading"><Loader size="sm" color="gray" /></div>;
  }

  if (editor) {
    return <div className="subsession-settings" aria-busy={saving}>
      <DerivationRoleEditor
        editor={editor}
        existingNames={Object.keys(roles)}
        models={models}
        catalog={catalog}
        busy={saving}
        saving={saving}
        error={error}
        onCancel={() => { setError(""); setEditor(null); }}
        onSave={(name, rolePayload, originalName) => {
          const nextRoles: Record<string, RoleConfig> = {};
          let replaced = false;
          for (const [key, value] of Object.entries(roles)) {
            if (originalName && key === originalName) {
              nextRoles[name] = rolePayload;
              replaced = true;
            } else {
              nextRoles[key] = value;
            }
          }
          if (!replaced) nextRoles[name] = rolePayload;
          void persist(draft, nextRoles, () => setEditor(null));
        }}
      />
    </div>;
  }

  return <div className="subsession-settings" aria-busy={saving}>
    <DerivationDefaultsSection
      draft={draft}
      defaults={defaults}
      busy={saving}
      saving={saving}
      saved={saved}
      error={error}
      onChange={(patch) => { setSaved(false); setError(""); setDraft((prev) => ({ ...prev, ...patch })); }}
      onSave={() => void persist(draft, roles, () => setSaved(true))}
    />
    <DerivationRolesSection
      roles={roles}
      builtinRoles={defaults.roles}
      busy={saving}
      error=""
      onAdd={() => { setSaved(false); setError(""); setEditor({ mode: "create", name: "", originalName: "", role: {} }); }}
      onEdit={(name) => { setSaved(false); setError(""); setEditor({ mode: "edit", name, originalName: name, role: roles[name] || {}, builtin: Object.hasOwn(defaults.roles, name) }); }}
      onDelete={(name) => {
        const nextRoles = { ...roles };
        delete nextRoles[name];
        void persist(draft, nextRoles);
      }}
    />
  </div>;
}
