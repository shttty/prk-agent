import type { UiContext, RuntimeSettingsList, SettingsSubmenu } from "../ui-types.ts";
import type { SettingItem } from "@earendil-works/pi-tui";
import { publish } from "../publication/publish-revision.ts";
import { disposeComponent } from "./dispose-component.ts";

export function closeSettingsSubmenu(ctx: UiContext, settings: RuntimeSettingsList, item: SettingItem, owner: SettingsSubmenu, selectedValue?: string, options?: { navigateTo?: string }) {
        if (owner.closed) return;
        owner.closed = true;
        ctx.settingsSubmenus.delete(settings);
        try {
          if (selectedValue !== undefined) { settings.updateValue(item.id, selectedValue); settings.onChange?.(item.id, selectedValue); }
          if (options?.navigateTo) settings.selectItem(options.navigateTo);
        } finally { disposeComponent(ctx, owner.component); publish(ctx); }
      }
