import React from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@fontsource-variable/figtree/wght.css";
import "@fontsource-variable/noto-sans-sc/wght.css";
import "@fontsource-variable/fraunces/wght-italic.css";
import "@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-Regular/result.css";
import "@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-Italic/result.css";
import "@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-Bold/result.css";
import "@chinese-fonts/maple-mono-cn/dist/MapleMono-CN-BoldItalic/result.css";
import "./design-system/tokens/fonts.css";
import "lxgw-wenkai-screen-webfont/lxgwwenkaigbscreen.css";
import App from "./shell/page/App.jsx";
import { createWorkbenchStore } from "./workbench/store/assemble-workbench-store.js";
import ThemeProvider from "./design-system/theme/ThemeProvider.jsx";
import { WorkbenchContext } from "./workbench/subscription/workbench-context.js";
import "./design-system/tokens/tokens.css";
import "./design-system/element-styles/element-styles.css";
const store = createWorkbenchStore();
createRoot(document.getElementById("root")).render(
  <ThemeProvider api={store.actions.api}>
    <WorkbenchContext.Provider value={store}><App store={store} /></WorkbenchContext.Provider>
  </ThemeProvider>,
);
