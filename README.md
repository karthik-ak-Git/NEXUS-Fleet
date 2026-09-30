# 🤖 NEXUS-Fleet: Edge-AI Distributed Fleet Coordination Digital Twin

> **Smart India Hackathon 2026 — Grand Finale Project**  
> **Problem Statement ID:** `SIH26123` | **Theme:** `Smart Automation` | **Category:** `Software`  
> **Team Name:** `SPARK-08` (`Team ID: 143472`) | **Nodal Agency:** `Bharat Electronics Limited`

[![SIH 2026](https://img.shields.io/badge/SIH-2026_Finale-0F2C59?style=for-the-badge&logo=react)](https://github.com/karthik-ak-Git/NEXUS-Fleet)
[![FastAPI Backend](https://img.shields.io/badge/FastAPI-Pytest_Passed_22/22-009688?style=for-the-badge&logo=fastapi)](https://github.com/karthik-ak-Git/NEXUS-Fleet)
[![TypeScript Workspace](https://img.shields.io/badge/TypeScript-0_Type_Errors-3178C6?style=for-the-badge&logo=typescript)](https://github.com/karthik-ak-Git/NEXUS-Fleet)
[![Docker Ready](https://img.shields.io/badge/Docker-Multi--stage-2496ED?style=for-the-badge&logo=docker)](https://github.com/karthik-ak-Git/NEXUS-Fleet)

---

## 📌 GitHub "About" Section Copy-Paste Snippet

Use this exact text & topic tags when updating the **About** box on your GitHub repository page:

### 📝 About Description:
```text
Edge-AI Based Distributed Fleet Coordination for Autonomous Mobile Robots (AMRs) in Smart Warehouses (SIH 2026 - PS SIH26123). Features 3D Three.js Digital Twin, 2D operational layout, P2P collision & conflict resolution, dynamic A* routing, and battery charging loop.
```

### 🏷️ Topic Tags to Add:
`sih2026` `autonomous-mobile-robots` `digital-twin` `threejs` `fastapi` `edge-ai` `warehouse-automation` `p2p-coordination` `a-star-pathfinding` `react-three-fiber`

---

## 🏗️ System Architecture & Visual Overview

```
                          ┌──────────────────────────────────────────┐
                          │   NEXUS-Fleet 3D/2D Web Dashboard        │
                          │   (React / Vite / Three.js / Canvas)     │
                          └───────────────────┬──────────────────────┘
                                              │
                                   WebSockets / HTTP REST
                                              │
                          ┌───────────────────▼──────────────────────┐
                          │   FastAPI Autonomous Engine Server       │
                          │   (P2P Agent Runtimes & Pytest Suite)    │
                          └───────────────────┬──────────────────────┘
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    ▼                                                   ▼
       ┌────────────────────────┐                          ┌────────────────────────┐
       │ Active AMRs (01 .. 05)  │                          │ Charger Slots (C1..C5) │
       │ Pickup -> Pack Counter │                          │ Low-Batt Silent Return │
       └────────────────────────┘                          └────────────────────────┘
```

---

## 🌐 Live Web Application & Documentation Links

- 🖥️ **Live Interactive Web Prototype:** [https://nexus-fleet.vercel.app](https://nexus-fleet.vercel.app)
- 📡 **Backend API & Health Status:** [https://nexus-fleet-backend.onrender.com/api/health](https://nexus-fleet-backend.onrender.com/api/health)
- 📚 **GitHub Documentation:** [https://github.com/karthik-ak-Git/NEXUS-Fleet](https://github.com/karthik-ak-Git/NEXUS-Fleet)
- 📊 **SIH 2026 Redesigned Presentation:** Included in repository (`SIH_2026_Spark-08_Redesigned.pptx`)

---

## 🚀 Deployment Guide (Vercel & Docker)

### 1. Vercel Monorepo Deployment (Fix for Vercel Import Screen)

When deploying to Vercel, Vercel detects a monorepo structure. Follow these exact steps depending on your deployment choice:

#### Option A: Deploying Frontend Only (`artifacts/nexus-fleet`)
1. Click **"Import single project"** next to `nexus-fleet` in the Vercel UI.
2. In Project Settings:
   - **Framework Preset:** `Vite`
   - **Root Directory:** `artifacts/nexus-fleet`
   - **Build Command:** `pnpm run build`
   - **Output Directory:** `dist/public`
3. Add Environment Variables:
   - `PORT` = `5173`
   - `BASE_PATH` = `/`
   - `VITE_API_URL` = `https://nexus-fleet-backend.onrender.com/api`

#### Option B: Root Monorepo Import
If importing the repository root directly into Vercel, Vercel will automatically use the included `vercel.json` config at the root.

---

### 2. Docker Container Deployment (Frontend + Backend)

Deploy both services locally or to any cloud VM using Docker Compose:

```bash
# Clone the repository
git clone https://github.com/karthik-ak-Git/NEXUS-Fleet.git
cd NEXUS-Fleet

# Build and start both containers in detached mode
docker compose up -d --build

# Verify container status
docker compose ps
```

Once running:
- **Frontend App:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000/api/health`

---

## 🔑 Production `.env` Configurations

### Frontend Environment (`artifacts/nexus-fleet/.env.production`)
```env
PORT=5173
BASE_PATH=/
VITE_API_URL=https://nexus-fleet-backend.onrender.com/api
VITE_WS_URL=wss://nexus-fleet-backend.onrender.com/ws/fleet
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### Backend Environment (`backend/.env.production`)
```env
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
CORS_ORIGINS=https://nexus-fleet.vercel.app,http://localhost:5173
```

---

## 🧪 Local Development & Verification Commands

```bash
# Run backend tests (22/22 passed)
uv run pytest backend/tests

# Run frontend typecheck (0 errors)
pnpm run typecheck

# Start local backend server
uv run uvicorn backend.app.main:app --host 0.0.0.0 --port 8000

# Start local frontend dev server
$env:PORT="5173"; $env:BASE_PATH="/"; pnpm --filter @workspace/nexus-fleet dev
```

---

## 📜 License
Developed by Team **SPARK-08** for **Smart India Hackathon 2026**. Released under the MIT License.
