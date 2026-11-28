// Carga fotos de productos desde una carpeta, cruzando el código del nombre del archivo con el SKU.
//
// Uso (Git Bash, desde la raíz del repo):
//   SUPABASE_URL=https://TU-PROYECTO \
//   SERVICE_KEY=<service role key> \
//   node scripts/cargar-fotos.mjs "C:/ruta/a/la/carpeta"              # prueba: solo muestra qué haría
//   ... node scripts/cargar-fotos.mjs "C:/ruta/a/la/carpeta" --aplicar    # sube las fotos y las asigna
//   ... --aplicar --reemplazar   # deja SOLO las fotos nuevas (por defecto se agregan adelante de las que haya)
//   ... --mapa=scripts/fotos-landing-mapa.json   # si los códigos de las fotos no son los SKU de la base:
//        un JSON { "CÓDIGO-DE-LA-FOTO": "SKU" }. Con mapa, solo se tocan los códigos que figuran en él.
//
// Nombres que entiende (el código va primero; mayúsculas o minúsculas da igual):
//   MAT011_imperial-algarrobo-virola-alpaca_1.jpg   → código MAT011, foto 1
//   TERM010-3.jpeg / TERM010.jpeg                   → código TERM010, foto 3 / foto principal
//   BOL011_portafolio-termo-cuero-negro_2.jpg       → si el producto tiene una opción "Negro", esa foto
//                                                      también queda como foto de esa variante
// El código se compara con el SKU de las variantes ignorando guiones, espacios y mayúsculas
// (MAT011 = mat-011). Las fotos "PARTE_<nombre>_N" se agrupan por nombre (PARTE_<NOMBRE>) y solo se usan
// si ese grupo está en el mapa. Los archivos sin código se listan y no se tocan.
//
// - Es idempotente: cada foto se sube siempre a la misma ruta (productos/<código>/<archivo>), así que
//   volver a correrlo no duplica nada.
// - Máximo 6 fotos por producto (lo mismo que permite el panel).
// - La service key NO se guarda en ningún archivo: se pasa solo por variable de entorno.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const serviceKey = process.env.SERVICE_KEY;
const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const apply = args.includes("--aplicar");
const replace = args.includes("--reemplazar");
const mapaPath = args.find((a) => a.startsWith("--mapa="))?.slice("--mapa=".length);
const mapa = mapaPath
  ? Object.fromEntries(Object.entries(JSON.parse(readFileSync(mapaPath, "utf8"))).filter(([k]) => !k.startsWith("_")))
  : null;
if (!url || !serviceKey || !folder) {
  console.error("Falta SUPABASE_URL, SERVICE_KEY o la carpeta. Mirá el comentario al principio del script.");
  process.exit(1);
}

const BUCKET = "product-images";
const MAX_IMAGES = 6;
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
/** Nombres mal tipeados en la carpeta → código real. */
const ALIASES = { BOOL002: "BOL002" };

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const words = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

// ---- 1. Fotos de la carpeta, agrupadas por código ------------------------------------------
const groups = new Map(); // código → [{ file, order, descriptor }]
const sinCodigo = [];
for (const file of readdirSync(folder).sort()) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (!MIME[ext]) continue;
  const base = path.basename(file, path.extname(file)).trim();
  // "PARTE_mate-imperial-algarrobo_2" no trae código: el grupo es el nombre (PARTE_MATE-IMPERIAL-ALGARROBO),
  // y solo se usa si está en el mapa
  const parte = /^PARTE[_-](.+?)(?:[-_ ]\d{1,2})?$/i.exec(base);
  const m = parte ? null : /^([A-Za-z]+\d+)(.*)$/.exec(base);
  if (!parte && !m) {
    sinCodigo.push(file);
    continue;
  }
  const raw = parte ? `PARTE_${parte[1]}`.toUpperCase() : m[1].toUpperCase();
  const code = ALIASES[raw] ?? raw;
  // Lo que sigue al código: "_imperial-algarrobo_2" (o, en PARTE, solo el "_2")
  const rest = parte ? base.slice("PARTE_".length + parte[1].length) : m[2];
  const num = /[-_ ](\d{1,2})$/.exec(rest);
  const order = num ? Number(num[1]) : 0; // sin número = foto principal
  const descriptor = (num ? rest.slice(0, num.index) : rest).replace(/^[-_ ]+/, "");
  if (!groups.has(code)) groups.set(code, []);
  groups.get(code).push({ file, ext, order, descriptor });
}
for (const list of groups.values()) list.sort((a, b) => a.order - b.order || a.file.localeCompare(b.file));

// ---- 2. Variantes y productos de la base -------------------------------------------------------
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

async function all(table, columns) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999);
    if (error) throw new Error(`No se pudo leer ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

const variants = await all("product_variants", "id, sku, product_id, attributes, image");
const products = new Map((await all("products", "id, name, images, option_names")).map((p) => [p.id, p]));
const bySku = new Map();
for (const v of variants) {
  const key = norm(v.sku);
  if (!bySku.has(key)) bySku.set(key, []);
  bySku.get(key).push(v);
}

// ---- 3. Plan: qué foto va a qué producto (y a qué variante) ----------------------------------
const plan = [];
const sinProducto = [];
for (const [code, photos] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
  if (mapa && !mapa[code]) {
    sinProducto.push({ code, photos: photos.length, motivo: "no está en el mapa" });
    continue;
  }
  const matches = bySku.get(norm(mapa ? mapa[code] : code)) ?? [];
  const productIds = [...new Set(matches.map((v) => v.product_id))];
  if (productIds.length !== 1) {
    sinProducto.push({ code, photos: photos.length, motivo: productIds.length ? "el código está en varios productos" : "no hay ningún SKU con ese código" });
    continue;
  }
  const product = products.get(productIds[0]);
  const productVariants = variants.filter((v) => v.product_id === product.id);
  // Foto de una opción: la última palabra del nombre coincide con un valor de la variante (negro, marron, river…)
  const variantPhotos = new Map(); // variant id → primera foto de esa opción
  if (productVariants.length > 1) {
    for (const p of photos) {
      const w = words(p.descriptor);
      const v = productVariants.find((v) =>
        Object.values(v.attributes ?? {}).some((value) => {
          const vw = words(String(value));
          return vw.length > 0 && vw.every((x) => w.includes(x));
        }),
      );
      if (v && !variantPhotos.has(v.id)) variantPhotos.set(v.id, p);
    }
  }
  plan.push({ code, product, photos, productVariants, variantPhotos });
}

// ---- 4. Mostrar el plan ----------------------------------------------------------------------
console.log(`\n${apply ? "APLICANDO" : "PRUEBA (no cambia nada; agregá --aplicar para hacerlo)"} · modo: ${replace ? "reemplazar" : "agregar adelante"}\n`);
for (const { code, product, photos, productVariants, variantPhotos } of plan) {
  const actuales = product.images?.length ?? 0;
  const extra = photos.length > MAX_IMAGES ? ` (se usan las primeras ${MAX_IMAGES})` : "";
  console.log(`✔ ${code.padEnd(9)}${mapa ? ` (${mapa[code]})` : ""} → ${product.name}  ·  ${photos.length} foto(s)${extra}, ya tenía ${actuales}`);
  for (const [variantId, p] of variantPhotos) {
    const v = productVariants.find((x) => x.id === variantId);
    console.log(`     opción ${Object.values(v.attributes ?? {}).join(" / ")} → ${p.file}`);
  }
}
if (sinProducto.length) {
  console.log(`\n✘ Códigos sin producto (${sinProducto.length}): no se tocan`);
  for (const s of sinProducto) console.log(`   ${s.code.padEnd(9)} ${s.photos} foto(s) · ${s.motivo}`);
}
if (sinCodigo.length) {
  console.log(`\n? Archivos sin código (${sinCodigo.length}): no se tocan`);
  for (const f of sinCodigo) console.log(`   ${f}`);
}
const totalFotos = plan.reduce((n, p) => n + Math.min(p.photos.length, MAX_IMAGES), 0);
console.log(`\nResumen: ${plan.length} productos con fotos nuevas (${totalFotos} fotos), ${sinProducto.length} códigos sin producto, ${sinCodigo.length} archivos sin código.`);
if (!apply) process.exit(0);

// ---- 5. Subir y asignar ----------------------------------------------------------------------
const bucket = supabase.storage.from(BUCKET);
let fallas = 0;
for (const { code, product, photos, variantPhotos } of plan) {
  try {
    const urls = new Map(); // archivo → URL pública
    const toUpload = [...new Set([...photos.slice(0, MAX_IMAGES), ...variantPhotos.values()])];
    for (const p of toUpload) {
      const safe = p.file.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9._-]/g, "-");
      const storagePath = `productos/${code.toLowerCase()}/${safe}`;
      const { error } = await bucket.upload(storagePath, readFileSync(path.join(folder, p.file)), {
        contentType: MIME[p.ext],
        cacheControl: "31536000",
        upsert: true,
      });
      if (error) throw new Error(`subiendo ${p.file}: ${error.message}`);
      urls.set(p.file, bucket.getPublicUrl(storagePath).data.publicUrl);
    }

    const nuevas = photos.slice(0, MAX_IMAGES).map((p) => urls.get(p.file));
    const images = [...new Set(replace ? nuevas : [...nuevas, ...(product.images ?? [])])].slice(0, MAX_IMAGES);
    const { error } = await supabase.from("products").update({ images }).eq("id", product.id);
    if (error) throw new Error(`guardando las fotos: ${error.message}`);

    for (const [variantId, p] of variantPhotos) {
      const { error: vErr } = await supabase.from("product_variants").update({ image: urls.get(p.file) }).eq("id", variantId);
      if (vErr) throw new Error(`guardando la foto de una opción: ${vErr.message}`);
    }
    console.log(`OK    ${code} → ${product.name} (${images.length} fotos${variantPhotos.size ? `, ${variantPhotos.size} opciones` : ""})`);
  } catch (e) {
    fallas++;
    console.error(`FALLÓ ${code} → ${product.name}: ${e.message}`);
  }
}
console.log(`\nListo: ${plan.length - fallas}/${plan.length} productos actualizados.${fallas ? " Volvé a correrlo: no duplica lo que ya subió." : ""}`);
console.log("La web se actualiza sola en hasta 60 segundos.");
process.exit(fallas ? 1 : 0);
