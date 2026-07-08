package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/tanbaocorp/janeweather/backend/internal/client"
	"github.com/tanbaocorp/janeweather/backend/internal/config"
	"github.com/tanbaocorp/janeweather/backend/internal/db"
)

func main() {
	log.Println("Starting Jane's Weather Forecast Collector Service...")

	// 1. Parse Command-line Flags
	daemonMode := flag.Bool("daemon", false, "Run in daemon mode to pull data periodically")
	syncInterval := flag.Duration("interval", 1*time.Hour, "Interval between syncs in daemon mode (e.g. 1h, 30m)")
	flag.Parse()

	// 2. Load Configurations
	cfg, err := config.LoadConfig()
	if err != nil {
		log.Fatalf("CRITICAL: Failed to load configuration: %v", err)
	}

	// 3. Initialize Database Client (Supabase)
	dbClient, err := db.NewDBClient(cfg.DBURL)
	if err != nil {
		log.Fatalf("CRITICAL: Failed to connect to Supabase: %v", err)
	}
	defer dbClient.Close()
	log.Println("Database connection to Supabase established successfully.")

	// 4. Initialize API Client
	apiClient := client.NewAPIClient()

	// 5. Load Cached Token
	cachedToken, err := client.LoadCachedToken()
	if err == nil && cachedToken != "" {
		log.Println("Loaded cached Axistream token.")
		apiClient.Token = cachedToken
	}

	// 6. Expose Web Server (To serve UI and handle Render health checks)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Serve built React static files
	fs := http.FileServer(http.Dir("./frontend/dist"))
	http.Handle("/", fs)

	log.Printf("Web server listening on port %s...\n", port)
	go func() {
		if err := http.ListenAndServe(":"+port, nil); err != nil {
			log.Printf("Web server stopped: %v\n", err)
		}
	}()

	// 7. Initialize Self-Pinger (Wakes up Render free tier instances before spin-down)
	selfPingURL := os.Getenv("SELF_PING_URL")
	if selfPingURL != "" {
		log.Printf("Self-pinger initialized. Target: %s\n", selfPingURL)
		go func() {
			// Sleep 1 minute before starting the self-ping loop
			time.Sleep(1 * time.Minute)
			ticker := time.NewTicker(10 * time.Minute)
			for range ticker.C {
				log.Printf("Sending self-ping to stay awake at: %s\n", selfPingURL)
				resp, err := http.Get(selfPingURL)
				if err != nil {
					log.Printf("Self-ping failed: %v\n", err)
				} else {
					resp.Body.Close()
					log.Printf("Self-ping response status: %s\n", resp.Status)
				}
			}
		}()
	}

	// 8. Run Sync Cycle
	if *daemonMode {
		log.Printf("Daemon mode active. Sync interval set to: %v\n", *syncInterval)
		
		// Run first sync immediately
		runSync(apiClient, dbClient, cfg)

		ticker := time.NewTicker(*syncInterval)
		defer ticker.Stop()

		for range ticker.C {
			log.Println("Scheduled tick triggered...")
			runSync(apiClient, dbClient, cfg)
		}
	} else {
		log.Println("One-shot mode active. Running single sync cycle...")
		runSync(apiClient, dbClient, cfg)
		log.Println("Collector execution completed.")
	}
}

// runSync performs a single cycle of fetching and storing forecast data.
func runSync(apiClient *client.APIClient, dbClient *db.DBClient, cfg *config.Config) {
	log.Println("Initiating weather forecast sync cycle...")

	// Validate token health
	if client.IsTokenExpired(apiClient.Token) {
		log.Println("Token is empty or expired. Authenticating...")
		newToken, err := apiClient.Login(cfg.Email, cfg.Password)
		if err != nil {
			log.Printf("ERROR: Failed to authenticate: %v\n", err)
			return
		}
		log.Println("Authentication successful. Session token saved.")
		_ = client.SaveTokenCache(newToken)
	}

	// Fetch Jane's Weather Forecast
	log.Printf("Fetching forecast for Project: %s, Provider: %s\n", cfg.ProjectID, cfg.ProviderID)
	forecast, err := apiClient.FetchForecast(cfg.ProjectID, cfg.ProviderID)
	if err != nil {
		log.Printf("ERROR: Failed to fetch forecast: %v\n", err)
		return
	}

	log.Printf("Success! Retrieved forecast updateTime: %s for Location: %s\n", forecast.UpdateTime, forecast.Location)
	
	// Override the updateTime with the current local time of the collector run
	// to ensure a strict 1-hour resolution history record without ON CONFLICT DO NOTHING dropouts.
	forecast.UpdateTime = time.Now().Truncate(time.Minute).Format(time.RFC3339)

	log.Printf("Parsing and saving forecast data to Supabase (Hourly: %d records, Daily: %d records)...\n", len(forecast.HourlyData), len(forecast.DailyData))

	// Save to Supabase
	if err := dbClient.SaveForecast(forecast); err != nil {
		log.Printf("ERROR: Failed to save forecast to database: %v\n", err)
		return
	}

	log.Println("Forecast sync cycle completed successfully.")
}
