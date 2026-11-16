// Copia las fotos de productos del Supabase viejo (nube) al Storage del Supabase nuevo (Coolify).
//
// Uso (Git Bash, desde la raíz del repo):
//   NEW_SUPABASE_URL=https://TU-DOMINIO-KONG \
//   NEW_SERVICE_KEY=<service role key> \
//   node scripts/migrar-fotos.mjs "C:/Users/Pc/Downloads/products_rows_fixed.sql" "C:/Users/Pc/Downloads/categories_rows.sql"
//
// - Lee las URLs del Supabase viejo que aparecen en los archivos .sql indicados.
// - Las descarga (el bucket viejo es público) y las sube al bucket product-images del nuevo, con la misma ruta.
// - Al final imprime el UPDATE de SQL que reescribe las URLs en la base nueva.
// La service key NO se guarda en ningún archivo: se pasa solo por variable de entorno.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const newUrl = process.env.NEW_SUPABASE_URL?.replace(/\/+$/, "");
const serviceKey = process.env.NEW_SERVICE_KEY;
const files = process.argv.slice(2);
if (!newUrl || !serviceKey || files.length === 0) {
  console.error("Falta NEW_SUPABASE_URL, NEW_SERVICE_KEY o algún archivo .sql. Mirá el comentario del script.");
  process.exit(1);
}

const BUCKET = "product-images";
const urlRe = /https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/product-images\/[^'",\s)\]]+/g;
const urls = new Set();
let oldBase = null;
for (const f of files) {
  for (const u of readFileSync(f, "utf8").match(urlRe) ?? []) {
    urls.add(u);
    oldBase ??= u.slice(0, u.indexOf(`/${BUCKET}/`) + BUCKET.length + 2);
  }
}
console.log(`${urls.size} fotos distintas para migrar.`);

const supabase = createClient(newUrl, serviceKey, { auth: { persistSession: false } });
const mime = { webp: "image/webp", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

let ok = 0;
const fallas = [];
for (const url of urls) {
  const path = decodeURIComponent(url.slice(oldBase.length));
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`descarga HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const ext = path.split(".").pop().toLowerCase();
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, body, { contentType: mime[ext] ?? "application/octet-stream", upsert: true });
    if (error) throw new Error(error.message);
    ok++;
    console.log(`OK   ${path}`);
  } catch (e) {
    fallas.push(path);
    console.error(`FALLÓ ${path}: ${e.message}`);
  }
}

console.log(`\nSubidas: ${ok}/${urls.size}. Fallaron: ${fallas.length}.`);
if (fallas.length === 0) {
  const nuevaBase = `${newUrl}/storage/v1/object/public/${BUCKET}/`;
  console.log("\n-- Corré esto en el SQL Editor del Supabase nuevo:\n");
  console.log(
    `update public.products set images = array(select replace(u, '${oldBase}', '${nuevaBase}') from unnest(images) u)\n where exists (select 1 from unnest(images) u where u like '${oldBase}%');\n` +
      `update public.categories set image = replace(image, '${oldBase}', '${nuevaBase}')\n where image like '${oldBase}%';`,
  );
} else {
  console.log("No imprimo el UPDATE hasta que suban todas. Volvé a correr el script (es idempotente).");
  process.exit(1);
}
