/**
 * Yaazhi project manifest handling.
 * Verified behavior (native Yaazhi project loader): the manifest file
 * (திட்டம்.json or yazhi.toml) is parsed as JSON with optional
 * `name` (string) and `entry` (string) keys.
 * No vscode imports — safe for unit tests.
 */

export interface ProjectManifest {
  name?: string;
  entry?: string;
}

/** Parse manifest JSON. Returns null when content is not a valid manifest. */
export function parseManifestJson(content: string): ProjectManifest | null {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return null;
  const record = data as Record<string, unknown>;
  const manifest: ProjectManifest = {};
  if (typeof record["name"] === "string") manifest.name = record["name"];
  if (typeof record["entry"] === "string") manifest.entry = record["entry"];
  return manifest;
}
