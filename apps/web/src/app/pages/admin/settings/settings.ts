import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-admin-settings',
  templateUrl: './settings.html',
  styleUrl: '../../../shared/portal-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettings {}
