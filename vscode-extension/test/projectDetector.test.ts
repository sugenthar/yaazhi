/** Project detection over an in-memory filesystem. */
import { describe, expect, it } from "vitest";
import { detectProject, findProjectRoot, resolveEntry } from "../src/project/projectDetector";
import { parseManifestJson } from "../src/project/projectConfig";
import { joinPath } from "../src/utils/paths";
import type { ProjectDeps } from "../src/project/projectDetector";

function memFs(files: Record<string, string>): ProjectDeps {
  const lower = new Map<string, string>();
  for (const [k, v] of Object.entries(files)) lower.set(k.toLowerCase(), v);
  return {
    exists: (p) => lower.has(p.toLowerCase()),
    readFile: (p) => lower.get(p.toLowerCase()) ?? null,
    workspaceFolders: [],
  };
}

const ROOT = joinPath("D:", "project");
const SRC = joinPath(ROOT, "src");

describe("parseManifestJson", () => {
  it("parses name and entry", () => {
    expect(parseManifestJson('{"name": "demo", "entry": "src/main.ழி"}')).toEqual({
      name: "demo",
      entry: "src/main.ழி",
    });
  });

  it("rejects invalid JSON and non-objects", () => {
    expect(parseManifestJson("{oops")).toBeNull();
    expect(parseManifestJson("[1,2]")).toBeNull();
    expect(parseManifestJson("42")).toBeNull();
  });
});

describe("findProjectRoot", () => {
  it("walks up from a nested file to yazhi.toml", () => {
    const deps = memFs({ [joinPath(ROOT, "yazhi.toml")]: "{}" });
    const found = findProjectRoot(joinPath(SRC, "main.ழி"), deps);
    expect(found?.root).toBe(ROOT);
    expect(found?.manifest).toBe(joinPath(ROOT, "yazhi.toml"));
  });

  it("returns null when no manifest exists", () => {
    expect(findProjectRoot(joinPath(SRC, "main.ழி"), memFs({}))).toBeNull();
  });
});

describe("resolveEntry", () => {
  it("uses the manifest entry first", () => {
    const entry = joinPath(ROOT, "src", "main.ழி");
    const deps = memFs({ [entry]: "x" });
    expect(resolveEntry(ROOT, { entry: joinPath("src", "main.ழி") }, deps.exists)).toBe(entry);
  });

  it("falls back to முதன்மை.ழி", () => {
    const fallback = joinPath(ROOT, "முதன்மை.ழி");
    const deps = memFs({ [fallback]: "x" });
    expect(resolveEntry(ROOT, null, deps.exists)).toBe(fallback);
  });
});

describe("detectProject", () => {
  it("detects name + entry through திட்டம்.json", () => {
    const entry = joinPath(ROOT, "முதன்மை.ழி");
    const deps = memFs({
      [joinPath(ROOT, "திட்டம்.json")]: JSON.stringify({ name: "demo" }),
      [entry]: "x",
    });
    const project = detectProject(joinPath(SRC, "other.ழி"), deps);
    expect(project?.root).toBe(ROOT);
    expect(project?.name).toBe("demo");
    expect(project?.entry).toBe(entry);
  });

  it("supports D:\\project\\src\\main.ழி → D:\\project\\yazhi.toml", () => {
    const entry = joinPath(ROOT, "src", "main.ழி");
    const deps = memFs({
      [joinPath(ROOT, "yazhi.toml")]: JSON.stringify({ entry: joinPath("src", "main.ழி") }),
      [entry]: "x",
    });
    const project = detectProject(entry, deps);
    expect(project?.root).toBe(ROOT);
    expect(project?.entry).toBe(entry);
  });
});
