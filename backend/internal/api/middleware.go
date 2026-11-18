package api

import (
	"log/slog"
	"net"
	"net/http"
	"runtime/debug"
	"strings"
	"sync"
	"time"

	"github.com/thaithai/massage-booking/internal/httpx"
)

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

// Unwrap ให้ http.ResponseController เข้าถึง Flusher ของ writer จริงได้ (จำเป็นสำหรับ SSE)
func (w *statusWriter) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		sw := &statusWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(sw, r)
		if strings.HasPrefix(r.URL.Path, "/api/") {
			slog.Info("http", "method", r.Method, "path", r.URL.Path, "status", sw.status, "ms", time.Since(start).Milliseconds())
		}
	})
}

func recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				slog.Error("panic", "err", rec, "stack", string(debug.Stack()))
				httpx.Fail(w, r, httpx.NewError(500, "INTERNAL_ERROR", "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง"))
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("X-Frame-Options", "DENY")
		h.Set("Referrer-Policy", "strict-origin-when-cross-origin")
		next.ServeHTTP(w, r)
	})
}

func cors(allowed []string) func(http.Handler) http.Handler {
	allowAll := false
	set := map[string]bool{}
	for _, o := range allowed {
		if o == "*" {
			allowAll = true
		}
		set[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && (allowAll || set[origin]) {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Vary", "Origin")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
				w.Header().Set("Access-Control-Max-Age", "600")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// rateLimiter จำกัดจำนวนคำขอต่อ IP ในช่วงเวลา (fixed window, เก็บในหน่วยความจำ)
type rateLimiter struct {
	mu         sync.Mutex
	hits       map[string]*window
	limit      int
	per        time.Duration
	trustProxy bool
}

type window struct {
	count int
	reset time.Time
}

func newRateLimiter(limit int, per time.Duration, trustProxy bool) *rateLimiter {
	rl := &rateLimiter{hits: map[string]*window{}, limit: limit, per: per, trustProxy: trustProxy}
	go func() {
		for range time.Tick(time.Minute) {
			rl.mu.Lock()
			now := time.Now()
			for k, v := range rl.hits {
				if now.After(v.reset) {
					delete(rl.hits, k)
				}
			}
			rl.mu.Unlock()
		}
	}()
	return rl
}

func clientIP(r *http.Request, trustProxy bool) string {
	if trustProxy {
		if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
			return strings.TrimSpace(strings.Split(xff, ",")[0])
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (rl *rateLimiter) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientIP(r, rl.trustProxy)
		rl.mu.Lock()
		win, ok := rl.hits[key]
		now := time.Now()
		if !ok || now.After(win.reset) {
			win = &window{reset: now.Add(rl.per)}
			rl.hits[key] = win
		}
		win.count++
		over := win.count > rl.limit
		rl.mu.Unlock()
		if over {
			httpx.Fail(w, r, httpx.NewError(http.StatusTooManyRequests, "RATE_LIMITED", "มีการส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่"))
			return
		}
		next.ServeHTTP(w, r)
	})
}
