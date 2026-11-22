import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AddressesApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/addresses', { params });
  }

  get<T>(id: number): Observable<T> {
    return this.http.get<T>(`/api/addresses/${id}`);
  }

  getStateOptions<T>(): Observable<T> {
    return this.http.get<T>('/api/addresses/state-options');
  }

  getZoneOptions<T>(): Observable<T> {
    return this.http.get<T>('/api/addresses/zone-options');
  }

  create<T>(payload: unknown): Observable<T> {
    return this.http.post<T>('/api/addresses', payload);
  }

  update<T>(id: number, payload: unknown): Observable<T> {
    return this.http.put<T>(`/api/addresses/${id}`, payload);
  }

  delete(id: number): Observable<unknown> {
    return this.http.delete(`/api/addresses/${id}`);
  }
}
