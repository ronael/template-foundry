import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import YAML from "yaml";
import type { z } from "zod";

export async function readStructuredFile<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const raw = await readFile(path, "utf8");
  const parsed = path.endsWith(".json") ? JSON.parse(raw) : YAML.parse(raw);
  return schema.parse(parsed);
}

export async function writeYamlFile(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, YAML.stringify(value), "utf8");
}

export async function writeJsonFile(
  path: string,
  value: unknown,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function writeTextFile(
  path: string,
  value: string,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, value, "utf8");
}
