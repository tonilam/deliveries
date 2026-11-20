import { Routes } from '@angular/router';

import { adminGuard, authGuard, customerGuard, guestGuard } from './core/auth/auth.guard';
import { registrationEnabledGuard } from './core/features/registration.guard';

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
    canActivate: [guestGuard, registrationEnabledGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    path: 'invite/:token',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/invite/invite').then((m) => m.Invite),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/change-password/change-password').then((m) => m.ChangePassword),
  },
  {
    path: 'auth/callback',
    loadComponent: () => import('./pages/auth-callback/auth-callback').then((m) => m.AuthCallback),
  },
  {
    path: 'app',
    canActivate: [customerGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/customer/dashboard/dashboard').then((m) => m.CustomerDashboard),
      },
      {
        path: 'deliveries',
        loadComponent: () =>
          import('./pages/customer/deliveries/deliveries').then((m) => m.CustomerDeliveries),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/admin/admin-home/admin-home').then((m) => m.AdminHome),
      },
      {
        path: 'settings',
        loadComponent: () => import('./pages/admin/settings/settings').then((m) => m.AdminSettings),
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/admin/features/features').then((m) => m.AdminFeatures),
      },
      {
        path: 'users',
        loadComponent: () => import('./pages/admin/users/users').then((m) => m.AdminUsers),
      },
      {
        path: 'users/create',
        loadComponent: () =>
          import('./pages/admin/users/create-user').then((m) => m.AdminCreateUser),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
