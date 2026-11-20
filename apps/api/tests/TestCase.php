<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Auth;

abstract class TestCase extends BaseTestCase
{
    /**
     * Mark the request as coming from the Angular SPA so Sanctum
     * starts the session middleware stack.
     */
    protected function asSpa(): static
    {
        return $this->withHeaders([
            'Origin' => 'http://localhost:4200',
            'Referer' => 'http://localhost:4200/',
        ]);
    }

    /**
     * Reset auth guards so each HTTP call reloads the user from the session
     * instead of reusing in-memory SessionGuard state from a prior request.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        Auth::forgetGuards();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }
}
