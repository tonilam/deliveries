import { Injectable, signal } from '@angular/core';

export type ToastrVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastrMessage {
  id: number;
  message: string;
  variant: ToastrVariant;
}

const DEFAULT_DURATIONS: Record<ToastrVariant, number> = {
  success: 4000,
  error: 6000,
  info: 4000,
  warning: 5000,
};

@Injectable({ providedIn: 'root' })
export class ToastrService {
  private nextId = 0;

  readonly messages = signal<ToastrMessage[]>([]);

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  dismiss(id: number): void {
    this.messages.update((list) => list.filter((item) => item.id !== id));
  }

  private show(message: string, variant: ToastrVariant): void {
    const id = ++this.nextId;
    this.messages.update((list) => [...list, { id, message, variant }]);
    window.setTimeout(() => this.dismiss(id), DEFAULT_DURATIONS[variant]);
  }
}
