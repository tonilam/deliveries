import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { AuthResponse, PendingInvitation, SsoProvider, User, UserRole } from './user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly user = signal<User | null>(null);

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
      tap((res) => this.user.set(res.user)),
      map((res) => res.user),
    );
  }

  login(payload: { email: string; password: string }): Observable<User> {
    return this.ensureCsrf().pipe(
      switchMap(() => this.http.post<AuthResponse>('/api/login', payload)),
      tap((res) => this.user.set(res.user)),
      map((res) => res.user),
    );
  }

  logout(): Observable<void> {
    return this.http.post<{ message: string }>('/api/logout', {}).pipe(
      tap(() => this.user.set(null)),
      map(() => undefined),
    );
  }

  me(): Observable<User | null> {
    return this.http.get<AuthResponse>('/api/user').pipe(
      tap((res) => this.user.set(res.user)),
      map((res) => res.user),
      catchError(() => {
        this.user.set(null);
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
      tap((res) => this.user.set(res.user)),
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
      tap((res) => this.user.set(res.user)),
      map((res) => res.user),
    );
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  homePathFor(user: User): string {
    if (user.must_change_password) {
      return '/change-password';
    }
    return user.role === 'admin' ? '/admin' : '/app';
  }

  isAdminRole(role: UserRole): boolean {
    return role === 'admin';
  }
}
