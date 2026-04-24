# JobPilot — Auto-Apply Chrome Extension + Web Dashboard

**JobPilot** is a Chrome Extension (Manifest V3) + web dashboard that helps users **automatically apply to jobs** on **LinkedIn** and **Naukri.com**. Jobs are queued from the dashboard, and the extension picks them up, opens each job in a background tab, fills the application using the user’s resume data, and submits.

## Links

- **Live demo**: https://jobpilot-wheat.vercel.app/
- **LinkedIn post**: https://www.linkedin.com/posts/mahijain6384_fullstackdevelopment-reactjs-nodejs-ugcPost-7453365213472661506-YRcb?utm_source=share&utm_medium=member_android&rcm=ACoAAD51zQkBjftMrwOLSw88outkeMgJX8PXkrI

## What’s included

- **Chrome Extension (MV3)**: service worker orchestration + content scripts for LinkedIn/Naukri (and generic forms)
- **Web dashboard (React + Vite)**: queue jobs and manage account/resume
- **Backend API (Node.js + Express)**: auth, resume data, application queue, status updates
- **AI Answers (OpenRouter)**: LLM-powered answers to application/screening questions (enable via `OPENROUTER_API_KEY`)

## Tech stack

- **Frontend**: React, Vite, Tailwind CSS
- **Backend**: Node.js, Express, MongoDB (Mongoose)
- **Extension**: Chrome Manifest V3, content scripts, `chrome.storage`, `chrome.tabs`, `chrome.scripting`, `chrome.alarms`
- **AI**: OpenRouter (optional)

## Repo structure

```text
jobpilot/
  client/        # React dashboard (Vite)
  server/        # Node/Express API
  extension/     # Chrome extension (MV3)
```

## Installation & local setup

### Prerequisites

- **Node.js** (LTS recommended) and **npm**
- **MongoDB** database (local or Atlas)
- **Google OAuth** credentials (optional if you want Google sign-in)
- **Chrome** (to load the extension)

### 1) Backend (API)

```bash
cd server
npm install
```

Create your env file:

- Copy `server/.env.example` → `server/.env`
- Fill in at least: `MONGODB_URI`, `JWT_SECRET`, and `FRONTEND_URL`
- **(Optional) Enable AI Answers (OpenRouter)**: set `OPENROUTER_API_KEY` in `server/.env`

Run the server:

```bash
npm run dev:server
```

By default it runs on `http://localhost:5000`.

### 2) Frontend (Dashboard)

In a new terminal:

```bash
cd client
npm install
npm run dev
```

This starts the dashboard (typically `http://localhost:5173`).

If your frontend expects an API base URL, set it via your Vite env (example):

```text
VITE_API_URL=http://localhost:5000
```

### 3) Chrome Extension (Load unpacked)

1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `jobpilot/extension`

The extension communicates with:

- The dashboard (localhost during dev / your deployed site in production)
- The backend API (localhost during dev / your deployed API in production)

### Optional: Build a ZIP of the extension for download

The client project includes a script that zips `extension/` into `client/public/JobPilot-Extension.zip`:

```bash
cd client
npm run build:ext
```

