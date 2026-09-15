/** Yaazhi: Restart — stop current program then re-run active file. */
import * as vscode from "vscode";
import { stopActive, isRunning } from "../terminal/yaazhiTerminal";
import { logger } from "../utils/logger";

export async function restartFile(_context: vscode.ExtensionContext): Promise<void> {
  const wasRunning = isRunning();
  if (wasRunning) {
    logger.info("Yaazhi Restart: stopping current process.");
    stopActive();
    // Give OS time to release the port (especially 8080)
    await new Promise((r) => setTimeout(r, 600));
  }
  // Re-invoke Run File for the active editor
  await vscode.commands.executeCommand("yaazhi.runFile");
}

export function registerRestart(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.restart", () => restartFile(context).catch((err) => {
      logger.error(`Yaazhi Restart failed: ${String(err)}`);
      void vscode.window.showErrorMessage("Yaazhi: Restart failed.");
    })),
  );
}
