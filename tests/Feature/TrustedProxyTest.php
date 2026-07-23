<?php

namespace Tests\Feature;

use App\Http\Middleware\TrustProxies;
use ReflectionProperty;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    /**
     * The middleware must never trust all proxies ('*'); doing so lets any
     * direct caller spoof X-Forwarded-* headers.
     */
    public function test_trust_proxies_is_not_wildcard(): void
    {
        $property = new ReflectionProperty(TrustProxies::class, 'proxies');
        $property->setAccessible(true);

        $this->assertNotSame('*', $property->getValue(new TrustProxies()));
        $this->assertNotSame('**', $property->getValue(new TrustProxies()));
    }

    /**
     * The trusted-proxy value is sourced from config/env, not hard-coded, so it
     * can be scoped to the real proxy subnet per environment.
     */
    public function test_trusted_proxy_value_comes_from_config(): void
    {
        $this->assertSame(env('TRUSTED_PROXIES'), config('trustedproxy.proxies'));
    }

    /**
     * With no proxy trusted (the default in tests, where there is no reverse
     * proxy), a spoofed X-Forwarded-Host must be ignored — Laravel must not
     * generate URLs for an attacker-controlled host.
     */
    public function test_spoofed_forwarded_host_is_ignored_when_no_proxy_is_trusted(): void
    {
        $response = $this->get('/login', [
            'X-Forwarded-Host' => 'evil.example',
            'X-Forwarded-Proto' => 'http',
        ]);

        $response->assertOk();
        $response->assertDontSee('evil.example');
    }
}
