import { describe, expect, it } from "vitest";
import { YaazhiCompletionProvider } from "../src/language/completionProvider";
import { YaazhiHoverProvider } from "../src/language/hoverProvider";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function makeDoc(text: string, languageId = "yaazhi", cursorLine = 0, cursorChar = 0) {
  const lines = text.split("\n");
  return {
    languageId,
    getText: () => text,
    lineAt: (line: number) => ({ text: lines[line] || "" }),
    getWordRangeAtPosition: (pos: { line: number; character: number }, re?: RegExp) => {
      const l = lines[pos.line] || "";
      const before = l.slice(0, pos.character);
      const after = l.slice(pos.character);
      const left = before.match(re || /[\p{L}$_][\p{L}\p{N}$_]*/u);
      // Simplified: return range covering the word
      const word = (before.match(/[\p{L}\p{N}$_\.]*$/u)?.[0] || "") + (after.match(/^[\p{L}\p{N}$_\.]*/u)?.[0] || "");
      if (!word) return undefined;
      const start = pos.character - (before.match(/[\p{L}\p{N}$_\.]*$/u)?.[0].length || 0);
      const end = start + word.length;
      return { start: { line: pos.line, character: start }, end: { line: pos.line, character: end } };
    },
  } as unknown as import("vscode").TextDocument;
}

describe("networking IntelliSense", () => {
  it("completion after வலை. suggests சேவையகம்", () => {
    const provider = new YaazhiCompletionProvider();
    const doc = makeDoc("வலை.", "yaazhi", 0, 3);
    // "வலை." is 3 chars (வ, லை, .) but length in JS is more; we just test with position after dot
    const pos = { line: 0, character: 3 } as unknown as import("vscode").Position;
    // Actually we need to set character to after "வலை."
    const line = "வலை.";
    const p = { line: 0, character: line.length } as unknown as import("vscode").Position;
    const items = provider.provideCompletionItems(doc as unknown as import("vscode").TextDocument, p);
    const labels = items.map((i) => i.label as unknown as string);
    expect(labels).toContain("சேவையகம்");
    expect(labels).toContain("பெறு");
  });

  it("completion after சேவையகம். suggests பெறு/இயக்கு", () => {
    const provider = new YaazhiCompletionProvider();
    const line = "சேவையகம்.";
    const p = { line: 0, character: line.length } as unknown as import("vscode").Position;
    const doc = makeDoc(line);
    const items = provider.provideCompletionItems(doc as unknown as import("vscode").TextDocument, p);
    const labels = items.map((i) => i.label as unknown as string);
    expect(labels).toContain("பெறு");
    expect(labels).toContain("இயக்கு");
  });

  it("completion after கோரிக்கை. suggests முறை/பாதை", () => {
    const provider = new YaazhiCompletionProvider();
    const line = "கோரிக்கை.";
    const p = { line: 0, character: line.length } as unknown as import("vscode").Position;
    const doc = makeDoc(line);
    const items = provider.provideCompletionItems(doc as unknown as import("vscode").TextDocument, p);
    const labels = items.map((i) => i.label as unknown as string);
    expect(labels).toContain("முறை");
    expect(labels).toContain("பாதை");
  });

  it("hover for வலை.சேவையகம் provides docs", () => {
    const provider = new YaazhiHoverProvider();
    const doc = makeDoc("வலை.சேவையகம்", "yaazhi", 0, 5);
    const pos = { line: 0, character: 5 } as unknown as import("vscode").Position;
    const hover = provider.provideHover(doc as unknown as import("vscode").TextDocument, pos);
    expect(hover).toBeDefined();
    const val = (hover as unknown as { contents: { value: string } }).contents.value;
    expect(val).toContain("சேவையகம்");
  });

  it("hover for பெறு provides GET docs", () => {
    const provider = new YaazhiHoverProvider();
    const doc = makeDoc("பெறு", "yaazhi", 0, 1);
    const pos = { line: 0, character: 1 } as unknown as import("vscode").Position;
    const hover = provider.provideHover(doc as unknown as import("vscode").TextDocument, pos);
    expect(hover).toBeDefined();
  });

  it("snippets include networking server", () => {
    const snippets = JSON.parse(fs.readFileSync(path.join(ROOT, "snippets/yaazhi.json"), "utf-8"));
    expect(snippets["Yaazhi web server"]).toBeDefined();
    expect(snippets["Yaazhi web server"].body.join("\n")).toContain("வலை.சேவையகம்");
    expect(snippets["Yaazhi GET route"]).toBeDefined();
    expect(snippets["Yaazhi POST route"]).toBeDefined();
    expect(snippets["Yaazhi PUT route"]).toBeDefined();
    expect(snippets["Yaazhi DELETE route"]).toBeDefined();
  });

  it("diagnostics: செயல் callback example file exists and is valid", () => {
    const p = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."), "examples/வணக்கம்.ழி");
    const text = fs.readFileSync(p, "utf-8");
    expect(text).toContain("சேவையகம்.பெறு");
    expect(text).toContain("செயல்(கோரிக்கை):");
    expect(text).toContain("வலை.சேவையகம்");
  });
});
