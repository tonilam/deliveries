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
    path: 'reset-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./pages/reset-password/reset-password').then((m) => m.ResetPassword),
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
        path: 'deliveries/create',
        loadComponent: () =>
          import('./pages/customer/deliveries/load-form').then((m) => m.CustomerLoadForm),
      },
      {
        path: 'deliveries/:id/edit',
        loadComponent: () =>
          import('./pages/customer/deliveries/load-form').then((m) => m.CustomerLoadForm),
      },
      {
        path: 'addresses',
        loadComponent: () =>
          import('./pages/customer/addresses/addresses').then((m) => m.CustomerAddresses),
      },
      {
        path: 'addresses/create',
        loadComponent: () =>
          import('./pages/customer/addresses/address-form').then((m) => m.CustomerAddressForm),
      },
      {
        path: 'addresses/:id/edit',
        loadComponent: () =>
          import('./pages/customer/addresses/address-form').then((m) => m.CustomerAddressForm),
      },
      {
        path: 'network',
        pathMatch: 'full',
        redirectTo: 'network/providers',
      },
      {
        path: 'network/:segment',
        loadComponent: () =>
          import('./pages/customer/network/network').then((m) => m.CustomerNetwork),
      },
      {
        path: 'network/:segment/create',
        loadComponent: () =>
          import('./pages/customer/network/network-company-form').then((m) => m.NetworkCompanyForm),
      },
      {
        path: 'network/:segment/:id/edit',
        loadComponent: () =>
          import('./pages/customer/network/network-company-form').then((m) => m.NetworkCompanyForm),
      },
      {
        path: 'rate-cards',
        loadComponent: () =>
          import('./pages/customer/rate-cards/rate-cards').then((m) => m.CustomerRateCards),
      },
      {
        path: 'rate-cards/create',
        loadComponent: () =>
          import('./pages/customer/rate-cards/rate-card-form').then((m) => m.CustomerRateCardForm),
      },
      {
        path: 'rate-cards/:id/edit',
        loadComponent: () =>
          import('./pages/customer/rate-cards/rate-card-form').then((m) => m.CustomerRateCardForm),
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
        loadComponent: () =>
          import('./pages/admin/settings/settings-shell').then((m) => m.AdminSettingsShell),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'countries' },
          {
            path: 'countries',
            loadComponent: () =>
              import('./pages/admin/settings/countries/countries').then((m) => m.AdminCountries),
          },
          {
            path: 'countries/create',
            loadComponent: () =>
              import('./pages/admin/settings/countries/country-form').then(
                (m) => m.AdminCountryForm,
              ),
          },
          {
            path: 'countries/:id/edit',
            loadComponent: () =>
              import('./pages/admin/settings/countries/country-form').then(
                (m) => m.AdminCountryForm,
              ),
          },
          {
            path: 'countries/:countryId/states/create',
            loadComponent: () =>
              import('./pages/admin/settings/countries/state-form').then((m) => m.AdminStateForm),
          },
          {
            path: 'countries/:countryId/states/:stateId/edit',
            loadComponent: () =>
              import('./pages/admin/settings/countries/state-form').then((m) => m.AdminStateForm),
          },
          {
            path: 'zones',
            loadComponent: () =>
              import('./pages/admin/settings/zones/zones').then((m) => m.AdminZones),
          },
          {
            path: 'zones/create',
            loadComponent: () =>
              import('./pages/admin/settings/zones/zone-form').then((m) => m.AdminZoneForm),
          },
          {
            path: 'goods',
            loadComponent: () =>
              import('./pages/admin/settings/goods/goods').then((m) => m.AdminGoods),
          },
          {
            path: 'goods/create',
            loadComponent: () =>
              import('./pages/admin/settings/goods/good-form').then((m) => m.AdminGoodForm),
          },
        ],
      },
      {
        path: 'features',
        loadComponent: () => import('./pages/admin/features/features').then((m) => m.AdminFeatures),
      },
      {
        path: 'companies',
        loadComponent: () =>
          import('./pages/admin/companies/companies').then((m) => m.AdminCompanies),
      },
      {
        path: 'vehicles',
        loadComponent: () => import('./pages/admin/vehicles/vehicles').then((m) => m.AdminVehicles),
      },
      {
        path: 'vehicles/categories/create',
        loadComponent: () =>
          import('./pages/admin/vehicles/vehicle-category-form').then(
            (m) => m.AdminVehicleCategoryForm,
          ),
      },
      {
        path: 'vehicles/categories/:categoryId/body-types',
        loadComponent: () =>
          import('./pages/admin/vehicles/body-types').then((m) => m.AdminVehicleBodyTypes),
      },
      {
        path: 'vehicles/categories/:categoryId/body-types/create',
        loadComponent: () =>
          import('./pages/admin/vehicles/body-type-form').then((m) => m.AdminVehicleBodyTypeForm),
      },
      {
        path: 'vehicles/categories/:categoryId/body-types/:id/edit',
        loadComponent: () =>
          import('./pages/admin/vehicles/body-type-form').then((m) => m.AdminVehicleBodyTypeForm),
      },
      {
        path: 'companies/create',
        loadComponent: () =>
          import('./pages/admin/companies/company-form').then((m) => m.AdminCompanyForm),
      },
      {
        path: 'companies/:id/edit',
        loadComponent: () =>
          import('./pages/admin/companies/company-form').then((m) => m.AdminCompanyForm),
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
        path: 'users/:id/reset-password',
        loadComponent: () =>
          import('./pages/admin/users/reset-password').then((m) => m.AdminResetPassword),
      },
      {
        path: 'profile',
        loadComponent: () => import('./pages/profile/profile').then((m) => m.Profile),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
