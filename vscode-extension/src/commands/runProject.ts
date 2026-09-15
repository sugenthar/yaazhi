/** Yaazhi: Run Project — resolve the manifest, run its entry point. */
import * as fs from "fs";
import * as vscode from "vscode";
import { publishDiagnostics } from "../diagnostics/diagnosticProvider";
import { detectProject } from "../project/projectDetector";
import { attachProcess, printHeader } from "../terminal/yaazhiTerminal";
import { ManagedProcess } from "../utils/process";
import { baseName } from "../utils/paths";
import { logger } from "../utils/logger";
import { requireToolchain } from "./common";

export async function runProject(context: vscode.ExtensionContext): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showErrorMessage("Open a Yaazhi (.ழி) file inside the project first.");
    return;
  }
  const toolchain = requireToolchain();
  if (!toolchain) return;

  const exists = (p: string): boolean => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  };
  const project = detectProject(editor.document.fileName, {
    exists,
    readFile: (p) => {
      try {
        return fs.readFileSync(p, "utf-8");
      } catch {
        return null;
      }
    },
    workspaceFolders: (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath),
  });

  if (!project) {
    logger.error("Run Project: no manifest found.");
    void vscode.window.showErrorMessage("Could not find yazhi.toml.");
    return;
  }
  if (!project.entry) {
    logger.error(`Run Project: no entry resolved in ${project.root}.`);
    void vscode.window.showErrorMessage(
      `Yaazhi project "${project.name}" has no entry point. Add an "entry" to the manifest or create முதன்மை.ழி.`,
    );
    return;
  }
  logger.info(`Run Project "${project.name}": entry=${project.entry}`);

  printHeader(`${project.name} (${baseName(project.entry)})`);
  // `yaazhi run <project>` compiles the manifest entry (plus its module
  // graph) and executes it in the project directory.
  const proc = new ManagedProcess(
    toolchain.bin,
    ["run", project.root, ...toolchain.compilerArgs],
    { cwd: project.root },
  );
  proc.onStdout(() => {});
  proc.onStderr((chunk: string) => {
    const entryDoc = vscode.workspace.textDocuments.find((d) => d.fileName === project.entry);
    if (entryDoc) publishDiagnostics(context, entryDoc, chunk);
  });
  proc.start();
  try {
    attachProcess(proc);
  } catch (err) {
    logger.error(String(err));
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
  }
}

export function registerRunProject(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.runProject", () =>
      runProject(context).catch((err: unknown) => {
        logger.error(`Run Project failed: ${err instanceof Error ? err.message : String(err)}`);
        void vscode.window.showErrorMessage("Yaazhi: Run Project failed. See the Yaazhi output channel for details.");
      }),
    ),
  );
}