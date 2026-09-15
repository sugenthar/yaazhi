/**
 * Yaazhi debug configuration provider.
 *
 * The native-only Yaazhi toolchain does not provide a debugger yet: the old
 * inline DAP adapter depended on the removed Python reference compiler's
 * `--debug` metadata plus a `yaazhi_dbg` host binary, neither of which exists
 * in the native build. Any `type: "yaazhi"` launch is rejected with a clear
 * explanation instead of silently misbehaving.
 */
import * as vscode from "vscode";

export class YaazhiDebugConfigurationProvider implements vscode.DebugConfigurationProvider {
  resolveDebugConfiguration(
    folder: vscode.WorkspaceFolder | undefined,
    config: vscode.DebugConfiguration,
  ): vscode.ProviderResult<vscode.DebugConfiguration> {
    void folder;
    if (config.type !== "yaazhi") return config;
    vscode.window.showErrorMessage(
      "Yaazhi debugging is not available in the native-only toolchain. " +
        "Compile and run your program with the Yaazhi: Build / Run commands.",
    );
    return null;
  }
}