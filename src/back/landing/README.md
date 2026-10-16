# back/landing

Lecturas de la web pública (landing y catálogo). Todavía vacío: es la próxima fase.

Reglas para cuando se construya:

- Leer **solo** de las vistas públicas de la base: `public_products`, `public_variants`,
  `public_categories`, `public_store_info`. Nunca de las tablas (`products`, `product_variants`…):
  ahí hay costos y stock exacto.
- No requiere sesión: el visitante es `anon`.
- Las funciones van en archivos por tema, por ejemplo `catalog.ts` (listar productos, detalle por slug)
  y `store.ts` (datos del local, WhatsApp).
