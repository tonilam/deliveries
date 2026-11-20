import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import {
  AuthResponse,
  Impersonator,
  PendingInvitation,
  SsoProvider,
  User,
  UserRole,
} from './user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<User | null>(null);
  readonly impersonating = signal(false);
  readonly impersonator = signal<Impersonator | null>(null);

  ensureCsrf(): Observable<void> {
    return this.http.get('/sanctum/csrf-cookie').pipe(map(() => undefined));
  }

  register(payload: {
    name: string;
    email: string;
    password: string;
    password_confirmation: string;
  }): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>('/api/register', payload)),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  login(payload: { email: string; password: string }): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>('/api/login', payload)),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  logout(): Observable<void> {
    return this.http.post<{ message: string }>('/api/logout', {}).pipe(
      tap(() => this.clearAuth()),
      map(() => undefined),
    );
  }

  me(): Observable<User | null> {
    return this.http.get<AuthResponse>('/api/user').pipe(
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
      catchError(() => {
        this.clearAuth();
        return of(null);
      }),
    );
  }

  updatePassword(payload: {
    current_password: string;
    password: string;
    password_confirmation: string;
  }): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() =>
        this.http.put<AuthResponse & { message: string }>('/api/user/password', payload),
      ),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  impersonate(userId: number): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>(`/api/admin/users/${userId}/impersonate`, {})),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  leaveImpersonation(): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>('/api/impersonation/leave', {})),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  startSso(provider: SsoProvider, options?: { invite?: string }): void {
    const params = options?.invite ? `?invite=${encodeURIComponent(options.invite)}` : '';
    window.location.href = `/api/auth/${provider}/redirect${params}`;
  }

  getInvitation(token: string): Observable<PendingInvitation> {
    return this.http
      .get<{ invitation: PendingInvitation }>(`/api/invitations/${token}`)
      .pipe(map((res) => res.invitation));
  }

  acceptInvitation(
    token: string,
    payload: { password: string; password_confirmation: string },
  ): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>(`/api/invitations/${token}/register`, payload)),
      tap((res) => this.applyAuth(res)),
      map((res) => res.user),
    );
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  homePathFor(user: User): string {
    if (user.must_change_password && !this.impersonating()) {
      return '/change-password';
    }
    return user.role === 'admin' ? '/admin' : '/app';
  }

  isAdminRole(role: UserRole): boolean {
    return role === 'admin';
  }

  private applyAuth(res: AuthResponse): void {
    this.user.set(res.user);
    this.impersonating.set(Boolean(res.impersonating));
    this.impersonator.set(res.impersonator ?? null);
  }

  private clearAuth(): void {
    this.user.set(null);
    this.impersonating.set(false);
    this.impersonator.set(null);
  }
}
