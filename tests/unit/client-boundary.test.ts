import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function listSourceFiles(directory: string): string[] {
  const entries = readdirSync(directory);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...listSourceFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith(".ts") || fullPath.endsWith(".tsx")) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("客户端边界", () => {
  it("带 use client 的文件不引用 src/server", () => {
    const files = listSourceFiles(path.resolve(process.cwd(), "src"));
    const violations = files.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("use client") && /from ["']@\/server/.test(source);
    });

    expect(violations).toEqual([]);
  });
});
