# Tienda con filtros laterales: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer `/tienda` con una barra lateral de filtros plegables, generada desde la base, con cantidades por opción.

**Architecture:** Una migración agrega `web_key()`, tres columnas a `public_products` y el RPC `shop_facets(jsonb)`. Las cantidades son facetas disyuntivas. Los productos se siguen filtrando desde supabase-js sobre la vista. El parseo y el armado de la URL quedan en un módulo puro y compartido. La UI se divide en sidebar, toolbar y chips de filtros activos.

**Tech Stack:** Next.js 16 (App Router, leer `node_modules/next/dist/docs/` antes de tocar páginas), React 19, Tailwind 4, Supabase (Postgres + PostgREST), Vitest (+ PGlite para SQL), Playwright + axe.

**Spec:** `docs/superpowers/specs/2026-11-18-tienda-filtros-laterales-design.md`

## Global Constraints

- La web pública lee **solo vistas `public_*`** como `anon`, nunca tablas. `shop_facets` es `security invoker`, `stable`, con `grant execute` a `anon, authenticated`.
- Los links que ya existen siguen andando sin cambios: `?categoria=`, `?ofertas=1`, `?promo=`, `?q=`, `?orden=`, `?page=`.
- Si las facetas fallan, la tienda muestra productos sin barra lateral (`safe(...)` con fallback `EMPTY_FACETS`).
- Ninguna opción con 0 productos aparece. Ninguna sección vacía aparece. "Sin marca" no es opción.
- La clave de URL es `slugify()` (`src/shared/slug.ts`). La función SQL `web_key()` tiene que dar **el mismo resultado** para los mismos casos de prueba.
- Comentarios y textos de la UI en español neutro, como el resto del proyecto. Nada de la marca o los textos de Nike.
- Como mucho 20 valores por parámetro y 5 parámetros de opción. Lo que sobra se ignora.

## Review Focus

1. **Link viejo o armado a mano** (`?marca=,,`, `?precio=abc`, `?precio=900-100`, `?color=<script>`): se ignora lo inválido y la tienda carga sin error. Si mín > máx, se intercambian.
2. **Filtro que deja 0 productos** (por ejemplo, marca + precio incompatibles): se ve el estado vacío con "Limpiar todo", y la sección elegida sigue visible aunque tenga 0, para poder destildarla.
3. **Promo + filtros** (`?promo=x&marca=y`): las facetas cuentan solo dentro de los productos de la promo, y "Limpiar todo" saca también la promo.
4. **Opción cuyo nombre choca con un parámetro reservado** (una opción llamada "Precio" o "Q"): no se ofrece como filtro y no rompe el parseo.
5. **Celular**: el panel de filtros se cierra con Escape y con el fondo, devuelve el foco al botón "Filtros" y no deja scrollear la página de atrás.

---

### Task 1: Base de datos — `web_key`, columnas nuevas y `shop_facets`

**Files:**
- Create: `supabase/migrations/20261119000000_tienda_filtros.sql`
- Test: `tests/db/schema.test.ts` (nuevo `describe("shop facets")`)
- Modify: `README.md` / docs de setup si listan migraciones (el commit `ef0c13b` las lista todas: sumar esta)

**Interfaces:**
- Produces:
  - `public.web_key(text) returns text`, `immutable`
  - `public_products` + `brand_key text`, `option_tags text[]`, `option_tags_in_stock text[]` (agregadas **al final** de la vista, partiendo de la última definición en `20261113000000_promociones_y_personalizacion.sql:211`; `create or replace view` permite sumar columnas al final, así que `public_categories`, que depende de la vista, no se toca)
  - `public.shop_facets(p_filters jsonb) returns jsonb`. Entrada: `{ q?: string, category?: string, ids?: uuid[], brands?: string[], price_min?: number, price_max?: number, options?: { [key]: string[] }, offers?: boolean, in_stock?: boolean }`. Salida: la forma de la sección "Base de datos" del spec, con `brands[].key` y `options[].values[].key`

- [ ] **Step 1: Escribir los tests que fallan** en `tests/db/schema.test.ts`, usando los helpers `as`, `rows` y `saveProduct` que ya existen:
  - `web_key matches slugify`: para `["El Mate", "Tamaño", "  Rojo  ", "Waterdog", "Ñandú Café", "a--b__c"]`, `select public.web_key($1)` === `slugify(x)` (importar de `@/shared/slug`).
  - `public_products exposes brand_key and option tags`: un producto con brand "Waterdog", option_names `["Color"]` y variantes Rojo (stock 0, track_stock) y Negro (stock 3) da `brand_key = 'waterdog'`, `option_tags` ⊇ `{color:rojo,color:negro}` y `option_tags_in_stock = {color:negro}`.
  - `shop_facets counts disjunctively`: con 2 productos Waterdog y 1 El Mate, `shop_facets('{"brands":["waterdog"]}')` devuelve en `brands` las dos marcas (Waterdog 2, El Mate 1), y en `categories` cuenta solo los de Waterdog.
  - `shop_facets omits zeros and sin marca`: ninguna entrada con `count = 0`, ni con `key` vacío o null.
  - `shop_facets price ignores own filter`: `price` con `price_min` aplicado === `price` sin ese filtro.
  - `shop_facets runs as anon`: `as("anon", ...)` no tira error.

- [ ] **Step 2: Correr y ver que fallan**
  Run: `npx vitest run tests/db/schema.test.ts -t "shop facets"`
  Expected: FAIL (`function public.web_key does not exist`)

- [ ] **Step 3: Escribir la migración.** `web_key`: `lower` → `translate` de `áàäâãéèëêíìïîóòöôõúùüûñç` a `aaaaaeeeeiiiiooooouuuunc` → `regexp_replace('[^a-z0-9]+','-','g')` → recortar guiones de los bordes → `left(…, 80)`. Las columnas de opciones salen de `public.product_variants` activas con `price > 0`, recorriendo `jsonb_each_text(pv.attributes)` y armando `web_key(key) || ':' || web_key(value)`. `shop_facets`: un CTE `base` con `public_products` filtrado por todo **menos** marca/opciones/precio. Después, una subconsulta por faceta que aplica todos los filtros salvo el suyo. Nombre visible = `mode()` de la forma original por clave, con desempate alfabético. Categorías ordenadas por `sort_order` (join a `public_categories`). Los valores de cada opción van por cantidad desc y después por nombre. Si `in_stock` es true, las opciones filtran contra `option_tags_in_stock`.

- [ ] **Step 4: Correr y ver que pasan**
  Run: `npx vitest run tests/db`
  Expected: PASS (todos, incluidos los tests viejos de `public_products`)

- [ ] **Step 5: Commit**
  `git add supabase/migrations/20261119000000_tienda_filtros.sql tests/db/schema.test.ts README.md`
  `git commit -m "feat(db): add shop facets function and filter columns to public products"`

---

### Task 2: Filtros en la URL (módulo puro compartido)

**Files:**
- Create: `src/shared/shop-filters.ts`, `src/shared/shop-filters.test.ts`
- Modify: `src/shared/types.ts:357-369` (`ShopFilters`, tipos de facetas), `src/back/landing/catalog.ts:71-81` (`parseShopFilters` pasa a delegar)

**Interfaces:**
- Produces (en `src/shared/types.ts`):
  ```ts
  export type PriceRange = { min: number | null; max: number | null };
  export type ShopFilters = { q: string; category: string; sort: ShopSort; offers: boolean; promo: string; page: number;
    brands: string[]; price: PriceRange; options: Record<string, string[]>; inStock: boolean };
  export type FacetValue = { value: string; key: string; count: number };
  export type ShopFacets = { categories: { slug: string; name: string; count: number }[]; brands: FacetValue[];
    options: { name: string; key: string; values: FacetValue[] }[]; price: { min: number; max: number } | null;
    offers: number; inStock: number };
  export const EMPTY_FACETS: ShopFacets; // listas vacías, price null, contadores 0
  ```
- Produces (en `src/shared/shop-filters.ts`):
  - `RESERVED_PARAMS: readonly string[]` = `["q","categoria","orden","ofertas","promo","page","marca","precio","stock"]`
  - `parseShopFilters(sp: SearchParams): ShopFilters`, que se mueve desde `catalog.ts` y suma los campos nuevos
  - `shopQuery(f: ShopFilters, patch?: Partial<ShopFilters>): string`: "?…" sin vacíos ni valores default, listas unidas con coma, `page` se omite si es 1
  - `toggleValue(list: string[], key: string): string[]`
  - `activeFilterCount(f: ShopFilters): number`: cuenta categoría, cada marca, cada valor de opción, precio (1), ofertas, stock y promo

- [ ] **Step 1: Escribir los tests que fallan** en `shop-filters.test.ts`:
  - `keeps legacy links`: `parseShopFilters({categoria:"yerbas", ofertas:"1", orden:"precio-asc", promo:"dia-padre", q:"mate", page:"2"})` trae los mismos valores que hoy y `brands: []`, `options: {}`, `inStock: false`, `price: {min:null,max:null}`.
  - `parses multi values`: `{marca:"waterdog,el-mate", color:"rojo,negro", stock:"1", precio:"5000-20000"}` da `brands: ["waterdog","el-mate"]`, `options: {color:["rojo","negro"]}`, `inStock: true`, `price: {min:5000,max:20000}`.
  - `drops invalid values` (Review Focus 1): `marca:",,Wáter Dog!,ok"` da `["ok"]`; `precio:"abc"` da nulls; `precio:"-20000"` da `{min:null,max:20000}`; `precio:"900-100"` da `{min:100,max:900}`; 25 marcas dan 20.
  - `ignores reserved and excess option params` (Review Focus 4): `precio` nunca cae en `options`; con 7 params de opción quedan 5.
  - `round trips`: `parseShopFilters(Object.fromEntries(new URLSearchParams(shopQuery(f))))` deep-equals `f` para un `f` con todo cargado.
  - `patch resets page`: `shopQuery({...f, page: 3}, { brands: ["x"] })` no tiene `page`.
  - `activeFilterCount` con categoría + 2 marcas + precio + promo === 5.

- [ ] **Step 2: Correr y ver que fallan**
  Run: `npx vitest run src/shared/shop-filters.test.ts`
  Expected: FAIL (no se encuentra el módulo)

- [ ] **Step 3: Implementar** `src/shared/shop-filters.ts`. Cada valor de lista se valida con `/^[a-z0-9-]{1,80}$/` (las claves ya vienen en slug; no se re-slugifican), y las claves de opción con `/^[a-z0-9-]{1,40}$/`. Sacar `parseShopFilters` y `SORTS` de `catalog.ts` y re-exportarlos desde ahí, para que `src/app/(landing)/tienda/page.tsx` no cambie.

- [ ] **Step 4: Correr y ver que pasan**
  Run: `npx vitest run src/shared && npm run typecheck`
  Expected: PASS. El typecheck va a marcar los usos de `ShopFilters` en `shop-screen.tsx` / `shop-filters.tsx`: si hace falta, completarlos con lo mínimo (los reescribe la Task 4).

- [ ] **Step 5: Commit**
  `git commit -m "feat(shop): parse and build multi-value shop filters from the url"`

---

### Task 3: Fuentes del catálogo — filtrar y dar facetas

**Files:**
- Modify: `src/back/landing/source.ts` (`ProductQuery`, `CatalogSource.facets`), `src/back/landing/supabase-source.ts:50-78`, `src/back/landing/demo-source.ts` (datos + `matches` + `facets`), `src/back/landing/catalog.ts` (`listShopProducts`, `getShopFacets`), `src/back/landing/README.md`
- Create: `src/back/landing/demo-source.test.ts`

**Interfaces:**
- Consumes: `ShopFilters`, `ShopFacets`, `EMPTY_FACETS` (Task 2); `brand_key`, `option_tags`, `option_tags_in_stock`, `shop_facets` (Task 1)
- Produces:
  - `ProductQuery` + `brands?: string[]; priceMin?: number; priceMax?: number; options?: Record<string, string[]>; inStock?: boolean`
  - `CatalogSource.facets(f: FacetQuery): Promise<ShopFacets>`, con `type FacetQuery = Omit<ProductQuery, "sort" | "limit" | "offset" | "featuredOnly" | "inNewsOnly" | "excludeId">`
  - `getShopFacets(f: ShopFilters): Promise<ShopFacets>` en `catalog.ts` (resuelve los ids de la promo igual que `listShopProducts` y usa `safe("filtros", EMPTY_FACETS, …)`)
  - `PublicProduct` + `brand_key: string | null; option_tags: string[]; option_tags_in_stock: string[]`

- [ ] **Step 1: Escribir los tests que fallan** en `demo-source.test.ts` (importa `demoSource` directo, no `catalog.ts`, porque ese es `server-only`):
  - `demo has brands and colors`: `facets({})` trae ≥ 2 marcas y una opción `key: "color"` con ≥ 2 valores.
  - `facets are disjunctive`: con `brands: [b0]`, `facets.brands` sigue trayendo todas las marcas y `categories` suma lo mismo que `products({brands:[b0]}).total`.
  - `no zero counts`: ningún `count === 0` en ninguna faceta.
  - `products filter by option and stock`: `products({options:{color:["negro"]}, inStock:true, sort:"destacados", limit:50})` solo trae productos con `"color:negro"` en `option_tags_in_stock`.
  - `price filter uses card price`: todos los resultados de `priceMin: 20000` tienen `price >= 20000`.

- [ ] **Step 2: Correr y ver que fallan**
  Run: `npx vitest run src/back/landing`
  Expected: FAIL

- [ ] **Step 3: Implementar.**
  - Demo: sumar `brand` a `DemoProduct` y cargar al menos 3 marcas en los productos existentes, más un segundo producto con `options: ["Color"]`, con una variante `inStock: false`. Calcular `brand_key` y `option_tags*` con `slugify` al armar `ALL`. `facets` replica las reglas del SQL en memoria.
  - Supabase: `.in("brand_key", brands)`, `.gte/.lte("price", …)`, `.eq("in_stock", true)`, y por cada opción `.overlaps(inStock ? "option_tags_in_stock" : "option_tags", values.map(v => \`${key}:${v}\`))`. `facets` = `createPublicClient().rpc("shop_facets", { p_filters })`, mapeando a `ShopFacets` (los numeric llegan como string: pasarlos con `Number`).
  - `listShopProducts` pasa los filtros nuevos.

- [ ] **Step 4: Correr y ver que pasan**
  Run: `npx vitest run && npm run typecheck`
  Expected: PASS

- [ ] **Step 5: Commit**
  `git commit -m "feat(shop): filter products by brand, price, options and stock with facet counts"`

---

### Task 4: UI de la tienda — sidebar, toolbar, chips y panel móvil

**Files:**
- Create: `src/front/landing/shop/shop-sidebar.tsx`, `src/front/landing/shop/shop-toolbar.tsx`, `src/front/landing/shop/active-filters.tsx`, `src/front/landing/shop/use-shop-navigation.ts`
- Modify: `src/front/landing/shop/shop-screen.tsx`, `src/front/landing/shop/shop-filters.tsx` (queda solo la búsqueda por texto: renombrar a `shop-search.tsx`), `src/app/(landing)/tienda/page.tsx` (sumar `getShopFacets` al `Promise.all`), `src/front/landing/shop/shop-loading.tsx` (esqueleto de dos columnas)
- Delete: `src/front/landing/shop/category-nav.tsx`

**Interfaces:**
- Consumes: `ShopFilters`, `ShopFacets`, `shopQuery`, `toggleValue`, `activeFilterCount` (Task 2); `getShopFacets` (Task 3)
- Produces:
  - `useShopNavigation(filters: ShopFilters): { apply(patch: Partial<ShopFilters>): void; pending: boolean }`: `router.replace(pathname + shopQuery(filters, patch), { scroll: false })` dentro de `startTransition`
  - `<ShopSidebar filters facets />`, `<ShopToolbar title total filters onToggleFilters filtersHidden />`, `<ActiveFilters filters facets />`, `<ShopSearch filters />`

- [ ] **Step 1: Implementar los componentes** siguiendo la sección "Frontend" del spec:
  - Sidebar: un `<details>` por sección. Arranca abierto si tiene algo elegido. Categoría = links (`aria-current`); el resto = checkboxes con "Nombre (N)". Precio = dos `input type="number"` con placeholder igual al min/max de la faceta, que se aplican al perder el foco o con Enter. Las secciones con algo elegido se muestran aunque la faceta venga vacía (Review Focus 2), con el valor elegido y la cantidad 0.
  - Toolbar: `<h1>` "Título (total)", botón "Ocultar filtros"/"Mostrar filtros" (desde `lg`, se guarda en `localStorage["shop.filtersHidden"]` con try/catch) y "Ordenar por" (`select`, con las mismas etiquetas de `SORT_LABELS`). Abajo de `lg`: botón "Filtros (N)" que abre el panel.
  - Panel móvil: `<dialog>` con `showModal()` (Escape y foco nativos). Se cierra al tocar el fondo y devuelve el foco al botón. Bloquea el scroll del `body` mientras está abierto (Review Focus 5).
  - Chips activos: una etiqueta legible desde las facetas (el `value`, no la `key`), un botón ✕ con `aria-label="Quitar filtro <nombre>"`, y "Limpiar todo", que navega a `/tienda` sin parámetros (también saca la promo: Review Focus 3).
  - Layout: `lg:grid lg:grid-cols-[16rem_1fr] lg:gap-8`. Con los filtros ocultos, una sola columna.
  - Si `facets` === `EMPTY_FACETS` y no hay filtros activos, no se renderiza la sidebar.

- [ ] **Step 2: Verificar en el navegador** (servidor `dev` de `.claude/launch.json`). En `/tienda`: se ve la sidebar con Categoría/Marca/Precio/Color y sus cantidades; tildar una marca cambia la URL a `?marca=…`, baja el total y aparece el chip; "Limpiar todo" vuelve a `/tienda`. En viewport `mobile`: "Filtros (N)" abre el panel, y Escape lo cierra. Sin errores en la consola.

- [ ] **Step 3: Correr lint y typecheck**
  Run: `npm run lint && npm run typecheck`
  Expected: sin errores

- [ ] **Step 4: Commit**
  `git commit -m "feat(shop): sidebar filters with counts, active chips and mobile panel"`

---

### Task 5: E2E y accesibilidad

**Files:**
- Modify: `e2e/public/shop.spec.ts`, `e2e/support/shop.ts`, la spec de axe que ya cubre `/tienda` (buscarla en `e2e/`)

**Interfaces:**
- Consumes: la UI de la Task 4. Se corre contra el servidor con `ELMATE_DEMO=1`, que tiene marcas y colores desde la Task 3.

- [ ] **Step 1: Actualizar y escribir los tests**:
  - `CU-03 filters by category`: ahora hace clic en el link "Yerbas" de la sidebar (`getByRole("complementary")` o la región de filtros). El resto de las aserciones queda igual.
  - `filters by brand`: tildar la primera marca → URL `marca=`, el total baja o se mantiene, aparece el chip "Quitar filtro <marca>", y al quitarlo vuelve el total original.
  - `legacy links still work`: `/tienda?categoria=yerbas` y `/tienda?ofertas=1` muestran productos y el chip correspondiente.
  - `empty result offers clear all` (Review Focus 2): `/tienda?marca=<marca>&precio=999999-` muestra el estado vacío, "Limpiar todo" funciona y la marca elegida sigue tildada en la sidebar.
  - `mobile filters panel @mobile` (Review Focus 5): abrir "Filtros", Escape lo cierra y el foco vuelve al botón.
  - `invalid params do not break the page` (Review Focus 1): `/tienda?precio=abc&marca=,,&color=%3Cscript%3E` responde 200 y muestra productos.
  - axe en `/tienda` con la sidebar abierta y con el panel móvil abierto: 0 violaciones serias o críticas.

- [ ] **Step 2: Correr**
  Run: `npx playwright test e2e/public/shop.spec.ts` (con `ELMATE_DEMO=1 npm run dev` levantado)
  Expected: PASS en desktop y mobile

- [ ] **Step 3: Suite completa**
  Run: `npm test && npm run lint && npm run typecheck && npx playwright test`
  Expected: todo PASS

- [ ] **Step 4: Commit**
  `git commit -m "test(shop): e2e coverage for sidebar filters, legacy links and mobile panel"`
