/**
 * Lightweight Yaazhi document symbols (Outline / Go to Symbol / breadcrumbs).
 * Regex-based over real syntax (`செயல்` name(...):, `வகுப்பு` name:);
 * the pure `findSymbols` core is unit-tested.
 */
import * as vscode from "vscode";
import { LANGUAGE_ID } from "../constants";

export interface FoundSymbol {
  name: string;
  kind: "function" | "class" | "method" | "constructor";
  line: number;
  character: number;
  /** Class this member belongs to, when the kind is method/constructor. */
  parent?: string;
}

const CLASS_RE = /^\s*வகுப்பு(\s+\[.*?\])?\s+([^\s(:]+)/;
const METHOD_RE = /^\s*செயல்\s+([^\s:(]+)\s*\(/;
const CTOR_NAMES = new Set(["உருவாக்கு", "உருவாக்குபவர்"]);

/** Scan document text for Yaazhi declarations. Pure — no vscode API. */
export function findSymbols(text: string): FoundSymbol[] {
  const symbols: FoundSymbol[] = [];
  const lines = text.split(/\r?\n/);
  /** Indentation of the most recent class header (null when not in a class). */
  let classIndent: number | null = null;
  let currentClass: string | null = null;

  lines.forEach((lineText, line) => {
    if (lineText.trimStart().startsWith("#")) return;
    const indent = lineText.length - lineText.trimStart().length;
    if (currentClass !== null && indent <= (classIndent ?? 0) && !lineText.trimStart().startsWith("வகுப்பு")) {
      currentClass = null;
      classIndent = null;
    }
    const cls = CLASS_RE.exec(lineText);
    if (cls) {
      const name = cls[2];
      symbols.push({ name, kind: "class", line, character: lineText.indexOf(name) });
      classIndent = indent;
      currentClass = name;
      return;
    }
    const m = METHOD_RE.exec(lineText);
    if (m) {
      const name = m[1];
      const inClass = currentClass !== null && indent > (classIndent ?? 0);
      const kind: FoundSymbol["kind"] =
        inClass && CTOR_NAMES.has(name) ? "constructor" : inClass ? "method" : "function";
      symbols.push({ name, kind, line, character: lineText.indexOf(name), parent: inClass ? currentClass ?? undefined : undefined });
    }
  });
  return symbols;
}

export class YaazhiSymbolProvider implements vscode.DocumentSymbolProvider {
  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    if (document.languageId !== LANGUAGE_ID) return [];
    const members = new Map<string, vscode.DocumentSymbol[]>();
    const roots: vscode.DocumentSymbol[] = [];
    for (const s of findSymbols(document.getText())) {
      const kind =
        s.kind === "class"
          ? vscode.SymbolKind.Class
          : s.kind === "constructor"
            ? vscode.SymbolKind.Constructor
            : s.kind === "method"
              ? vscode.SymbolKind.Method
              : vscode.SymbolKind.Function;
      const pos = new vscode.Position(s.line, Math.max(0, s.character));
      const range = document.getWordRangeAtPosition(pos) ?? new vscode.Range(pos, pos);
      const symbol = new vscode.DocumentSymbol(s.name, "", kind, range, range);
      if (s.parent) {
        const list = members.get(s.parent) ?? [];
        list.push(symbol);
        members.set(s.parent, list);
      } else {
        roots.push(symbol);
      }
    }
    // Attach member symbols to their class symbol.
    for (const root of roots) {
      const children = members.get(root.name);
      if (children && children.length > 0) root.children = children;
    }
    return roots;
  }
}
