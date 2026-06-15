import { describe, expect, it } from "vitest";
import { pageMetadata } from "./pageMetadata";

describe("page metadata", () => {
  it("prevents room pages from being indexed while keeping the share URL", () => {
    expect(pageMetadata("/room/example", "https://code-room.example", "https://code-room.example/room/example")).toEqual({
      robots: "noindex, nofollow",
      canonical: "https://code-room.example/",
      openGraphUrl: "https://code-room.example/room/example"
    });
  });
});
