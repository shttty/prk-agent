import { join } from "node:path";
import { writePluginDirectory } from "./write-plugin-directory.mjs";

const UI_NAME = "@prk-tests/remote-ui";
// The command reports the executing PID and the answer of a ctx.ui dialog, proving where the handler really ran.
const COMMAND_SOURCE = `export default function pluginUiProbe(pi) {
  pi.registerCommand("plugin_ui_probe", { description: "Report the executing process", handler: async (args, ctx) => {
    const answer = await ctx.ui.confirm("plugin_ui_probe", String(process.pid));
    ctx.ui.notify(\`PLUGIN_UI_PROBE:\${process.pid}:\${args}:\${answer}\`, "info");
  } });
}
`;

// Owned local-directory packages: the remote UI fixture (seeded on the session host) and a command probe (installed
// through the page). Provider ownership is checked separately on a really bootstrapped Gateway.
export async function preparePluginDirectories(root) {
  const directory = join(root, "plugin-directories");
  const ui = { name: UI_NAME, source: await writePluginDirectory(join(directory, "remote-ui"), { name: UI_NAME, fixture: "remote-extension-ui.mjs" }) };
  const command = { source: await writePluginDirectory(join(directory, "command-probe"), { name: "@prk-tests/plugin-ui-probe", source: COMMAND_SOURCE }) };
  const upgradeUi = () => writePluginDirectory(ui.source, { name: UI_NAME, version: "2.0.0", fixture: "remote-extension-ui.mjs" });
  const settingsPackages = [{ source: ui.source, enabled: true, location: "host" }];
  return { ui, command, upgradeUi, settingsPackages };
}
