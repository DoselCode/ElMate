# back/landing

Lecturas de la web pública (home, tienda, página de producto). Sin sesión: el visitante es `anon`.

| Archivo | Qué hace |
|---|---|
| `catalog.ts` | **Lo único que importan las páginas.** Arma la home (ofertas, más vendidos, novedades), la tienda con filtros y la página de producto. Si la base falla devuelve listas vacías: la web no se cae. |
| `source.ts` | Contrato de las consultas básicas (`CatalogSource`). |
| `supabase-source.ts` | Implementación real: lee **solo** las vistas `public_products`, `public_variants`, `public_categories`, `public_best_sellers`, `public_store_info`. Nunca las tablas (ahí hay costos y stock exacto). |
| `demo-source.ts` | Catálogo de ejemplo en memoria (precios y nombres del diseño de Figma). Se activa con `ELMATE_DEMO=1`. Sin WhatsApp a propósito. |

Las páginas públicas se cachean (`revalidate = 60`); las acciones del panel llaman a
`revalidatePath("/", "layout")` para que un cambio de precio o stock se vea al instante.
