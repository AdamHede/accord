import { describe, expect, it } from "vitest";
import { PROVINCES } from "../src/engine";
// @ts-expect-error board assets are browser JavaScript modules shared with the client.
import { BOARD_ASSET, BOARD_VISUAL_PROVINCES } from "../public/map/board-asset.js";

describe("board asset metadata", () => {
  it("is versioned", () => {
    expect(BOARD_ASSET.schemaVersion).toBe(1);
  });

  it("covers every rules province and only rules provinces", () => {
    const rulesIds = Object.keys(PROVINCES).sort();
    const visualIds = Object.keys(BOARD_VISUAL_PROVINCES).sort();

    expect(visualIds).toEqual(rulesIds);
  });

  it("links visual metadata to matching rules graph IDs", () => {
    for (const [id, metadata] of Object.entries(BOARD_VISUAL_PROVINCES)) {
      expect((metadata as { rulesGraphId: string }).rulesGraphId).toBe(id);
      expect(PROVINCES[id]).toBeDefined();
    }
  });
});
