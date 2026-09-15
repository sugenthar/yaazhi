/** Yaazhi: Stop — terminate the running Yaazhi process, if any. */
import * as vscode from "vscode";
import { isRunning, stopActive } from "../terminal/yaazhiTerminal";
import { logger } from "../utils/logger";

export function registerStop(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.stop", () => {
      if (!isRunning()) {
        void vscode.window.showInformationMessage("No Yaazhi process is running.");
        return;
      }
      stopActive();
      logger.info("Yaazhi process stopped by user.");
      void vscode.window.showInformationMessage("Yaazhi process stopped.");
    }),
  );
}
