/**
 * Generic INI parser for ao-libre DAT files.
 *
 * Format:
 *   - Sections: [SECTIONNAME]
 *   - Key-value: Key=Value
 *   - Comments: lines starting with ' or #
 *   - Encoding: ISO-8859-1 (latin1) — caller is responsible for reading with correct encoding
 *   - Line endings: CRLF
 */

export type IniSection = Record<string, string>;

/**
 * Parse an INI-style string into a Map of section name → key-value record.
 *
 * - Skips comment lines (starting with ' or #) and blank lines.
 * - Sections with no key-value pairs are included as empty objects.
 * - Lines outside any section (before the first [SECTION]) are ignored.
 */
export function parseIni(content: string): Map<string, IniSection> {
  const result = new Map<string, IniSection>();
  let currentSection: string | null = null;
  let currentData: IniSection = {};

  // Normalise line endings: strip \r so we only deal with \n
  const lines = content.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.replace(/\r$/, "").trim();

    // Skip blank lines and comments
    if (line === "" || line.startsWith("'") || line.startsWith("#")) {
      continue;
    }

    // Section header: [SECTIONNAME]
    if (line.startsWith("[") && line.endsWith("]")) {
      // Save previous section if we had one
      if (currentSection !== null) {
        result.set(currentSection, currentData);
      }
      currentSection = line.slice(1, -1);
      currentData = {};
      continue;
    }

    // Key=Value pair
    const eqIdx = line.indexOf("=");
    if (eqIdx !== -1 && currentSection !== null) {
      const key = line.slice(0, eqIdx);
      const value = line.slice(eqIdx + 1);
      currentData[key] = value;
    }
  }

  // Save the last section
  if (currentSection !== null) {
    result.set(currentSection, currentData);
  }

  return result;
}
