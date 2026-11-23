import assert from "node:assert/strict";
import test from "node:test";
import { webCommands } from "../../../../web/chat/composer/commands/web-commands.js";
import { commandRedirect } from "../../../../web/chat/composer/commands/command-redirect.js";
import { selectCandidate } from "../../../../web/chat/composer/select-command.js";
import { handleInputKeyDown } from "../../../../web/chat/composer/handle-input-key-down.js";
import { composerMode } from "../../../../web/chat/composer/composer-mode.js";

const catalogCommands = [
  { name: "compact", source: "builtin", availability: { enabled: false }, arguments: [{ name: "instructions" }] },
  { name: "model", source: "builtin", availability: { enabled: true } },
  { name: "login", source: "builtin", availability: { enabled: false } },
  { name: "skill:enabled-skill", source: "skill", description: "run skill", availability: { enabled: true } },
  { name: "skill:disabled-by-setting", source: "skill", description: "off", availability: { enabled: false } },
  { name: "review-template", source: "template", description: "template", availability: { enabled: false } },
  { name: "ext-cmd", source: "extension", description: "extension", availability: { enabled: false } },
];

test("slash menu lists compact, templates, extensions and enabled skills regardless of session state", () => {
  const visible = webCommands(catalogCommands);
  assert.deepEqual(
    visible.map((entry) => entry.name),
    ["compact", "skill:enabled-skill", "review-template", "ext-cmd"],
  );
  for (const entry of visible) assert.equal(entry.unavailableReason, undefined);
});

test("commandRedirect never blocks advertised Web commands even when catalog marks them disabled", () => {
  assert.equal(commandRedirect(catalogCommands, "compact"), null);
  assert.equal(typeof commandRedirect(catalogCommands, "model"), "string");
  assert.equal(typeof commandRedirect(catalogCommands, "login"), "string");
});

test("selecting and keyboard-navigating slash candidates works without availability gating", () => {
  const visible = webCommands(catalogCommands).map((entry) => ({ ...entry, prefix: "/" }));
  let draft = "/";
  let index = 0;
  let dismissed = true;
  selectCandidate({
    setComposerText: (next) => { draft = next; },
    setCandidateIndex: (next) => { index = next; },
    setPopupDismissed: (next) => { dismissed = next; },
  }, visible[0]);
  assert.equal(draft, "/compact ");
  assert.equal(index, 0);
  assert.equal(dismissed, false);

  let prevented = false;
  handleInputKeyDown({
    composingRef: { current: false },
    composition: false,
    referenceMenuOpen: false,
    popupDismissed: false,
    commandMenuOpen: true,
    candidateOptions: visible,
    candidateIndex: 0,
    setCandidateIndex: (next) => { index = next; },
    selectCandidate: () => {},
  }, { key: "ArrowDown", preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(index, 1);
});

test("composerMode does not mark an active slash command with arguments as unknown", () => {
  const activeMode = composerMode({
    normalizedComposerText: "/compact keep conclusions",
    candidateOptions: [],
    activeCommand: { name: "compact" },
    composerText: "/compact keep conclusions",
    plainSendAvailable: false,
    queue: "steer",
  });
  assert.equal(activeMode.unknownControl, false);
  assert.equal(activeMode.plainSuggested, false);

  const unknownMode = composerMode({
    normalizedComposerText: "/nosuchcommand",
    candidateOptions: [],
    activeCommand: null,
    composerText: "/nosuchcommand",
    plainSendAvailable: false,
    queue: "steer",
  });
  assert.equal(unknownMode.unknownControl, true);
  assert.equal(unknownMode.plainSuggested, true);
});
