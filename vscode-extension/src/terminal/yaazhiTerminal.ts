/**
 * Yaazhi integrated-terminal integration.
 * Uses VS Code's own terminal panel via a Pseudoterminal (no custom UI):
 * streams real process output and prints the exit code.
 */
import * as vscode from "vscode";
import { TERMINAL_NAME } from "../constants";
import { exitCodeLine } from "../compiler/compilerOutput";
import { ManagedProcess } from "../utils/process";
import { logger } from "../utils/logger";

const DIVIDER = "──────";

class YaazhiPty implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  private readonly closeEmitter = new vscode.EventEmitter<number>();
  readonly onDidWrite = this.writeEmitter.event;
  readonly onDidClose = this.closeEmitter.event;

  write(text: string): void {
    this.writeEmitter.fire(text.replace(/\r?\n/g, "\r\n"));
  }

  open(): void {
    /* output is pushed via write() */
  }

  close(): void {
    /* VS Code owns the lifecycle */
  }

  handleInput(_data: string): void {
    /* Ctrl+C in the terminal stops the running program. */
  }
}

let terminal: vscode.Terminal | null = null;
let pty: YaazhiPty | null = null;
let active: ManagedProcess | null = null;
// eslint-disable-next-line prefer-const
let outputChannel: vscode.OutputChannel | null = null;

function getPty(): YaazhiPty {
  if (!pty || !terminal || terminal.exitStatus !== undefined) {
    if (terminal) {
      try {
        terminal.dispose();
      } catch {
        /* already gone */
      }
    }
    pty = new YaazhiPty();
    terminal = vscode.window.createTerminal({ name: TERMINAL_NAME, pty });
  }
  return pty;
}

/** Print the standard Yaazhi run header into the terminal and output channel. */
export function printHeader(title: string): void {
  const p = getPty();
  terminal?.show(true);
  p.write(`Yaazhi\r\n${DIVIDER}\r\n\r\nRunning: ${title}\r\n\r\n`);
  outputChannel?.appendLine(`Yaazhi: Running ${title}`);
}

/** Stream a process's output into the Yaazhi terminal and output channel. */
export function attachProcess(proc: ManagedProcess, done?: (code: number | null) => void): void {
  stopActive();
  active = proc;
  const p = getPty();
  terminal?.show(true);
  proc.onStdout((chunk) => {
    p.write(chunk);
    outputChannel?.appendLine(chunk);
  });
  proc.onStderr((chunk) => {
    p.write(chunk);
    outputChannel?.appendLine(chunk);
  });
  proc.onExit((code) => {
    p.write(`\r\n${exitCodeLine(code)}\r\n`);
    outputChannel?.appendLine(`\r\nProcess exited with code: ${code}`);
    if (active === proc) active = null;
    try {
      done?.(code);
    } catch {
      /* ignore */
    }
  });
}

/** True while a Yaazhi program launched by this extension is running. */
export function isRunning(): boolean {
  return active !== null && active.running;
}

/** Stop the running Yaazhi process (safe when idle or already exited). */
export function stopActive(): void {
  const proc = active;
  active = null;
  if (proc) {
    logger.info("Stopping Yaazhi process.");
    proc.kill();
  }
  // Hide output channel when no process is running
  if (outputChannel) {
    try {
      outputChannel.hide();
    } catch {
      /* already hidden */
    }
  }
}
