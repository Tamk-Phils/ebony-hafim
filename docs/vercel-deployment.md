# Vercel Deployment Guide for HA-FIM

This guide covers deploying the **Hardware-Assisted File Integrity Monitoring (HA-FIM)** control plane frontend to [Vercel](https://vercel.com).

---

## 1. Architecture Overview for Cloud Deployments

HA-FIM is composed of two primary layers:
1. **Frontend Control Plane (React + Vite + Tailwind CSS)**:
   - Single-Page Application (SPA) providing real-time telemetry, baseline management, forensic event inspection, TEE attestation verification, and empirical benchmark visualizations.
   - Designed for edge CDN hosting on **Vercel**.
2. **Backend & Host Monitoring Agent (FastAPI + inotify + TEE Adapter)**:
   - Long-running Linux daemon utilizing native `libc inotify_init1` loops, periodic filesystem reconciliation, cryptographic stream hashing, and AWS Nitro Enclaves (`AF_VSOCK`) or Software Dev adapters.
   - Runs on an AWS EC2 instance with Nitro Enclaves (e.g. `c5.xlarge`, `c6i.xlarge`) or any Linux host with Docker.

---

## 2. Deploying the Frontend to Vercel

### Option A: Automatic Deployment via Git (Recommended)

1. Push your repository to GitHub: `https://github.com/Tamk-Phils/ebony-hafim.git`
2. Log in to [Vercel](https://vercel.com) and click **"Add New..."** &rarr; **"Project"**.
3. Import the `ebony-hafim` repository.
4. **Project Configuration**:
   - The repository includes a root [`vercel.json`](../vercel.json) and root [`package.json`](../package.json). Vercel will automatically configure:
     - **Framework Preset**: `Vite`
     - **Build Command**: `cd frontend && npm run build` (or `npm run build`)
     - **Output Directory**: `frontend/dist`
     - **Install Command**: `cd frontend && npm install`
5. **Environment Variables**:
   Add the following environment variable under **Project Settings &rarr; Environment Variables**:
   - `VITE_API_BASE_URL`: The public HTTPS URL where your HA-FIM backend is reachable (e.g. `https://api.hafim.yourdomain.com`).
   - *(Optional)* If omitted or left empty, the frontend defaults to relative `/api/v1` and same-origin WebSockets.
6. Click **Deploy**.

---

### Option B: Deploying with `frontend/` as Root Directory

If you set the **Root Directory** in Vercel to `frontend`:
- The [`frontend/vercel.json`](../frontend/vercel.json) file will handle SPA rewrites.
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Environment Variable**: `VITE_API_BASE_URL`

---

## 3. SPA Routing & Fallback Verification

Vercel rewrites all non-asset requests to `/index.html`:
```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```
This ensures refreshing deep routes (`/monitored-files`, `/events`, `/tee`, `/evaluations`, `/audit`) resolves to the React application rather than returning a `404 Not Found`.

---

## 4. WebSocket & Real-Time Alerts

The frontend automatically resolves the live event WebSocket stream based on `VITE_API_BASE_URL`:
- If `VITE_API_BASE_URL=https://api.hafim.yourdomain.com`:
  - API requests &rarr; `https://api.hafim.yourdomain.com/api/v1/...`
  - WebSockets &rarr; `wss://api.hafim.yourdomain.com/ws/events`
- If `VITE_API_BASE_URL` is omitted:
  - API requests &rarr; `/api/v1/...`
  - WebSockets &rarr; `ws(s)://<current-domain>/ws/events`

---

## 5. Connecting to the Backend

Deploy the backend to an AWS EC2 Nitro-enabled instance or standard Linux container using the included Docker configuration:

```bash
# On your Linux / AWS EC2 host:
docker compose up -d hafim-backend
```

Once running, point your Vercel deployment's `VITE_API_BASE_URL` to your backend host.
