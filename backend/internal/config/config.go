package config

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"time"
	_ "time/tzdata" // ฝัง timezone database ไว้ในไบนารี (ไม่ต้องพึ่ง OS)
)

type Config struct {
	Port           string
	DatabaseURL    string
	JWTSecret      string
	JWTTTL         time.Duration
	AllowedOrigins []string
	AdminEmail     string
	AdminPassword  string
	AdminName      string
	StaticDir      string
	SimpleProtocol bool
	TrustProxy     bool
	Location       *time.Location
}

// Load อ่านค่าจาก Environment Variables (และไฟล์ .env ถ้ามี)
func Load() (*Config, error) {
	loadDotEnv(".env")

	tzName := getenv("SHOP_TIMEZONE", "Asia/Bangkok")
	loc, err := time.LoadLocation(tzName)
	if err != nil {
		return nil, fmt.Errorf("SHOP_TIMEZONE ไม่ถูกต้อง: %w", err)
	}

	ttl, err := time.ParseDuration(getenv("JWT_TTL", "12h"))
	if err != nil {
		return nil, fmt.Errorf("JWT_TTL ไม่ถูกต้อง: %w", err)
	}

	cfg := &Config{
		Port:           getenv("PORT", "8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		JWTSecret:      os.Getenv("JWT_SECRET"),
		JWTTTL:         ttl,
		AdminEmail:     strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL"))),
		AdminPassword:  os.Getenv("ADMIN_PASSWORD"),
		AdminName:      getenv("ADMIN_NAME", "เจ้าของร้าน"),
		StaticDir:      os.Getenv("STATIC_DIR"),
		SimpleProtocol: os.Getenv("DB_SIMPLE_PROTOCOL") == "true",
		TrustProxy:     os.Getenv("TRUST_PROXY") == "true",
		Location:       loc,
	}
	for _, o := range strings.Split(getenv("ALLOWED_ORIGINS", "http://localhost:5173"), ",") {
		if o = strings.TrimSpace(o); o != "" {
			cfg.AllowedOrigins = append(cfg.AllowedOrigins, o)
		}
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("ต้องกำหนด DATABASE_URL (connection string ของ Supabase)")
	}
	if len(cfg.JWTSecret) < 32 {
		return nil, fmt.Errorf("JWT_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร")
	}
	return cfg, nil
}

func getenv(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

// loadDotEnv โหลด KEY=VALUE จากไฟล์ .env โดยไม่ทับค่าที่ตั้งไว้แล้วใน environment
func loadDotEnv(path string) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		k, v, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		k = strings.TrimSpace(k)
		v = strings.Trim(strings.TrimSpace(v), `"'`)
		if _, exists := os.LookupEnv(k); !exists {
			os.Setenv(k, v)
		}
	}
}
