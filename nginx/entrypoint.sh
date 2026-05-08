#!/bin/sh
set -e

# Sadece API_RATE_LIMIT değişkenini template'e uygula.
# Nginx değişkenleri ($host, $remote_addr vb.) dokunulmadan kalır.
envsubst '$API_RATE_LIMIT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
