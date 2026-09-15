/**
 * Yaazhi: Check — validate without producing artifacts.
 * Runs the native `yaazhi check <file>` command (compile-only, nothing is
 * executed) and reports diagnostics.
 */
import * as vscode from "vscode";
import { buildCheckArgs, compilerEnv } from "../compiler/compiler";
import { publishDiagnostics, clearDiagnostics } from "../diagnostics/diagnosticProvider";
import { runProcess } from "../utils/process";
import { dirName } from "../utils/paths";
import { logger } from "../utils/logger";
import { requireActiveYaazhiFile, requireToolchain } from "./common";

export async function check(context: vscode.ExtensionContext): Promise<void> {
  const active = await requireActiveYaazhiFile();
  if (!active) return;
  const toolchain = requireToolchain();
  if (!toolchain) return;

  const { document, filePath } = active;
  logger.info(`Check: ${filePath}`);
  const result = await runProcess(
    toolchain.bin,
    buildCheckArgs(filePath, {
      bin: toolchain.bin,
      extraArgs: toolchain.compilerArgs,
    }),
    { cwd: dirName(filePath), env: compilerEnv() },
  );
  const parsed = publishDiagnostics(context, document, result.stderr);
  if (result.code === 0) {
    clearDiagnostics(context, document);
    logger.info(`Check passed: ${filePath}`);
    void vscode.window.showInformationMessage("Yaazhi check: no errors.");
  } else {
    logger.error(`Check found ${parsed.length} problem(s): ${filePath}`);
    void vscode.window.showErrorMessage(
      `Yaazhi check found ${parsed.length} problem(s). See Problems panel.`,
    );
  }
}

export function registerCheck(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.check", () =>
      check(context).catch((err: unknown) => {
        logger.error(`Check failed: ${err instanceof Error ? err.message : String(err)}`);
        void vscode.window.showErrorMessage("Yaazhi: Check failed. See the Yaazhi output channel for details.");
      }),
    ),
  );
}
