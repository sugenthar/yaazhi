/** Compiler/home discovery with mocked filesystems (native toolchain). */
import { describe, expect, it } from "vitest";
import { discoverYaazhiHome } from "../src/compiler/compilerLocator";
import { buildCompileArgs, compilerEnv } from "../src/compiler/compiler";
import { joinPath } from "../src/utils/paths";

function existsFor(files: string[]): (p: string) => boolean {
  const set = new Set(files.map((f) => f.toLowerCase()));
  return (p) => set.has(p.toLowerCase());
}

describe("discoverYaazhiHome", () => {
  it("prefers the yaazhi.home setting", () => {
    const compiler = joinPath("D:", "yaazhi", "bin", "yaazhi.exe");
    const found = discoverYaazhiHome({
      configuredHome: joinPath("D:", "yaazhi"),
      workspaceFolders: [],
      env: {},
      platform: "win32",
      exists: existsFor([compiler]),
    });
    expect(found.compiler).toBe(compiler);
    expect(found.homeSource).toBe("setting");
  });

  it("falls back to YAAZHI_HOME", () => {
    const compiler = joinPath("E:", "tools", "yaazhi", "compiler", "build", "yaazhi");
    const found = discoverYaazhiHome({
      configuredHome: "",
      workspaceFolders: [],
      env: { YAAZHI_HOME: joinPath("E:", "tools", "yaazhi") },
      platform: "linux",
      exists: existsFor([compiler]),
    });
    expect(found.compiler).toBe(compiler);
    expect(found.homeSource).toBe("env");
  });

  it("discovers the home from the workspace layout", () => {
    const home = joinPath("D:", "yaazhi");
    const compiler = joinPath(home, "bin", "yaazhi.exe");
    const found = discoverYaazhiHome({
      configuredHome: "",
      workspaceFolders: [home],
      env: {},
      platform: "win32",
      exists: existsFor([compiler]),
    });
    expect(found.compiler).toBe(compiler);
    expect(found.homeSource).toBe("workspace");
  });

  it("discovers an installed distribution via a launcher on PATH", () => {
    const home = joinPath("D:", "yaazhi");
    const compiler = joinPath(home, "bin", "yaazhi.exe");
    const launcher = joinPath(home, "bin", "yaazhi.exe");
    const found = discoverYaazhiHome({
      configuredHome: "",
      workspaceFolders: [],
      env: {},
      platform: "win32",
      exists: existsFor([compiler]),
      findOnPath: () => [launcher],
    });
    expect(found.compiler).toBe(compiler);
    expect(found.homeSource).toBe("installed");
  });

  it("never selects a .exe compiler on Linux", () => {
    const home = joinPath("/srv", "yaazhi");
    const exeOnly = joinPath(home, "bin", "yaazhi.exe");
    const found = discoverYaazhiHome({
      configuredHome: "",
      workspaceFolders: [home],
      env: {},
      platform: "linux",
      exists: existsFor([exeOnly]),
    });
    expect(found.compiler).toBe("");
    expect(found.homeSource).toBe("none");
  });

  it("reports none when nothing is found", () => {
    const found = discoverYaazhiHome({
      configuredHome: "",
      workspaceFolders: [joinPath("C:", "empty")],
      env: {},
      exists: existsFor([]),
    });
    expect(found.compiler).toBe("");
    expect(found.homeSource).toBe("none");
  });
});

describe("compiler invocation", () => {
  it("builds the native build command", () => {
    const args = buildCompileArgs("D:\\p\\main.ழி", "D:\\p\\main.ழி.nbc", {
      bin: "D:\\yaazhi\\bin\\yaazhi",
      extraArgs: [],
    });
    expect(args).toEqual(["build", "D:\\p\\main.ழி", "-o", "D:\\p\\main.ழி.nbc"]);
  });

  it("passes the compiler environment through unchanged", () => {
    const env = compilerEnv({ PATH: "x" });
    expect(env["PATH"]).toBe("x");
    expect(env["PYTHONUTF8"]).toBeUndefined();
  });
});