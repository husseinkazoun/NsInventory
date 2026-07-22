#!/bin/sh
set -eu

attempt=0
until php artisan migrate --force; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 30 ]; then
        echo "Database did not become ready in time."
        exit 1
    fi
    sleep 2
done

php artisan db:seed --class=ClothingSetupSeeder --force
php artisan storage:link >/dev/null 2>&1 || true
php artisan optimize:clear
chown -R www-data:www-data storage bootstrap/cache

exec "$@"
