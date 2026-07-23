<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Trusted Proxies
    |--------------------------------------------------------------------------
    |
    | The reverse proxy (Caddy) that sits in front of the app. In production
    | this is set at deploy time to the actual Docker network subnet Caddy runs
    | on (e.g. "172.18.0.0/16"), so Laravel trusts X-Forwarded-* only from that
    | internal network — never "*". No external host can obtain an address on
    | the internal Docker subnet, so spoofed forwarding headers from real
    | clients are rejected. Unset (null) => trust no proxies (safe default for
    | local/test where there is no reverse proxy).
    |
    | App\Http\Middleware\TrustProxies falls back to this value when its own
    | $proxies property is null.
    |
    */

    'proxies' => env('TRUSTED_PROXIES'),

];
