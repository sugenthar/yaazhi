/** Mini helper for syntax grammar assertions (approx TextMate scopes via JS regex). */
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

export function loadGrammar(root: string): Record<string, unknown> {
  const p = path.join(root, "syntaxes/yaazhi.tmLanguage.json");
  return JSON.parse(fs.readFileSync(p, "utf-8")) as Record<string, unknown>;
}

export function grammarJson(grammar: unknown): string {
  return JSON.stringify(grammar);
}

/**
 * Try to match a grammar `match` regex against `text` using JS RegExp with `u` flag.
 * TextMate uses Oniguruma; JS `u` is a close approximation for Tamil/word boundaries.
 * Returns true if the regex matches anywhere in text.
 */
export function matches(grammarMatch: string, text: string): boolean {
  try {
    const re = new RegExp(grammarMatch, "u");
    return re.test(text);
  } catch {
    return false;
  }
}

/**
 * Find all `match` strings in the grammar (recursively) for debugging.
 */
export function collectMatchPatterns(grammar: Record<string, unknown>): string[] {
  const out: string[] = [];
  const repo = (grammar.repository ?? {}) as Record<string, { patterns?: Array<Record<string, unknown>> }>;
  const top = (grammar.patterns ?? []) as Array<Record<string, unknown>>;
  const walk = (arr: Array<Record<string, unknown>>) => {
    for (const pat of arr) {
      if (typeof pat.match === "string") out.push(pat.match as string);
      if (typeof pat.begin === "string") out.push(pat.begin as string);
      if (Array.isArray(pat.patterns)) walk(pat.patterns as Array<Record<string, unknown>>);
    }
  };
  walk(top);
  for (const key of Object.keys(repo)) {
    const entry = repo[key];
    if (entry?.patterns) walk(entry.patterns as Array<Record<string, unknown>>);
  }
  return out;
}

/**
 * Compile a .ழி fixture via the real native Yaazhi compiler (read-only check).
 * Returns the raw { ok, stderr, status }.
 *
 * Grammar-only fixtures may use constructs the current native compiler
 * deliberately rejects (see KNOWN sidebar in syntax.test.ts); callers decide
 * whether a rejection is an expected parity gap or a failure.
 */
export function compileFixture(fixturePath: string, repoRoot: string): { ok: boolean; stderr: string; status: number | null } {
  const compiler =
    [`${repoRoot}/bin/yaazhi`, `${repoRoot}/compiler/build/yaazhi`].find((p) => fs.existsSync(p)) ?? "";
  if (compiler === "") {
    return { ok: false, stderr: "native compiler not built (no bin/yaazhi or compiler/build/yaazhi)", status: null };
  }
  const out = path.join("/tmp", `yaazhi-syntax-test-${Date.now()}-${Math.random().toString(36).slice(2)}.nbc`);
  const res = spawnSync(compiler, ["build", fixturePath, "-o", out], {
    encoding: "utf-8",
    cwd: repoRoot,
  });
  // Clean up
  try { fs.unlinkSync(out); } catch { /* ignore */ }
  const stderr = (res.stderr ?? "") + (res.stdout ?? "");
  return { ok: res.status === 0, stderr, status: res.status };
}
