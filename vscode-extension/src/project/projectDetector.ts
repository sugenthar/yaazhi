/**
 * Project detection: walk upward from the active file to find yazhi.toml
 * or திட்டம்.json, then resolve the entry point. No vscode imports.
 */
import { MANIFEST_NAMES, DEFAULT_ENTRIES } from "../constants";
import { joinPath, walkUp, isSubPath } from "../utils/paths";
import { parseManifestJson } from "./projectConfig";

export interface ProjectDeps {
  exists: (p: string) => boolean;
  readFile: (p: string) => string | null;
  workspaceFolders: string[];
}

export interface DetectedProject {
  /** Directory containing the manifest. */
  root: string;
  /** Manifest file path. */
  manifest: string;
  /** Project display name (manifest `name` or directory name). */
  name: string;
  /** Absolute entry-point file, or null when it cannot be resolved. */
  entry: string | null;
}

/** Find the nearest ancestor directory (of `startPath`) holding a manifest. */
export function findProjectRoot(startPath: string, deps: ProjectDeps): { root: string; manifest: string } | null {
  for (const dir of walkUp(startPath)) {
    for (const manifestName of MANIFEST_NAMES) {
      const candidate = joinPath(dir, manifestName);
      if (deps.exists(candidate)) return { root: dir, manifest: candidate };
    }
    // Stop at the workspace root: never search the user's wider machine.
    const outsideAll = deps.workspaceFolders.length > 0 &&
      !deps.workspaceFolders.some((ws) => ws === dir || isSubPath(ws, dir));
    if (outsideAll) break;
  }
  return null;
}

/** Resolve the entry file for a project root + parsed manifest. */
export function resolveEntry(root: string, manifest: { entry?: string } | null, exists: (p: string) => boolean): string | null {
  if (manifest?.entry) {
    const entryPath = joinPath(root, manifest.entry);
    if (exists(entryPath)) return entryPath;
    return null;
  }
  for (const name of DEFAULT_ENTRIES) {
    const candidate = joinPath(root, name);
    if (exists(candidate)) return candidate;
  }
  return null;
}

/**
 * Detect the Yaazhi project for `startPath`.
 * Returns null when no manifest is found (callers must show
 * "Could not find yazhi.toml." instead of guessing).
 */
export function detectProject(startPath: string, deps: ProjectDeps): DetectedProject | null {
  const found = findProjectRoot(startPath, deps);
  if (!found) return null;
  const content = deps.readFile(found.manifest);
  const manifest = content !== null ? parseManifestJson(content) : null;
  const entry = resolveEntry(found.root, manifest, deps.exists);
  const name = manifest?.name ?? found.root.split(/[/\\]/).filter(Boolean).pop() ?? found.root;
  return { root: found.root, manifest: found.manifest, name, entry };
}
