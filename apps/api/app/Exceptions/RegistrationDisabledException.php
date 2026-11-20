<?php

namespace App\Exceptions;

use RuntimeException;

class RegistrationDisabledException extends RuntimeException
{
    public function __construct()
    {
        parent::__construct('User registration is currently disabled.');
    }
}
