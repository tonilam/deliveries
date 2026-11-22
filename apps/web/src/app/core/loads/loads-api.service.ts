import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { LoadRow, OwnerCompanyType } from '../../pages/customer/deliveries/load.types';

@Injectable({ providedIn: 'root' })
export class LoadsApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/loads', { params });
  }

  get(loadId: number): Observable<{ load: LoadRow }> {
    return this.http.get<{ load: LoadRow }>(`/api/loads/${loadId}`);
  }

  getWithOwnerType(
    loadId: number,
  ): Observable<{ load: LoadRow; own_company_type: OwnerCompanyType }> {
    return this.http.get<{ load: LoadRow; own_company_type: OwnerCompanyType }>(
      `/api/loads/${loadId}`,
    );
  }

  getOwnerTypeMeta(
    params: HttpParams,
  ): Observable<{ meta: { own_company_type?: OwnerCompanyType } }> {
    return this.http.get<{ meta: { own_company_type?: OwnerCompanyType } }>('/api/loads', {
      params,
    });
  }

  create(payload: unknown): Observable<{ load: LoadRow }> {
    return this.http.post<{ load: LoadRow }>('/api/loads', payload);
  }

  update(loadId: number, payload: unknown): Observable<{ load: LoadRow }> {
    return this.http.put<{ load: LoadRow }>(`/api/loads/${loadId}`, payload);
  }

  delete(loadId: number): Observable<unknown> {
    return this.http.delete(`/api/loads/${loadId}`);
  }

  createChild(parentId: number, payload: unknown): Observable<{ load: LoadRow }> {
    return this.http.post<{ load: LoadRow }>(`/api/loads/${parentId}/children`, payload);
  }

  getActivity<T>(loadId: number, params: HttpParams): Observable<T> {
    return this.http.get<T>(`/api/loads/${loadId}/activity`, { params });
  }

  getPartyOptions<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/loads/party-options', { params });
  }

  getAddressOptions<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/loads/address-options', { params });
  }

  moveItem<T>(parentId: number, itemId: number, payload: unknown): Observable<T> {
    return this.http.post<T>(`/api/loads/${parentId}/items/${itemId}/move`, payload);
  }

  attachItem(loadId: number, itemId: number): Observable<{ item: unknown }> {
    return this.http.post<{ item: unknown }>(`/api/loads/${loadId}/items`, { item_id: itemId });
  }

  detachItem(loadId: number, itemId: number): Observable<unknown> {
    return this.http.delete(`/api/loads/${loadId}/items/${itemId}`);
  }
}
