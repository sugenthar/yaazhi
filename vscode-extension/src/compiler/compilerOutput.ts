/** Human-readable summaries of compiler results. No vscode imports. */

export function summarizeCompile(code: number | null, stderr: string): string {
  if (code === 0) return "Yaazhi compilation succeeded.";
  const first = stderr.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)[0];
  if (first) return `Yaazhi compilation failed. ${first}`;
  return `Yaazhi compilation failed (exit code ${code ?? "unknown"}).`;
}

export function exitCodeLine(code: number | null): string {
  return `Process exited with code: ${code ?? "unknown"}`;
}
