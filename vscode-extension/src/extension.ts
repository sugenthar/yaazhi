/** Yaazhi VS Code extension entry point (native-only toolchain). */
import * as vscode from "vscode";
import { LANGUAGE_ID } from "./constants";
import { registerRunFile } from "./commands/runFile";
import { registerRunProject } from "./commands/runProject";
import { registerBuild } from "./commands/build";
import { registerCheck } from "./commands/check";
import { registerStop } from "./commands/stop";
import { registerRestart } from "./commands/restart";
import { registerDebugCommands } from "./debugger/debugCommands";
import { YaazhiCompletionProvider } from "./language/completionProvider";
import { YaazhiHoverProvider } from "./language/hoverProvider";
import { YaazhiSymbolProvider } from "./language/symbolProvider";
import { stopActive } from "./terminal/yaazhiTerminal";
import { OUTPUT_CHANNEL_NAME } from "./constants";
import { logger } from "./utils/logger";
import { detectTerminal } from "./utils/terminal";

let outputChannel: vscode.OutputChannel | null = null;

export function activate(context: vscode.ExtensionContext): void {
  logger.info("Yaazhi extension activating (native toolchain).");

  // Create the Yaazhi output channel for Unicode-safe display
  outputChannel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  context.subscriptions.push(outputChannel);

  // Built-in language features (analysis is done in TypeScript; the native
  // compiler has no LSP server).
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      { language: LANGUAGE_ID },
      new YaazhiCompletionProvider(),
    ),
    vscode.languages.registerHoverProvider({ language: LANGUAGE_ID }, new YaazhiHoverProvider()),
    vscode.languages.registerDocumentSymbolProvider(
      { language: LANGUAGE_ID },
      new YaazhiSymbolProvider(),
    ),
  );

  registerRunFile(context);
  registerRunProject(context);
  registerBuild(context);
  registerCheck(context);
  registerStop(context);
  registerRestart(context);
  registerDebugCommands(context);

  // Minimal status bar: shows "Yaazhi" for .ழி editors, opens Yaazhi settings.
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.text = "Yaazhi";
  status.tooltip = "Yaazhi language settings";
  status.command = {
    title: "Yaazhi settings",
    command: "workbench.action.openSettings",
    arguments: ["yaazhi"],
  };
  const updateStatus = (): void => {
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.languageId === LANGUAGE_ID) status.show();
    else status.hide();
  };
  context.subscriptions.push(
    status,
    vscode.window.onDidChangeActiveTextEditor(updateStatus),
  );
  updateStatus();

  // Register the Tamil terminal diagnostic command.
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.diagnoseTerminal", () => {
      diagnoseTerminal();
    }),
  );

  // Register the "Yaazhi: Open Output" command to show the Unicode-safe output channel.
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.openOutput", () => {
      if (outputChannel) {
        outputChannel.show();
      }
    }),
  );

  logger.info("Yaazhi extension activated.");
}

export async function deactivate(): Promise<void> {
  // Never leave orphan processes behind.
  stopActive();
  if (outputChannel) {
    outputChannel.dispose();
    outputChannel = null;
  }
}

/** Diagnostic output for Yaazhi terminal Unicode support. */
function diagnoseTerminal(): void {
  const platform = process.platform;
  const shell = platform === "win32" ? "cmd.exe" : undefined;
  const codePage = platform === "win32" ? "65001 (user configured)" : "UTF-8 default";
  const compiler = vscode.workspace.getConfiguration("yaazhi").get("compiler") as string | undefined;
  const runtimeHost = vscode.workspace.getConfiguration("yaazhi").get("runtime") as string | undefined;
  const availableTerminal = detectTerminal();

  const lines: string[] = [];
  lines.push(`Tamil terminal diagnostics`);
  lines.push(`--------------------------`);
  lines.push(`Platform: ${platform}`);
  lines.push(`Shell: ${shell || "default (Linux/Unix)"}`);
  lines.push(`Code page: ${codePage}`);
  lines.push(`Compiler: ${compiler || "not configured (discovered in home)"}`);
  lines.push(`Runtime: ${runtimeHost || "not configured"}`);
  lines.push(`Available terminal: ${availableTerminal || "none detected"}`);
  lines.push(`Output Channel: ${OUTPUT_CHANNEL_NAME} ${outputChannel ? "(active)" : "(inactive)"}`);
  lines.push("");
  lines.push(`Tamil terminal diagnostics complete.`);

  vscode.window.showInformationMessage(lines.join("\n"));
}