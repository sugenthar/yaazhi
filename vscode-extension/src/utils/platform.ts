/**
 * Platform-aware detection helpers used by the Yaazhi toolchain resolver.
 *
 * Pure functions with injectable platform/arch so behaviour on Linux,
 * Windows and macOS can be unit-tested from any host. This mirrors the
 * `platformJoin.ts` pattern (explicit platform, never style-sniffing) so the
 * resolver NEVER builds a mixed POSIX/Windows path or selects an executable
 * binary that cannot run on the current OS.
 */
export type NodePlatform = "win32" | "darwin" | "linux";
export type NodeArch = "x64" | "arm64" | "ia32" | "arm" | string;

export interface Platform {
  /** "win32" on Windows, "darwin" on macOS, "linux" elsewhere. */
  platform: NodePlatform;
  /** CPU architecture ("x64", "arm64", ...). */
  arch: NodeArch;
}

/** True when `p` is a Windows drive-letter absolute path (`C:\` / `C:/`). */
export function isWindowsAbsolute(p: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(p.trim());
}

/** Executable filename suffixes valid on a given platform, in priority order. */
export function executableSuffixes(platform: NodePlatform): readonly string[] {
  switch (platform) {
    case "win32":
      // Native Windows builds use a plain `.exe`. A `.lnx` (or suffix-less)
      // binary cannot run on Windows, so it is never considered.
      return [".exe"];
    case "darwin":
      // macOS host binary — no extension on macOS.
      return [""];
    case "linux":
    default:
      // ELF Linux hosts are built with a `.lnx` suffix to disambiguate from
      // the PE `.exe`; a suffix-less ELF is also accepted. A `.exe` PE binary
      // must never be selected here.
      return [".lnx", ""];
  }
}

/** Filename variants for a base executable name on a platform, in priority order. */
export function executableNames(
  base: string,
  platform: NodePlatform,
): readonly string[] {
  return executableSuffixes(platform).map((suffix) => `${base}${suffix}`);
}
