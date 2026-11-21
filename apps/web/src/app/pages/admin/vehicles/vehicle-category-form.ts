import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ToastrService } from '../../../core/feedback/toastr.service';

@Component({
  selector: 'app-admin-vehicle-category-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './vehicle-category-form.html',
  styleUrls: ['../../../shared/portal-shell.scss', './vehicle-category-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminVehicleCategoryForm {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toastr = inject(ToastrService);

  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(255)]],
    code: ['', [Validators.required, Validators.maxLength(64), Validators.pattern(/^[a-z0-9_]+$/)]],
    sort_order: [0, [Validators.required, Validators.min(0), Validators.max(9999)]],
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    this.auth
      .ensureCsrf()
      .pipe(
        switchMap(() => this.http.post('/api/admin/vehicle-categories', this.form.getRawValue())),
      )
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.toastr.success('Vehicle category created.');
          void this.router.navigateByUrl('/admin/vehicles');
        },
        error: (err: { error?: { message?: string; errors?: Record<string, string[]> } }) => {
          const messages = err.error?.errors;
          const message =
            messages?.['code']?.[0] ??
            messages?.['name']?.[0] ??
            err.error?.message ??
            'Unable to save category.';
          this.error.set(message);
          this.toastr.error(message);
          this.submitting.set(false);
        },
      });
  }
}
