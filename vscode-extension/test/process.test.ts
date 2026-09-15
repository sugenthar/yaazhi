/** Process management: capture, exit codes, kill, cleanup. */
import { describe, expect, it } from "vitest";
import { ManagedProcess, runProcess } from "../src/utils/process";

describe("runProcess", () => {
  it("captures stdout and the exit code", async () => {
    const result = await runProcess(process.execPath, ["-e", "process.stdout.write('hi');"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toBe("hi");
    expect(result.timedOut).toBe(false);
  });

  it("captures stderr and non-zero exit codes", async () => {
    const result = await runProcess(process.execPath, [
      "-e",
      "process.stderr.write('oops'); process.exit(3);",
    ]);
    expect(result.code).toBe(3);
    expect(result.stderr).toBe("oops");
  });

  it("reports spawn errors instead of throwing", async () => {
    const result = await runProcess("yaazhi-definitely-missing-exe-12345", []);
    expect(result.code).toBeNull();
    expect(result.spawnError).toBeDefined();
  });

  it("streams chunks to listeners", async () => {
    const seen: string[] = [];
    await runProcess(process.execPath, ["-e", "process.stdout.write('a');"], {
      onStdout: (c) => seen.push(c),
    });
    expect(seen.join("")).toBe("a");
  });
});

describe("ManagedProcess", () => {
  it("kills a long-running process and fires onExit", async () => {
    const proc = new ManagedProcess(process.execPath, ["-e", "setInterval(()=>{}, 1000);"]);
    const exited = new Promise<number | null>((resolve) => proc.onExit(resolve));
    proc.start();
    expect(proc.running).toBe(true);
    proc.kill();
    const code = await exited;
    expect(proc.running).toBe(false);
    expect(code).toBeDefined();
  });

  it("kill is safe when repeated or idle", () => {
    const proc = new ManagedProcess(process.execPath, ["-e", "process.exit(0);"]);
    expect(() => {
      proc.kill();
      proc.kill();
    }).not.toThrow();
  });
});
