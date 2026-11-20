import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-customer-deliveries',
  templateUrl: './deliveries.html',
  styleUrl: '../../../shared/portal-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerDeliveries {}
