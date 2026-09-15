/** Diagnostic parsing against real compiler output shapes. */
import { describe, expect, it } from "vitest";
import { parseCompilerOutput } from "../src/diagnostics/diagnosticParser";

describe("parseCompilerOutput", () => {
  it("parses a parser error with a Tamil line marker", () => {
    const text = "யாழி பிழை: பகுப்பாய்வு பிழை: எதிர்பாராத குறி (வரி 3)";
    const diags = parseCompilerOutput(text);
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBe(2);
    expect(diags[0].wholeLine).toBe(true);
    expect(diags[0].severity).toBe("error");
  });

  it("parses a lexer error", () => {
    const text = "யாழி பிழை: நெடுநிலை பிழை: எண்ணுக்கு முன் $ தேவை (number needs $ prefix) (வரி 1)";
    const diags = parseCompilerOutput(text);
    expect(diags).toHaveLength(1);
    expect(diags[0].line).toBe(0);
  });

  it("keeps file-level errors without inventing locations", () => {
    const text = "மூலக் கோப்பு கிடைக்கவில்லை: D:\\x\\main.ழி";
    const diags = parseCompilerOutput(text);
    expect(diags).toHaveLength(1);
    expect(diags[0].wholeLine).toBe(false);
  });

  it("ignores success chatter and blank lines", () => {
    const text = "யாழி பைட்டுக்குறியீடு எழுதப்பட்டது: out.nbc (12 பைட்டுகள்)\n\n";
    expect(parseCompilerOutput(text)).toHaveLength(0);
  });

  it("returns nothing for empty output", () => {
    expect(parseCompilerOutput("")).toEqual([]);
  });
});
