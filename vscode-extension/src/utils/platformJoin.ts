/**
 * Platform-explicit path joining for the toolchain resolver.
 *
 * Unlike `utils/paths.ts` (which style-sniffs the input), this builds paths
 * with the platform's own separator semantics so the resolver never produces
 * a mixed POSIX/Windows path and never executes a wrong-OS binary.
 */
import * as path from "path";
import { NodePlatform } from "./platform";

function mod(platform: NodePlatform): typeof path.win32 {
  return platform === "win32" ? path.win32 : path.posix;
}

/** PATH list separator for a platform (`;` on Windows, `:` elsewhere). */
export function pathDelimiter(platform: NodePlatform): string {
  return mod(platform).delimiter;
}

/** Join path segments with the platform's native separators. */
export function joinForPlatform(
  segments: readonly (string | readonly string[])[],
  platform: NodePlatform,
): string {
  const flat: string[] = [];
  for (const s of segments) {
    if (typeof s === "string") {
      flat.push(s);
    } else {
      flat.push(...s);
    }
  }
  return mod(platform).join(...flat);
}