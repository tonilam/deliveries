import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../../core/auth/auth.service';
import { ToastrService } from '../../../../core/feedback/toastr.service';
import { GoodType, GoodTypePayload } from '../../../../core/good-type/good-type.model';

@Component({
  selector: 'app-admin-good-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './good-form.html',
  styleUrls: ['../../../../shared/portal-shell.scss', './good-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminGoodForm {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    code: [
      '',
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(8),
        Validators.pattern(/^[A-Za-z0-9]+$/),
      ],
    ],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    refrigerated_required: [false],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const payload: GoodTypePayload = {
      code: this.form.controls.code.value.trim().toUpperCase(),
      name: this.form.controls.name.value.trim(),
      refrigerated_required: this.form.controls.refrigerated_required.value,
    };

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() => this.http.post<{ good_type: GoodType }>('/api/admin/good-types', payload)),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toastr.success('Goods type created.');
          void this.router.navigateByUrl('/admin/settings/goods');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          this.submitting.set(false);
          const message = this.firstError(err) ?? 'Could not save goods type';
          this.error.set(message);
          this.toastr.error(message);
        },
      });
  }

  private firstError(err: {
    error?: { message?: string; errors?: Record<string, string[]> };
  }): string | undefined {
    const errors = err.error?.errors;
    return (
      errors?.['code']?.[0] ??
      errors?.['name']?.[0] ??
      errors?.['refrigerated_required']?.[0] ??
      err.error?.message
    );
  }
}
