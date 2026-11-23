import { useCallback } from "react";
import { useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { useContext } from "react";
import { WorkbenchContext } from "../../workbench/subscription/workbench-context.js";
import { Loader } from "@mantine/core";
import { buildDerivationPayload } from "./build-derivation-payload.js";
import { DerivationDefaultsSection } from "./DerivationDefaultsSection.jsx";
import { DerivationRoleEditor } from "./DerivationRoleEditor.jsx";
import { DerivationRolesSection } from "./DerivationRolesSection.jsx";
import "./subsessions.css";

const FALLBACK_DEFAULTS = {
  defaultToolMode: "code",
  defaultIsolated: false,
  maxDepth: 3,
  defaultInstructions:
    "Your parent already planned the overall work; you own only this piece. Do it directly unless your role or assignment explicitly calls for further sessions.",
  roles: {},
};

function draftFromDerivation(derivation, defaults) {
  return {
    defaultToolMode: derivation?.defaultToolMode === "code" || derivation?.defaultToolMode === "direct" ? derivation.defaultToolMode : "",
    defaultIsolated: Boolean(derivation?.defaultIsolated ?? defaults?.defaultIsolated ?? false),
    maxDepth: Number.isInteger(derivation?.maxDepth) ? derivation.maxDepth : (defaults?.maxDepth ?? 3),
    defaultInstructions: typeof derivation?.defaultInstructions === "string"
      ? derivation.defaultInstructions
      : (defaults?.defaultInstructions ?? FALLBACK_DEFAULTS.defaultInstructions),
  };
}

export default function SubsessionSettings({ actions }) {
  const store = useContext(WorkbenchContext);
  const [defaults, setDefaults] = useState(FALLBACK_DEFAULTS);
  const [draft, setDraft] = useState(() => draftFromDerivation(null, FALLBACK_DEFAULTS));
  const [roles, setRoles] = useState({});
  // Only the initial list: the page loads its own catalog below.
  const [models, setModels] = useState(() => store.getSnapshot().modelCatalog?.value?.models || []);
  const [catalog, setCatalog] = useState(null);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; }, []);
  const applyResponse = useCallback((result) => {
    const nextDefaults = { ...FALLBACK_DEFAULTS, ...(result?.defaults || {}) };
    const nextDerivation = result?.derivation || {};
    setDefaults(nextDefaults);
    setDraft(draftFromDerivation(nextDerivation, nextDefaults));
    setRoles(nextDerivation.roles && typeof nextDerivation.roles === "object" ? { ...nextDerivation.roles } : {});
  }, []);

  useEffect(() => {
    const current = ++generation.current;
    setLoading(true);
    setError("");
    Promise.all([
      actions.api.get("/derivation"),
      actions.api.get("/models").catch(() => null),
      actions.api.get("/capabilities").catch(() => null),
    ]).then(([derivationRes, modelsRes, capabilitiesRes]) => {
      if (current !== generation.current) return;
      applyResponse(derivationRes);
      if (Array.isArray(modelsRes?.models)) setModels(modelsRes.models);
      if (capabilitiesRes?.catalog) setCatalog(capabilitiesRes.catalog);
    }).catch((cause) => {
      if (current === generation.current) setError(cause?.message || "子会话设置读取失败。");
    }).finally(() => {
      if (current === generation.current) setLoading(false);
    });
    return invalidate;
  }, [actions, applyResponse, invalidate]);

  const persist = async (nextDraft, nextRoles, onSuccess) => {
    const current = generation.current;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const payload = buildDerivationPayload(nextDraft, nextRoles);
      const response = await actions.api.post("/derivation", { derivation: payload });
      if (current !== generation.current) return;
      applyResponse(response?.derivation ? response : { derivation: payload, defaults });
      onSuccess?.();
    } catch (cause) {
      if (current === generation.current) setError(cause?.message || "子会话设置保存失败。");
    } finally {
      if (current === generation.current) setSaving(false);
    }
  };

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
          const nextRoles = {};
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
