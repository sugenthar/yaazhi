/**
 * Compiler/home discovery. Pure functions with injected dependencies
 * (no vscode imports) so discovery is unit-testable with mocks.
 *
 * The compiler is the native C11 executable: `<home>/bin/yaazhi` in an
 * installed distribution, `<home>/compiler/build/yaazhi` in a development
 * checkout. Runtime/debugger host resolution lives in the centralized
 * platform-aware resolver (`src/toolchain/resolveToolchain.ts`); nothing in
 * here invents a binary path for another operating system.
 */
import { COMPILER_DIRS, COMPILER_NAMES } from "../constants";
import { joinPath, dirName, baseName, walkUp } from "../utils/paths";
import { pathDelimiter } from "../utils/platformJoin";
import { NodePlatform, executableNames } from "../utils/platform";

export interface DiscoveryInputs {
  /** Value of the `yaazhi.home` setting ("" when unset). */
  configuredHome: string;
  /** Absolute paths of open workspace folders. */
  workspaceFolders: string[];
  /** Process environment (YAAZHI_HOME / YAZHI_VM). */
  env: NodeJS.ProcessEnv;
  /** Existence check (fs.existsSync by default, mocked in tests). */
  exists: (p: string) => boolean;
  /**
   * OS semantics ("win32" on Windows, POSIX elsewhere).
   * Defaults to `process.platform` when omitted (tests inject it).
   */
  platform?: NodePlatform;
  /**
   * Opt-in PATH lookup of the `yaazhi` launcher, used for *installed*
   * distribution discovery (a `<home>/bin/yaazhi` on PATH). When omitted, a
   * default implementation searches `env.PATH`.
   */
  findOnPath?: (name: string, platform: NodePlatform) => string[];
}

export interface Toolchain {
  /** Resolved Yaazhi home directory ("" when not found). */
  home: string;
  /** Full path to the native compiler executable ("" when not found). */
  compiler: string;
  /** How the home was found (for logging / troubleshooting). */
  homeSource: "setting" | "env" | "installed" | "workspace" | "none";
}

/** Compiler executable candidates for a given Yaazhi home. */
export function compilerEntriesFor(home: string, platform: NodePlatform): string[] {
  const out: string[] = [];
  for (const dir of COMPILER_DIRS) {
    for (const base of COMPILER_NAMES) {
      for (const name of executableNames(base, platform)) {
        out.push(joinPath(home, ...dir, name));
      }
    }
  }
  return out;
}

/**
 * Discover the Yaazhi home directory.
 * Order: `yaazhi.home` setting → YAAZHI_HOME env → installed distribution
 * (a `yaazhi` launcher on PATH at `<home>/bin/`) → workspace layout
 * (a folder containing the native compiler, or an ancestor of one).
 */
export function discoverYaazhiHome(inputs: DiscoveryInputs): Toolchain {
  const { configuredHome, workspaceFolders, env, exists } = inputs;
  const platform: NodePlatform = inputs.platform ?? defaultPlatform();

  if (configuredHome.trim() !== "") {
    const compiler = firstExisting(compilerEntriesFor(configuredHome.trim(), platform), exists);
    if (compiler !== "") {
      return { home: configuredHome.trim(), compiler, homeSource: "setting" };
    }
    // Configured but invalid: report it anyway so callers can show a
    // targeted error instead of silently falling back elsewhere.
    return { home: configuredHome.trim(), compiler: "", homeSource: "setting" };
  }

  const envHome = (env["YAAZHI_HOME"] ?? "").trim();
  if (envHome !== "") {
    const compiler = firstExisting(compilerEntriesFor(envHome, platform), exists);
    if (compiler !== "") {
      return { home: envHome, compiler, homeSource: "env" };
    }
  }

  // Installed-distribution discovery: `yaazhi` on PATH at `<home>/bin/yaazhi`.
  // Symlinked launchers resolve through the workspace walk fallback via
  // realpath elsewhere; here the bin/ layout is derived directly from the
  // candidate path.
  const findOnPath = inputs.findOnPath ?? defaultFindOnPath(env);
  for (const candidate of findOnPath("yaazhi", platform)) {
    const home = homeFromLauncher(candidate, exists, platform);
    if (home !== "") {
      return { home, compiler: firstExisting(compilerEntriesFor(home, platform), exists), homeSource: "installed" };
    }
  }

  for (const folder of workspaceFolders) {
    // The workspace folder may be the Yaazhi home itself, or a nested
    // directory inside it (e.g. examples/). Walk upward looking for the
    // native compiler marker. Never touches process.cwd().
    for (const candidate of walkUp(folder, 8)) {
      const compiler = firstExisting(compilerEntriesFor(candidate, platform), exists);
      if (compiler !== "") {
        return { home: candidate, compiler, homeSource: "workspace" };
      }
    }
  }

  return { home: "", compiler: "", homeSource: "none" };
}

function firstExisting(candidates: string[], exists: (p: string) => boolean): string {
  for (const c of candidates) {
    if (exists(c)) return c;
  }
  return "";
}

function homeFromLauncher(
  candidate: string,
  exists: (p: string) => boolean,
  platform: NodePlatform,
): string {
  const bin = dirName(candidate);
  if (baseName(bin) !== "bin") return "";
  const home = dirName(bin);
  if (home !== "" && firstExisting(compilerEntriesFor(home, platform), exists) !== "") return home;
  return "";
}

function defaultPlatform(): NodePlatform {
  return typeof process !== "undefined" && process.platform
    ? (process.platform as NodePlatform)
    : "linux";
}

function defaultFindOnPath(env: NodeJS.ProcessEnv) {
  return (name: string, platform: NodePlatform): string[] => {
    const pathEnv = env["PATH"] ?? "";
    if (pathEnv === "") return [];
    const sep = pathDelimiter(platform);
    const names = platform === "win32"
      ? [name + ".exe", name + ".bat", name + ".cmd", name]
      : [name];
    const found: string[] = [];
    for (const dir of pathEnv.split(sep)) {
      if (dir === "") continue;
      for (const n of names) {
        found.push(joinPath(dir, n));
      }
    }
    return found;
  };
}