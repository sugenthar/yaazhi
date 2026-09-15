/**
 * Compiler invocation builders + captured compile.
 * Invokes the native C11 CLI: `yaazhi build <target> -o <out>` for build,
 * `yaazhi check <target>` for check, `yaazhi run <target>` for run. The
 * native compiler/`run` flow manages its own temporary NBC and runtime host.
 * No vscode imports.
 */
import { runProcess, RunResult } from "../utils/process";

export interface CompilerConfig {
  /** Path to the native Yaazhi compiler executable. */
  bin: string;
  extraArgs: readonly string[];
}

/** Args for `yaazhi build <target> -o <out>`. */
export function buildCompileArgs(
  target: string,
  output: string,
  cfg: CompilerConfig,
): string[] {
  return ["build", target, "-o", output, ...cfg.extraArgs];
}

/** Args for `yaazhi check <target>` (validates without writing output). */
export function buildCheckArgs(target: string, cfg: CompilerConfig): string[] {
  return ["check", target, ...cfg.extraArgs];
}

/**
 * Compile `target` (file, directory, or manifest) and capture output.
 * Returns the raw process result; diagnostics are parsed separately.
 */
export async function compileCapture(
  cfg: CompilerConfig,
  target: string,
  output: string,
  cwd: string,
): Promise<RunResult> {
  return runProcess(cfg.bin, buildCompileArgs(target, output, cfg), {
    cwd,
    env: compilerEnv(),
  });
}

/** Default NBC output path for `<file>.ழி` → `<file>.ழி.nbc`. */
export function defaultNbcPath(sourceFile: string): string {
  return `${sourceFile}.nbc`;
}

/**
 * Environment for spawning the compiler. The native binary is UTF-8 native;
 * no special handling is required.
 */
export function compilerEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base };
}