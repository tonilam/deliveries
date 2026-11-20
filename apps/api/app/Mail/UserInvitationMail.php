<?php

namespace App\Mail;

use App\Models\UserInvitation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class UserInvitationMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly UserInvitation $invitation,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'You are invited to Loadplanner',
        );
    }

    public function content(): Content
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        return new Content(
            text: 'mail.user-invitation',
            with: [
                'name' => $this->invitation->name,
                'role' => $this->invitation->role->value,
                'inviteUrl' => $frontend.'/invite/'.$this->invitation->token,
            ],
        );
    }
}
