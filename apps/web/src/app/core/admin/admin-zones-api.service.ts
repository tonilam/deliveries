import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Zone } from '../zone/zone.model';

@Injectable({ providedIn: 'root' })
export class AdminZonesApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/admin/zones', { params });
  }

  create(payload: unknown): Observable<{ zone: Zone }> {
    return this.http.post<{ zone: Zone }>('/api/admin/zones', payload);
  }

  update(id: number, payload: unknown): Observable<unknown> {
    return this.http.put(`/api/admin/zones/${id}`, payload);
  }

  delete(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/zones/${id}`);
  }
}
