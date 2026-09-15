/** Yaazhi completion: keywords, built-ins, literals + networking IntelliSense. */
import * as vscode from "vscode";
import { BUILTINS, KEYWORDS, TYPES, LITERALS, LANGUAGE_ID } from "../constants";

const KEYWORD_DETAIL = "Yaazhi keyword";
const BUILTIN_DETAIL = "Yaazhi built-in";
const TYPE_DETAIL = "Yaazhi type";

// Networking completions — only for actually implemented APIs
const VALAI_DOT = [
  { label: "சேவையகம்", detail: "வலை.சேவையகம்(host, port) — HTTP server", kind: vscode.CompletionItemKind.Function },
  { label: "பெறு", detail: "வலை.பெறு(url) — client GET", kind: vscode.CompletionItemKind.Function },
  { label: "அனுப்பு", detail: "வலை.அனுப்பு(url, body) — client POST", kind: vscode.CompletionItemKind.Function },
  { label: "மாற்று", detail: "வலை.மாற்று(url, body) — client PUT", kind: vscode.CompletionItemKind.Function },
  { label: "நீக்கு", detail: "வலை.நீக்கு(url) — client DELETE", kind: vscode.CompletionItemKind.Function },
  { label: "பதில்", detail: "வலை.பதில்(body, status, headers) — HTTP response", kind: vscode.CompletionItemKind.Function },
] as const;

const TARAVU_DOT = [
  { label: "ஜெசன்", detail: "தரவு.ஜெசன்(value) — JSON serialize", kind: vscode.CompletionItemKind.Function },
  { label: "சரமாக்கு", detail: "தரவு.சரமாக்கு(value) — alias for ஜெசன்", kind: vscode.CompletionItemKind.Function },
  { label: "பகுப்பாய்வு", detail: "தரவு.பகுப்பாய்வு(jsonStr) — JSON parse", kind: vscode.CompletionItemKind.Function },
] as const;

const SERVER_DOT = [
  { label: "பெறு", detail: "GET route — சேவையகம்.பெறு(path, செயல்(கோரிக்கை): ...)", kind: vscode.CompletionItemKind.Method },
  { label: "அனுப்பு", detail: "POST route — சேவையகம்.அனுப்பு(path, செயல்(...))", kind: vscode.CompletionItemKind.Method },
  { label: "மாற்று", detail: "PUT route — சேவையகம்.மாற்று(path, செயல்(...))", kind: vscode.CompletionItemKind.Method },
  { label: "நீக்கு", detail: "DELETE route — சேவையகம்.நீக்கு(path, செயல்(...))", kind: vscode.CompletionItemKind.Method },
  { label: "இயக்கு", detail: "Start server — சேவையகம்.இயக்கு()", kind: vscode.CompletionItemKind.Method },
  { label: "கோப்பு", detail: "Static file — சேவையகம்.கோப்பு(path, file)", kind: vscode.CompletionItemKind.Method },
  { label: "கோப்பை", detail: "Alias for கோப்பு", kind: vscode.CompletionItemKind.Method },
  { label: "நிலையான", detail: "Static dir — சேவையகம்.நிலையான(prefix, dir)", kind: vscode.CompletionItemKind.Method },
  { label: "மிடில்வேர்", detail: "Middleware — சேவையகம்.மிடில்வேர்(செயல்(கோரிக்கை, அடுத்தது): ...)", kind: vscode.CompletionItemKind.Method },
  { label: "CORS", detail: "CORS — சேவையகம்.CORS() or சேவையகம்.CORS({origin, methods})", kind: vscode.CompletionItemKind.Method },
] as const;

const REQUEST_DOT = [
  { label: "முறை", detail: "HTTP method", kind: vscode.CompletionItemKind.Property },
  { label: "பாதை", detail: "Request path", kind: vscode.CompletionItemKind.Property },
  { label: "வழி", detail: "Alias for பாதை (path)", kind: vscode.CompletionItemKind.Property },
  { label: "உடல்", detail: "Request body", kind: vscode.CompletionItemKind.Property },
  { label: "தலைப்புகள்", detail: "Headers dictionary", kind: vscode.CompletionItemKind.Property },
  { label: "வினவல்", detail: "Query string (parsed dict)", kind: vscode.CompletionItemKind.Property },
  { label: "அளவுருக்கள்", detail: "Dynamic route params", kind: vscode.CompletionItemKind.Property },
  { label: "params", detail: "Alias for அளவுருக்கள்", kind: vscode.CompletionItemKind.Property },
  { label: "ஜெசன்", detail: "Parse JSON body — கோரிக்கை.ஜெசன்()", kind: vscode.CompletionItemKind.Method },
  { label: "method", detail: "English alias for முறை", kind: vscode.CompletionItemKind.Property },
  { label: "path", detail: "English alias for பாதை", kind: vscode.CompletionItemKind.Property },
  { label: "body", detail: "English alias for உடல்", kind: vscode.CompletionItemKind.Property },
  { label: "headers", detail: "English alias for தலைப்புகள்", kind: vscode.CompletionItemKind.Property },
  { label: "query", detail: "English alias for வினவல்", kind: vscode.CompletionItemKind.Property },
] as const;

export class YaazhiCompletionProvider implements vscode.CompletionItemProvider {
  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] {
    if (document.languageId !== LANGUAGE_ID) return [];
    const line = document.lineAt(position.line).text.slice(0, position.character);
    // Context-aware networking completions
    if (line.endsWith("வலை.")) {
      return VALAI_DOT.map((e) => {
        const it = new vscode.CompletionItem(e.label, e.kind);
        it.detail = e.detail;
        return it;
      });
    }
    if (line.endsWith("தரவு.") || line.endsWith("செய்தியகம்.")) {
      return TARAVU_DOT.map((e) => {
        const it = new vscode.CompletionItem(e.label, e.kind);
        it.detail = e.detail;
        return it;
      });
    }
    if (/(?:சேவையகம்|server)\.$/.test(line)) {
      return SERVER_DOT.map((e) => {
        const it = new vscode.CompletionItem(e.label, e.kind);
        it.detail = e.detail;
        return it;
      });
    }
    if (/(?:கோரிக்கை|req|request)\.$/.test(line)) {
      return REQUEST_DOT.map((e) => {
        const it = new vscode.CompletionItem(e.label, e.kind);
        it.detail = e.detail;
        return it;
      });
    }

    const items: vscode.CompletionItem[] = [];
    for (const keyword of KEYWORDS) {
      const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
      item.detail = KEYWORD_DETAIL;
      items.push(item);
    }
    for (const type of TYPES) {
      const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
      item.detail = TYPE_DETAIL;
      items.push(item);
    }
    for (const builtin of BUILTINS) {
      const item = new vscode.CompletionItem(builtin, vscode.CompletionItemKind.Function);
      item.detail = BUILTIN_DETAIL;
      items.push(item);
    }
    for (const literal of LITERALS) {
      const item = new vscode.CompletionItem(literal, vscode.CompletionItemKind.Constant);
      item.detail = "Yaazhi literal";
      items.push(item);
    }
    // Always include networking top-level items for discoverability
    for (const e of [...VALAI_DOT, ...TARAVU_DOT, ...SERVER_DOT]) {
      const it = new vscode.CompletionItem(e.label, e.kind);
      it.detail = e.detail;
      // avoid duplicates with keywords
      if (!items.some((x) => x.label === e.label)) items.push(it);
    }
    return items;
  }
}
