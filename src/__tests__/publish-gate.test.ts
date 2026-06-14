import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("publish gate docs", () => {
  it("describe the readiness gate with security, docs, and delivery checks", () => {
    const gate = read("docs/bill-of-materials.html.md");
    const bom = read("bill-of-materials.md");

    expect(gate).toContain("Publish Readiness Checklist");
    expect(gate).toContain("Security And Privacy");
    expect(gate).toContain("Documentation");
    expect(gate).toContain("Git And Delivery");
    expect(gate).toContain("pnpm run check");
    expect(gate).toContain("pnpm run check:contract-sync");
    expect(gate).toContain("pnpm run validate:release");
    expect(gate).toContain("git push origin main");
    expect(gate).toContain("gh run watch");
    expect(gate).toContain("README.md");
    expect(gate).toContain("security-policy.md");
    expect(gate).toContain("contributing.md");
    expect(gate).toContain("bill-of-materials.md");
    expect(gate).toContain("docs/roadmap/backlog.md");
    expect(gate).toContain("docs/roadmap/implementation-roadmap.md");
    expect(bom).toContain("docs/bill-of-materials.html.md");
    expect(bom).toContain("public documentation set");
  });

  it("includes explicit secret-scanning guidance", () => {
    const gate = read("docs/bill-of-materials.html.md");

    expect(gate).toContain("rg -n --hidden");
    expect(gate).toContain("private hostnames");
    expect(gate).toContain("internal-only endpoints");
    expect(gate).toContain("No new secrets");
  });
});
