# Tienda: filtros laterales generados desde los datos

Fecha: 2026-11-18 · Rama: `feature/store-filters-ux` (desde `develop`)

## Intención

Rehacer `/tienda` con el patrón de una tienda grande (referencia: el listado de Nike):
filtros en una columna a la izquierda, plegables, y orden arriba a la derecha.
Los filtros **no se escriben a mano**: salen de lo que hay cargado en la base.
Si un filtro o una opción no tiene productos, no aparece. Si mañana se cargan
variantes con otra opción (por ejemplo "Material"), aparece sola.

El objetivo es que el cliente encuentre más rápido lo que busca y vea cuántos
productos tiene cada opción antes de hacer clic.

## Objetivos

- Barra lateral con secciones plegables: **Categoría**, **Marca**, **Precio**,
  **una sección por cada opción de variante** (hoy solo "Color"), **Ofertas** y **En stock**.
- Cada opción muestra su cantidad: "Waterdog (3)". Las cantidades se recalculan
  según los demás filtros elegidos (facetas disyuntivas: la cantidad de una opción de Marca
  tiene en cuenta todos los filtros activos menos el de Marca).
- Las opciones sin productos no se muestran. Las secciones sin opciones tampoco.
- Encabezado: título con el total ("Yerbas (8)"), botón **Ocultar filtros** y **Ordenar por**.
- Chips de filtros activos sobre la grilla, cada uno con su ✕, más "Limpiar todo".
- En el celular, los filtros se abren en un panel lateral con el botón "Filtros (N)".
- Todo sigue viajando en la URL: un listado filtrado se puede compartir.

## Lo que queda afuera

- Sin talles ni filtros pensados para ropa. Solo lo que hay en los datos.
- Sin cambios en el panel de administración ni en la carga de productos.
- Sin búsqueda por texto completo nueva. La búsqueda actual por palabras queda igual.
- No se copia la marca, los textos ni la estética de Nike. Solo el patrón de layout.

## Lo que haría fallar esto aunque funcione

- Que aparezcan filtros u opciones que llevan a "0 productos".
- Que se rompan los links que ya existen: `?categoria=`, `?ofertas=1`, `?promo=`, `?q=`, `?orden=`, `?page=`.
  Los usan la home, el menú y las cards de promociones.
- Que la vista pública exponga costos o stock exacto. Hoy no lo hace y tiene que seguir así.
- Que la web se caiga si la función de filtros falla. La regla del proyecto es devolver vacío y seguir.

## Restricciones

- La web pública lee **solo vistas públicas** (`public_products`, `public_variants`, etc.) como `anon`.
  Nunca las tablas. La función nueva es `security invoker` y lee esas vistas.
- `demo-source.ts` implementa el mismo contrato `CatalogSource`, así que también tiene que dar facetas
  (calculadas en memoria) para que `ELMATE_DEMO=1` siga andando.
- Next.js del proyecto con cambios de API: leer `node_modules/next/dist/docs/` antes de tocar la página.
- Las páginas se cachean (`revalidate = 60`). Las facetas comparten esa caché.

## Enfoques considerados

| | Enfoque | A favor | En contra |
|---|---|---|---|
| **A (elegido)** | Las facetas las calcula una función de Postgres (RPC) | Cantidades exactas según los filtros activos; escala a miles de productos; una sola consulta | Requiere una migración |
| B | La app trae el catálogo visible entero y arma las facetas en TypeScript | Sin migración, más rápido de hacer | Trae todos los productos en cada visita; filtrar por color igual necesita cambios en la consulta |

Se eligió **A** porque el catálogo va a crecer y que las cantidades cambien según lo que ya elegiste
es justamente lo que más ayuda al cliente.

## Diseño

### Base de datos (una migración nueva)

0. **Función `public.web_key(text) returns text`** (`immutable`): la única forma de pasar un texto
   libre a clave de URL. Hace `lower`, `btrim`, saca los acentos con `translate`
   (áéíóúüñ → aeiouun; no hace falta la extensión `unaccent`) y cambia todo lo que no sea `[a-z0-9]`
   por `-` (sin guiones repetidos ni en los bordes). "Tamaño" → `tamano`, "El Mate" → `el-mate`.
   En TS el espejo es el `slugify()` que ya existe en `src/shared/slug.ts`, con tests que comparan los dos con los mismos casos.
   Los textos que dan la misma clave se juntan en una sola opción. Como nombre se muestra
   la forma que más se repite y, si empatan, la primera en orden alfabético.
1. **`public_products` gana tres columnas**:
   - `brand_key text`: `web_key(brand)`. El filtro de marca compara contra esta columna, nunca contra `brand`.
   - `option_tags text[]`: las combinaciones `opción:valor` de **todas** sus variantes activas, con las dos
     partes pasadas por `web_key` (`"color:rojo"`).
   - `option_tags_in_stock text[]`: lo mismo, pero solo de las variantes con stock.
     Cuando está activo "En stock", el filtro por opción usa esta columna. Así `color=rojo&stock=1`
     solo muestra productos que tienen el rojo disponible.
   Se filtra con `overlaps` desde supabase-js, sin RPC. La vista se recrea con todas sus columnas
   actuales más estas tres.
2. **Función `public.shop_facets(p_filters jsonb) returns jsonb`**, `stable`, `security invoker`,
   `grant execute` a `anon` y `authenticated`. Recibe los mismos filtros que la tienda y devuelve:
   ```json
   {
     "categories": [{ "slug": "yerbas", "name": "Yerbas", "count": 8 }],
     "brands":     [{ "value": "Waterdog", "key": "waterdog", "count": 3 }],
     "options":    [{ "name": "Color", "key": "color", "values": [{ "value": "Rojo", "key": "rojo", "count": 2 }] }],
     "price":      { "min": 3500, "max": 42000 },
     "offers": 4,
     "in_stock": 15
   }
   ```
   Cada faceta se cuenta aplicando todos los filtros **menos el suyo**. Las opciones con `count = 0`
   no se devuelven. "Sin marca" no es una opción de filtro.
   El rango de precio se calcula sin aplicar el filtro de precio, para que los campos mín/máx no se achiquen.
   **El precio que se filtra es el que muestra la tarjeta**: `public_products.price`, o sea la variante
   más barata con la promo ya aplicada. Un producto "Desde $3.000" no entra en `precio=5000-20000`
   aunque tenga variantes más caras. Coincide con lo que el cliente ve en la grilla.

### URL (compatible con lo actual)

| Parámetro | Ejemplo | Notas |
|---|---|---|
| `categoria` | `yerbas` | Una sola, como hoy |
| `marca` | `waterdog,el-mate` | Varias, separadas por coma, en slug |
| `precio` | `5000-20000` | Mínimo y máximo, cualquiera de los dos puede faltar (`-20000`) |
| `<opción>` | `color=rojo,negro` | Una por opción de variante, con la clave en slug. Si una opción choca con un parámetro reservado se ignora |
| `ofertas`, `stock` | `1` | Interruptores |
| `q`, `orden`, `promo`, `page` | | Igual que hoy |

Dentro de una misma sección, las opciones se combinan con **O** (Rojo o Negro). Entre secciones, con **Y**.
Cambiar cualquier filtro vuelve a la página 1.

### Backend (`src/back/landing`)

- `ShopFilters` suma `brands`, `price`, `options`, `inStock`. `parseShopFilters` valida todo
  (slugs con la misma regex de hoy, precio numérico y positivo, como mucho 20 valores por parámetro).
- `ProductQuery` y `supabase-source.products()` suman esos filtros (`in` para marca, `gte`/`lte`
  para precio, `overlaps` sobre `option_tags` por opción, `eq in_stock`).
- `CatalogSource.facets(filters)` nuevo: en Supabase llama al RPC; en demo calcula en memoria.
- `catalog.ts` expone `getShopFacets(filters)` envuelto en `safe(...)`: si falla devuelve facetas vacías
  y la tienda se ve sin barra lateral, pero con productos.

### Frontend (`src/front/landing/shop`)

- `shop-screen.tsx`: layout de dos columnas (barra de ~16rem + grilla) desde `lg`; una columna abajo de eso.
- `shop-sidebar.tsx` (nuevo): secciones plegables con `<details>`/`<summary>` (accesibles sin JS).
  Categoría como links (una sola elegida), el resto checkboxes, el precio con dos campos mín/máx
  (más preciso que un slider con pocos productos). Las secciones con algo elegido arrancan abiertas.
- `shop-toolbar.tsx` (nuevo): título + total, "Ocultar filtros" (recuerda la elección en `localStorage`)
  y "Ordenar por". En el celular: botón "Filtros (N)" que abre el panel.
- `active-filters.tsx` (nuevo): chips de lo elegido, con ✕ y "Limpiar todo". Arregla el bug de hoy:
  "Limpiar" borraba la promo y la categoría pero no aparecía con solo una promo activa.
- La búsqueda por texto queda arriba de la grilla, con el mismo comportamiento de espera entre teclas.
- `category-nav.tsx` (los chips con scroll) se retira: Categoría pasa a la barra lateral.
- Los cambios actualizan la URL con `router.replace` dentro de una transición, como hoy, sin botón "Aplicar".

### Tests

- Unit: `parseShopFilters` (parámetros nuevos, valores inválidos, links viejos) y el armado de la URL.
- Unit: facetas de `demo-source` (disyuntivas, sin ceros).
- SQL: `web_key()` da lo mismo que `slugify()` para los mismos casos.
- `demo-source` suma marcas y variantes de color a algunos productos, para que el E2E de marca y color
  tenga datos sin depender de la base de desarrollo.
- SQL: probar `shop_facets` contra la base de desarrollo con filtros combinados.
- E2E (`e2e/public/shop.spec.ts`): filtrar por marca y ver que bajen el total y la grilla; chips activos;
  panel de filtros en el viewport de celular; links viejos (`?categoria=yerbas`, `?ofertas=1`) siguen andando;
  accesibilidad con axe.

## Decisiones que tomé yo (revisalas)

- Categoría queda de una sola elección y se van los chips de arriba, para no tener el mismo filtro dos veces.
- Precio con dos campos mín/máx en vez de slider.
- Multi-selección dentro de cada sección (O), entre secciones Y.
- Parámetros de URL legibles (`marca=`, `color=`) en vez de un formato genérico.
- "Ocultar filtros" se recuerda por visitante en el navegador.
- El filtro de precio usa el precio de la tarjeta (el más barato), no "alguna variante en el rango".
- Marcas y valores que solo cambian en mayúsculas o acentos se juntan en una opción.
- Con "En stock" activo, el color tiene que estar disponible en esa misma variante.
- El modo demo suma marcas y colores de ejemplo para poder testear.

## Lo que queda a criterio de quien lo construya

- Estilos exactos, espaciados e íconos, dentro de los tokens que ya existen.
- Orden de las opciones dentro de cada sección (sugerido: por cantidad y después alfabético; categorías por `sort_order`).
- La estructura interna del SQL de `shop_facets`.
