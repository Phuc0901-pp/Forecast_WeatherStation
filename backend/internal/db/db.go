package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/tanbaocorp/janeweather/backend/internal/model"
)

// DBClient wraps the database connection pool.
type DBClient struct {
	db *sql.DB
}

// NewDBClient initializes a connection pool to the Supabase database.
func NewDBClient(dbURL string) (*DBClient, error) {
	connConfig, err := pgx.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Disable prepared statement cache for compatibility with PgBouncer/Supabase pooler
	connConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol

	db := stdlib.OpenDB(*connConfig)

	// Set connection limits
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(5 * time.Minute)

	// Ping to verify connectivity
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DBClient{db: db}, nil
}

// Close closes the database connection.
func (dbc *DBClient) Close() error {
	return dbc.db.Close()
}

var cleanRegex = regexp.MustCompile(`[^\d\.\-]`)

// parseNumeric extracts a clean float64 from strings containing units (e.g. "27°", "71 %", "0.33 mm", "13 km/h").
func parseNumeric(s string) *float64 {
	s = strings.TrimSpace(s)
	if s == "" || strings.ToUpper(s) == "N/A" {
		return nil
	}

	// Remove units and special characters
	cleaned := cleanRegex.ReplaceAllString(s, "")
	if cleaned == "" {
		return nil
	}

	val, err := strconv.ParseFloat(cleaned, 64)
	if err != nil {
		return nil
	}
	return &val
}

// SaveForecast saves a complete Jane's Weather forecast run (run, hourly, daily records) inside a SQL transaction.
func (dbc *DBClient) SaveForecast(forecast *model.ForecastResponse) error {
	ctx := context.Background()
	tx, err := dbc.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// 1. Insert forecast run details
	runQuery := `
		INSERT INTO weather_forecast_run (location, update_time)
		VALUES ($1, $2)
		ON CONFLICT (update_time) DO NOTHING;
	`
	_, err = tx.ExecContext(ctx, runQuery, forecast.Location, forecast.UpdateTime)
	if err != nil {
		return fmt.Errorf("failed to insert forecast run: %w", err)
	}

	// 2. Collect all hourly data (both top-level and nested within dailyData)
	allHourly := make(map[string]model.HourlyData)

	// Add top-level hourly data (usually containing remaining hours of today)
	for _, h := range forecast.HourlyData {
		allHourly[h.Time] = h
	}

	// Add nested hourly data (containing full 24-hour predictions for all days)
	for _, d := range forecast.DailyData {
		for _, h := range d.HourlyData {
			allHourly[h.Time] = h
		}
	}

	// 3. Insert hourly forecasts
	hourlyQuery := `
		INSERT INTO hourly_forecast (
			update_time, prediction_time, temperature, weather_summary, pressure,
			rainfall, rainfall_probability, rainfall_confidence, wind_speed, humidity,
			wind_direction_compass, wind_direction_angle, uv_index, uv_level, dew_point,
			delta_t, tcc, weather_icon, weather_icon_precis, spray_rating,
			temp_spray_rating, wind_spray_rating, tcc_spray_rating, delta_t_spray_rating,
			raw_data
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
		) ON CONFLICT (update_time, prediction_time) DO NOTHING;
	`

	for _, h := range allHourly {
		rawBytes, _ := json.Marshal(h)
		_, err = tx.ExecContext(
			ctx,
			hourlyQuery,
			forecast.UpdateTime,
			h.Time,
			parseNumeric(h.Temperature),
			h.WeatherIconPrecis, // weather_summary
			parseNumeric(h.Pressure),
			parseNumeric(h.Rainfall),
			parseNumeric(h.RainfallProbability),
			h.RainfallConfidence,
			parseNumeric(h.WindSpeed),
			parseNumeric(h.Humidity),
			h.WindDirectionCompass,
			h.WindDirectionAngle,
			parseNumeric(h.UVIndex),
			h.UVLevel,
			parseNumeric(h.DewPoint),
			parseNumeric(h.DeltaT),
			parseNumeric(h.TCC),
			h.WeatherIcon,
			h.WeatherIconPrecis,
			h.SprayRating,
			h.TempSprayRating,
			h.WindSprayRating,
			h.TccSprayRating,
			h.DeltaTSprayRating,
			string(rawBytes),
		)
		if err != nil {
			return fmt.Errorf("failed to insert hourly forecast for %s: %w", h.Time, err)
		}
	}

	// 4. Insert daily forecasts
	dailyQuery := `
		INSERT INTO daily_forecast (
			update_time, prediction_date, weather_summary, temperature_max, temperature_min,
			day_icon, day_icon_precis, night_icon, night_icon_precis, raw_data
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10
		) ON CONFLICT (update_time, prediction_date) DO NOTHING;
	`

	for _, d := range forecast.DailyData {
		rawBytes, _ := json.Marshal(d)

		// Parse the prediction date (which is "YYYY-MM-DD")
		parsedDate, err := time.Parse("2006-01-02", d.Time)
		if err != nil {
			log.Printf("Warning: Failed to parse date string %s: %v", d.Time, err)
			continue
		}

		_, err = tx.ExecContext(
			ctx,
			dailyQuery,
			forecast.UpdateTime,
			parsedDate,
			d.WeatherSummary,
			parseNumeric(d.TemperatureMax),
			parseNumeric(d.TemperatureMin),
			d.DayIcon,
			d.DayIconPrecis,
			d.NightIcon,
			d.NightIconPrecis,
			string(rawBytes),
		)
		if err != nil {
			return fmt.Errorf("failed to insert daily forecast for %s: %w", d.Time, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}
