export const DESCRIPTION = `Describe a plugin's JSON config file so PRK's settings can show it as a form, or read back what is stored.
WHEN: after installing a Pi plugin package, or when the user asks how to configure a plugin: read its README/docs first, then call set once with every setting the docs describe.
set: {action:"set", provider, file, sections:[{title, fields:[{key, label, type, default?, options?, description?, secret?}]}]}. provider = the package name shown in PRK's tool settings; file = absolute path of the plugin's JSON config on the Gateway host (it may not exist yet). key is a dot path into that JSON; type is string|number|boolean|select|list (select needs options); mark API keys/tokens/passwords secret:true. Write labels/descriptions in the user's language. A new set replaces the provider's previous description.
get: {action:"get", provider} returns the stored description and current values (secrets masked).
This only describes the file; it never changes plugin values. Plugins pick up value changes after a session reload or Gateway restart.`;

export const PLUGIN_CONFIG_TOOL_METADATA = { name: "plugin_config", description: DESCRIPTION };
