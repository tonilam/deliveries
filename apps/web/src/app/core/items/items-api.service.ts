import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ItemsApiService {
  private readonly http = inject(HttpClient);

  list<T>(params: HttpParams | Record<string, string>): Observable<T> {
    const options =
      params instanceof HttpParams
        ? { params }
        : { params: new HttpParams({ fromObject: params }) };
    return this.http.get<T>('/api/items', options);
  }

  listByQuery(query: string): Observable<unknown> {
    return this.http.get<unknown>(`/api/items?${query}`);
  }

  getGoodTypeOptions<T>(): Observable<T> {
    return this.http.get<T>('/api/items/good-type-options');
  }

  create<T>(payload: unknown): Observable<T> {
    return this.http.post<T>('/api/items', payload);
  }
}
