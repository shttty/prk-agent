// Rebrand the embedded Pi SDK as "prk" (Pi's documented fork hook, `piConfig` in its own package.json).
// Effect: project-level dirs become `.prk/` instead of `.pi/`, and the agent-dir env var becomes
// PRK_CODING_AGENT_DIR. Runs as postinstall; the Gateway refuses to start if it was skipped.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PRK_PI_CONFIG = Object.freeze({ name: "prk", configDir: ".prk" });

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "node_modules", "@earendil-works", "pi-coding-agent", "package.json");
const text = readFileSync(path, "utf8");
const pkg = JSON.parse(text);
if (JSON.stringify(pkg.piConfig) !== JSON.stringify(PRK_PI_CONFIG)) {
  pkg.piConfig = { ...PRK_PI_CONFIG };
  writeFileSync(path, `${JSON.stringify(pkg, null, "\t")}\n`);
  console.log(`patched ${path}: piConfig = ${JSON.stringify(PRK_PI_CONFIG)}`);
}

// TEMPORARY: teach pi-ai's shared Google helpers (used by google-generative-ai and google-vertex)
// Gemini API values that @earendil-works/pi-ai 1.6.0 still rejects. Each group is skipped once its
// marker is present, so remove a group when a released pi-ai handles it natively.
// src/application/sdk-brand/assert-google-patches.ts refuses to start the Gateway if any is missing.
const googleSharedPath = join(root, "node_modules", "@earendil-works", "pi-ai", "dist", "api", "google-shared.js");
const googleSharedPatches = [
  {
    // Gemini 4 Hydrogen's "xhigh" level: the resolver whitelists minimal..high and throws before the
    // request. @google/genai 2.32 has no ThinkingLevel.XHIGH, but passes thinkingConfig through
    // unvalidated, so the literal "XHIGH" is the wire value.
    label: 'allow Google thinking level "xhigh"',
    marker: '"xhigh"',
    edits: [
      [
        "    HIGH: GoogleSdkThinkingLevel.HIGH,\n};",
        '    HIGH: GoogleSdkThinkingLevel.HIGH,\n    XHIGH: "XHIGH",\n};',
      ],
      [
        '        case "high":\n            return resolvedLevel;',
        '        case "high":\n        case "xhigh":\n            return resolvedLevel;',
      ],
      [
        '        case "high":\n            return "HIGH";',
        '        case "high":\n            return "HIGH";\n        case "xhigh":\n            return "XHIGH";',
      ],
    ],
  },
  {
    // Unhandled finish reasons still throw and kill the turn. Treat them as errors and keep
    // rawStopReason. Pi 1.6.0 handles CONTINUATION as length without this patch.
    label: "map unhandled Google finish reasons",
    marker: '"MALFORMED_RESPONSE"',
    edits: [
      [
        '        case FinishReason.NO_IMAGE:\n            return "error";',
        '        case FinishReason.NO_IMAGE:\n        case "MALFORMED_RESPONSE":\n        case "MISSING_THOUGHT_SIGNATURE":\n        case "ESCALATION":\n        case "PUP_LIMITED_DISABLED":\n        case "MODEL_ARMOR":\n            return "error";',
      ],
    ],
  },
];
let googleShared = readFileSync(googleSharedPath, "utf8");
const appliedGooglePatches = [];
for (const { label, marker, edits } of googleSharedPatches) {
  if (googleShared.includes(marker)) continue;
  for (const [from, to] of edits) {
    if (!googleShared.includes(from)) {
      throw new Error(`patch-pi: anchor for "${label}" not found in ${googleSharedPath}: ${JSON.stringify(from)}`);
    }
    googleShared = googleShared.replace(from, to);
  }
  appliedGooglePatches.push(label);
}
if (appliedGooglePatches.length > 0) {
  writeFileSync(googleSharedPath, googleShared);
  console.log(`patched ${googleSharedPath}: ${appliedGooglePatches.join("; ")}`);
}

// Approved PRK provider policy seam; reverify every anchor when upgrading Pi.
if (pkg.version !== "1.6.0") throw new Error(`Provider policy patch requires Pi 1.6.0; found ${pkg.version}`);
const sdk = join(dirname(path), "dist", "core");
function patchProviderFile(relative, edits) {
  const target = join(sdk, relative);
  let source = readFileSync(target, "utf8");
  for (const [before, after] of edits) {
    if (source.includes(after)) continue;
    if (!source.includes(before)) throw new Error(`patch-pi: provider policy anchor missing in ${target}: ${before}`);
    source = source.replace(before, after);
  }
  if (source !== readFileSync(target, "utf8")) writeFileSync(target, source);
}
const policyType = '(request: { providerId: string; extensionPath: string; source: string; operation: "register" | "unregister" }) => boolean | string';
patchProviderFile("resource-loader.d.ts", [["    extensionFactories?: InlineExtension[];", `    extensionFactories?: InlineExtension[];\n    /** PRK Pi 1.6.0 seam: true allows, false acknowledges, string reports a policy error. */\n    providerPolicy?: ${policyType};\n    providerOnly?: boolean;`]]);
patchProviderFile("extensions/loader.d.ts", [["createExtensionRuntime(): ExtensionRuntime;", `createExtensionRuntime(options?: { providerPolicy?: ${policyType}; providerOnly?: boolean }): ExtensionRuntime;`], ["Promise<Extension>;", "Promise<Extension | null>;"]]);
patchProviderFile("extensions/types.d.ts", [["export interface ExtensionRuntimeState {", `export interface ExtensionRuntimeState {\n    providerPolicy?: ${policyType};\n    providerOnly?: boolean;\n    providerPolicyErrors: Array<{ path: string; error: string; code: "PROVIDER_POLICY"; providerId: string; operation: "register" | "unregister" }>;\n    reportProviderPolicyError?: (error: ExtensionError) => void;`], ["        error: string;\n    }>;\n    warnings?", '        error: string;\n        code?: "PROVIDER_POLICY";\n        providerId?: string;\n        operation?: "register" | "unregister";\n    }>;\n    warnings?']]);
const checkPolicy = `    const pendingProviderChanges = [];
    let hasProvider = false;
    const applyProviderChange = (operation, providerId, change) => {
        const apply = () => {
            const decision = runtime.providerPolicy?.({ operation, providerId, extensionPath: extension.path });
            if (typeof decision === "string") {
                const diagnostic = { path: extension.path, error: decision, code: "PROVIDER_POLICY", providerId, operation };
                runtime.providerPolicyErrors.push(diagnostic);
                runtime.reportProviderPolicyError?.({ extensionPath: extension.path, event: "provider_policy", error: decision });
            }
            if (decision === false || typeof decision === "string") return;
            if (operation === "register") hasProvider = true;
            change();
        };
        if (state === "loading") pendingProviderChanges.push(apply);
        else apply();
    };
`;
patchProviderFile("extensions/loader.js", [
  ["export function createExtensionRuntime() {", "export function createExtensionRuntime(options = {}) {"],
  ["        pendingProviderRegistrations: [],", "        providerPolicy: options.providerPolicy,\n        providerOnly: options.providerOnly,\n        providerPolicyErrors: [],\n        pendingProviderRegistrations: [],"],
  ['    const applyRuntimeChange = (change) => {', `${checkPolicy}    const applyRuntimeChange = (change) => {`],
  ["        pendingFlagValues.clear();", "        pendingFlagValues.clear();\n        pendingProviderChanges.length = 0;"],
  ["applyRuntimeChange(() => runtime.registerProvider(providerOrName, config, extension.path));", 'applyProviderChange("register", providerOrName, () => runtime.registerProvider(providerOrName, config, extension.path));'],
  ["applyRuntimeChange(() => runtime.registerNativeProvider(providerOrName, extension.path));", 'applyProviderChange("register", providerOrName.id, () => runtime.registerNativeProvider(providerOrName, extension.path));'],
  ["applyRuntimeChange(() => runtime.unregisterProvider(name, extension.path));", 'applyProviderChange("unregister", name, () => runtime.unregisterProvider(name, extension.path));'],
  ["            runtime.assertActive();\n            for (const [name, value] of pendingFlagValues)", `            runtime.assertActive();
            for (const apply of pendingProviderChanges) apply();
            if (runtime.providerOnly && !hasProvider) {
                state = "failed";
                for (const unsubscribe of loadingUnsubscribers) unsubscribe();
                clearPending();
                return false;
            }
            for (const [name, value] of pendingFlagValues)`],
  ["        load.commit();", "        if (load.commit() === false) return null;"],
]);
const providerSource = 'this.resourceMetadataByPath?.get(request.extensionPath)?.origin === "package" ? this.resourceMetadataByPath.get(request.extensionPath).source : request.extensionPath';
const runtimeCreation = `createExtensionRuntime({ providerOnly: this.providerOnly, providerPolicy: this.providerPolicy && ((request) => this.providerPolicy({ ...request, source: ${providerSource} })) })`;
patchProviderFile("resource-loader.js", [
  ["        this.eventBus = options.eventBus ?? createEventBus();", "        this.eventBus = options.eventBus ?? createEventBus();\n        this.providerPolicy = options.providerPolicy;\n        this.providerOnly = options.providerOnly;"],
  ["loadExtensionsCached(extensionPaths, this.cwd, this.eventBus);", `loadExtensionsCached(extensionPaths, this.cwd, this.eventBus, ${runtimeCreation});`],
  ["loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime);", `loadExtensionsCached(paths.filter((path) => !isBuiltinPath(path)), this.cwd, this.eventBus, runtime ?? ${runtimeCreation});`],
  ["                extension.hidden = true;", "                if (!extension) continue;\n                extension.hidden = true;"],
  ["                extension.hidden = isNamed && input.hidden;", "                if (!extension) continue;\n                extension.hidden = isNamed && input.hidden;"],
  ["        this.extensionsResult = this.extensionsOverride ? this.extensionsOverride(extensionsResult) : extensionsResult;", `        const loadErrors = extensionsResult.errors;
        Object.defineProperty(extensionsResult, "errors", { enumerable: true, get: () => [...loadErrors, ...extensionsResult.runtime.providerPolicyErrors] });
        this.extensionsResult = this.extensionsOverride ? this.extensionsOverride(extensionsResult) : extensionsResult;`],
]);
patchProviderFile("extensions/runner.js", [["    bindCore(actions, contextActions, providerActions) {", '    bindCore(actions, contextActions, providerActions) {\n        this.runtime.reportProviderPolicyError = (error) => this.emitError(error);']]);
console.log("Pi 1.6.0 provider policy seam applied");
