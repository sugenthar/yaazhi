/**
 * Regression tests for the REAL Run File / Run Project command wiring
 * (native-only toolchain).
 *
 * These drive the actual `runFile` / `runProject` command handlers through
 * the real modules:
 *   `commands/common.ts requireToolchain`
 *   → native `yaazhi run <target>` via `ManagedProcess` → `child_process.spawn`.
 *
 * Only the OS boundary is faked (`child_process.spawn`) and `fs.existsSync`
 * (so nonexistent binaries can "exist" for any simulated platform); every
 * producer/consumer module is the real compiled pipeline. The captured spawn
 * (exe + argv) is exactly the OS call that previously failed on another
 * implementation with `can't execute binary file` / exit 126.
 *
 * Guarantee pinned here: the compiler handed to `spawn` is the platform-native
 * Yaazhi binary (`.exe` on Windows, suffix-less on macOS, `.lnx`/plain on
 * Linux) and `yaazhi run` performs the compile+execute in one native process.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  resetVscodeMock,
  vscodeState,
  vscodeShownErrors,
  MockTextDocument,
} from "./helpers/vscodeMock";
import { runFile } from "../src/commands/runFile";
import { runProject } from "../src/commands/runProject";

/** OS-level spawns captured through the real ManagedProcess/runProcess. */
const spawnCalls = vi.hoisted(
  () =>
    [] as Array<{
      exe: string;
      args: string[];
      cwd: unknown;
      env: unknown;
      windowsHide: boolean;
    }>,
);

/** Shared state the mocked `fs.existsSync` consults (per-test reset). */
const fsMockState = vi.hoisted(() => ({
  existingPaths: new Set<string>(),
  realExistsSync: null as null | ((p: unknown) => boolean),
}));

vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof fs>("fs");
  fsMockState.realExistsSync = actual.existsSync as (p: unknown) => boolean;
  return {
    ...actual,
    existsSync: (p: unknown) => {
      const s = String(p);
      if (fsMockState.existingPaths.has(s)) return true;
      return fsMockState.realExistsSync ? fsMockState.realExistsSync(p) : false;
    },
  };
});

vi.mock("child_process", async () => {
  const actual = await vi.importActual<typeof import("child_process")>("child_process");
  return {
    ...actual,
    spawn: (exe: string, args: readonly string[], opts?: Record<string, unknown>) => {
      spawnCalls.push({
        exe,
        args: [...args],
        cwd: opts?.cwd,
        env: opts?.env,
        windowsHide: (opts?.windowsHide as boolean) ?? false,
      });
      const child = {
        on(event: string, cb: (a: unknown) => void) {
          if (event === "close") queueMicrotask(() => cb(0));
          return child;
        },
        stdout: { on: () => child },
        stderr: { on: () => child },
        kill: () => true,
        pid: 1234,
      };
      return child;
    },
  };
});

const originalPlatform = process.platform;
const originalEnv: Record<string, string | undefined> = {
  YAAZHI_HOME: process.env.YAAZHI_HOME,
  PATH: process.env.PATH,
};

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { value: platform, configurable: true });
}

function context(): { subscriptions: unknown[] } {
  return { subscriptions: [] };
}

function yazhiDocument(fileName: string): MockTextDocument {
  return {
    uri: { fsPath: fileName },
    fileName,
    languageId: "yaazhi",
    isUntitled: false,
    isDirty: false,
    lineCount: 1,
    save: () => Promise.resolve(true),
    lineAt: () => ({ text: "", range: {} }),
  };
}

function yazhiEditor(fileName: string): { document: MockTextDocument } {
  return { document: yazhiDocument(fileName) };
}

beforeEach(() => {
  resetVscodeMock();
  spawnCalls.length = 0;
  fsMockState.existingPaths = new Set<string>();
  setPlatform("linux");
  process.env.YAAZHI_HOME = "";
  process.env.PATH = "/usr/bin:/bin";
});

afterEach(() => {
  setPlatform(originalPlatform);
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const LINUX_HOME = "/opt/yaazhi";
const LINUX_COMPILER = `${LINUX_HOME}/compiler/build/yaazhi`;

describe("Run File / Run Project: ONE native compiler invocation (yaazhi run)", () => {
  it("Linux Run File spawns the native compiler with ['run', file]", async () => {
    fsMockState.existingPaths.add(LINUX_COMPILER);
    fsMockState.existingPaths.add(`${LINUX_HOME}/runtime/build/yaazhi_run.lnx`);
    fsMockState.existingPaths.add(`${LINUX_HOME}/runtime/build/yaazhi_run.exe`);
    vscodeState.config = { home: LINUX_HOME };
    vscodeState.activeEditor = yazhiEditor("/project/main.ழி");

    await runFile(context());

    // EXACTLY ONE spawn: the native `yaazhi run <file>` pipeline.
    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].exe).toBe(LINUX_COMPILER);
    expect(spawnCalls[0].args).toEqual(["run", "/project/main.ழி"]);
    expect(spawnCalls[0].cwd).toBe("/project");
    // No process is ever spawned with the Windows .exe.
    expect(spawnCalls.every((s) => !s.exe.endsWith(".exe"))).toBe(true);
    expect(vscodeShownErrors()).toHaveLength(0);
  });

  it("Linux Run Project spawns ['run', projectRoot] from the project directory", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "yaazhi-proj-"));
    const entry = path.join(root, "main.ழி");
    fs.writeFileSync(path.join(root, "yazhi.toml"), `{\n  "name": "Wiring",\n  "entry": "main.ழி"\n}\n`, "utf-8");
    fs.writeFileSync(entry, "", "utf-8");

    fsMockState.existingPaths.add(LINUX_COMPILER);
    vscodeState.config = { home: LINUX_HOME };
    vscodeState.folders = [{ uri: { fsPath: root } }];
    vscodeState.activeEditor = yazhiEditor(entry);

    await runProject(context());

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].exe).toBe(LINUX_COMPILER);
    expect(spawnCalls[0].args).toEqual(["run", root]);
    expect(spawnCalls[0].cwd).toBe(root);
    expect(spawnCalls.every((s) => !s.exe.endsWith(".exe"))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("Windows Run File spawns bin\\yaazhi.exe (and never the .lnx)", async () => {
    setPlatform("win32");
    const winHome = "C:\\Yaazhi";
    const winCompiler = "C:\\Yaazhi\\bin\\yaazhi.exe";
    fsMockState.existingPaths.add(winCompiler);
    fsMockState.existingPaths.add("C:\\Yaazhi\\bin\\yaazhi.lnx"); // trap
    vscodeState.config = { home: winHome };
    vscodeState.activeEditor = yazhiEditor("C:\\project\\main.ழி");

    await runFile(context());

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].exe).toBe(winCompiler);
    expect(spawnCalls[0].args).toEqual(["run", "C:\\project\\main.ழி"]);
  });

  it("macOS Run File spawns a suffix-less native compiler — never .exe or .lnx", async () => {
    setPlatform("darwin");
    const macHome = "/opt/yaazhi";
    const macCompiler = "/opt/yaazhi/bin/yaazhi";
    fsMockState.existingPaths.add(macCompiler);
    fsMockState.existingPaths.add(`${macHome}/bin/yaazhi.exe`); // trap
    fsMockState.existingPaths.add(`${macHome}/bin/yaazhi.lnx`); // trap
    vscodeState.config = { home: macHome };
    vscodeState.activeEditor = yazhiEditor("/Users/dev/project/main.ழி");

    await runFile(context());

    expect(spawnCalls).toHaveLength(1);
    expect(spawnCalls[0].exe).toBe(macCompiler);
    expect(spawnCalls[0].exe.endsWith(".exe")).toBe(false);
    expect(spawnCalls[0].exe.endsWith(".lnx")).toBe(false);
  });

  it("rejects a missing compiler BEFORE any spawn", async () => {
    // No compiler markers exist under the configured home.
    vscodeState.config = { home: LINUX_HOME };
    vscodeState.activeEditor = yazhiEditor("/project/main.ழி");

    await runFile(context());

    // Zero spawns: nothing to run without a compiler.
    expect(spawnCalls).toHaveLength(0);
    expect(vscodeShownErrors().length).toBeGreaterThan(0);
  });

  it("configured-but-invalid home shows a targeted error (no spawn)", async () => {
    vscodeState.config = { home: LINUX_HOME };
    vscodeState.activeEditor = yazhiEditor("/project/main.ழி");
    // A compiler exists elsewhere on disk only — must NOT be silently picked up.
    fsMockState.existingPaths.add("/elsewhere/bin/yaazhi");
    fsMockState.existingPaths.add("/elsewhere/compiler/build/yaazhi");

    await runFile(context());

    expect(spawnCalls).toHaveLength(0);
    expect(vscodeShownErrors().some((m) => m.includes('"yaazhi.home"'))).toBe(true);
  });
});

describe("VS Code configuration must not contribute an absolute toolchain path", () => {
  it("yaazhi.home / runtime / compiler default to the empty string in package.json (no baked-in path)", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    const props = pkg.contributes.configuration.properties;
    for (const key of ["yaazhi.home", "yaazhi.runtime", "yaazhi.compiler"]) {
      expect(props[key].default, key).toBe("");
      expect(props[key].default, key).not.toMatch(/^[A-Za-z]:[\\/]/);
      expect(props[key].default, key).not.toContain("/home/");
    }
  });

  it("does not resurrect pythonPath/languageServer/debugger/restartLanguageServer settings or commands", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf-8"));
    const props = pkg.contributes.configuration.properties;
    expect(props["yaazhi.pythonPath"]).toBeUndefined();
    expect(props["yaazhi.languageServer.enabled"]).toBeUndefined();
    expect(props["yaazhi.debugger"]).toBeUndefined();
    expect(pkg.contributes.debuggers).toBeUndefined();
    const titles = JSON.stringify(pkg.contributes.commands);
    expect(titles).not.toContain("restartLanguageServer");
    expect(JSON.stringify(pkg.contributes.commands)).not.toContain("debugFile");
  });
});