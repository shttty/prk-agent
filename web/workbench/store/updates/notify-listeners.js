
export function notifyListeners(ctx) {
    for (const listener of [...ctx.listeners]) listener();
  }

