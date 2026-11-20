<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PasswordResetMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly User $user,
        public readonly string $token,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reset your Loadplanner password',
        );
    }

    public function content(): Content
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        $query = http_build_query([
            'email' => $this->user->email,
            'token' => $this->token,
        ]);

        return new Content(
            text: 'mail.password-reset',
            with: [
                'name' => $this->user->name,
                'resetUrl' => $frontend.'/reset-password?'.$query,
            ],
        );
    }
}
