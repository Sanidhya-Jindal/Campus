# Campus

**AI-powered campus security dashboard.** Campus fuses multi-modal
activity data — Wi-Fi associations, CCTV frames, card swipes, lab bookings,
library checkouts and free-text notes — into a single operational picture, then
layers machine learning and LLM reasoning on top: it reconstructs any person's
day, predicts where they'll go next, forecasts how crowded each building will
be, and surfaces prioritised security alerts with actionable recommendations.

It ships as a single container and runs on Azure Container Apps.

**🔗 Live demo:** <https://campus.kindbush-568172cc.uaenorth.azurecontainerapps.io/>

> The demo scales to zero when idle, so the first request after a quiet period
> takes ~2–3 minutes to cold-start. The security alerts panel also takes ~50s to
> populate on its very first load, then is cached and near-instant.

---

## Features

- **Live campus map** — a dark Leaflet map with every location as a pin,
  coloured by live predicted occupancy (underused / normal / overcrowded).
  Click a building for a detail sheet; expand to a full-screen view.
- **Entity registry & search** — 7,000 profiles searchable by name, ID, email,
  card, device hash or face ID.
- **Timeline reconstruction** — a chronological, multi-source activity trail for
  any person on any date, with a natural-language summary written by Gemini.
- **Location prediction** — a Random Forest model forecasts a person's next
  likely location from their temporal patterns, with an explanation.
- **Occupancy forecasting** — per-location crowd forecasts for all 16 buildings,
  each classified against its capacity.
- **Intelligent alerts** — Missing Person (activity gaps, excluding sleeping
  hours), Overcrowding, Access Violation and After-Hours Access, ranked by
  severity and enriched with LLM recommendations.
- **Face search** — upload a photo; a 512-D FaceNet embedding is matched against
  the enrolled set via pgvector cosine distance.
- **A.R.I.A chatbot** — a LangGraph agent that answers natural-language
  questions ("find Neha Mehta", "any alerts I should know about?") by calling
  the same APIs.

---

## Architecture

Four services behind a single nginx front door, so the browser talks to one
origin (no CORS) and the whole thing deploys as one image.

```
                         ┌──────────────────────────── nginx :8080 ───────────────────────────┐
   browser ───────────►  │  /                       → Next.js  :3000   (dashboard, map, UI)    │
                         │  /api /users /admin      → Django   :8000   (REST API, ML, alerts)  │
                         │  /identify-and-search/   → FastAPI  :8001   (FaceNet embeddings)    │
                         │  /chat                   → FastAPI  :8090   (LangGraph agent)        │
                         └──────────────────────────────────┬──────────────────────────────────┘
                                                             ▼
                                     PostgreSQL + pgvector (Supabase)   ·   Google Gemini
```

**Stack**

| Layer      | Technology |
|------------|------------|
| Frontend   | Next.js 15 (App Router), React 19, Tailwind CSS v4, Leaflet, Recharts |
| Backend    | Django 5.2, Django REST Framework, SimpleJWT |
| Database   | PostgreSQL with the `pgvector` extension (Supabase) |
| ML         | scikit-learn (Random Forest), pandas, NumPy |
| AI         | Google Gemini (via `google-generativeai` and LangChain), LangGraph agent |
| Face       | FaceNet `InceptionResnetV1` (vggface2), 512-D embeddings |
| Container  | nginx + supervisor, gunicorn, one Docker image |

---

## Running locally

**Prerequisites**

- Python **3.11–3.12** (NumPy 2.3 needs ≥3.11; the pinned `psycopg2-binary` has
  no wheels for 3.13+)
- Node.js 20+
- A PostgreSQL database with the `pgvector` extension (Supabase works and enables
  it with one click)
- A Google Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey))

**1. Backend**

```bash
cd Backend
python -m venv .venv && . .venv/Scripts/activate     # Windows; use bin/activate on macOS/Linux
pip install -r requirements.txt
cp .env.example .env                                  # then fill in DB_* and GEMINI_API_KEY
python manage.py migrate                              # creates tables + the pgvector extension
python manage.py createcachetable                     # database-backed response cache
python manage.py runserver 8000
```

**2. AI services** (face search + chatbot agent)

```bash
cd AI
python -m venv .venv && . .venv/Scripts/activate
pip install -r requirements.txt
cp .env.example .env                                  # GEMINI_API_KEY, AGENT_EMAIL, AGENT_PASSWORD

python face_embedding.py                              # face service on :8001
cd Agent && python server.py                          # chatbot agent on :8090 (or 8080 standalone)
```

**3. Frontend**

```bash
cd frontend
npm install
npm run dev                                           # http://localhost:3000
```

Service URLs default to localhost, so no frontend `.env` is needed for local
dev. To point elsewhere, set `NEXT_PUBLIC_API_BASE`, `NEXT_PUBLIC_AGENT_BASE`
and `NEXT_PUBLIC_FACE_BASE` in `frontend/.env.local`.

### Loading data

The models expect the campus dataset (profiles, events, occupancy, face
embeddings, etc.) in PostgreSQL. Import CSVs with the management commands in
`Backend/api/management/commands/`, e.g.:

```bash
python manage.py import_profiles "path/to/student or staff profiles.csv"
python manage.py import_events   "path/to/events.csv"
python manage.py import_occupancy "path/to/occupancy_data.csv" --clear
python manage.py import_faceembeddings "path/to/face_embeddings.csv"
# ...and import_cardswipes, import_wifi_logs, import_cctvframes,
#    import_notes, import_labbookings, import_librarycheckouts
```

Import **profiles first**, then **events**, then the per-source tables (they
link back to events).

---

## Deployment (Azure Container Apps)

The whole system builds into one public image via GitHub Actions and runs on
Azure Container Apps' free student tier.

1. **Push to `main`** — [`.github/workflows/build-image.yml`](.github/workflows/build-image.yml)
   builds the Dockerfile and publishes `ghcr.io/sanidhya-jindal/campus:latest`.
2. **Make the GHCR package public** so Azure can pull it anonymously.
3. **Create the Container App** (in [Azure Cloud Shell](https://shell.azure.com)):

```bash
az group create --name campus-rg --location centralindia
az containerapp env create --name campus-env --resource-group campus-rg --location centralindia

az containerapp create \
  --name campus --resource-group campus-rg --environment campus-env \
  --image ghcr.io/sanidhya-jindal/campus:latest \
  --target-port 8080 --ingress external \
  --cpu 2 --memory 4Gi --min-replicas 0 --max-replicas 1 \
  --secrets db-pass='...' gemini-key='...' agent-pass='...' \
  --env-vars \
    SECRET_KEY='...' DEBUG=False \
    DB_NAME=postgres DB_USER='...' DB_PASSWORD=secretref:db-pass \
    DB_HOST='...' DB_PORT=5432 \
    GEMINI_API_KEY=secretref:gemini-key GEMINI_MODEL=gemini-flash-lite-latest \
    AGENT_EMAIL='agent@campussentinel.local' AGENT_PASSWORD=secretref:agent-pass \
  --query "properties.configuration.ingress.fqdn" -o tsv
```

Then set `ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` to the FQDN it prints.

**Notes**

- `--min-replicas 0` scales to zero when idle, so it costs almost nothing — at
  the price of a ~2–3 minute cold start on the first hit.
- The expensive alerts and forecast responses are cached in a database-backed
  cache, so they compute once and are then served in well under a second across
  every worker and restart.
- The CPU-only PyTorch wheels are used in the image; the default CUDA build would
  add ~2.5 GB of libraries that are dead weight on CPU nodes.

---

## API reference

**Auth**

```
POST /users/register/        Register a user
POST /users/login/           Log in (returns access + refresh JWT)
POST /users/token/refresh/   Exchange a refresh token for a new access token
GET  /users/me/              Current user
```

**Core**

```
GET  /api/entities/?q=<query>          Search profiles
GET  /api/entities/<id>/               Profile detail (+ last seen)
GET  /api/entities/<id>/timeline/?date=YYYY-MM-DD   Timeline + AI summary
GET  /api/alerts/                      Prioritised alerts (+ AI recommendations)
POST /api/predict/                     Predict next location  {entity_id}
POST /api/forecast/                    Occupancy for one location  {location_id, future_time}
POST /api/forecast-all/                Occupancy for all locations  {future_time}
POST /api/search/face/                 Face match  {embedding: [512 floats]}
```

---

## Locations & capacities

| Location | Capacity | Location | Capacity |
|----------|----------|----------|----------|
| Hostel | 5,000 | Library | 2,150 |
| Seminar Room | 1,800 | Auditorium | 1,360 |
| Cafeteria | 1,360 | Gym | 1,012 |
| Admin Lobby | 710 | Faculty Office | 650 |
| LAB_101 | 40 | LAB | 30 |
| LAB_305 | 30 | Main Building | 30 |
| WORKSHOP | 20 | LAB_A1 | 20 |
| LAB_102 | 15 | LAB_A2 | 12 |

---

## Repository layout

```
Backend/    Django REST API, ML models, alert engine, CSV import commands
AI/         FastAPI face-embedding service + LangGraph chatbot agent
frontend/   Next.js dashboard, campus map, entity views
docker/     nginx, supervisor and startup config for the combined image
Dockerfile  Multi-stage build for the single deployable image
```

Each module has its own `README.md` with more detail.
