import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { VehicleBodyType, VehicleCategory } from '../vehicle/vehicle.model';

@Injectable({ providedIn: 'root' })
export class AdminVehiclesApiService {
  private readonly http = inject(HttpClient);

  getCategoriesCatalogue(): Observable<{ vehicle_categories: VehicleCategory[] }> {
    return this.http.get<{ vehicle_categories: VehicleCategory[] }>(
      '/api/admin/vehicle-categories',
      { params: new HttpParams().set('catalogue', '1') },
    );
  }

  listBodyTypes<T>(categoryId: number, params: HttpParams): Observable<T> {
    return this.http.get<T>(`/api/admin/vehicle-categories/${categoryId}/body-types`, { params });
  }

  createCategory(payload: unknown): Observable<unknown> {
    return this.http.post('/api/admin/vehicle-categories', payload);
  }

  updateCategory(id: number, payload: unknown): Observable<unknown> {
    return this.http.put(`/api/admin/vehicle-categories/${id}`, payload);
  }

  deleteCategory(id: number): Observable<unknown> {
    return this.http.delete(`/api/admin/vehicle-categories/${id}`);
  }

  getBodyType(
    categoryId: number,
    bodyTypeId: number,
  ): Observable<{ vehicle_body_type: VehicleBodyType }> {
    return this.http.get<{ vehicle_body_type: VehicleBodyType }>(
      `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`,
    );
  }

  createBodyType(
    categoryId: number,
    payload: unknown,
  ): Observable<{ vehicle_body_type: VehicleBodyType }> {
    return this.http.post<{ vehicle_body_type: VehicleBodyType }>(
      `/api/admin/vehicle-categories/${categoryId}/body-types`,
      payload,
    );
  }

  updateBodyType(
    categoryId: number,
    bodyTypeId: number,
    payload: unknown,
  ): Observable<{ vehicle_body_type: VehicleBodyType }> {
    return this.http.put<{ vehicle_body_type: VehicleBodyType }>(
      `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`,
      payload,
    );
  }

  deleteBodyType(categoryId: number, bodyTypeId: number): Observable<unknown> {
    return this.http.delete(`/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}`);
  }

  createBodyTypeOption(
    categoryId: number,
    bodyTypeId: number,
    payload: unknown,
  ): Observable<unknown> {
    return this.http.post(
      `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options`,
      payload,
    );
  }

  updateBodyTypeOption(
    categoryId: number,
    bodyTypeId: number,
    optionId: number,
    payload: unknown,
  ): Observable<unknown> {
    return this.http.put(
      `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options/${optionId}`,
      payload,
    );
  }

  deleteBodyTypeOption(
    categoryId: number,
    bodyTypeId: number,
    optionId: number,
  ): Observable<unknown> {
    return this.http.delete(
      `/api/admin/vehicle-categories/${categoryId}/body-types/${bodyTypeId}/options/${optionId}`,
    );
  }
}
