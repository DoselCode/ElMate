import { describe, expect, it } from "vitest";
import { httpUrl, isPlainText, plainText } from "./text";

describe("isPlainText", () => {
  it("acepta texto normal, tildes, emojis, símbolos y saltos de línea", () => {
    for (const ok of ["Mate Imperial 1 L", "Termo \"Stanley\" – 20% OFF", "Combo ☕ + 🧉", "Línea 1\nLínea 2", "Mate <3", "5 < 10 y 10 > 5", "👨‍👩‍👧 regalo"]) {
      expect(isPlainText(ok), ok).toBe(true);
    }
  });

  it("rechaza etiquetas HTML y scripts", () => {
    for (const bad of ["<script>alert(1)</script>", "hola <b>x</b>", "<img src=x onerror=alert(1)>", "</div>", "<!-- x -->", "< script>", "<SCRIPT src=//x>"]) {
      expect(isPlainText(bad), bad).toBe(false);
    }
  });

  it("rechaza esquemas ejecutables", () => {
    for (const bad of ["javascript:alert(1)", "JavaScript :alert(1)", "vbscript:x", "data:text/html;base64,AAAA"]) {
      expect(isPlainText(bad), bad).toBe(false);
    }
  });

  it("rechaza caracteres de control e invisibles", () => {
    for (const bad of ["a\u0000b", "a​b", "txt‮exe", "a﻿b", "a\u001Bb"]) {
      expect(isPlainText(bad), JSON.stringify(bad)).toBe(false);
    }
  });
});

describe("plainText", () => {
  it("recorta y encadena el largo como un string normal", () => {
    const schema = plainText().min(2).max(5);
    expect(schema.parse("  abc ")).toBe("abc");
    expect(schema.safeParse("a").success).toBe(false);
    expect(schema.safeParse("abcdef").success).toBe(false);
    expect(schema.safeParse("<b>").success).toBe(false);
  });
});

describe("httpUrl", () => {
  const schema = httpUrl("Imagen inválida");
  it("solo http(s)", () => {
    expect(schema.safeParse("https://x.supabase.co/a.webp").success).toBe(true);
    expect(schema.safeParse("javascript:alert(1)").success).toBe(false);
    expect(schema.safeParse("data:image/svg+xml,<svg onload=alert(1)>").success).toBe(false);
    expect(schema.safeParse("file:///etc/passwd").success).toBe(false);
  });
});
