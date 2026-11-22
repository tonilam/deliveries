import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { Country } from '../country/country.model';

@Injectable({ providedIn: 'root' })
export class AdminCountriesApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<{ countries: Country[] }> {
    return this.http.get<{ countries: Country[] }>('/api/admin/countries');
  }

  get(id: number): Observable<{ country: Country }> {
    return this.http.get<{ country: Country }>(`/api/admin/countries/${id}`);
  }

  create(payload: unknown): Observable<{ country: Country }> {
    return this.http.post<{ country: Country }>('/api/admin/countries', payload);
  }

  update(id: number, payload: unknown): Observable<{ country: Country }> {
    return this.http.put<{ country: Country }>(`/api/admin/countries/${id}`, payload);
  }

  deleteCountry(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/countries/${id}`);
  }

  createState(countryId: number, payload: unknown): Observable<unknown> {
    return this.http.post(`/api/admin/countries/${countryId}/states`, payload);
  }

  updateState(countryId: number, stateId: number, payload: unknown): Observable<unknown> {
    return this.http.put(`/api/admin/countries/${countryId}/states/${stateId}`, payload);
  }

  deleteState(countryId: number, stateId: number): Observable<unknown> {
    return this.http.delete(`/api/admin/countries/${countryId}/states/${stateId}`);
  }
}
