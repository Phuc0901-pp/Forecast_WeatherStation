package model

// ForecastResponse represents the top-level forecast response payload from Axisstream Jane's Weather integration.
type ForecastResponse struct {
	Location   string       `json:"location"`
	UpdateTime string       `json:"updateTime"`
	RecentData RecentData   `json:"recentData"`
	HourlyData []HourlyData `json:"hourlyData"`
	DailyData  []DailyData  `json:"dailyData"`
}

// RecentData represents the current/recent weather conditions returned in the forecast.
type RecentData struct {
	Time                string  `json:"time"`
	Temperature         string  `json:"temperature"`
	WeatherSummary      string  `json:"weatherSummary"`
	Pressure            string  `json:"pressure"`
	TotalPrecipitation  string  `json:"totalPrecipitation"`
	Rainfall            string  `json:"rainfall"`
	RainfallProbability string  `json:"rainfallProbability"`
	RainfallConfidence  string  `json:"rainfallConfidence"`
	WindSpeed           string  `json:"windSpeed"`
	Humidity            string  `json:"humidity"`
	WindDirectionCompass string  `json:"windDirectionCompass"`
	WindDirectionAngle  float64 `json:"windDirectionAngle"`
	UVIndex             string  `json:"uvIndex"`
	UVLevel             string  `json:"uvLevel"`
	WeatherIcon         string  `json:"weatherIcon"`
	WeatherIconPrecis   string  `json:"weatherIconPrecis"`
	DewPoint            string  `json:"dewPoint"`
	DeltaT              string  `json:"deltaT"`
	FogProbability      string  `json:"fogProbability"`
	SoilTemp            string  `json:"soil_temp"`
	SprayRating         string  `json:"sprayRating"`
	TempMax             string  `json:"temp_max"`
	TempMin             string  `json:"temp_min"`
}

// HourlyData represents a single hour's prediction data.
type HourlyData struct {
	Time                 string  `json:"time"`
	Temperature          string  `json:"temperature"`
	Pressure             string  `json:"pressure"`
	Rainfall             string  `json:"rainfall"`
	RainfallProbability  string  `json:"rainfallPropability"` // Spelled "rainfallPropability" in the hourly API JSON payload
	RainfallConfidence   string  `json:"rainfallConfidence"`
	WindSpeed            string  `json:"windSpeed"`
	Humidity             string  `json:"humidity"`
	WindDirectionCompass string  `json:"windDirectionCompass"`
	WindDirectionAngle   float64 `json:"windDirectionAngle"`
	UVIndex              string  `json:"uvIndex"`
	UVLevel              string  `json:"uvLevel"`
	DewPoint             string  `json:"dewPoint"`
	DeltaT               string  `json:"deltaT"`
	TCC                  string  `json:"tcc"`
	WeatherIcon          string  `json:"weatherIcon"`
	WeatherIconPrecis    string  `json:"weatherIconPrecis"`
	SprayRating          string  `json:"sprayRating"`
	TempSprayRating      string  `json:"tempSprayRating"`
	WindSprayRating      string  `json:"windSprayRating"`
	TccSprayRating       string  `json:"tccSprayRating"`
	DeltaTSprayRating    string  `json:"deltaTSprayRating"`
}

// DailyData represents a single day's summary prediction.
type DailyData struct {
	Time           string       `json:"time"`
	WeatherSummary string       `json:"weatherSummary"`
	TemperatureMax string       `json:"temperatureMax"`
	TemperatureMin string       `json:"temperatureMin"`
	DayIcon        string       `json:"dayIcon"`
	DayIconPrecis  string       `json:"dayIconPrecis"`
	NightIcon      string       `json:"nightIcon"`
	NightIconPrecis string       `json:"nightIconPrecis"`
	HourlyData     []HourlyData `json:"hourlyData"`
}
