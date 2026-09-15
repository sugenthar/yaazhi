/**
 * Parse real Yaazhi compiler stderr into structured diagnostics.
 *
 * Verified compiler output shapes (native Yaazhi CLI):
 *   "யாழி பிழை: <message> (வரி N)"      single-file / project compile errors
 *   "பிழை: <message>"                    CLI-level failures
 *   "<kind> பிழை: <message> (வரி N)"     lexer/parser wrapped errors
 *   "மூலக் கோப்பு கிடைக்கவில்லை: <path>"
 *   "இயந்திரம் காணப்படவில்லை ..."
 *
 * The compiler reports a 1-based line via "(வரி N)" but no column, so
 * diagnostics cover the whole line. Locations are never invented: when no
 * line is present the diagnostic is file-level (line 0).
 * No vscode imports — safe for unit tests.
 */

export type YaazhiSeverity = "error" | "warning";

export interface ParsedDiagnostic {
  /** 0-based line. 0 with wholeLine=false means file-level. */
  line: number;
  /** 0-based column (0 unless the compiler gave one). */
  column: number;
  /** When true the diagnostic covers the whole line. */
  wholeLine: boolean;
  severity: YaazhiSeverity;
  message: string;
}

const LINE_RE = /\(வரி\s*(\d+)\)/;
const WARNING_RE = /எச்சரிக்கை/i;

function toZeroBased(n: number): number {
  return Math.max(0, n - 1);
}

/** Parse compiler stderr (or combined output) into diagnostics. */
export function parseCompilerOutput(text: string): ParsedDiagnostic[] {
  const out: ParsedDiagnostic[] = [];
  if (!text) return out;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    // Skip success chatter ("…பைட்டுக்குறியீடு எழுதப்பட்டது…").
    if (/பைட்டுக்குறியீடு எழுதப்பட்டது/.test(line)) continue;
    if (!/பிழை|கிடைக்கவில்லை|காணப்படவில்லை|தேவை|ஆதரிக்கப்படவில்லை/i.test(line)) {
      continue;
    }
    const m = LINE_RE.exec(line);
    const severity: YaazhiSeverity = WARNING_RE.test(line) ? "warning" : "error";
    if (m) {
      out.push({
        line: toZeroBased(parseInt(m[1], 10)),
        column: 0,
        wholeLine: true,
        severity,
        message: line,
      });
    } else {
      out.push({ line: 0, column: 0, wholeLine: false, severity, message: line });
    }
  }
  return out;
}
