import { describe, expect, it } from "vitest";
import { instagramEmbedUrl, normalizeInstagramPost, parseInstagramPosts } from "./instagram";

describe("normalizeInstagramPost", () => {
  it("acepta posts, reels y links con perfil o parámetros", () => {
    expect(normalizeInstagramPost("https://www.instagram.com/p/DAbc123_-x/?img_index=1&igsh=zzz")).toBe("https://www.instagram.com/p/DAbc123_-x/");
    expect(normalizeInstagramPost("https://instagram.com/elmate.cordoba/reel/Cxyz987654/")).toBe("https://www.instagram.com/reel/Cxyz987654/");
    expect(normalizeInstagramPost("https://www.instagram.com/reels/Cxyz987654")).toBe("https://www.instagram.com/reel/Cxyz987654/");
  });

  it("rechaza lo que no es una publicación", () => {
    expect(normalizeInstagramPost("https://www.instagram.com/elmate.cordoba/")).toBeNull();
    expect(normalizeInstagramPost("https://facebook.com/p/Cxyz987654/")).toBeNull();
    expect(normalizeInstagramPost("hola")).toBeNull();
  });
});

describe("parseInstagramPosts", () => {
  it("separa válidos e inválidos y descarta repetidos", () => {
    const { urls, invalid } = parseInstagramPosts(
      "https://www.instagram.com/p/Aaaaa11111/\nhttps://www.instagram.com/p/Aaaaa11111/?igsh=1\nlo-que-sea, https://www.instagram.com/reel/Bbbbb22222/",
    );
    expect(urls).toEqual(["https://www.instagram.com/p/Aaaaa11111/", "https://www.instagram.com/reel/Bbbbb22222/"]);
    expect(invalid).toEqual(["lo-que-sea"]);
  });

  it("texto vacío: sin links", () => {
    expect(parseInstagramPosts("  \n ")).toEqual({ urls: [], invalid: [] });
  });
});

describe("instagramEmbedUrl", () => {
  it("agrega /embed", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/p/Aaaaa11111/")).toBe("https://www.instagram.com/p/Aaaaa11111/embed");
  });
});
