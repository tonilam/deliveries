import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ToastrService } from '../../core/feedback/toastr.service';
import { PendingInvitation, SsoProvider } from '../../core/auth/user.model';

@Component({
  selector: 'app-invite',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './invite.html',
  styleUrl: './invite.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Invite implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly toastr = inject(ToastrService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly invitation = signal<PendingInvitation | null>(null);
  protected readonly token = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', [Validators.required]],
  });

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    const inviteError = params.get('error');
    if (inviteError) {
      this.error.set(inviteError);
    }

    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(token);

    if (!token) {
      this.loading.set(false);
      this.error.set('This invitation link is invalid.');
      return;
    }

    this.auth.getInvitation(token).subscribe({
      next: (invitation) => {
        this.invitation.set(invitation);
        this.loading.set(false);
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.loading.set(false);
        const first = err.error?.errors?.['token']?.[0] ?? err.error?.message;
        this.error.set(first ?? 'This invitation is invalid or has expired.');
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid || !this.token()) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth.acceptInvitation(this.token(), this.form.getRawValue()).subscribe({
      next: (user) => {
        this.submitting.set(false);
        this.toastr.success('Account created.');
        void this.router.navigateByUrl(this.auth.homePathFor(user));
      },
      error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
        this.submitting.set(false);
        const errors = err.error?.errors;
        const message =
          errors?.['password']?.[0] ??
          errors?.['token']?.[0] ??
          errors?.['email']?.[0] ??
          err.error?.message ??
          'Could not complete invitation';
        this.error.set(message);
        this.toastr.error(message);
      },
    });
  }

  protected sso(provider: SsoProvider): void {
    this.auth.startSso(provider, { invite: this.token() });
  }

  protected roleLabel(role: string): string {
    return role === 'admin' ? 'Admin' : 'Customer';
  }
}
