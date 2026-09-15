/** Yaazhi: Run File — compile the active .ழி file and run it. */
import * as vscode from "vscode";
import * as path from "path";
import { ManagedProcess } from "../utils/process";
import { attachProcess, printHeader } from "../terminal/yaazhiTerminal";
import { logger } from "../utils/logger";
import { displayName, requireActiveYaazhiFile, requireToolchain } from "./common";

export async function runFile(context: vscode.ExtensionContext): Promise<void> {
  void context;
  const active = await requireActiveYaazhiFile();
  if (!active) return;
  const toolchain = requireToolchain();
  if (!toolchain) return;

  const { document, filePath } = active;
  const cwd = path.dirname(filePath);
  printHeader(displayName(filePath));

  // `yaazhi run <file>` compiles to a temporary NBC and executes it on the
  // runtime host internally, streaming the program's output.
  const proc = new ManagedProcess(
    toolchain.bin,
    ["run", filePath, ...toolchain.compilerArgs],
    { cwd },
  );
  proc.onStdout(() => {});
  proc.start();
  try {
    attachProcess(proc);
    // Detect server for helpful terminal message.
    let serverInfo: { host: string; port: string } | null = null;
    try {
      const text = typeof (document as unknown as { getText?: () => string }).getText === "function"
        ? (document as unknown as { getText: () => string }).getText()
        : "";
      serverInfo = detectServer(text);
    } catch {
      serverInfo = null;
    }
    if (serverInfo) {
      // Only report after the runtime confirms it didn't immediately exit.
      setTimeout(() => {
        if (proc.running) {
          const url = `http://${serverInfo!.host}:${serverInfo!.port}`;
          logger.info(`Yaazhi server started on ${url}`);
        }
      }, 600);
    }
  } catch (err) {
    logger.error(String(err));
    void vscode.window.showErrorMessage(err instanceof Error ? err.message : String(err));
  }
}

export function registerRunFile(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("yaazhi.runFile", () => runFile(context).catch(handle)),
  );
}

const TAMIL_DIGITS: Record<string, string> = { "௦": "0", "௧": "1", "௨": "2", "௩": "3", "௪": "4", "௫": "5", "௬": "6", "௭": "7", "௮": "8", "௯": "9" };
function tamilToAscii(s: string): string {
  return s.replace(/[௦-௯]/g, (c) => TAMIL_DIGITS[c] || c);
}
function detectServer(text: string): { host: string; port: string } | null {
  const m = text.match(/வலை\s*\.\s*சேவையகம்\s*\(\s*["']([^"']+)["']\s*,\s*\$?\s*([௦-௯0-9]+)/);
  if (!m) return null;
  const host = m[1].trim() || "127.0.0.1";
  const port = tamilToAscii(m[2].trim());
  return { host, port };
}

function handle(err: unknown): void {
  logger.error(`Run File failed: ${err instanceof Error ? err.message : String(err)}`);
  void vscode.window.showErrorMessage("Yaazhi: Run File failed. See the Yaazhi output channel for details.");
}