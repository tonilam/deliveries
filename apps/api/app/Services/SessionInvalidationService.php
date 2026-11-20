<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

class SessionInvalidationService
{
    /**
     * Drop all database sessions for the user so existing SPA logins stop working.
     */
    public function invalidateFor(User $user): void
    {
        DB::table('sessions')->where('user_id', $user->id)->delete();
    }
}
