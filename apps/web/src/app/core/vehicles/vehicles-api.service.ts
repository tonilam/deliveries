import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CustomerVehicleBodyType,
  CustomerVehicleCategory,
  VehicleBodyTypeOptionRow,
} from '../vehicle/vehicle.model';

@Injectable({ providedIn: 'root' })
export class VehiclesApiService {
  private readonly http = inject(HttpClient);

  getCustomerCatalogue(): Observable<{ vehicle_categories: CustomerVehicleCategory[] }> {
    return this.http.get<{ vehicle_categories: CustomerVehicleCategory[] }>('/api/vehicles');
  }

  setBodyTypeActive(
    id: number,
    active: boolean,
  ): Observable<{ vehicle_body_type: CustomerVehicleBodyType }> {
    return this.http.put<{ vehicle_body_type: CustomerVehicleBodyType }>(
      `/api/vehicles/body-types/${id}`,
      { active },
    );
  }

  getActivity<T>(params: HttpParams): Observable<T> {
    return this.http.get<T>('/api/vehicles/activity', { params });
  }

  getBodyTypeOptions(): Observable<{ vehicle_body_types: VehicleBodyTypeOptionRow[] }> {
    return this.http.get<{ vehicle_body_types: VehicleBodyTypeOptionRow[] }>(
      '/api/vehicles/body-type-options',
    );
  }
}
