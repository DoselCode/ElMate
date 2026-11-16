#!/usr/bin/env bash
# Aplica las migraciones de supabase/migrations/ al Supabase self-hosted de Coolify (VPS).
# Uso (desde la raíz del repo, en Git Bash):
#   VPS=root@187.41.122.109 bash scripts/aplicar-migraciones-vps.sh
#
# Las migraciones se aplican en orden y en UNA transacción: si una falla, no queda nada a medias.
# Solo para una base nueva/vacía. Una migración ya aplicada no se vuelve a correr.
set -euo pipefail

VPS="${VPS:?Falta VPS, ej: VPS=root@187.41.122.109}"
DIR="supabase/migrations"
BUNDLE="$(mktemp)"
trap 'rm -f "$BUNDLE"' EXIT

{
  echo "\\set ON_ERROR_STOP on"
  echo "begin;"
  for f in $(ls "$DIR"/*.sql | sort); do
    echo "-- ===== $f ====="
    cat "$f"
    echo
  done
  echo "commit;"
} > "$BUNDLE"

echo "Migraciones a aplicar:"
ls "$DIR"/*.sql | sort | sed 's/^/  /'

scp "$BUNDLE" "$VPS:/tmp/elmate-migraciones.sql"

# Busca el contenedor de Postgres del servicio Supabase (nombre: supabase-db-<id>)
ssh "$VPS" bash -s <<'EOF'
set -euo pipefail
DB=$(docker ps --format '{{.Names}}' | grep '^supabase-db' | head -1)
[ -n "$DB" ] || { echo "No encuentro el contenedor supabase-db"; exit 1; }
echo "Contenedor: $DB"
docker cp /tmp/elmate-migraciones.sql "$DB:/tmp/elmate-migraciones.sql"
docker exec "$DB" psql -U postgres -d postgres -f /tmp/elmate-migraciones.sql
rm -f /tmp/elmate-migraciones.sql
docker exec "$DB" rm -f /tmp/elmate-migraciones.sql
echo "OK: migraciones aplicadas."
EOF
