# Fractoscan

## Project Overview
FractoScan is a full-stack app:
- Frontend: React + Vite
- Backend: Node.js + Express (`fractoscan-backend`)
- ML API: Flask + YOLO (`fractoscan-ml`)

## Local Development

### 1) Frontend
```bash
npm install
npm run dev
```

### 2) Backend (API)
```bash
cd fractoscan-backend
cp .env.example .env
npm install
npm start
```

### 3) ML API
```bash
cd fractoscan-ml
pip install -r requirements.txt
python app.py
```

## Environment Variables
- Frontend: `.env` (see `.env.example`)
  - `VITE_API_ORIGIN` (defaults to `http://127.0.0.1:5001`)
- Backend: `fractoscan-backend/.env` (see `fractoscan-backend/.env.example`)
  - `MONGO_URI`, `JWT_SECRET`, `ML_PREDICT_URL`

## Free Deployment (Recommended)
This repo includes:
- `render.yaml` (Render blueprint for backend + ML)
- `vercel.json` / `public/_redirects` (SPA route rewrites for React Router)

Typical flow:
1) Deploy `fractoscan-ml` (Render) → note the public URL.
2) Deploy `fractoscan-backend` (Render) and set:
   - `ML_PREDICT_URL=https://<your-ml-service>/predict`
   - `MONGO_URI=...`
   - `JWT_SECRET=...`
3) Deploy the frontend (Vercel/Netlify/Cloudflare Pages) and set:
   - `VITE_API_ORIGIN=https://<your-backend-service>`

Note: free tiers often “sleep”, so the first request after inactivity can be slow.
