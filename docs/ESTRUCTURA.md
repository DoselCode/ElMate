# Estructura del proyecto

El código está separado en **front** (lo que se ve) y **back** (datos, permisos y lógica de servidor), y cada uno a su vez en **admin** (panel) y **landing** (web pública).

```
ElMate/
├── supabase/                  BASE DE DATOS (Supabase exige esta carpeta en la raíz)
│   ├── migrations/            tablas, permisos (RLS), funciones SQL y vistas
│   └── seed.sql               datos de ejemplo para desarrollo
│
├── src/
│   ├── app/                   RUTAS — solo enrutamiento, sin lógica ni diseño
│   │   ├── layout.tsx         layout raíz (fuentes, estilos globales)
│   │   ├── (landing)/         web pública  →  /
│   │   └── admin/             panel        →  /admin/...
│   │       ├── login/
│   │       └── (panel)/       todo lo que requiere sesión (stock, movimientos…)
│   │
│   ├── front/                 FRONT — componentes React
│   │   ├── admin/
│   │   │   ├── auth/          pantalla y formulario de login
│   │   │   ├── layout/        marco del panel (menú lateral)
│   │   │   └── stock/         inventario, movimientos, formulario de producto, diálogos
│   │   ├── landing/           portada (provisoria) y, a futuro, catálogo
│   │   └── shared/
│   │       ├── ui/            botón, campo, modal, badge, paginación, estados vacíos
│   │       └── styles/        globals.css (colores y tokens de marca)
│   │
│   ├── back/                  BACK — solo corre en el servidor (salvo images.ts)
│   │   ├── admin/
│   │   │   ├── auth/          session.ts (quién está logueado, requireStaff/requireAdmin)
│   │   │   │                  actions.ts (login / logout)
│   │   │   └── stock/         queries.ts (lecturas), actions.ts (escrituras),
│   │   │                      images.ts (subida de fotos a Storage)
│   │   ├── landing/           lecturas públicas del catálogo (próxima fase)
│   │   └── shared/            clientes de Supabase, sesión del proxy, errores de base
│   │
│   ├── shared/                COMPARTIDO — lo usan front y back
│   │   ├── schemas/           validaciones Zod (formulario y servidor usan las mismas)
│   │   ├── types.ts           tipos de datos (filas, filtros, resultados)
│   │   ├── format.ts          formato de plata, fechas y cantidades
│   │   ├── query.ts           parámetros de URL y paginación
│   │   └── slug.ts            "Mate Imperial" → "mate-imperial"
│   │
│   └── proxy.ts               Next.js lo exige acá; delega en back/shared/supabase/proxy.ts
│
├── tests/db/                  tests de la base (migraciones reales sobre Postgres en memoria)
└── docs/                      documentación
```

## Reglas

| Carpeta | Puede importar de | No puede |
|---|---|---|
| `app/` | `back/`, `front/`, `shared/` | tener lógica de datos o JSX de pantallas |
| `front/` | `front/`, `shared/`, y las **acciones** de `back/` (`actions.ts`, `images.ts`) | consultar Supabase directamente |
| `back/` | `back/`, `shared/` | importar componentes de `front/` |
| `shared/` | solo `shared/` | depender de React, Next o Supabase |

- **Permisos:** cada función de `back/` valida quién llama (`requireStaff` / `requireAdmin` / `getAdminOrNull`), además de las políticas RLS de la base. Una página nueva no puede saltearse el control por olvido.
- **Escrituras:** `back/*/actions.ts` valida con Zod y llama a una función SQL transaccional. Nunca devuelve excepciones al navegador: responde `{ ok, error, fieldErrors }`.
- **Web pública:** `back/landing/` solo lee las vistas `public_*` (sin costos ni stock exacto).

## Cómo se arma una pantalla

Ejemplo: `/admin/stock`.

```
app/admin/(panel)/stock/page.tsx          1. recibe la URL
    │
    ├─► back/admin/stock/queries.ts       2. parseStockFilters(), getStockList(), getStockSummary()
    │       └─ Supabase (vista stock_overview, con RLS)
    │
    └─► front/admin/stock/stock-screen.tsx   3. dibuja resumen, filtros y tabla con esos datos
            └─ stock-table.tsx → stock-dialogs.tsx
                    └─► back/admin/stock/actions.ts   4. al guardar un ajuste (Server Action)
```

## Dónde va cada cosa nueva

**Una pantalla nueva del panel** (por ejemplo, Ventas):
1. `back/admin/ventas/queries.ts` y `actions.ts`.
2. `front/admin/ventas/ventas-screen.tsx` (y sus componentes).
3. `app/admin/(panel)/ventas/page.tsx`, que solo une las dos cosas.
4. Sumar el link en `front/admin/layout/sidebar.tsx`.

**Una sección de la landing** (por ejemplo, el catálogo):
1. `back/landing/catalog.ts`, que lee las vistas `public_*`.
2. `front/landing/catalog/...`.
3. `app/(landing)/catalogo/page.tsx`.

**Un componente que usan admin y landing:** va en `front/shared/ui/`.
**Un cambio en la base:** una migración nueva en `supabase/migrations/` y su test en `tests/db/`.
