import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("codemap docs", () => {
  it("documents the frontend component split", () => {
    const atlas = read("codemap.md");
    const srcMap = read("src/codemap.md");
    const componentsMap = read("src/components/codemap.md");

    expect(atlas).toContain("src/components/");
    expect(srcMap).toContain("src/components/");
    expect(srcMap).toContain("SettingsTab.tsx");
    expect(srcMap).toContain("CapabilitiesPanel.tsx");
    expect(srcMap).toContain("EvaluationTable.tsx");
    expect(componentsMap).toContain("App.tsx");
  });

  it("documents the backend command and domain split", () => {
    const srcTauriMap = read("src-tauri/src/codemap.md");

    expect(srcTauriMap).toContain("module root");
    expect(srcTauriMap).toContain("commands/");
    expect(srcTauriMap).toContain("domain/");
    expect(srcTauriMap).not.toContain("real backend module today");
  });
});
