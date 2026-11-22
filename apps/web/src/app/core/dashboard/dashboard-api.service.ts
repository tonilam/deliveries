import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AdminDashboardResponse } from '../../pages/admin/admin-home/admin-home';
import { CustomerDashboardResponse } from '../../pages/customer/dashboard/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private readonly http = inject(HttpClient);

  getCustomerDashboard(): Observable<CustomerDashboardResponse> {
    return this.http.get<CustomerDashboardResponse>('/api/dashboard');
  }

  getAdminDashboard(): Observable<AdminDashboardResponse> {
    return this.http.get<AdminDashboardResponse>('/api/admin/dashboard');
  }
}
