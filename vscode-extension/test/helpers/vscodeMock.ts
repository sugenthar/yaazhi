/**
 * Minimal `vscode` API stub so pure-adjacent modules can be unit-tested
 * with vitest (no VS Code download needed). Only what the tests touch.
 */

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export enum SymbolKind {
  Function = 11,
  Class = 4,
}

export enum CompletionItemKind {
  Function = 2,
  Keyword = 13,
  Constant = 20,
}

export class Position {
  constructor(
    public readonly line: number,
    public readonly character: number,
  ) {}
}

export class Range {
  constructor(
    public readonly start: Position,
    public readonly end: Position,
  ) {}
}

export class Diagnostic {
  public source: string | undefined;
  constructor(
    public readonly range: Range,
    public readonly message: string,
    public readonly severity: DiagnosticSeverity = DiagnosticSeverity.Error,
  ) {}
}

export class DocumentSymbol {
  constructor(
    public readonly name: string,
    public readonly detail: string,
    public readonly kind: SymbolKind,
    public readonly range: Range,
    public readonly selectionRange: Range,
  ) {}
}

export class CompletionItem {
  public detail: string | undefined;
  constructor(
    public readonly label: string,
    public readonly kind?: CompletionItemKind,
  ) {}
}

export class MarkdownString {
  constructor(public readonly value: string) {}
}

export class Hover {
  constructor(
    public readonly contents: MarkdownString,
    public readonly range?: Range,
  ) {}
}

/** Minimal EventEmitter (Pseudoterminal/Pty consumers). */
export class EventEmitter<T> {
  private readonly listeners = new Set<(data: T) => void>();

  readonly event = (listener: (data: T) => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  fire(data: T): void {
    for (const cb of [...this.listeners]) {
      try {
        cb(data);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  dispose(): void {
    this.listeners.clear();
  }
}

export interface MockWorkspaceFolder {
  uri: { fsPath: string };
}

export interface MockTextDocument {
  uri: { fsPath: string };
  fileName: string;
  languageId: string;
  isUntitled: boolean;
  isDirty: boolean;
  lineCount: number;
  save: () => Promise<boolean>;
  lineAt: (line: number) => { text: string; range: unknown };
}

/** Mutable state the command-wiring tests drive through `resetVscodeMock`. */
export interface MockTextEditor {
  document: MockTextDocument;
}

export const vscodeState: {
  activeEditor: MockTextEditor | null;
  folders: MockWorkspaceFolder[];
  documents: MockTextDocument[];
  config: Record<string, unknown>;
} = {
  activeEditor: null,
  folders: [],
  documents: [],
  config: {},
};

const shownErrors: string[] = [];
const shownInfos: string[] = [];
const createdTerminals: unknown[] = [];
const registeredCommands: { command: string }[] = [];

/** Reset all mock state (call in beforeEach). */
export function resetVscodeMock(): void {
  vscodeState.activeEditor = null;
  vscodeState.folders = [];
  vscodeState.documents = [];
  vscodeState.config = {};
  shownErrors.length = 0;
  shownInfos.length = 0;
  createdTerminals.length = 0;
  registeredCommands.length = 0;
}

/** Error messages shown via vscode.window.showErrorMessage (in order). */
export function vscodeShownErrors(): string[] {
  return [...shownErrors];
}

/** Info messages shown via vscode.window.showInformationMessage (in order). */
export function vscodeShownInfos(): string[] {
  return [...shownInfos];
}

export const window = {
  get activeTextEditor(): MockTextEditor | null {
    return vscodeState.activeEditor;
  },
  set activeTextEditor(editor: MockTextEditor | null) {
    vscodeState.activeEditor = editor;
  },
  showErrorMessage(message: string): Promise<undefined> {
    shownErrors.push(message);
    return Promise.resolve(undefined);
  },
  showInformationMessage(message: string): Promise<undefined> {
    shownInfos.push(message);
    return Promise.resolve(undefined);
  },
  createOutputChannel(_name: string): { appendLine: () => void; show: () => void; hide: () => void; dispose: () => void } {
    return { appendLine: () => {}, show: () => {}, hide: () => {}, dispose: () => {} };
  },
  createTerminal(options?: { name?: string }): {
    name: string;
    exitStatus: undefined;
    show: () => void;
    dispose: () => void;
  } {
    const terminal = {
      name: options?.name ?? "",
      exitStatus: undefined,
      show: () => {},
      dispose: () => {},
    };
    createdTerminals.push(terminal);
    return terminal;
  },
};

export const workspace = {
  getConfiguration(section?: string): { get: <T>(key: string, defaultValue?: T) => T } {
    const table = section === "yaazhi" ? vscodeState.config : {};
    return {
      get: <T,>(key: string, defaultValue?: T) => (table[key] as T) ?? defaultValue,
    };
  },
  get workspaceFolders(): { uri: { fsPath: string } }[] {
    return vscodeState.folders;
  },
  get textDocuments(): { uri: { fsPath: string }; fileName: string }[] {
    return vscodeState.documents;
  },
};

export const commands = {
  registerCommand(command: string, _handler: unknown): { dispose: () => void } {
    registeredCommands.push({ command });
    return { dispose: () => {} };
  },
};

export const languages = {
  createDiagnosticCollection(_name: string): {
    set: () => void;
    delete: () => void;
    clear: () => void;
    dispose: () => void;
  } {
    return { set: () => {}, delete: () => {}, clear: () => {}, dispose: () => {} };
  },
};

const stub = new Proxy(
  {},
  {
    get: (_t, prop) => {
      if (prop === "__esModule") return true;
      throw new Error(`vscodeMock: '${String(prop)}' is not stubbed`);
    },
  },
);

export default stub;
