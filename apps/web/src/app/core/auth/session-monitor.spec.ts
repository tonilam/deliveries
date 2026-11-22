import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { SESSION_CHECK_INTERVAL_MS, SessionMonitor } from './session-monitor';
import { User } from './user.model';

const sampleUser = (id: number): User => ({
  id,
  name: 'Test User',
  email: 'test@example.com',
  role: 'customer',
  is_active: true,
  has_password: true,
  must_change_password: false,
  company_id: 1,
  email_verified_at: null,
  created_at: '2026-01-01T00:00:00.000000Z',
  updated_at: '2026-01-01T00:00:00.000000Z',
});

describe('SessionMonitor', () => {
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    TestBed.inject(SessionMonitor);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('does not probe before the interval when signed in', () => {
    auth.user.set(sampleUser(1));

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS - 1);

    httpMock.expectNone('/api/user');
  });

  it('probes every 5 minutes while signed in', () => {
    auth.user.set(sampleUser(1));

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS);
    const first = httpMock.expectOne('/api/user');
    first.flush({ user: sampleUser(1), impersonating: false, impersonator: null });

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS);
    const second = httpMock.expectOne('/api/user');
    second.flush({ user: sampleUser(1), impersonating: false, impersonator: null });
  });

  it('does not set session_expired when already on login after sign-out', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.user.set(sampleUser(1));

    await vi.advanceTimersByTimeAsync(SESSION_CHECK_INTERVAL_MS);
    const req = httpMock.expectOne('/api/user');
    auth.user.set(null);
    Object.defineProperty(router, 'url', { value: '/login', configurable: true });
    req.flush('Unauthenticated.', { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears auth and navigates to login on 401', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    auth.user.set(sampleUser(1));

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS);
    httpMock
      .expectOne('/api/user')
      .flush('Unauthenticated.', { status: 401, statusText: 'Unauthorized' });

    expect(auth.user()).toBeNull();
    expect(navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { error: 'session_expired' },
      replaceUrl: true,
    });
  });

  it('stays signed in on network failure', () => {
    auth.user.set(sampleUser(1));

    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS);
    httpMock.expectOne('/api/user').error(new ProgressEvent('error'));

    expect(auth.user()).toEqual(sampleUser(1));
  });

  it('does not probe when no user is signed in', () => {
    vi.advanceTimersByTime(SESSION_CHECK_INTERVAL_MS * 2);
    httpMock.expectNone('/api/user');
  });

  it('stops probing after sign-out', async () => {
    auth.user.set(sampleUser(1));
    await vi.advanceTimersByTimeAsync(SESSION_CHECK_INTERVAL_MS);
    httpMock
      .expectOne('/api/user')
      .flush({ user: sampleUser(1), impersonating: false, impersonator: null });

    auth.user.set(null);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(SESSION_CHECK_INTERVAL_MS * 2);
    httpMock.expectNone('/api/user');
  });
});
