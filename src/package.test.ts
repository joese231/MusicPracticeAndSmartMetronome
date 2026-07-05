import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package scripts", () => {
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );

  it("exposes lint, typecheck, qa, and production audit commands", () => {
    expect(pkg.scripts.lint).toBe(
      "eslint . --ext .js,.jsx,.ts,.tsx,.mts --max-warnings=0",
    );
    expect(pkg.scripts.typecheck).toBe("tsc --noEmit");
    expect(pkg.scripts.qa).toBe("npm run typecheck && npm run test && npm run build");
    expect(pkg.scripts.audit).toBe("npm audit --omit=dev");
  });
});
