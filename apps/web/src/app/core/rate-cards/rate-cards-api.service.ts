import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RateCardsApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/rate-cards', { params });
  }

  get<T>(id: number): Observable<T> {
    return this.http.get<T>(`/api/rate-cards/${id}`);
  }

  create(payload: unknown): Observable<unknown> {
    return this.http.post('/api/rate-cards', payload);
  }

  update(id: number, payload: unknown): Observable<unknown> {
    return this.http.put(`/api/rate-cards/${id}`, payload);
  }

  getCompanyOptions<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/rate-cards/company-options', { params });
  }
}
