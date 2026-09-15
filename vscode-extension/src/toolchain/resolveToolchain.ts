/**
 * Centralized Yaazhi toolchain resolver: home, compiler, runtime host and
 * debugger host.
 *
 * Pure functions with injected platform/arch/existence dependencies (no
 * vscode imports) so every platform's behaviour is unit-testable on any host.
 *
 * Core guarantee: the extension NEVER executes a binary that cannot run on
 * the current OS. A Windows `.exe` is rejected on POSIX hosts (the historical
 * "cannot execute binary file", exit 126 bug), a `.lnx` is rejected on
 * Windows, and a `.exe`/`.lnx` is rejected on macOS. An incompatible explicit
 * setting is reported with a clear, targeted error — it is never silently
 * substituted and never executed.
 *
 * No developer-specific path is ever invented: there is no hardcoded
 * fallback to a particular home directory.
 */
import {
  DEBUG_HOST_DIRS,
  HOST_DIRS,
  YAAZHI_DEBUG_HOST_ENV,
} from "../constants";
import {
  discoverYaazhiHome,
} from "../compiler/compilerLocator";
import { joinForPlatform, pathDelimiter } from "../utils/platformJoin";
import {
  executableNames,
  isWindowsAbsolute,
  NodeArch,
  NodePlatform,
} from "../utils/platform";

export type { NodeArch, NodePlatform } from "../utils/platform";

export type HomeSource = "setting" | "env" | "installed" | "workspace" | "none";
export type HostKind = "runtime" | "debugger";

/** Result of resolving the Yaazhi home directory. */
export interface HomeResolution {
  home: string;
  compiler: string;
  source: HomeSource;
  /** Human-readable error ("" when resolved). */
  error: string;
}

export interface HomeInputs {
  /** `yaazhi.home` setting value ("" when unset). */
  configuredHome: string;
  /** Absolute paths of open workspace folders. */
  workspaceFolders: string[];
  /** Process environment (YAAZHI_HOME). */
  env: NodeJS.ProcessEnv;
  /** "win32" on Windows, POSIX semantics elsewhere. */
  platform: NodePlatform;
  /** Existence check (fs.existsSync by default, mocked in tests). */
  exists: (p: string) => boolean;
}

/** Result of resolving a host binary (runtime or debugger). */
export interface HostResolution {
  /** Absolute path to the usable host binary ("" when not usable). */
  path: string;
  /** True when an existing binary was found but is not usable on this OS. */
  incompatible: boolean;
  /** Human-readable error when `path` is "". */
  error: string;
}

export interface HostInputs {
  /** `yaazhi.runtime` / `yaazhi.debugger` setting ("" when unset). */
  configured: string;
  /** Resolved Yaazhi home ("" when unknown). */
  home: string;
  env: NodeJS.ProcessEnv;
  /** "runtime" or "debugger" (drives env var + candidate dirs). */
  kind: HostKind;
  platform: NodePlatform;
  arch?: NodeArch;
  /** PATH directories to search when not found under the home ("" default). */
  pathDirs?: string[];
  exists: (p: string) => boolean;
}

function describeKind(kind: HostKind): { setting: string; env: string; host: string } {
  return kind === "runtime"
    ? { setting: '"yaazhi.runtime"', env: "YAAZHI_VM", host: "runtime host (yaazhi_run)" }
    : { setting: '"yaazhi.debugger"', env: YAAZHI_DEBUG_HOST_ENV, host: "debugger host (yaazhi_dbg)" };
}

/** True when `p` names a binary built for another operating system. */
function isPlatformIncompatible(path: string, platform: NodePlatform): boolean {
  const lower = path.toLowerCase();
  switch (platform) {
    case "win32":
      // A `.lnx` ELF cannot run on Windows. `.exe` is the native Windows form.
      return lower.endsWith(".lnx");
    case "darwin":
      // macOS hosts build without an extension; `.exe` (PE) or `.lnx` (ELF)
      // binaries cannot run on macOS.
      return lower.endsWith(".exe") || lower.endsWith(".lnx");
    case "linux":
    default:
      // A `.exe` PE binary cannot run on Linux ("cannot execute binary file").
      return lower.endsWith(".exe");
  }
}

/** OS name for a filename suffix, for error messages. */
function binaryOs(pathLower: string): string | null {
  if (pathLower.endsWith(".exe")) return "Windows";
  if (pathLower.endsWith(".lnx")) return "Linux";
  return null;
}

/** Suggested native host filename for a platform (for error messages). */
function nativeHostName(kind: HostKind, platform: NodePlatform): string {
  return executableNames(hostBaseName(kind), platform)[0];
}

/** Native extension for a platform (for error messages). */
function nativeForm(platform: NodePlatform): string {
  return platform === "win32" ? "a Windows .exe" : platform === "darwin" ? "an extension-less host" : "a Linux .lnx";
}

/** Current OS display name. */
function osLabel(platform: NodePlatform): string {
  return platform === "win32" ? "Windows" : platform === "darwin" ? "macOS" : "Linux";
}

/**
 * Validate an explicitly-configured host path for the current platform.
 * Returns a clear error when the binary is built for another OS, or "" when
 * the path is usable (or simply not present / ambiguous).
 */
function explicitHostError(candidate: string, kind: HostKind, platform: NodePlatform): string {
  const builtFor = binaryOs(candidate.toLowerCase());
  if (builtFor !== null && builtFor !== osLabel(platform)) {
    const { setting, env, host } = describeKind(kind);
    return (
      `The configured Yaazhi ${host} ("${candidate}") is a ${builtFor} executable and cannot ` +
      `be used on ${osLabel(platform)}. Use a ${osLabel(platform)} host ` +
      `(${nativeForm(platform)}, e.g. ${nativeHostName(kind, platform)}) for this platform, ` +
      `or fix the ${setting} / ${env} setting.`
    );
  }
  return "";
}

function hostEnvVar(kind: HostKind): string {
  return kind === "runtime" ? "YAAZHI_VM" : YAAZHI_DEBUG_HOST_ENV;
}

function hostDirCandidates(kind: HostKind): readonly (readonly string[])[] {
  return kind === "runtime" ? HOST_DIRS : DEBUG_HOST_DIRS;
}

function hostBaseName(kind: HostKind): string {
  return kind === "runtime" ? "yaazhi_run" : "yaazhi_dbg";
}

/**
 * Resolve the Yaazhi home directory with platform validation.
 * Order: `yaazhi.home` setting → `YAAZHI_HOME` env → workspace discovery.
 *
 * A Windows drive-letter home is rejected on a POSIX host with a clear error
 * (never interpreted, never silently ignored).
 */
export function resolveHome(inputs: HomeInputs): HomeResolution {
  const { configuredHome, workspaceFolders, env, platform, exists } = inputs;

  const setting = configuredHome.trim();
  if (setting !== "") {
    if (platform !== "win32" && isWindowsAbsolute(setting)) {
      return {
        home: setting,
        compiler: "",
        source: "setting",
        error:
          `"yaazhi.home" is set to "${setting}", a Windows drive-letter path, which cannot be ` +
          `used on this platform. Set it to the path of the directory containing the ` +
          `native Yaazhi compiler (for example /usr/local/yaazhi on Linux/macOS).`,
      };
    }
  }

  const envHome = (env["YAAZHI_HOME"] ?? "").trim();
  if (envHome !== "" && platform !== "win32" && isWindowsAbsolute(envHome)) {
    return {
      home: envHome,
      compiler: "",
      source: "env",
      error:
        `YAAZHI_HOME is set to "${envHome}", a Windows drive-letter path, which cannot be used ` +
        `on this platform. Set it to the path of the directory containing native Yaazhi tools.`,
    };
  }

  const found = discoverYaazhiHome({ configuredHome, workspaceFolders, env, exists, platform });
  if (found.compiler !== "") {
    return { home: found.home, compiler: found.compiler, source: found.homeSource, error: "" };
  }
  if (found.homeSource === "setting") {
    return {
      home: found.home,
      compiler: "",
      source: "setting",
      error:
        `"yaazhi.home" is set to "${found.home}" but no native Yaazhi compiler executable ` +
        `(bin/yaazhi or compiler/build/yaazhi) was found there. Check the setting or install the ` +
        `Yaazhi language tools in that directory.`,
    };
  }
  return { home: found.home, compiler: "", source: found.homeSource, error: "" };
}

/**
 * Resolve a host binary (yaazhi_run for runtime, yaazhi_dbg for debugger).
 *
 * Order: `yaazhi.runtime`/`yaazhi.debugger` setting → env (YAAZHI_VM /
 * YAAZHI_DBG_VM) → home-relative candidates (platform-ordered: `.lnx` before
 * plain on Linux, `.exe` on Windows, no extension on macOS) → PATH discovery.
 * The `.exe` variant is never selected on POSIX and the `.lnx` variant never
 * on Windows.
 *
 * An explicitly-configured binary that exists but is built for another OS is
 * reported as a targeted error and NEVER executed or silently substituted.
 */
export function resolveHost(inputs: HostInputs): HostResolution {
  const { configured, home, env, kind, platform, exists } = inputs;

  const setting = configured.trim();
  if (setting !== "") {
    const err = explicitHostError(setting, kind, platform);
    if (err !== "") {
      return { path: "", incompatible: true, error: err };
    }
    if (exists(setting)) {
      return { path: setting, incompatible: false, error: "" };
    }
  }

  const envPath = (env[hostEnvVar(kind)] ?? "").trim();
  if (envPath !== "") {
    const err = explicitHostError(envPath, kind, platform);
    if (err !== "") {
      return { path: "", incompatible: true, error: err };
    }
    if (exists(envPath)) {
      return { path: envPath, incompatible: false, error: "" };
    }
  }

  if (home !== "") {
    const names = executableNames(hostBaseName(kind), platform);
    for (const dir of hostDirCandidates(kind)) {
      for (const name of names) {
        const candidate = joinForPlatform([home, ...dir, name], platform);
        if (exists(candidate)) {
          return { path: candidate, incompatible: false, error: "" };
        }
      }
    }
  }

  const fromPath = findOnPath(inputs);
  if (fromPath !== "") {
    return { path: fromPath, incompatible: false, error: "" };
  }

  return { path: "", incompatible: false, error: "" };
}

/** Search PATH directories for a platform-native host binary. */
function findOnPath(inputs: HostInputs): string {
  const { env, kind, platform, exists } = inputs;
  const sep = pathDelimiter(platform);
  const pathDirs = inputs.pathDirs ?? (env["PATH"] ?? "").split(sep);
  const names = executableNames(hostBaseName(kind), platform);
  for (const dir of pathDirs) {
    if (dir.trim() === "") continue;
    for (const name of names) {
      if (isPlatformIncompatible(name, platform)) continue;
      const candidate = joinForPlatform([dir, name], platform);
      if (exists(candidate)) return candidate;
    }
  }
  return "";
}