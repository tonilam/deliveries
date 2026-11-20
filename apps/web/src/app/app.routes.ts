import { Routes } from '@angular/router';

import { adminGuard, authGuard, customerGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/role-redirect/role-redirect').then((m) => m.RoleRedirect),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: 'app',
    canActivate: [customerGuard],
    loadComponent: () =>
      import('./pages/customer/dashboard/dashboard').then((m) => m.CustomerDashboard),
  },
  {
    path: 'app/deliveries',
    canActivate: [customerGuard],
    loadComponent: () =>
      import('./pages/customer/deliveries/deliveries').then((m) => m.CustomerDeliveries),
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/admin-home/admin-home').then((m) => m.AdminHome),
  },
  {
    path: 'admin/settings',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/settings/settings').then((m) => m.AdminSettings),
  },
  {
    path: 'admin/users',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/admin/users/users').then((m) => m.AdminUsers),
  },
  { path: '**', redirectTo: '' },
];
