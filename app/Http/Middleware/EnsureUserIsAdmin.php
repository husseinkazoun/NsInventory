<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Restricts a route to administrators.
 *
 * Always apply this *after* the "auth" middleware so an unauthenticated visitor
 * is redirected to the login page rather than being told a page exists via a
 * 403. Authenticated non-administrators get a 403.
 */
class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            abort(403);
        }

        return $next($request);
    }
}
