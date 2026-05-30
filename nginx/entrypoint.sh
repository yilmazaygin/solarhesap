#!/bin/sh
set -e

# Only substitute API_RATE_LIMIT in the template.
# Nginx variables ($host, $remote_addr, etc.) are left untouched.
envsubst '$API_RATE_LIMIT' < /etc/nginx/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec "$@"
