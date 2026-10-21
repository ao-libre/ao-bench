import { describe, it, expect } from "vitest";
import { parseIni } from "./parser.js";

describe("parseIni", () => {
  it("parses a simple INI string with two sections", () => {
    const content = "[SEC1]\r\nKey1=Value1\r\nKey2=Value2\r\n\r\n[SEC2]\r\nFoo=Bar\r\n";
    const result = parseIni(content);

    expect(result.size).toBe(2);

    const sec1 = result.get("SEC1");
    expect(sec1).toBeDefined();
    expect(sec1?.["Key1"]).toBe("Value1");
    expect(sec1?.["Key2"]).toBe("Value2");

    const sec2 = result.get("SEC2");
    expect(sec2).toBeDefined();
    expect(sec2?.["Foo"]).toBe("Bar");
  });

  it("skips lines starting with single-quote comments", () => {
    const content = "' This is a comment\r\n[SECTION]\r\n' Another comment\r\nName=Test\r\n";
    const result = parseIni(content);

    expect(result.size).toBe(1);
    const sec = result.get("SECTION");
    expect(sec).toBeDefined();
    expect(Object.keys(sec ?? {})).toEqual(["Name"]);
    expect(sec?.["Name"]).toBe("Test");
  });

  it("skips lines starting with # comments", () => {
    const content = "# Hash comment\r\n[SECTION]\r\n# Another hash\r\nKey=Val\r\n";
    const result = parseIni(content);

    const sec = result.get("SECTION");
    expect(sec).toBeDefined();
    expect(Object.keys(sec ?? {})).not.toContain("#");
    expect(sec?.["Key"]).toBe("Val");
  });

  it("includes empty sections as empty objects", () => {
    const content = "[EMPTY]\r\n[NOTEMPTY]\r\nX=1\r\n";
    const result = parseIni(content);

    expect(result.has("EMPTY")).toBe(true);
    expect(result.get("EMPTY")).toEqual({});

    expect(result.has("NOTEMPTY")).toBe(true);
    expect(result.get("NOTEMPTY")).toEqual({ X: "1" });
  });

  it("handles CRLF line endings correctly", () => {
    // Mix of CRLF and LF to be robust
    const content = "[OBJ1]\r\nName=Manzana Roja\r\nObjType=1\r\n";
    const result = parseIni(content);

    const section = result.get("OBJ1");
    expect(section?.["Name"]).toBe("Manzana Roja");
    expect(section?.["ObjType"]).toBe("1");
  });

  it("handles values containing = sign correctly", () => {
    const content = "[SEC]\r\nDesc=A=B=C\r\n";
    const result = parseIni(content);
    // Only the first = is the key-value separator
    expect(result.get("SEC")?.["Desc"]).toBe("A=B=C");
  });

  it("ignores keys outside any section", () => {
    const content = "Orphan=1\r\n[SEC]\r\nKey=2\r\n";
    const result = parseIni(content);
    // "Orphan" is before any section — should not appear
    expect(result.has("SEC")).toBe(true);
    const flatKeys = [...result.values()].flatMap((s) => Object.keys(s));
    expect(flatKeys).not.toContain("Orphan");
  });
});
