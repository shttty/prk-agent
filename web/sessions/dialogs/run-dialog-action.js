
export async function runDialogAction(action, onClose, setError, failureMessage, fallbackMessage) {
  try {
    const result = await action();
    if (result !== false) onClose();
    else setError(failureMessage);
  } catch (cause) {
    setError(cause instanceof Error ? cause.message : fallbackMessage);
  }
}
