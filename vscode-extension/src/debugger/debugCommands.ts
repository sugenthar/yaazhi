/**
 * Yaazhi: Debug File / Debug Project — entry points.
 * Debugging requires a `yaazhi_dbg` host that the native-only toolchain does
 * not ship; these commands remain registered (so menu/command palette items
 * do not break) and route through the provider, which explains the situation.
 */
import * as vscode from "vscode";
import { logger } from "../utils/logger";
import { YaazhiDebugConfigurationProvider } from "./debugConfigProvider";

export function registerDebugCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.debugFile", () => {
      logger.info("Debug File requested.");
      void vscode.window.showErrorMessage(
        "Yaazhi debugging is not available in the native-only toolchain. Use Yaazhi: Build / Run instead.",
      );
    }),
    vscode.commands.registerCommand("yaazhi.debugProject", () => {
      logger.info("Debug Project requested.");
      void vscode.window.showErrorMessage(
        "Yaazhi debugging is not available in the native-only toolchain. Use Yaazhi: Run Project instead.",
      );
    }),
    vscode.debug.registerDebugConfigurationProvider("yaazhi", new YaazhiDebugConfigurationProvider()),
  );
}