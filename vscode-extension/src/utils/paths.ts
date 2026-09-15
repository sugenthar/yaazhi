/** Safe Windows/Unicode path helpers. No vscode imports. */
import * as fs from "fs";
import * as path from "path";
import { SOURCE_EXTENSION, LEGACY_EXTENSION } from "../constants";

function isWindowsStyle(p: string): boolean {
  const c = p.split(/[\\/]/)[0] ?? "";
  return /^[A-Za-z]:$/.test(c) || p.includes("\\");
}

function modFor(p: string): typeof path.win32 {
  return isWindowsStyle(p) ? path.win32 : path.posix;
}

/** Normalize any path (drive letters, separators, Tamil/Unicode names). */
export function normalizePath(p: string): string {
  return modFor(p).normalize(p);
}

/** Join path segments safely — never concatenate separators manually. */
export function joinPath(...segments: string[]): string {
  const m = modFor(segments[0] ?? "");
  return m.normalize(m.join(...segments));
}

/** Resolve a path to absolute form against an explicit base (never cwd). */
export function resolveFrom(base: string, target: string): string {
  const m = modFor(base);
  return m.resolve(base, target);
}

/** True when `file` is a Yaazhi source file (`.ழி`). */
export function isYaazhiFile(filePath: string): boolean {
  return filePath.endsWith(SOURCE_EXTENSION);
}

/** True when `filePath` is a rejected legacy (`.அ`) source. */
export function isLegacyFile(filePath: string): boolean {
  return filePath.endsWith(LEGACY_EXTENSION);
}

/** File base name (Tamil names preserved). */
export function baseName(filePath: string): string {
  return modFor(filePath).basename(filePath);
}

/** Directory containing `filePath`. */
export function dirName(filePath: string): string {
  return modFor(filePath).dirname(filePath);
}

/** True when `child` is inside `parent` (or equal). Case-insensitive on Windows. */
export function isSubPath(parent: string, child: string): boolean {
  const m = modFor(parent);
  const rel = m.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !m.isAbsolute(rel));
}

/**
 * Walk upward from `start` (file or directory), yielding each ancestor
 * directory including `start` itself when it is a directory.
 * Stops at the filesystem root or after `maxDepth` steps.
 */
export function* walkUp(start: string, maxDepth = 24): Generator<string> {
  let current = normalizePath(start);
  const m = modFor(current);
  const stat = safeStatSync(current);
  // A missing path ending in an extension is assumed to be a file
  // (e.g. an unsaved-but-resolved editor path); start from its directory.
  if (stat === "file" || (stat === "missing" && m.extname(current) !== "")) {
    current = m.dirname(current);
  }
  let depth = 0;
  let previous = "";
  while (current !== previous && depth < maxDepth) {
    yield current;
    previous = current;
    current = m.dirname(current);
    depth += 1;
  }
}

function safeStatSync(p: string): "file" | "dir" | "missing" {
  try {
    const st = fs.statSync(p);
    if (st.isFile()) return "file";
    if (st.isDirectory()) return "dir";
    return "missing";
  } catch {
    return "missing";
  }
}

/** Quote a path for human-readable display (never for shell execution). */
export function displayPath(p: string): string {
  return `"${p}"`;
}
