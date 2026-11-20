# Authenticated app shell

## Story
As a signed-in user, I want a consistent left main menu and a top bar with my avatar menu, so that I can navigate the app and reach My Profile or Sign Out from any page.

## Acceptance criteria
- [x] After login, authenticated pages use a shared shell: left main menu + right content area with a top bar
- [x] Left menu shows role-appropriate links (customer: Dashboard, Deliveries; admin: Home, System settings, User management)
- [x] Top bar shows a user avatar on the right; clicking it opens a dropdown with **My Profile** and **Sign Out**
- [x] **My Profile** opens a placeholder profile page
- [x] **Sign Out** ends the session and returns the user to login

## Notes
- Design/chrome change over the existing portal pages from US-002 / US-003; auth mechanics remain US-001.
- Avatar uses initials until a real avatar URL exists on the user model.
- Truckit dropdown/nav can replace local chrome once `truckit-component-library` is installed.
