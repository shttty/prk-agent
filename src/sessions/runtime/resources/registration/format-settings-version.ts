export function registrationSettingsVersion(source: string | undefined): string {
  const settings = source === undefined ? {} : JSON.parse(source);
  return JSON.stringify([settings.packages, settings.extensions, settings.skills]);
}
