import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface SettingsNavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-admin-settings-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './settings-shell.html',
  styleUrls: ['../../../shared/portal-shell.scss', './settings-shell.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsShell {
  protected readonly navItems: SettingsNavItem[] = [
    { label: 'Countries', path: '/admin/settings/countries' },
  ];
}
