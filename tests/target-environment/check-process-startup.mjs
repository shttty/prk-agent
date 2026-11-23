import { checkStartup } from "./runtime-channel/check-startup.mjs";

console.log(JSON.stringify({ status: "PASS", ...await checkStartup("local") }));
