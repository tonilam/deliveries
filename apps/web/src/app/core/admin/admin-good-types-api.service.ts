import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { GoodType } from '../good-type/good-type.model';

@Injectable({ providedIn: 'root' })
export class AdminGoodTypesApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/admin/good-types', { params });
  }

  create(payload: unknown): Observable<{ good_type: GoodType }> {
    return this.http.post<{ good_type: GoodType }>('/api/admin/good-types', payload);
  }

  update(code: string, payload: unknown): Observable<unknown> {
    return this.http.put(`/api/admin/good-types/${code}`, payload);
  }

  delete(code: string): Observable<unknown> {
    return this.http.delete(`/api/admin/good-types/${code}`);
  }
}
