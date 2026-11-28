import { describe, expect, it } from "vitest";
import {
  instagramEmbedSrc,
  instagramEmbedUrl,
  isInstagramEmbedMessage,
  isInstagramUrl,
  normalizeInstagramPost,
  parseInstagramPosts,
} from "./instagram";

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

describe("isInstagramUrl", () => {
  it("solo https en instagram.com", () => {
    expect(isInstagramUrl("https://www.instagram.com/elmate.cordoba/")).toBe(true);
    expect(isInstagramUrl("https://instagram.com/elmate.cordoba")).toBe(true);
    expect(isInstagramUrl("javascript:alert(1)")).toBe(false);
    expect(isInstagramUrl("http://www.instagram.com/x")).toBe(false);
    expect(isInstagramUrl("https://instagram.com.evil.com/x")).toBe(false);
    expect(isInstagramUrl("https://evil.com/?u=instagram.com")).toBe(false);
  });
});

describe("instagramEmbedUrl", () => {
  it("agrega /embed", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/p/Aaaaa11111/")).toBe("https://www.instagram.com/p/Aaaaa11111/embed");
  });

  it("los reels se incrustan por /p/ para que se reproduzcan en la web", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/reel/Bbbbb22222/")).toBe("https://www.instagram.com/p/Bbbbb22222/embed");
  });
});

describe("instagramEmbedSrc", () => {
  it("usa los parámetros del embed oficial", () => {
    const src = new URL(
      instagramEmbedSrc("https://www.instagram.com/reel/Bbbbb22222/", { width: 313.6, origin: "https://elmate.com.ar", path: "/?a=1" }),
    );
    expect(src.origin + src.pathname).toBe("https://www.instagram.com/p/Bbbbb22222/embed/");
    expect(Object.fromEntries(src.searchParams)).toEqual({ cr: "1", v: "14", wp: "314", rd: "https://elmate.com.ar", rp: "/?a=1" });
  });
});

describe("isInstagramEmbedMessage", () => {
  it("acepta los avisos del embed de Instagram", () => {
    for (const type of ["LOADING", "MEASURE", "MOUNTED"]) {
      expect(isInstagramEmbedMessage("https://www.instagram.com", JSON.stringify({ type, details: {} }))).toBe(true);
    }
  });

  it("ignora otros orígenes, otros tipos y datos que no son JSON", () => {
    expect(isInstagramEmbedMessage("https://evil.example", JSON.stringify({ type: "MEASURE" }))).toBe(false);
    expect(isInstagramEmbedMessage("https://www.instagram.com", JSON.stringify({ type: "OTRO" }))).toBe(false);
    expect(isInstagramEmbedMessage("https://www.instagram.com", "no es json")).toBe(false);
    expect(isInstagramEmbedMessage("https://www.instagram.com", { type: "MEASURE" })).toBe(false);
    expect(isInstagramEmbedMessage("https://www.instagram.com", "null")).toBe(false);
  });
});
