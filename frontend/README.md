# Frontend

React and TypeScript interface for exploring sensor observations and managing machine records. The frontend can be started and developed independently of the backend, but API-driven features need a reachable FastAPI service.

## Sensor Data Explorer

The main page lets you choose a monitoring device, load its parameters, set a start and end date/time, and retrieve matching observations from FastAPI. Parameter names identify observations within the selected device. Numeric parameters show optional inclusive minimum and maximum fields; switching to a text parameter clears and hides those filters. Results retain the API observation shape and all pages are fetched in batches of up to 1,000 rows so the data is ready for visualization components.

Date/time inputs use the browser's local timezone. Requests send ISO timestamps with a timezone offset (converted to UTC). The default range is January 1–2, 2025, matching the simulated demonstration data; it does not represent live collection times. Set `VITE_API_BASE_URL` as described below to configure the backend origin.

The project currently has no frontend test runner. Run `npm run build` and `npm run lint` from this directory to check the frontend.

## Requirements

- Node.js 22 or later
- npm
- A reachable Machine Records API for listing and managing records

## Install and configure

From the frontend directory:

```sh
cd frontend
npm ci
cp .env.example .env.local
```

The provided `frontend/.env.example` sets `VITE_API_BASE_URL=http://localhost:8000`. Change that value if your backend listens elsewhere. This variable is included in the browser build, so use a public API URL and never put secrets in it.

When using the frontend with the backend started directly on the host, make sure the backend `CORS_ORIGINS` includes `http://localhost:5173` and `http://127.0.0.1:5173`. If you want to use Vite's `/api` proxy instead, leave `VITE_API_BASE_URL` empty; the checked-in proxy target `backend:8000` is the Docker Compose service name and is not resolvable from a host-run Vite process.

## Start the development server

```sh
npm run dev
```

Open <http://localhost:5173>. Vite serves the React app with hot reload. If the backend is unavailable, the page can render but record and health requests will show an API error until a service is reachable.

To use the integrated stack, run `make up` from the repository root instead. Compose starts PostgreSQL, applies migrations through the backend startup command, and starts both frontend and backend services.

## Frontend commands

Run these from `frontend/`:

```sh
npm run build       # TypeScript check and production bundle
npm run lint        # ESLint
npm run preview     # Serve the production bundle locally after npm run build
```

There is currently no automated frontend interaction test runner configured. CRUD and validation interactions should be checked in the browser against a running backend.

## Troubleshooting

- **The app loads but records do not:** check that the FastAPI service is running at `VITE_API_BASE_URL` and that the URL is reachable from the browser.
- **CORS error in browser developer tools:** add the exact page origin, usually `http://localhost:5173`, to backend `CORS_ORIGINS` and restart the API.
- **Requests go to `backend:8000` on the host:** set `VITE_API_BASE_URL=http://localhost:8000` in `.env.local`; `backend` is only resolvable on the Compose network.
- **Port 5173 is busy:** run `npm run dev -- --port 5174` and allow `http://localhost:5174` in backend `CORS_ORIGINS`.
- **Environment changes have no effect:** restart Vite after changing `.env.local`.

For the integrated application setup and API details, see the root [README](../README.md) and [backend README](../backend/README.md).
