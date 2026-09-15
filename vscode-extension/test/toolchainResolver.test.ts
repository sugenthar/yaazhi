/**
 * Centralized platform-aware toolchain resolver tests.
 *
 * Every scenario uses mocked exists/platform/PATH and NO developer-machine
 * path (no /home/sugenthar, no D:/yaazhi fallback). These verify the platform
 * selection is correct on any host, plus Linux real-layout resolution and
 * the exact Linux "cannot execute binary file" guard.
 */
import { describe, expect, it } from "vitest";
import {
  resolveHome,
  resolveHost,
} from "../src/toolchain/resolveToolchain";
import {
  executableNames,
  executableSuffixes,
  isWindowsAbsolute,
} from "../src/utils/platform";
import { NodePlatform } from "../src/utils/platform";

function existsFor(files: readonly string[]): (p: string) => boolean {
  const set = new Set(files.map((f) => f.toLowerCase()));
  return (p) => set.has(p.toLowerCase());
}

function join(...parts: string[]): string {
  return parts.join("/").replace(/\/+/g, "/");
}

type HostOpts = {
  kind: "runtime" | "debugger";
  platform: NodePlatform;
  home: string;
  configured?: string;
  arch?: string;
  files?: readonly string[];
};

function lookup(o: HostOpts): ReturnType<typeof resolveHost> {
  const { files, ...rest } = o;
  return resolveHost({
    kind: rest.kind,
    platform: rest.platform,
    home: rest.home,
    configured: rest.configured ?? "",
    arch: rest.arch,
    env: {},
    exists: existsFor(files ?? []),
  });
}

describe("executableNames / suffixes per platform", () => {
  it("Linux prefers .lnx then plain; never .exe", () => {
    expect(executableSuffixes("linux")).toEqual([".lnx", ""]);
    expect(executableNames("yaazhi_run", "linux")).toEqual(["yaazhi_run.lnx", "yaazhi_run"]);
  });

  it("Windows prefers only .exe; never .lnx", () => {
    expect(executableSuffixes("win32")).toEqual([".exe"]);
    expect(executableNames("yaazhi_run", "win32")).toEqual(["yaazhi_run.exe"]);
  });

  it("macOS uses no extension; never .exe or .lnx", () => {
    expect(executableSuffixes("darwin")).toEqual([""]);
    expect(executableNames("yaazhi_run", "darwin")).toEqual(["yaazhi_run"]);
  });

  it("detects Windows drive-letter absolute paths", () => {
    expect(isWindowsAbsolute("D:\\yaazhi")).toBe(true);
    expect(isWindowsAbsolute("D:/yaazhi")).toBe(true);
    expect(isWindowsAbsolute("/usr/local/yaazhi")).toBe(false);
  });
});

describe("resolveHome", () => {
  const base = { workspaceFolders: [], exists: existsFor([]) };

  it("setting beats env; compiler path derived below the home", () => {
    const home = "/opt/yaazhi";
    const main = join(home, "bin/yaazhi");
    const res = resolveHome({ ...base, configuredHome: home, env: { YAAZHI_HOME: "/env" }, exists: existsFor([main]) });
    expect(res).toMatchObject({ home, compiler: main, source: "setting", error: "" });
  });

  it("falls back to YAAZHI_HOME", () => {
    const home = "/opt/yaazhi";
    const main = join(home, "bin/yaazhi");
    const res = resolveHome({ ...base, configuredHome: "", env: { YAAZHI_HOME: home }, exists: existsFor([main]) });
    expect(res).toMatchObject({ home, source: "env", error: "" });
  });

  it("discovers the home from the workspace upward", () => {
    const main = "/srv/yaazhi/bin/yaazhi";
    const res = resolveHome({ ...base, configuredHome: "", workspaceFolders: ["/srv/yaazhi/examples/a"], env: {}, exists: existsFor([main]) });
    expect(res.home).toBe("/srv/yaazhi");
    expect(res.source).toBe("workspace");
  });

  it("rejects a Windows drive-letter setting on Linux", () => {
    const res = resolveHome({ ...base, configuredHome: "D:\\yaazhi", platform: "linux", env: {}, exists: existsFor(["D:\\yaazhi\\bin\\yaazhi.exe"]) });
    expect(res.compiler).toBe("");
    expect(res.source).toBe("setting");
    expect(res.error).toContain("Windows drive-letter");
    expect(res.error).not.toContain("D:/yaazhi");
  });

  it("rejects a Windows drive-letter YAAZHI_HOME on POSIX", () => {
    const res = resolveHome({ ...base, configuredHome: "", platform: "darwin", env: { YAAZHI_HOME: "D:\\yaazhi" }, exists: existsFor(["D:\\yaazhi\\bin\\yaazhi.exe"]) });
    expect(res.compiler).toBe("");
    expect(res.source).toBe("env");
    expect(res.error).toContain("Windows drive-letter");
  });

  it("accepts a Windows home on Windows (native separators)", () => {
    const main = "D:\\yaazhi\\compiler\\build\\yaazhi.exe";
    const res = resolveHome({ ...base, configuredHome: "D:\\yaazhi", platform: "win32", env: {}, exists: existsFor([main]) });
    expect(res).toMatchObject({ home: "D:\\yaazhi", source: "setting", error: "" });
    expect(res.compiler.toLowerCase()).toBe(main.toLowerCase());
  });

  it("reports the configured-but-invalid home verbatim (no D:/yaazhi fabrication)", () => {
    const res = resolveHome({ ...base, configuredHome: "/tmp/not-the-home", platform: "linux", env: {}, exists: existsFor([]) });
    expect(res.home).toBe("/tmp/not-the-home");
    expect(res.source).toBe("setting");
    expect(res.error).toContain('"yaazhi.home"');
    expect(res.error).not.toContain("D:");
  });

  it("error is empty when nothing is found (caller shows the generic message)", () => {
    const res = resolveHome({ ...base, configuredHome: "", platform: "linux", env: {}, exists: existsFor([]) });
    expect(res).toMatchObject({ home: "", compiler: "", source: "none", error: "" });
  });
});

const files = {
  lnx: "/srv/yaazhi/runtime/build/yaazhi_run.lnx",
  lnx2: "/srv/yaazhi/build/yaazhi_run.lnx",
  exe: "C:\\yaazhi\\runtime\\build\\yaazhi_run.exe",
  dbgLnx: "/srv/yaazhi/runtime/build/yaazhi_dbg.lnx",
};

describe("resolveHost runtime (yaazhi_run)", () => {
  it("Linux: prefers .lnx home candidate over the plain name", () => {
    const res = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", files: [files.lnx] });
    expect(res.path).toBe(files.lnx);
    expect(res.incompatible).toBe(false);
  });

  it("Linux: picks build/yaazhi_run.lnx from the secondary dir", () => {
    const res = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", files: [files.lnx2] });
    expect(res.path).toBe(files.lnx2);
  });

  it("Linux: NEVER selects the existing .exe (the historical exit-126 bug)", () => {
    const res = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", files: [files.exe] });
    expect(res.path).toBe("");
    expect(res.incompatible).toBe(false);
    expect(res.error).toBe("");
  });

  it("Linux: plain suffix-less runtime works", () => {
    const plain = "/srv/yaazhi/runtime/build/yaazhi_run";
    const res = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", files: [plain] });
    expect(res.path).toBe(plain);
  });

  it("Windows: prefers the .exe home candidate", () => {
    const res = lookup({ kind: "runtime", platform: "win32", home: "C:\\yaazhi", files: [files.exe] });
    expect(res.path).toBe(files.exe);
  });

  it("Windows: a .lnx host is never considered even if present", () => {
    const res = lookup({ kind: "runtime", platform: "win32", home: "C:\\yaazhi", files: [join("C:/yaazhi","runtime/build/yaazhi_run.lnx".toLowerCase())] });
    expect(res.path).toBe("");
  });

  it("macOS: no-extension host under the home", () => {
    const plain = "/srv/yaazhi/runtime/build/yaazhi_run";
    const res = lookup({ kind: "runtime", platform: "darwin", home: "/srv/yaazhi", files: [plain] });
    expect(res.path).toBe(plain);
  });

  it("macOS: never selects .exe or .lnx under the home (ignored, not run)", () => {
    const a = lookup({ kind: "runtime", platform: "darwin", home: "/srv/yaazhi", files: ["/srv/yaazhi/runtime/build/yaazhi_run.exe"] });
    expect(a.path).toBe(""); expect(a.incompatible).toBe(false);
    const b = lookup({ kind: "runtime", platform: "darwin", home: "/srv/yaazhi", files: ["/srv/yaazhi/runtime/build/yaazhi_run.lnx"] });
    expect(b.path).toBe(""); expect(b.incompatible).toBe(false);
  });

  it("macOS: rejects an explicitly configured Windows/Linux host", () => {
    const a = resolveHost({ kind: "runtime", platform: "darwin", home: "", env: {}, exists: existsFor(["/x/yaazhi_run.exe"]), configured: "/x/yaazhi_run.exe" });
    expect(a.path).toBe(""); expect(a.incompatible).toBe(true);
    expect(a.error).toContain("Windows");
    const b = resolveHost({ kind: "runtime", platform: "darwin", home: "", env: {}, exists: existsFor(["/x/yaazhi_run.lnx"]), configured: "/x/yaazhi_run.lnx" });
    expect(b.path).toBe(""); expect(b.incompatible).toBe(true);
    expect(b.error).toContain("Linux");
  });

  it("explicit yaazhi.runtime wins when usable", () => {
    const custom = "/custom/space dir/my_yaazhi_run";
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "", env: {}, exists: existsFor([custom]), configured: custom });
    expect(res.path).toBe(custom);
  });

  it("rejects an explicitly configured .exe runtime on Linux with a clear error", () => {
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "", env: {}, exists: existsFor(["/some/path/yaazhi_run.exe"]), configured: "/some/path/yaazhi_run.exe" });
    expect(res.path).toBe("");
    expect(res.incompatible).toBe(true);
    expect(res.error).toContain("yaazhi_run.exe");
    expect(res.error).toContain("Windows");
    expect(res.error).toContain("Linux");
    expect(res.error).toContain("yaazhi_run.lnx");
  });

  it("rejects an explicitly configured Linux runtime on Windows", () => {
    const res = resolveHost({ kind: "runtime", platform: "win32", home: "", env: {}, exists: existsFor(["D:\\yazhi\\yaazhi_run.lnx"]), configured: "D:\\yazhi\\yaazhi_run.lnx" });
    expect(res.path).toBe("");
    expect(res.incompatible).toBe(true);
    expect(res.error).toContain("cannot be used");
  });

  it("YAAZHI_VM env beats home candidates", () => {
    const viaEnv = "/env/bin/yaazhi_run.lnx";
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", env: { YAAZHI_VM: viaEnv }, exists: existsFor([viaEnv, files.lnx]), configured: "" });
    expect(res.path).toBe(viaEnv);
  });

  it("rejects an incompatible YAAZHI_VM .exe on Linux (no silent substitution)", () => {
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", env: { YAAZHI_VM: "/env/yaazhi_run.exe" }, exists: existsFor(["/env/yaazhi_run.exe", files.lnx]), configured: "" });
    expect(res.path).toBe("");
    expect(res.incompatible).toBe(true);
    expect(res.error).toContain("YAAZHI_VM");
    expect(res.error).not.toContain("/srv/yaazhi/runtime/build/yaazhi_run.lnx");
  });

  it("PATH discovery finds a native runtime when not under the home", () => {
    const onPath = "/usr/local/bin/yaazhi_run.lnx";
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", env: { PATH: "/usr/local/bin:/usr/bin" }, exists: existsFor([onPath]), configured: "", pathDirs: ["/usr/local/bin", "/usr/bin"] });
    expect(res.path).toBe(onPath);
  });

  it("PATH discovery ignores non-executable .exe on Linux", () => {
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "", env: { PATH: "/usr/local/bin" }, exists: existsFor(["/usr/local/bin/yaazhi_run.exe"]), configured: "", pathDirs: ["/usr/local/bin"] });
    expect(res.path).toBe("");
  });

  it("empty when the runtime is genuinely missing", () => {
    const res = lookup({ kind: "runtime", platform: "linux", home: "", files: [] });
    expect(res).toMatchObject({ path: "", incompatible: false, error: "" });
  });

  it("a relative configured runtime is honored (passed to spawn as-is)", () => {
    const rel = "tools/yazhi/run/../yaazhi_run.lnx";
    const res = resolveHost({ kind: "runtime", platform: "linux", home: "", env: {}, exists: existsFor([rel]), configured: rel });
    expect(res.path).toBe(rel);
  });

  it("a relative configured home resolves its compiler beneath it", () => {
    const home = "relative/yaazhi";
    const main = join(home, "compiler/build/yaazhi");
    const res = resolveHome({ configuredHome: home, workspaceFolders: [], env: {}, platform: "linux", exists: existsFor([main]) });
    expect(res).toMatchObject({ home, compiler: main, source: "setting", error: "" });
  });

  it("handles Unicode/Tamil home paths with spaces", () => {
    const home = "/home/தமிழ் நிரல்/yaazhi";
    const host = join(home, "runtime/build/yaazhi_run.lnx");
    const res = lookup({ kind: "runtime", platform: "linux", home, files: [host] });
    expect(res.path).toBe(host);
  });

  it("architecture is reported via the platform not the filename (x64 vs arm64)", () => {
    // Binary naming does not encode architecture; both arches resolve the same
    // host name, but arch is accepted so callers can surface it.
    const a = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", arch: "arm64", files: [files.lnx] });
    const b = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", arch: "x64", files: [files.lnx] });
    expect(a.path).toBe(b.path);
  });
});

describe("resolveHost debugger (yaazhi_dbg)", () => {
  it("Linux: prefers .lnx debug host", () => {
    const res = lookup({ kind: "debugger", platform: "linux", home: "/srv/yaazhi", files: [files.dbgLnx] });
    expect(res.path).toBe(files.dbgLnx);
  });

  it("explicit yaazhi.debugger wins when usable", () => {
    const custom = "/custom/yaazhi_dbg";
    const res = resolveHost({ kind: "debugger", platform: "linux", home: "", env: {}, exists: existsFor([custom]), configured: custom });
    expect(res.path).toBe(custom);
  });

  it("rejects an explicit .exe debugger on Linux", () => {
    const res = resolveHost({ kind: "debugger", platform: "linux", home: "", env: {}, exists: existsFor(["C:\\y\\yaazhi_dbg.exe"]), configured: "C:\\y\\yaazhi_dbg.exe" });
    expect(res.path).toBe(""); expect(res.incompatible).toBe(true);
  });

  it("Windows never selects a .lnx debugger (rare but exists)", () => {
    const res = lookup({ kind: "debugger", platform: "win32", home: "C:\\y", files: ["C:\\y\\runtime\\build\\yaazhi_dbg.lnx"] });
    expect(res.path).toBe("");
  });

  it("empty when the debug host is missing", () => {
    const res = lookup({ kind: "debugger", platform: "linux", home: "/srv/yaazhi", files: [] });
    expect(res).toMatchObject({ path: "", incompatible: false });
  });
});

describe("compiler path derivation", () => {
  it("home resolution supplies the native compiler beneath the home", () => {
    const main = "/usr/local/yaazhi/bin/yaazhi";
    const res = resolveHome({ configuredHome: "/usr/local/yaazhi", workspaceFolders: [], env: {}, platform: "linux", exists: existsFor([main]) });
    expect(res.compiler).toBe(main);
  });
});

describe("run/debug wiring uses the resolved platform host", () => {
  it("run flow host is the platform-appropriate runtime (Linux)", () => {
    const res = lookup({ kind: "runtime", platform: "linux", home: "/srv/yaazhi", files: [files.lnx, files.exe] });
    // The resolveHost output is the value Run passes to spawn() via startRuntime.
    expect(res.path).toBe(files.lnx);
    expect(res.path.endsWith(".lnx")).toBe(true);
  });

  it("debug flow host is the platform-appropriate debugger (Linux)", () => {
    const res = lookup({ kind: "debugger", platform: "linux", home: "/srv/yaazhi", files: [files.dbgLnx] });
    expect(res.path.endsWith(".lnx")).toBe(true);
  });

  it("run impersonating Windows selects the .exe (never .lnx)", () => {
    const res = lookup({ kind: "runtime", platform: "win32", home: "C:\\yaazhi", files: [files.exe] });
    expect(res.path).toBe(files.exe);
    expect(res.path.endsWith(".lnx")).toBe(false);
  });
});