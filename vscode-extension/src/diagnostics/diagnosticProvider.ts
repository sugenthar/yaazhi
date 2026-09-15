/** Map parsed diagnostics into VS Code Problems + editor squiggles. */
import * as vscode from "vscode";
import { DIAGNOSTIC_SOURCE } from "../constants";
import { parseCompilerOutput, ParsedDiagnostic } from "./diagnosticParser";

let collection: vscode.DiagnosticCollection | null = null;

export function getDiagnosticCollection(context: vscode.ExtensionContext): vscode.DiagnosticCollection {
  if (!collection) {
    collection = vscode.languages.createDiagnosticCollection(DIAGNOSTIC_SOURCE);
    context.subscriptions.push(collection);
  }
  return collection;
}

function toVscodeDiagnostic(doc: vscode.TextDocument, parsed: ParsedDiagnostic): vscode.Diagnostic {
  const severity =
    parsed.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
  let range: vscode.Range;
  if (parsed.wholeLine && parsed.line < doc.lineCount) {
    range = doc.lineAt(parsed.line).range;
  } else if (parsed.line < doc.lineCount) {
    const lineLen = doc.lineAt(parsed.line).text.length;
    const col = Math.min(parsed.column, lineLen);
    range = new vscode.Range(parsed.line, col, parsed.line, Math.max(col + 1, lineLen));
  } else {
    range = new vscode.Range(0, 0, 0, 1);
  }
  const diagnostic = new vscode.Diagnostic(range, parsed.message, severity);
  diagnostic.source = DIAGNOSTIC_SOURCE;
  return diagnostic;
}

/** Replace a document's diagnostics from raw compiler output text. */
export function publishDiagnostics(
  context: vscode.ExtensionContext,
  doc: vscode.TextDocument,
  compilerOutput: string,
): ParsedDiagnostic[] {
  const parsed = parseCompilerOutput(compilerOutput);
  getDiagnosticCollection(context).set(
    doc.uri,
    parsed.map((p) => toVscodeDiagnostic(doc, p)),
  );
  return parsed;
}

/** Clear a document's diagnostics (e.g. after a successful compile). */
export function clearDiagnostics(context: vscode.ExtensionContext, doc: vscode.TextDocument): void {
  getDiagnosticCollection(context).delete(doc.uri);
}
