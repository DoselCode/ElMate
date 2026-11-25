import { describe, expect, it } from "vitest";
import { HOME_TEXT_DEFAULTS, HOME_TEXT_KEYS, HOME_TEXT_SECTIONS, makeT } from "./home-content";
import { storeSettingsSchema } from "./schemas/settings";

describe("textos de la home editables", () => {
  it("usa el texto del panel y, si está vacío o no existe, el de por defecto", () => {
    const t = makeT({ "hero.text": "  Nuevo texto  ", "offers.title": "   ", "x.y": "ignorado" });
    expect(t("hero.text")).toBe("Nuevo texto");
    expect(t("offers.title")).toBe(HOME_TEXT_DEFAULTS["offers.title"]);
    expect(makeT(null)("ritual.title")).toBe(HOME_TEXT_DEFAULTS["ritual.title"]);
  });

  it("el formulario del panel tiene un campo por cada texto", () => {
    const listed = HOME_TEXT_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));
    expect([...listed].sort()).toEqual([...HOME_TEXT_KEYS].sort());
  });
});

describe("Datos del local: logo, video y textos", () => {
  const base = {
    name: "El Mate", tagline: "", whatsappNumber: "", phone: "", address: "", instagramUrl: "", instagramPosts: "",
    hoursWeekdays: "", hoursSaturday: "", hoursSunday: "", logo: "", heroVideo: "", homeTexts: {},
  };
  it("acepta URLs http(s) o vacío, y solo claves de texto que existen", () => {
    expect(storeSettingsSchema.safeParse({ ...base, logo: "https://x.co/logo.webp", heroVideo: "https://x.co/v.mp4", homeTexts: { "hero.text": "Hola" } }).success).toBe(true);
    expect(storeSettingsSchema.safeParse({ ...base, logo: "logo.png" }).success).toBe(false);
    expect(storeSettingsSchema.safeParse({ ...base, homeTexts: { "no.existe": "x" } }).success).toBe(false);
  });
});
