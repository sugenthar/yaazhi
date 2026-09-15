/** Extension logging via a "Yaazhi" OutputChannel. No telemetry. */
import * as vscode from "vscode";
import { OUTPUT_CHANNEL_NAME } from "../constants";

let channel: vscode.OutputChannel | null = null;

function getChannel(): vscode.OutputChannel {
  if (!channel) channel = vscode.window.createOutputChannel(OUTPUT_CHANNEL_NAME);
  return channel;
}

function stamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info(message: string): void {
    getChannel().appendLine(`[${stamp()}] INFO  ${message}`);
  },
  warn(message: string): void {
    getChannel().appendLine(`[${stamp()}] WARN  ${message}`);
  },
  error(message: string): void {
    getChannel().appendLine(`[${stamp()}] ERROR ${message}`);
  },
  show(): void {
    getChannel().show();
  },
};
