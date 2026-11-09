#!/usr/bin/env bash
# Teste da Edge Function criar-corretor sem criar contas: só checa as recusas e o CORS.
# Esperado: "sem token 401", "anon 403", "OPTIONS 200 com origem permitida".
set -u
URL="https://trktcetqkjwwgcgmjsxg.supabase.co/functions/v1/criar-corretor"
K=$(sed -n "s/.*SUPABASE_ANON_KEY = '\(.*\)';/\1/p" "$(dirname "$0")/../../app/config.js")
echo "sem token $(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H 'Content-Type: application/json' -d '{}')"
echo "anon $(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL" -H "apikey: $K" -H "Authorization: Bearer $K" -H 'Content-Type: application/json' -d '{"email":"x@exemplo.com","senha":"12345678"}')"
echo "OPTIONS $(curl -s -o /dev/null -w '%{http_code}' -X OPTIONS "$URL" -H 'Origin: https://thiagolivs1.github.io' -H 'Access-Control-Request-Method: POST') com origem $(curl -s -D - -o /dev/null -X OPTIONS "$URL" -H 'Origin: https://thiagolivs1.github.io' | tr -d '\r' | sed -n 's/^access-control-allow-origin: //Ip')"
