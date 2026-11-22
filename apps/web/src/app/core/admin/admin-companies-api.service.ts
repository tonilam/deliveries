import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Company } from '../company/company.model';
import { Country } from '../country/country.model';

@Injectable({ providedIn: 'root' })
export class AdminCompaniesApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/admin/companies', { params });
  }

  get(id: number): Observable<{ company: Company }> {
    return this.http.get<{ company: Company }>(`/api/admin/companies/${id}`);
  }

  getCountries(): Observable<{ countries: Country[] }> {
    return this.http.get<{ countries: Country[] }>('/api/admin/countries');
  }

  create(payload: unknown): Observable<{ company: Company }> {
    return this.http.post<{ company: Company }>('/api/admin/companies', payload);
  }

  update(id: number, payload: unknown): Observable<{ company: Company }> {
    return this.http.put<{ company: Company }>(`/api/admin/companies/${id}`, payload);
  }

  checkUniqueness<T>(body: unknown): Observable<T> {
    return this.http.post<T>('/api/admin/companies/check-uniqueness', body);
  }

  getNetwork<T>(parentId: number, params: HttpParams): Observable<T> {
    return this.http.get<T>(`/api/admin/companies/${parentId}/network`, { params });
  }

  getNetworkCandidates<T>(parentId: number, params: HttpParams): Observable<T> {
    return this.http.get<T>(`/api/admin/companies/${parentId}/network/candidates`, { params });
  }

  linkToNetwork(
    parentId: number,
    payload: { company_id: number },
  ): Observable<{ company: Company }> {
    return this.http.post<{ company: Company }>(
      `/api/admin/companies/${parentId}/network`,
      payload,
    );
  }
}
