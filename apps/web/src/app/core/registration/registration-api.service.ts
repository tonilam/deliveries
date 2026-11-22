import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RegistrationCompanyChoice {
  id: number;
  business_name: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrationApiService {
  private readonly http = inject(HttpClient);

  companiesForEmail(email: string): Observable<{ companies: RegistrationCompanyChoice[] }> {
    return this.http.get<{ companies: RegistrationCompanyChoice[] }>(
      '/api/registration/companies',
      {
        params: new HttpParams().set('email', email),
      },
    );
  }
}
