# 2026-11-22 — Session expiry while signed in

- Added user story [US-029](../stories/US-029-session-expiry.md): while signed in, the web app probes `GET /api/user` every 5 minutes; 401/419 clears the client session and returns to login with a session-expired message.
- Web: `SessionMonitor` on the app root, `AuthService.probeSession()`, login `?error=session_expired` copy.