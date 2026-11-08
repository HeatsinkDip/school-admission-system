#!/bin/sh
set -eu

API_URL="${API_BASE_URL:-http://localhost:8080}"
ESCAPED_URL=$(printf '%s' "$API_URL" | sed 's/\\/\\\\/g; s/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<EOF
window.__CONFIG__ = {
  API_BASE_URL: "${ESCAPED_URL}"
};
EOF

exec nginx -g "daemon off;"

