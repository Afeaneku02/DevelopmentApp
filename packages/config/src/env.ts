// Guards process.env access so this also works when bundled for the browser
// (e.g. apps/web), where `process` is not defined.
export function getEnv(name: string, fallback: string): string {
  const value = typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
  return value && value.trim().length > 0 ? value : fallback;
}
