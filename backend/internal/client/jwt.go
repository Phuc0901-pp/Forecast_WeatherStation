package client

import (
	"encoding/base64"
	"encoding/json"
	"strings"
	"time"
)

// JWTPayload represents the decoded structure of the JWT payload we care about.
type JWTPayload struct {
	Exp int64 `json:"exp"`
}

// IsTokenExpired parses the token's payload locally and checks if it has expired
// or is close to expiring (within a 1-minute buffer window).
func IsTokenExpired(tokenString string) bool {
	if tokenString == "" {
		return true
	}

	parts := strings.Split(tokenString, ".")
	if len(parts) < 2 {
		return true
	}

	payloadSegment := parts[1]

	// Add base64 padding if necessary
	if len(payloadSegment)%4 != 0 {
		payloadSegment += strings.Repeat("=", 4-(len(payloadSegment)%4))
	}

	// Try URL decoding first, fallback to standard decoding
	bytes, err := base64.URLEncoding.DecodeString(payloadSegment)
	if err != nil {
		bytes, err = base64.StdEncoding.DecodeString(payloadSegment)
		if err != nil {
			return true
		}
	}

	var payload JWTPayload
	if err := json.Unmarshal(bytes, &payload); err != nil {
		return true
	}

	// Consider the token expired if it expires in the next 60 seconds (buffer)
	return time.Now().Unix() >= (payload.Exp - 60)
}
