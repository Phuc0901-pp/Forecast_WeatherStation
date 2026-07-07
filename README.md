# Jane's Weather Forecast Dashboard (03_JaneWeather)

This project connects to the Axisstream Jane's Weather API, retrieves 6-day weather forecasts periodically, normalizes and stores the historical predictions in Supabase, and visualizes them using a premium ReactJS + Framer Motion dashboard.

## Project Structure

```
03_JaneWeather/
├── backend/                   # Go Backend Collector Daemon
│   ├── cmd/
│   │   └── collector/
│   │       └── main.go        # Entry point containing daemon loop and CLI flags
│   ├── internal/
│   │   ├── client/
│   │   │   ├── client.go      # HTTP client utilizing Chrome headers & token caching
│   │   │   └── jwt.go         # Parses base64 JWT locally to check expiration
│   │   ├── config/
│   │   │   └── config.go      # Parses .env file to load variables
│   │   ├── db/
│   │   │   └── db.go          # Supabase client with numeric string parsers & transactions
│   │   └── model/
│   │       └── model.go       # Go models mapping to Jane's Weather API
│   ├── .env                   # [Git Ignored] Local API and DB credentials
│   ├── go.mod                 # Go module descriptor
│   └── go.sum                 # Go dependency checksums
└── frontend/                  # ReactJS Frontend (Vite)
    ├── src/
    │   ├── App.jsx            # React Dashboard visualizer (fetches data from Supabase)
    │   ├── index.css          # Vanilla CSS design system (Obsidian glassmorphic theme)
    │   ├── main.jsx           # Mounting wrapper
    │   └── supabaseClient.js  # Supabase public connection configurations
    ├── index.html             # HTML layout template
    ├── package.json           # npm configuration
    └── vite.config.js         # Vite configurations
```

---

## 1. Supabase Database Schema

The database tables are hosted on **AWS Sydney (ap-southeast-2)** and have already been initialized with the following structure:

- **`weather_forecast_run`**: Logs the details of each forecast fetch (`location`, `update_time`, `created_at`).
- **`hourly_forecast`**: Stores hour-by-hour predictions. constrained by `(update_time, prediction_time)` to track forecast shifts over time.
- **`daily_forecast`**: Stores 6-day daily summaries. constrained by `(update_time, prediction_date)`.

---

## 2. Running the Backend Collector (Go)

The Go backend handles automatic retrieval and normalization. Open a terminal in `03_JaneWeather/backend`:

### Configure Credentials
Make sure the `backend/.env` file contains your credentials:
```env
AXISTREAM_EMAIL=huynh@tanbaocorp.vn
AXISTREAM_PASSWORD=Tanbao@123
AXISTREAM_PROJECT_ID=1b73e2fe-1e6c-46c6-8534-82c0e03be283
AXISTREAM_PROVIDER_ID=2db91bf4-4f68-4d23-bad4-6687f8e1975e
SUPABASE_DB_URL=postgresql://postgres.rtemlpaeyjpbktpqqtwv:0908904895Phuc@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?sslmode=require
```

### Run One-shot Sync (Runs once and exits)
```bash
go run ./cmd/collector
```

### Run in Daemon Mode (Runs continuously in the background)
Runs every 1 hour by default (recommended):
```bash
go run ./cmd/collector -daemon
```

To customize the interval (e.g., sync every 30 minutes):
```bash
go run ./cmd/collector -daemon -interval 30m
```

---

## 3. Running the Frontend (ReactJS)

The React client communicates directly with Supabase via HTTPS using the publishable public key. Open a terminal in `03_JaneWeather/frontend`:

### Start Development Server
```bash
npm run dev
```

### Compile Production Build
```bash
npm run build
```

---

## 4. Key Implementation Highlights

- **Stealth Requesting (Bot Evasion)**: Configured with standard desktop Windows Chrome headers and automated session token recycling to prevent triggering Cloudflare/WAF rate blocks.
- **Data Normalization & Cleaning**: Raw strings like `"27°"`, `"71 %"`, and `"0.33 mm"` are cleaned into float/int numeric datatypes on database entry. This allows math operations, averages, and chart plotting to work natively.
- **Model Shift Tracking**: Because we keep all hourly forecast history, the **"Historical Accuracy Analysis"** tab in the UI plots a multi-line comparison of temperature forecast curves from the last 3 sync runs. This visually demonstrates how the climate model adjusts its predictions as the target hour approaches.
