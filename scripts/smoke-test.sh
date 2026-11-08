#!/usr/bin/env bash
# Contract smoke test for all 8 endpoints. Usage: scripts/smoke-test.sh [baseUrl]
# Requires only bash + curl. Exits non-zero on the first mismatch.
set -euo pipefail
B="${1:-http://localhost:8080}"
S1="2015269$(printf '%010d' $((RANDOM * RANDOM % 10000000000)))"
S2="2015270$(printf '%010d' $((RANDOM * RANDOM % 10000000000)))"
pass=0

check() { # check <name> <expected-status> <actual-status> <body> [grep-pattern...]
  local name=$1 exp=$2 got=$3 body=$4; shift 4
  if [[ "$got" != "$exp" ]]; then echo "FAIL  $name: expected HTTP $exp, got $got  body=$body"; exit 1; fi
  for p in "$@"; do
    if ! grep -q -- "$p" <<<"$body"; then echo "FAIL  $name: body missing $p  body=$body"; exit 1; fi
  done
  pass=$((pass + 1)); echo "ok    $name ($got) $body"
}
req() { # req <method> <path> [studentId] [json]
  local m=$1 p=$2 sid=${3:-} data=${4:-}
  local args=(-s -o /tmp/smoke_body -w '%{http_code}' -X "$m" "$B$p" -H 'Content-Type: application/json')
  [[ -n "$sid" ]] && args+=(-H "X-Student-Id: $sid")
  [[ -n "$data" ]] && args+=(-d "$data")
  CODE=$(curl "${args[@]}"); BODY=$(cat /tmp/smoke_body)
}
field() { sed -E "s/.*\"$1\":\"([^\"]*)\".*/\1/" <<<"$BODY"; }

req POST /classes "" '{"name":"Smoke - Morning Shift","totalSeats":1}'
check "1 POST /classes" 201 "$CODE" "$BODY" '"id":"c_' '"name":"Smoke - Morning Shift"' '"totalSeats":1'
C=$(field id)

req GET /classes
check "2 GET /classes" 200 "$CODE" "$BODY" "\"id\":\"$C\"" '"heldSeats"' '"confirmedSeats"' '"availableSeats"'

req GET "/classes/$C"
check "3 GET /classes/{id}" 200 "$CODE" "$BODY" '"heldSeats":0' '"confirmedSeats":0' '"availableSeats":1'

req POST "/classes/$C/holds" "$S1"
check "4 POST /classes/{id}/holds" 201 "$CODE" "$BODY" '"holdId":"h_' "\"classId\":\"$C\"" "\"studentId\":\"$S1\"" '"status":"HELD"' '"expiresAt":"20[0-9-]*T[0-9:.]*Z"'
H=$(field holdId)

req POST "/classes/$C/holds" "$S2";  check "4b seats full -> 409" 409 "$CODE" "$BODY" '"code":"SEATS_FULL"'
req POST "/classes/$C/holds" "$S1";  check "4c already applied -> 409" 409 "$CODE" "$BODY" '"code":"ALREADY_APPLIED"'
req POST "/classes/$C/holds" "123";  check "4d bad student id -> 400" 400 "$CODE" "$BODY" '"code":"VALIDATION_ERROR"'
req POST "/classes/c_999999999/holds" "$S1"; check "4e unknown class -> 404" 404 "$CODE" "$BODY" '"code":"NOT_FOUND"'

req GET "/holds/$H"
check "5 GET /holds/{id} (no header)" 200 "$CODE" "$BODY" "\"holdId\":\"$H\"" "\"classId\":\"$C\"" '"status":"HELD"' '"expiresAt"'

req POST "/holds/$H/confirm" "$S2"; check "6a confirm by other student -> 403" 403 "$CODE" "$BODY" '"code":"NOT_OWNER"'
req POST "/holds/$H/confirm" "$S1"; check "6 POST /holds/{id}/confirm" 200 "$CODE" "$BODY" "\"holdId\":\"$H\"" '"status":"CONFIRMED"'
req POST "/holds/$H/confirm" "$S1"; check "6b confirm again (idempotent)" 200 "$CODE" "$BODY" '"status":"CONFIRMED"'
req GET "/classes/$C";              check "6c confirmedSeats counted once" 200 "$CODE" "$BODY" '"heldSeats":0' '"confirmedSeats":1' '"availableSeats":0'
req DELETE "/holds/$H" "$S1";       check "7a cancel confirmed -> 409" 409 "$CODE" "$BODY" '"code":"ALREADY_CONFIRMED"'

req POST /classes "" '{"name":"Smoke - Day Shift","totalSeats":5}'; C2=$(field id)
req POST "/classes/$C2/holds" "$S1"; H2=$(field holdId)
req DELETE "/holds/$H2" "$S2"; check "7b cancel by other student -> 403" 403 "$CODE" "$BODY" '"code":"NOT_OWNER"'
req DELETE "/holds/$H2" "$S1"; check "7 DELETE /holds/{id}" 204 "$CODE" "$BODY"
req DELETE "/holds/$H2" "$S1"; check "7c cancel again (idempotent)" 204 "$CODE" "$BODY"
req POST "/holds/$H2/confirm" "$S1"; check "7d confirm cancelled -> 409" 409 "$CODE" "$BODY" '"code":"HOLD_CANCELLED"'

req GET /me/holds "$S1"
check "8 GET /me/holds" 200 "$CODE" "$BODY" "\"holdId\":\"$H\"" "\"holdId\":\"$H2\"" '"className":"Smoke - Morning Shift"' '"status":"CONFIRMED"' '"status":"CANCELLED"'
req GET /me/holds; check "8b /me/holds without header -> 400" 400 "$CODE" "$BODY" '"code":"VALIDATION_ERROR"'

req POST /classes "" '{"name":"","totalSeats":5}'; check "1b empty name -> 400" 400 "$CODE" "$BODY" '"code":"VALIDATION_ERROR"'
req POST /classes "" '{"name":"x","totalSeats":0}'; check "1c zero seats -> 400" 400 "$CODE" "$BODY" '"code":"VALIDATION_ERROR"'
req GET /holds/garbage; check "5b malformed hold id -> 404" 404 "$CODE" "$BODY" '"code":"NOT_FOUND"'

echo "ALL $pass CHECKS PASSED against $B"
