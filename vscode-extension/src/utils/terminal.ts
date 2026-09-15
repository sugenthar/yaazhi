/** Detect available terminal emulators on Linux. */
import * as cp from "child_process";

/** Common terminal emulator commands to check. */
const TERMINAL_CANDIDATES = [
  "gnome-terminal",
  "konsole",
  "xterm",
  "xfce4-terminal",
  "mate-terminal",
  "lxterminal",
  "terminator",
  "tilix",
  "alacritty",
  "kitty",
  "wezterm",
  "foot",
];

/**
 * Return the first available terminal emulator command, or "" when none is found.
 * Uses `which` to check each candidate without invoking the terminal.
 */
export function detectTerminal(): string {
  for (const candidate of TERMINAL_CANDIDATES) {
    try {
      cp.execSync(`which ${candidate}`, { timeout: 2000, stdio: "ignore" });
      return candidate;
    } catch {
      /* not found, try next */
    }
  }
  return "";
}

/** Return a list of all detected terminal emulators. */
export function detectTerminals(): string[] {
  const found: string[] = [];
  for (const candidate of TERMINAL_CANDIDATES) {
    try {
      cp.execSync(`which ${candidate}`, { timeout: 2000, stdio: "ignore" });
      found.push(candidate);
    } catch {
      /* not found */
    }
  }
  return found;
}

/** Return the default terminal command for the current platform. */
export function getDefaultTerminal(): string {
  const platform = process.platform;
  if (platform === "win32") return "cmd.exe";
  if (platform === "darwin") return "osascript";
  return detectTerminal() || "xterm";
}
