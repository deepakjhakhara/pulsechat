# Pulse Chat — Streamer Companion

A responsive YouTube Live Chat companion with Google OAuth, readable animated chat cards, notification sounds, Super Chat highlighting, font-size controls, and a mobile layout.

## Requirements
- Node.js 20+
- A Google Cloud project with **YouTube Data API v3** enabled
- OAuth 2.0 Client ID of type **Web application**

## 1. Configure Google OAuth
1. Open https://console.cloud.google.com/ and create/select a project.
2. Enable **YouTube Data API v3** in APIs & Services → Library.
3. Configure the OAuth consent screen. Add your test Google account as a test user while the app is in testing.
4. Create an OAuth Client ID → Web application.
5. Add this Authorized redirect URI exactly: `http://localhost:4000/auth/google/callback`
6. Copy the Client ID and Client Secret.

## 2. Configure environment
Copy `server/.env.example` to `server/.env` and fill in the Google credentials. Replace `SESSION_SECRET` with a long random value.

## 3. Install and run
From this folder:

```bash
npm install
npm run install:all
npm run dev
```

Open `http://localhost:5173` and select **Connect YouTube**.

## 4. Test on Android on the same Wi-Fi
For a quick layout preview, find your PC's LAN IPv4 address (for example `192.168.1.20`), set `CLIENT_ORIGIN` in `server/.env` to `http://192.168.1.20:5173`, and set `VITE_API_URL=http://192.168.1.20:4000` in `client/.env`. Restart both dev servers and open `http://192.168.1.20:5173` on the phone. **Google OAuth from the phone will not work with the localhost callback.** For real phone sign-in and use away from your PC, deploy both parts behind an HTTPS domain and register the exact HTTPS callback URL in Google Cloud. The same HTTPS deployment is the recommended setup for using the app on both devices.

## Important implementation notes
- The backend uses the YouTube Data API's `liveChatMessages.list` endpoint and follows the API-provided `pollingIntervalMillis` and `nextPageToken`. This is a compatible first implementation using the official REST client. The `streamList` method is the newer low-latency server-streaming option and can be added with a gRPC client in a later iteration.
- The OAuth scope is `youtube.readonly`; no chat-writing permission is requested.
- The in-memory Express session store and development cookie settings are for local development only. Before public deployment, use a persistent session store, HTTPS secure cookies, CSRF protections, rate limits, and a production secret manager. Do not commit `.env` or expose the client secret.
- The app currently targets one signed-in streamer session per browser session. Multi-user production hosting should isolate pollers by authenticated user and use a persistent token store.
- The browser may require one user interaction before it allows notification audio. The **Test notification sound** button unlocks audio on supported browsers.
