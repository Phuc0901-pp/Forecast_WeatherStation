package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/tanbaocorp/janeweather/backend/internal/model"
)

// APIClient encapsulates HTTP requests to the Axisstream services.
type APIClient struct {
	httpClient  *http.Client
	authURL     string
	providerURL string
	Token       string
}

// NewAPIClient creates a new API client instance.
func NewAPIClient() *APIClient {
	return &APIClient{
		httpClient:  &http.Client{Timeout: 30 * time.Second},
		authURL:     "https://v2.api.axisstream.co",
		providerURL: "https://provider.api.axisstream.co",
	}
}

// Login authenticates against the Axisstream identity portal and sets the token.
func (c *APIClient) Login(email, password string) (string, error) {
	loginURL := fmt.Sprintf("%s/api/account/login", c.authURL)
	payload := map[string]interface{}{
		"email":      email,
		"password":   password,
		"rememberMe": false,
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal login body: %w", err)
	}

	req, err := http.NewRequest("POST", loginURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create login request: %w", err)
	}

	c.setEvasionHeaders(req)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("login network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("login failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var resData struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&resData); err != nil {
		return "", fmt.Errorf("failed to decode login response: %w", err)
	}

	if resData.Token == "" {
		return "", fmt.Errorf("login response did not contain a token")
	}

	c.Token = resData.Token
	return resData.Token, nil
}

// FetchForecast retrieves weather forecast data from Janes Weather integration.
func (c *APIClient) FetchForecast(projectID, providerID string) (*model.ForecastResponse, error) {
	forecastURL := fmt.Sprintf("%s/janes_weather/forecast/project/%s/provider/%s", c.providerURL, projectID, providerID)

	req, err := http.NewRequest("GET", forecastURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create forecast request: %w", err)
	}

	c.setEvasionHeaders(req)
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.Token))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("forecast request network error: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("forecast retrieval failed (status %d): %s", resp.StatusCode, string(respBody))
	}

	var forecastData model.ForecastResponse
	if err := json.NewDecoder(resp.Body).Decode(&forecastData); err != nil {
		return nil, fmt.Errorf("failed to decode forecast payload: %w", err)
	}

	return &forecastData, nil
}

// setEvasionHeaders mimics modern Windows Google Chrome navigation headers.
func (c *APIClient) setEvasionHeaders(req *http.Request) {
	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept-Language", "vi,en-US;q=0.9,en;q=0.8")
	req.Header.Set("Sec-Ch-Ua", `"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	req.Header.Set("Sec-Fetch-Dest", "empty")
	req.Header.Set("Sec-Fetch-Mode", "cors")
	req.Header.Set("Sec-Fetch-Site", "same-site")
}

// Token Cache Management helper functions
func GetTokenCachePath() string {
	// Create configs directory in current folder
	_ = os.MkdirAll("configs", 0755)
	return filepath.Join("configs", "token.json")
}

func LoadCachedToken() (string, error) {
	path := GetTokenCachePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}

	var cache struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(data, &cache); err != nil {
		return "", err
	}
	return cache.Token, nil
}

func SaveTokenCache(token string) error {
	path := GetTokenCachePath()
	cache := struct {
		Token string `json:"token"`
	}{Token: token}

	bytes, err := json.MarshalIndent(cache, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, bytes, 0644)
}
