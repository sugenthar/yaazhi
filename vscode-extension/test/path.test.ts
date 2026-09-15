/** Windows + Unicode path handling. */
import { describe, expect, it } from "vitest";
import {
  baseName,
  dirName,
  isLegacyFile,
  isSubPath,
  isYaazhiFile,
  joinPath,
  normalizePath,
  resolveFrom,
  walkUp,
} from "../src/utils/paths";
import { buildCompileArgs, defaultNbcPath } from "../src/compiler/compiler";

describe("yaazhi paths", () => {
  it("recognizes .ழி files and rejects .அ", () => {
    expect(isYaazhiFile("D:\\a\\main.ழி")).toBe(true);
    expect(isYaazhiFile("D:\\a\\main.py")).toBe(false);
    expect(isLegacyFile("D:\\a\\old.அ")).toBe(true);
    expect(isLegacyFile("D:\\a\\main.ழி")).toBe(false);
  });

  it("handles Tamil directories, spaces, and parentheses", () => {
    const p = joinPath("D:", "Projects", "தமிழ் நிரல் (test)", "main.ழி");
    expect(baseName(p)).toBe("main.ழி");
    expect(dirName(p)).toBe(joinPath("D:", "Projects", "தமிழ் நிரல் (test)"));
    expect(normalizePath(p)).toBe(p);
  });

  it("joins without manual separators", () => {
    expect(joinPath("D:\\a", "b", "c.ழி")).toBe("D:\\a\\b\\c.ழி");
  });

  it("resolves against an explicit base, never cwd", () => {
    expect(resolveFrom("D:\\proj", joinPath("src", "main.ழி"))).toBe("D:\\proj\\src\\main.ழி");
  });

  it("detects sub-paths", () => {
    expect(isSubPath("D:\\proj", "D:\\proj\\src\\a.ழி")).toBe(true);
    expect(isSubPath("D:\\proj", "D:\\other\\a.ழி")).toBe(false);
  });

  it("walkUp yields ancestors up to the root", () => {
    const chain = [...walkUp(joinPath("D:", "a", "b", "c.ழி"), 4)];
    expect(chain[0]).toBe(joinPath("D:", "a", "b"));
    expect(chain[1]).toBe(joinPath("D:", "a"));
    expect(chain.length).toBeLessThanOrEqual(4);
  });
});

const COMPILER_CFG = { bin: "D:\\yaazhi\\bin\\yaazhi", extraArgs: [] as string[] };

describe("native invocation argument construction (Unicode source bug)", () => {
  it("default NBC path keeps the source name", () => {
    expect(defaultNbcPath("D:\\p\\test.ழி")).toBe("D:\\p\\test.ழி.nbc");
  });

  it("Unicode directory target is preserved verbatim for the compiler", () => {
    const target = "D:\\Projects\\தமிழ் நிரல்\\test.ழி";
    const args = buildCompileArgs(target, defaultNbcPath(target), COMPILER_CFG);
    expect(args[1]).toBe(target);
    expect(args[1]).toContain("தமிழ் நிரல்");
    expect(args[1]).toContain("test.ழி");
  });

  it("spaces survive: D:\\Projects\\My Yaazhi Project\\test.ழி", () => {
    const target = "D:\\Projects\\My Yaazhi Project\\test.ழி";
    const args = buildCompileArgs(target, defaultNbcPath(target), COMPILER_CFG);
    expect(args[1]).toBe(target);
  });

  it("Tamil directory survives: D:\\Projects\\யாழி\\test.ழி", () => {
    const target = "D:\\Projects\\யாழி\\test.ழி";
    const args = buildCompileArgs(target, defaultNbcPath(target), COMPILER_CFG);
    expect(args[1]).toBe(target);
    expect(args[1]).toContain("யாழி");
  });

  it("build output path lands after -o, in the exact order passed", () => {
    const outputPath = defaultNbcPath("D:\\p\\தமிழ் நிரல்\\test.ழி");
    const compileArgs = buildCompileArgs("D:\\p\\தமிழ் நிரல்\\test.ழி", outputPath, COMPILER_CFG);
    const outputIndex = compileArgs.indexOf("-o");
    expect(compileArgs[0]).toBe("build");
    expect(compileArgs[outputIndex + 1]).toBe(outputPath);
  });
});
