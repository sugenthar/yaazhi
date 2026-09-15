/**
 * Central process management for the Yaazhi extension.
 * Uses child_process.spawn with argument arrays only — never a shell string.
 * No vscode imports — safe for unit tests.
 */
import { spawn, ChildProcess } from "child_process";

export interface RunOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export interface RunResult {
  /** Process exit code, or null when killed / spawn failed. */
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: string;
}

/**
 * Run an executable with an argument array, capturing stdout/stderr.
 * Never invokes a shell.
 */
export function runProcess(exe: string, args: readonly string[], opts: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;

    let child: ChildProcess;
    try {
      child = spawn(exe, [...args], {
        cwd: opts.cwd,
        env: opts.env ?? process.env,
        windowsHide: true,
      });
    } catch (err) {
      resolve({ code: null, stdout: "", stderr: "", timedOut: false, spawnError: String(err) });
      return;
    }

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          /* already exited */
        }
      }, opts.timeoutMs);
      timer.unref?.();
    }

    child.stdout?.on("data", (d: Buffer) => {
      const text = d.toString("utf-8");
      stdout += text;
      try {
        opts.onStdout?.(text);
      } catch {
        /* listener errors must not break capture */
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
      const text = d.toString("utf-8");
      stderr += text;
      try {
        opts.onStderr?.(text);
      } catch {
        /* listener errors must not break capture */
      }
    });
    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      resolve({ code: null, stdout, stderr, timedOut, spawnError: String(err) });
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolve({ code, stdout, stderr, timedOut });
    });
  });
}

export type ManagedListener = (chunk: string) => void;

/**
 * Long-running, killable child process with streamed output.
 * Used for Run flows so Yaazhi: Stop can terminate cleanly.
 */
export class ManagedProcess {
  private child: ChildProcess | null = null;
  private readonly stdoutListeners = new Set<ManagedListener>();
  private readonly stderrListeners = new Set<ManagedListener>();
  private readonly exitListeners = new Set<(code: number | null) => void>();
  private done = false;

  constructor(
    private readonly exe: string,
    private readonly args: readonly string[],
    private readonly opts: RunOptions = {},
  ) {}

  onStdout(cb: ManagedListener): () => void {
    this.stdoutListeners.add(cb);
    return () => this.stdoutListeners.delete(cb);
  }

  onStderr(cb: ManagedListener): () => void {
    this.stderrListeners.add(cb);
    return () => this.stderrListeners.delete(cb);
  }

  onExit(cb: (code: number | null) => void): () => void {
    this.exitListeners.add(cb);
    return () => this.exitListeners.delete(cb);
  }

  get running(): boolean {
    return this.child !== null && !this.done;
  }

  start(): void {
    const child = spawn(this.exe, [...this.args], {
      cwd: this.opts.cwd,
      env: this.opts.env ?? process.env,
      windowsHide: true,
    });
    this.child = child;
    child.stdout?.on("data", (d: Buffer) => {
      const text = d.toString("utf-8");
      for (const cb of this.stdoutListeners) {
        try {
          cb(text);
        } catch {
          /* ignore listener errors */
        }
      }
    });
    child.stderr?.on("data", (d: Buffer) => {
      const text = d.toString("utf-8");
      for (const cb of this.stderrListeners) {
        try {
          cb(text);
        } catch {
          /* ignore listener errors */
        }
      }
    });
    const finish = (code: number | null) => {
      this.done = true;
      this.child = null;
      for (const cb of this.exitListeners) {
        try {
          cb(code);
        } catch {
          /* ignore listener errors */
        }
      }
    };
    child.on("error", () => finish(null));
    child.on("close", (code) => finish(code));
  }

  /** Terminate the process. Safe to call when already exited or repeated. Handles Linux/Windows/macOS. */
  kill(): void {
    const child = this.child;
    if (!child || this.done) return;
    try {
      if (process.platform === "win32" && (child as unknown as { pid?: number }).pid) {
        const pid = (child as unknown as { pid: number }).pid;
        try {
          // Force kill process tree on Windows
          const { spawnSync } = require("child_process") as typeof import("child_process");
          spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
        } catch { /* fallback */ }
      }
      // SIGTERM first, then SIGKILL if still running
      child.kill();
      setTimeout(() => {
        try { if (!this.done) (child as unknown as { kill: (s?: string) => void }).kill("SIGKILL"); } catch {}
      }, 800).unref?.();
    } catch {
      /* already exited */
    }
  }
}
