import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { User } from '../../core/auth/user.model';

interface NavItem {
  label: string;
  path: string;
  exact?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app-shell.html',
  styleUrl: './app-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly user = this.auth.user;
  protected readonly impersonating = this.auth.impersonating;
  protected readonly leavingImpersonation = signal(false);
  protected readonly menuOpen = signal(false);

  protected readonly navItems = computed<NavItem[]>(() => {
    const u = this.user();
    if (!u) {
      return [];
    }
    return this.auth.isAdminRole(u.role)
      ? [
          { label: 'Home', path: '/admin', exact: true },
          { label: 'System settings', path: '/admin/settings' },
          { label: 'Features', path: '/admin/features' },
          { label: 'Companies', path: '/admin/companies' },
          { label: 'User management', path: '/admin/users' },
        ]
      : [
          { label: 'Dashboard', path: '/app', exact: true },
          { label: 'Deliveries', path: '/app/deliveries' },
          { label: 'Addresses', path: '/app/addresses' },
        ];
  });

  protected readonly profilePath = computed(() => {
    const u = this.user();
    return u && this.auth.isAdminRole(u.role) ? '/admin/profile' : '/app/profile';
  });

  protected readonly initials = computed(() => this.initialsFor(this.user()));

  protected toggleMenu(event: Event): void {
    event.stopPropagation();
    this.menuOpen.update((open) => !open);
  }

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    this.closeMenu();
    this.auth.logout().subscribe({
      next: () => void this.router.navigateByUrl('/login'),
      error: () => void this.router.navigateByUrl('/login'),
    });
  }

  protected leaveImpersonation(): void {
    if (this.leavingImpersonation()) {
      return;
    }
    this.closeMenu();
    this.leavingImpersonation.set(true);
    this.auth.leaveImpersonation().subscribe({
      next: () => {
        this.leavingImpersonation.set(false);
        void this.router.navigateByUrl('/admin/users?tab=customer');
      },
      error: () => {
        this.leavingImpersonation.set(false);
      },
    });
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.menuOpen()) {
      this.closeMenu();
    }
  }

  private initialsFor(user: User | null): string {
    if (!user?.name?.trim()) {
      return '?';
    }
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    const letters = parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
    return letters || '?';
  }
}
