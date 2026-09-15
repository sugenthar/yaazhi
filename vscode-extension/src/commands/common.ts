/** Shared wiring for Yaazhi commands: config → discovery → toolchain. */
import * as fs from "fs";
import * as vscode from "vscode";
import {
  COMPILER_NOT_FOUND,
  LEGACY_EXTENSION,
} from "../constants";
import { resolveHome, NodePlatform } from "../toolchain/resolveToolchain";
import { baseName, isLegacyFile, isYaazhiFile } from "../utils/paths";
import { logger } from "../utils/logger";

export interface ToolchainConfig {
  home: string;
  bin: string;
  compilerArgs: string[];
}

export interface ActiveYaazhiFile {
  document: vscode.TextDocument;
  filePath: string;
}

/** Return the active saved .ழி editor, or show a clear message. */
export async function requireActiveYaazhiFile(): Promise<ActiveYaazhiFile | null> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || (editor.document.languageId !== "yaazhi" && !isYaazhiFile(editor.document.fileName))) {
    void vscode.window.showErrorMessage("Open a Yaazhi (.ழி) file first.");
    return null;
  }
  const document = editor.document;
  if (isLegacyFile(document.fileName)) {
    void vscode.window.showErrorMessage(
      `Yaazhi source files use the ${".ழி"} extension (${LEGACY_EXTENSION} is not supported).`,
    );
    return null;
  }
  if (document.isUntitled) {
    void vscode.window.showErrorMessage("Please save the current .ழி file before running.");
    return null;
  }
  if (document.isDirty) {
    await document.save();
    if (document.isDirty) {
      void vscode.window.showErrorMessage("Please save the current .ழி file before running.");
      return null;
    }
  }
  return { document, filePath: document.fileName };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Resolve the native compiler + home. Shows errors on failure. */
export function requireToolchain(): ToolchainConfig | null {
  const cfg = vscode.workspace.getConfiguration("yaazhi");
  const configuredHome = String(cfg.get("home") ?? "").trim();
  const configuredCompiler = String(cfg.get("compiler") ?? "").trim();
  const compilerArgs = stringArray(cfg.get("compilerArgs"));
  const workspaceFolders = (vscode.workspace.workspaceFolders ?? []).map((f) => f.uri.fsPath);
  const exists = (p: string): boolean => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  };
  const platform = process.platform as NodePlatform;

  const homeRes = resolveHome({ configuredHome, workspaceFolders, env: process.env, platform, exists });
  const home = homeRes.home;
  if (homeRes.error) {
    logger.error(`Home discovery failed: ${homeRes.error}`);
    void vscode.window.showErrorMessage(homeRes.error);
    return null;
  }

  let bin = homeRes.compiler;
  if (configuredCompiler !== "") {
    bin = configuredCompiler;
  }
  if (bin === "" || !exists(bin)) {
    if (configuredCompiler !== "") {
      logger.error(`Compiler not found (configured: ${configuredCompiler}).`);
      void vscode.window.showErrorMessage(
        `Yaazhi compiler was not found at "${configuredCompiler}". Check "yaazhi.compiler".`,
      );
    } else {
      logger.info(`Compiler discovery via ${homeRes.source}: ${bin || "(not found)"}`);
      void vscode.window.showErrorMessage(COMPILER_NOT_FOUND);
    }
    return null;
  }

  return { home, bin, compilerArgs };
}

/** Short display name for terminal headers and messages. */
export function displayName(filePath: string): string {
  return baseName(filePath);
}
