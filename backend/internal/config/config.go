package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

// Config holds all service configurations loaded from the environment/.env.
type Config struct {
	Email      string
	Password   string
	ProjectID  string
	ProviderID string
	DBURL      string
}

// LoadConfig loads variables from .env and maps them to Config.
func LoadConfig() (*Config, error) {
	_ = loadEnvFile(".env")

	email := os.Getenv("AXISTREAM_EMAIL")
	password := os.Getenv("AXISTREAM_PASSWORD")
	projectID := os.Getenv("AXISTREAM_PROJECT_ID")
	providerID := os.Getenv("AXISTREAM_PROVIDER_ID")
	dbURL := os.Getenv("SUPABASE_DB_URL")

	if email == "" || password == "" {
		return nil, fmt.Errorf("missing AXISTREAM_EMAIL or AXISTREAM_PASSWORD in environment")
	}
	if projectID == "" || providerID == "" {
		return nil, fmt.Errorf("missing AXISTREAM_PROJECT_ID or AXISTREAM_PROVIDER_ID in environment")
	}
	if dbURL == "" {
		return nil, fmt.Errorf("missing SUPABASE_DB_URL in environment")
	}

	return &Config{
		Email:      email,
		Password:   password,
		ProjectID:  projectID,
		ProviderID: providerID,
		DBURL:      dbURL,
	}, nil
}

// loadEnvFile reads a file line by line and sets environment variables for Go process.
func loadEnvFile(filename string) error {
	file, err := os.Open(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)

		// Skip comments and empty lines
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		val := strings.TrimSpace(parts[1])

		// Strip quotes if they surround the value
		if len(val) >= 2 {
			if (strings.HasPrefix(val, "\"") && strings.HasSuffix(val, "\"")) ||
				(strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) {
				val = val[1 : len(val)-1]
			}
		}

		_ = os.Setenv(key, val)
	}

	return scanner.Err()
}
