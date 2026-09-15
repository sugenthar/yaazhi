import { defineConfig } from "vitest/config";
import * as path from "path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, "test/helpers/vscodeMock.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
});
