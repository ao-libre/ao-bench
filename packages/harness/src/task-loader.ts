import { readFileSync } from "node:fs";
import type { TaskSpec } from "./types.js";

/**
 * Parse a minimal flat YAML file (key: value lines, no nesting).
 * Numeric values are coerced; everything else is kept as string.
 */
function parseSimpleYaml(content: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    // Skip blank lines and comments
    if (!line || line.startsWith("#")) continue;

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue === "") continue;

    // Try numeric coercion
    const asNumber = Number(rawValue);
    if (!isNaN(asNumber) && rawValue !== "") {
      result[key] = asNumber;
    } else {
      result[key] = rawValue;
    }
  }

  return result;
}

/**
 * Load a TaskSpec from a YAML file.
 * Throws if required fields are missing.
 */
export function loadTask(taskFile: string): TaskSpec {
  const content = readFileSync(taskFile, "utf-8");
  const data = parseSimpleYaml(content);

  // Required fields
  const required = ["name", "description", "timeLimitSeconds"] as const;
  for (const field of required) {
    if (!(field in data)) {
      throw new Error(`Task file ${taskFile} is missing required field: ${field}`);
    }
  }

  const name = data["name"];
  const description = data["description"];
  const timeLimitSeconds = data["timeLimitSeconds"];

  if (typeof name !== "string") {
    throw new Error(`Task field 'name' must be a string`);
  }
  if (typeof description !== "string") {
    throw new Error(`Task field 'description' must be a string`);
  }
  if (typeof timeLimitSeconds !== "number") {
    throw new Error(`Task field 'timeLimitSeconds' must be a number`);
  }

  const spec: TaskSpec = { name, description, timeLimitSeconds };

  const startMap = data["startMap"];
  if (startMap !== undefined) spec.startMap = Number(startMap);

  const startX = data["startX"];
  if (startX !== undefined) spec.startX = Number(startX);

  const startY = data["startY"];
  if (startY !== undefined) spec.startY = Number(startY);

  const skill = data["skill"];
  if (skill !== undefined) spec.skill = String(skill);

  return spec;
}
