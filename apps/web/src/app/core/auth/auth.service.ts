import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, switchMap, tap } from 'rxjs';

import { AuthResponse, SsoProvider, User, UserRole } from './user.model';

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

  startSso(provider: SsoProvider): void {
    window.location.href = `/api/auth/${provider}/redirect`;
  }

  isAuthenticated(): boolean {
    return this.user() !== null;
  }

  homePathFor(user: User): string {
    return user.role === 'admin' ? '/admin' : '/app';
  }

  isAdminRole(role: UserRole): boolean {
    return role === 'admin';
  }
}
