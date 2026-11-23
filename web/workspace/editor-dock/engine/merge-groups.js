
export function mergeGroups(ctx) {
      const [first, ...rest] = ctx.api.groups;
      if (!rest.length) return;
      const active = ctx.api.activePanel;
      for (const group of rest) group.api.moveTo({ group: first, position: "center", skipSetActive: true });
      active?.api.setActive();
    }
