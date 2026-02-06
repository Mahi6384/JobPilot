# Google OAuth Implementation Documentation - JobPilot

This document provides a comprehensive overview of how Google OAuth is implemented in the JobPilot application.

## 1. Overview
JobPilot uses a secure, token-based Google OAuth 2.0 flow. The frontend handles the user interaction and retrieves an ID Token (credential), which is then verified by the backend to authenticate or register the user.

## 2. Infrastructure Setup (Google Cloud Console)
To maintain the implementation, the following must be configured in the [Google Cloud Console](https://console.cloud.google.com/):

- **Project**: JobPilot
- **APIs & Services**: Enabled "Google People API".
- **OAuth Consent Screen**: Configured with `email` and `profile` scopes.
- **Credentials**:
    - **Type**: OAuth 2.0 Client ID (Web Application)
    - **Authorized JavaScript Origins**: `http://localhost:5173` (Frontend)
    - **Authorized Redirect URIs**: `http://localhost:5000/api/auth/google/callback` (Required for some flows, though we currently use the ID Token popup flow).

## 3. Environment Variables
The implementation relies on the following variables in `.env` files:

### Backend (`server/.env`)
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
```

### Frontend (`client/.env`)
```env
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```

---

## 4. Frontend Implementation
**Library**: `@react-oauth/google`

### Setup (`main.jsx`)
The entire application is wrapped in the `GoogleOAuthProvider` to provide the authentication context.
```javascript
<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
  <App />
</GoogleOAuthProvider>
```

### Authentication Component (`AuthForm.jsx`)
We use the modern `<GoogleLogin />` component which supports both the standard popup and **Google One Tap**.
- **Success Handler**: Receives a `credential` (JWT). This is sent to the backend via a POST request to `/api/auth/google`.
- **State Update**: Upon successful backend response, it saves the `token` and `user` to `localStorage` and dispatches a global `authChange` event.

---

## 5. Backend Implementation
**Library**: `google-auth-library`

### Token Verification (`authController.js`)
The backend does **not** trust the user data sent from the frontend. Instead, it verifies the ID Token directly with Google's servers.

```javascript
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const ticket = await client.verifyIdToken({
  idToken: credential,
  audience: process.env.GOOGLE_CLIENT_ID,
});
const payload = ticket.getPayload(); // Contains verified email, name, sub (googleId)
```

### User Logic
1.  **Check**: Does a user with this `email` or `googleId` exist?
2.  **Match**: If yes, return the existing user (and link `googleId` if missing).
3.  **Create**: If no, create a new user with `onboardingStatus: "initial"`.
4.  **Token**: Issue a standard JobPilot JWT for subsequent API requests.

---

## 6. UI & Experience Integration

### Reactive Navbar (`Navbar.jsx`)
- **Initials Avatar**: Shows a circular `<div>` with the first letter of the user's email.
- **Auto-Sync**: Listens for the `authChange` event and `storage` changes to update the UI (Login -> Logout) across different tabs or components instantly.
- **Logout**: Clears storage and dispatches `authChange` to reset the UI.

### Auth Guards (`Login.jsx`, `SignUp.jsx`)
- Uses `useEffect` to check for an existing token.
- If found, redirects the user to `/dashboard` immediately to prevent re-authentication.

---

## 7. Security Best Practices
- **Token Verification**: ID Tokens are verified on the backend using the official Google library.
- **JWT Refresh**: Uses short-lived access tokens and long-lived refresh tokens (standard JobPilot auth).
- **Sensitive Data**: Client Secret is never exposed to the frontend.
- **Authorized Origins**: Locked down to specific domains in the Google Cloud Console.
