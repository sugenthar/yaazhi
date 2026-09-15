/** Extension activation surface: language id, commands, settings. */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface LanguageEntry {
  id: string;
  aliases: string[];
  extensions: string[];
}

interface GrammarEntry {
  language: string;
  scopeName: string;
  path: string;
}

interface CommandEntry {
  command: string;
}

interface PackageJson {
  contributes: {
    languages: LanguageEntry[];
    grammars: GrammarEntry[];
    commands: CommandEntry[];
    configuration: { properties: Record<string, unknown> };
  };
  activationEvents: string[];
}

function loadPackageJson(): PackageJson {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as PackageJson;
}

describe("extension manifest", () => {
  it("registers the yaazhi language with the .ழி extension", () => {
    const pkg = loadPackageJson();
    const langs = pkg.contributes.languages;
    expect(langs).toHaveLength(1);
    expect(langs[0].id).toBe("yaazhi");
    expect(langs[0].extensions).toContain(".ழி");
    expect(langs[0].aliases).toContain("Yaazhi");
    expect(langs[0].aliases).toContain("யாழி");
  });

  it("does not register a niral language mode", () => {
    const raw = fs.readFileSync(path.join(ROOT, "package.json"), "utf-8");
    expect(raw.toLowerCase()).not.toContain("niral");
  });

  it("registers the grammar as source.yaazhi", () => {
    const pkg = loadPackageJson();
    const grammars = pkg.contributes.grammars;
    expect(grammars).toHaveLength(1);
    expect(grammars[0].language).toBe("yaazhi");
    expect(grammars[0].scopeName).toBe("source.yaazhi");
    expect(fs.existsSync(path.join(ROOT, grammars[0].path))).toBe(true);
  });

  it("contributes the Yaazhi commands (native-only: no debug/LSP)", () => {
    const pkg = loadPackageJson();
    const ids = pkg.contributes.commands.map((c: CommandEntry) => c.command).sort();
    // Native-only toolchain: run/build/check/stop/restart; LSP and debug
    // commands are gone.
    expect(ids).toEqual([
      "yaazhi.build",
      "yaazhi.check",
      "yaazhi.diagnoseTerminal",
      "yaazhi.openOutput",
      "yaazhi.restart",
      "yaazhi.runFile",
      "yaazhi.runProject",
      "yaazhi.stop",
    ]);
    expect(ids).not.toContain("yaazhi.debugFile");
    expect(ids).not.toContain("yaazhi.debugProject");
    expect(ids).not.toContain("yaazhi.restartLanguageServer");
  });

  it("contributes the documented settings (no pythonPath / languageServer / debugger)", () => {
    const pkg = loadPackageJson();
    const props = pkg.contributes.configuration.properties;
    for (const key of [
      "yaazhi.home",
      "yaazhi.compiler",
      "yaazhi.runtime",
      "yaazhi.compilerArgs",
    ]) {
      expect(props[key], key).toBeDefined();
    }
    expect(props["yaazhi.pythonPath"]).toBeUndefined();
    expect(props["yaazhi.debugger"]).toBeUndefined();
    expect(props["yaazhi.languageServer.enabled"]).toBeUndefined();
    expect(props["yaazhi.runtimeArgs"]).toBeUndefined();
  });

  it("activates on the yaazhi language", () => {
    const pkg = loadPackageJson();
    expect(pkg.activationEvents).toContain("onLanguage:yaazhi");
  });
});
