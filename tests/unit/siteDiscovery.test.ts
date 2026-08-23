import { describe, expect, it } from "vitest";
import { selectRoutes } from "../../src/domain/inspection.js";

describe("selectRoutes", () => {
  it("prioritizes commercially important routes and dedupes", () => {
    const selected = selectRoutes(
      ["/random", "/pricing", "/about", "/pricing", "/misc", "/contact"],
      { maxPages: 4 },
    );

    expect(selected).toEqual(["/pricing", "/about", "/contact"]);
  });

  it("drops the root page and caps at maxPages - 1", () => {
    const selected = selectRoutes(
      ["/", "/pricing", "/about", "/contact", "/blog", "/services", "/work"],
      { maxPages: 3 },
    );

    expect(selected).toHaveLength(2);
    expect(selected).not.toContain("/");
  });

  it("orders non-priority routes deterministically", () => {
    const first = selectRoutes(["/zebra", "/alpha", "/mid"], { maxPages: 5 });
    const second = selectRoutes(["/mid", "/zebra", "/alpha"], { maxPages: 5 });

    expect(first).toEqual(second);
    expect(first).toEqual(["/mid", "/alpha", "/zebra"]);
  });
});
