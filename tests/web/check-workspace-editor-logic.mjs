import { fakeApi } from "./workspace-editor-logic/fake-api.mjs";
import { checkLayoutAndPaths } from "./workspace-editor-logic/check-layout-and-paths.mjs";
import { checkFilesAndDirtyState } from "./workspace-editor-logic/check-files-and-dirty-state.mjs";
import { checkStorageAndLayerRegistries } from "./workspace-editor-logic/check-storage-and-layer-registries.mjs";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DIFF_COMPONENT } from "../../web/workspace/editor-layout/editor-layout-constants.js";
import { FILE_COMPONENT } from "../../web/workspace/editor-layout/editor-layout-constants.js";
import { editorLayoutKey } from "../../web/workspace/editor-layout/editor-layout-key.js";
import { findPanelByPath } from "../../web/workspace/editor-layout/find-panel-by-path.js";
import { mergeSavedLayout } from "../../web/workspace/editor-layout/merge-saved-layout.js";
import { panelsWithin } from "../../web/workspace/editor-layout/panels-within.js";
import { parseSavedLayout } from "../../web/workspace/editor-layout/parse-saved-layout.js";
import { placementFor } from "../../web/workspace/editor-layout/placement-for.js";
import { renameChanges } from "../../web/workspace/editor-layout/rename-changes.js";
import { savedPaths } from "../../web/workspace/editor-layout/saved-paths.js";
import { serializeLayout } from "../../web/workspace/editor-layout/serialize-layout.js";
import { pathItems } from "../../web/workspace/file-paths/path-items.js";
import { remapPath } from "../../web/workspace/file-paths/remap-path.js";
import { visibleEntries } from "../../web/workspace/file-paths/visible-entries.js";
import { within } from "../../web/workspace/file-paths/within.js";
import { createFileStore } from "../../web/workspace/file-store/assemble-file-store.js";

const ctx = {
  fakeApi: (...args) => fakeApi(ctx, ...args),

};
await checkLayoutAndPaths(ctx);
await checkFilesAndDirtyState(ctx);
await checkStorageAndLayerRegistries(ctx);

