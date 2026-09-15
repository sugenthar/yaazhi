/** findSymbols: class/method/constructor outline over real Yaazhi syntax. */
import { describe, expect, it } from "vitest";
import { findSymbols } from "../src/language/symbolProvider";

describe("findSymbols", () => {
  it("finds a top-level function without a parent", () => {
    const symbols = findSymbols('செயல் கூட்டு(அ, ஆ):\n    கொடு அ + ஆ\n');
    expect(symbols).toEqual([
      { name: "கூட்டு", kind: "function", line: 0, character: 6, parent: undefined },
    ]);
  });

  it("finds a class and nests its methods", () => {
    const text = [
      "வகுப்பு விலங்கு:",
      "    செயல் உருவாக்கு(பெயர்):",
      "        இது.பெயர் = பெயர்",
      "    செயல் ஒலி():",
      "        அச்சிடு(\"...\")",
      "",
    ].join("\n");
    const symbols = findSymbols(text);
    expect(symbols).toHaveLength(3);
    expect(symbols[0]).toMatchObject({ name: "விலங்கு", kind: "class", line: 0 });
    expect(symbols[1]).toMatchObject({
      name: "உருவாக்கு",
      kind: "constructor",
      parent: "விலங்கு",
      line: 1,
    });
    expect(symbols[2]).toMatchObject({ name: "ஒலி", kind: "method", parent: "விலங்கு", line: 3 });
  });

  it("returns to top-level after the class body", () => {
    const text = [
      "வகுப்பு அ:",
      "    செயல் முறை():",
      "        கொடு $௧",
      "செயல் முக்கிய():",
      "    வெளி = அ()",
      "",
    ].join("\n");
    const symbols = findSymbols(text);
    expect(symbols).toHaveLength(3);
    expect(symbols[2]).toMatchObject({ name: "முக்கிய", kind: "function", parent: undefined });
  });

  it("tracks sibling classes independently", () => {
    const text = [
      "வகுப்பு அ:",
      "    செயல் ச():",
      "        pசெல்க",
      "வகுப்பு ஆ:",
      "    செயல் ஈ():",
      "        கொடு $௨",
      "",
    ].join("\n");
    const symbols = findSymbols(text);
    expect(symbols).toHaveLength(4);
    expect(symbols[1].parent).toBe("அ");
    expect(symbols[3]).toMatchObject({ name: "ஈ", kind: "method", parent: "ஆ" });
  });

  it("skips comment lines", () => {
    const symbols = findSymbols("# செயல் கண்டுபிடி():\nசெயல் உண்மையான():\n    கொடு $மெய்\n");
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("உண்மையான");
  });

  it("recognizes the உருவாக்குபவர் constructor alias", () => {
    const symbols = findSymbols("வகுப்பு அ:\n    செயல் உருவாக்குபவர்():\n        பசுல்\n");
    expect(symbols[1].kind).toBe("constructor");
  });
});