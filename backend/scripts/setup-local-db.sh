#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

SCHEMA_SQLITE="prisma/schema.sqlite.prisma"
SCHEMA_MAIN="prisma/schema.prisma"

if [ ! -f "$SCHEMA_SQLITE" ]; then
  echo "[sqlite] generating $SCHEMA_SQLITE from $SCHEMA_MAIN..."
  sed -e 's/provider = "postgresql"/provider = "sqlite"/' \
      -e 's/@db\.Decimal([^)]*)//g' \
      "$SCHEMA_MAIN" > "$SCHEMA_SQLITE"
fi

echo "[sqlite] pushing schema..."
DATABASE_URL="file:dev.db" npx prisma db push --schema="$SCHEMA_SQLITE" --skip-generate

echo "[sqlite] generating Prisma client..."
npx prisma generate --schema="$SCHEMA_SQLITE"

echo "[sqlite] dev.db ready"
