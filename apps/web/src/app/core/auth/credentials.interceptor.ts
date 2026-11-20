import { HttpInterceptorFn } from '@angular/common/http';

/** Send cookies on every API request (Sanctum SPA session). */
export const credentialsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: true }));
