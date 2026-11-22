import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { User } from '../auth/user.model';
import { Company } from '../company/company.model';

@Injectable({ providedIn: 'root' })
export class AdminUsersApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/admin/users', { params });
  }

  get<T>(id: number): Observable<T> {
    return this.http.get<T>(`/api/admin/users/${id}`);
  }

  create(payload: unknown): Observable<{ user: User }> {
    return this.http.post<{ user: User }>('/api/admin/users', payload);
  }

  sendInvitation(payload: unknown): Observable<{ message: string }> {
    return this.http.post<{ message: string }>('/api/admin/invitations', payload);
  }

  searchCompanies(params: HttpParams): Observable<{ companies: Company[] }> {
    return this.http.get<{ companies: Company[] }>('/api/admin/companies', { params });
  }

  updatePassword(userId: number, payload: unknown): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`/api/admin/users/${userId}/password`, payload);
  }

  sendPasswordReset(userId: number): Observable<{ email: string }> {
    return this.http.post<{ email: string }>(`/api/admin/users/${userId}/password-reset`, {});
  }
}
