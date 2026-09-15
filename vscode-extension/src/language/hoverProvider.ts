/** Yaazhi hover: keywords, built-ins and networking API. */
import * as vscode from "vscode";
import { HOVER_DOCS, NETWORK_HOVER_DOCS, LANGUAGE_ID } from "../constants";

const WORD_RE = /[\p{L}$_][\p{L}\p{N}$_]*/u;
const DOTTED_RE = /[\p{L}$_\.][\p{L}\p{N}$_\.]*/u;

export class YaazhiHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.Hover | undefined {
    if (document.languageId !== LANGUAGE_ID) return undefined;
    // First try dotted form like வலை.சேவையகம் or சேவையகம்.பெறு or கோரிக்கை.முறை
    const dottedRange = document.getWordRangeAtPosition(position, DOTTED_RE);
    if (dottedRange) {
      const dotted = document.getText(dottedRange);
      // Check full dotted and also last segment
      const docFull = (HOVER_DOCS as Record<string, string>)[dotted] || (NETWORK_HOVER_DOCS as Record<string, string>)[dotted];
      if (docFull) {
        return new vscode.Hover(new vscode.MarkdownString(`**${dotted}**\n\n${docFull}`), dottedRange);
      }
      // Try to find the most specific suffix that has docs
      const parts = dotted.split(".");
      for (let i = parts.length - 1; i >= 0; i--) {
        const seg = parts[i];
        const d = (HOVER_DOCS as Record<string, string>)[seg] || (NETWORK_HOVER_DOCS as Record<string, string>)[seg];
        if (d) {
          const segRange = document.getWordRangeAtPosition(position, WORD_RE);
          return new vscode.Hover(new vscode.MarkdownString(`**${seg}**\n\n${d}`), segRange || dottedRange);
        }
      }
    }
    const range = document.getWordRangeAtPosition(position, WORD_RE);
    if (!range) return undefined;
    const word = document.getText(range);
    const doc = (HOVER_DOCS as Record<string, string>)[word] || (NETWORK_HOVER_DOCS as Record<string, string>)[word];
    if (!doc) return undefined;
    return new vscode.Hover(new vscode.MarkdownString(`**${word}**\n\n${doc}`), range);
  }
}
