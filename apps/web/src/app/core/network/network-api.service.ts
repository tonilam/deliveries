import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Company } from '../company/company.model';
import { Country } from '../country/country.model';

@Injectable({ providedIn: 'root' })
export class NetworkApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/network/companies', { params });
  }

  getCountries(): Observable<{ countries: Country[] }> {
    return this.http.get<{ countries: Country[] }>('/api/countries');
  }

  get(id: number): Observable<{ company: Company }> {
    return this.http.get<{ company: Company }>(`/api/network/companies/${id}`);
  }

  create(payload: unknown): Observable<{ company: Company }> {
    return this.http.post<{ company: Company }>('/api/network/companies', payload);
  }

  update(id: number, payload: unknown): Observable<{ company: Company }> {
    return this.http.put<{ company: Company }>(`/api/network/companies/${id}`, payload);
  }

  delete(id: number): Observable<unknown> {
    return this.http.delete(`/api/network/companies/${id}`);
  }

  checkUniqueness<T>(body: unknown): Observable<T> {
    return this.http.post<T>('/api/network/companies/check-uniqueness', body);
  }
}
