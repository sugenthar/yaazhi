/** Yaazhi: Build — compile only, no execution. Emits `<file>.ழி.nbc`. */
import * as vscode from "vscode";
import { buildCompileArgs, compilerEnv, defaultNbcPath } from "../compiler/compiler";
import { summarizeCompile } from "../compiler/compilerOutput";
import { publishDiagnostics, clearDiagnostics } from "../diagnostics/diagnosticProvider";
import { runProcess } from "../utils/process";
import { dirName } from "../utils/paths";
import { logger } from "../utils/logger";
import { displayName, requireActiveYaazhiFile, requireToolchain } from "./common";

export async function build(context: vscode.ExtensionContext): Promise<void> {
  const active = await requireActiveYaazhiFile();
  if (!active) return;
  const toolchain = requireToolchain();
  if (!toolchain) return;

  const { document, filePath } = active;
  const outPath = defaultNbcPath(filePath);
  logger.info(`Build: ${filePath} -> ${outPath}`);

  const result = await runProcess(
    toolchain.bin,
    buildCompileArgs(filePath, outPath, {
      bin: toolchain.bin,
      extraArgs: toolchain.compilerArgs,
    }),
    { cwd: dirName(filePath), env: compilerEnv() },
  );
  const parsed = publishDiagnostics(context, document, result.stderr);
  if (result.code === 0) {
    clearDiagnostics(context, document);
    logger.info(`Build succeeded: ${outPath}`);
    void vscode.window.showInformationMessage(`Yaazhi build succeeded: ${displayName(outPath)}`);
  } else {
    logger.error(summarizeCompile(result.code, result.stderr));
    void vscode.window.showErrorMessage(
      `Yaazhi build failed with ${parsed.length} problem(s). See Problems panel.`,
    );
  }
}

export function registerBuild(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.build", () =>
      build(context).catch((err: unknown) => {
        logger.error(`Build failed: ${err instanceof Error ? err.message : String(err)}`);
        void vscode.window.showErrorMessage("Yaazhi: Build failed. See the Yaazhi output channel for details.");
      }),
    ),
  );
}
