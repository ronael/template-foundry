import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { writeJsonFile, writeYamlFile } from "../infrastructure/yamlStore.js";
import { defaultStandard } from "./defaults.js";

export async function initWorkspace(root: string): Promise<string[]> {
  const base = join(root, ".template-foundry");
  const dirs = ["standards", "benchmarks", "audits", "reports", "candidates"];
  await mkdir(base, { recursive: true });
  for (const dir of dirs) {
    await mkdir(join(base, dir), { recursive: true });
  }
  await writeJsonFile(join(base, "config.json"), {
    schemaVersion: 1,
    defaultStandard: ".template-foundry/standards/golden-framer-v1.yml",
    reportDir: ".template-foundry/reports",
  });
  await writeYamlFile(
    join(base, "standards", "golden-framer-v1.yml"),
    defaultStandard,
  );
  return [base, ...dirs.map((dir) => join(base, dir))];
}
