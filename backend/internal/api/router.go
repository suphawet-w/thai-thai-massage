package api

import (
	"crypto/subtle"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/thaithai/massage-booking/internal/app"
	"github.com/thaithai/massage-booking/internal/auth"
	"github.com/thaithai/massage-booking/internal/config"
	"github.com/thaithai/massage-booking/internal/httpx"
)

type API struct {
	store  *app.Store
	auth   *auth.Service
	cfg    *config.Config
	botKey string
}

func New(store *app.Store, authSvc *auth.Service, cfg *config.Config) *API {
	return &API{store: store, auth: authSvc, cfg: cfg, botKey: os.Getenv("BOT_API_KEY")}
}

type H = httpx.Handler

// botGuard: ถ้าตั้ง BOT_API_KEY ไว้ การจองที่ระบุ source=botnoi ต้องแนบ header X-API-Key ให้ถูกต้อง
func (a *API) botGuard(next H) H {
	return func(w http.ResponseWriter, r *http.Request) error {
		if a.botKey != "" {
			if k := r.Header.Get("X-API-Key"); k != "" && subtle.ConstantTimeCompare([]byte(k), []byte(a.botKey)) != 1 {
				return httpx.NewError(http.StatusUnauthorized, "INVALID_API_KEY", "API key ไม่ถูกต้อง")
			}
		}
		return next(w, r)
	}
}

func (a *API) Routes() http.Handler {
	mux := http.NewServeMux()
	bookingLimit := newRateLimiter(30, time.Minute, a.cfg.TrustProxy)
	cancelLimit := newRateLimiter(20, time.Minute, a.cfg.TrustProxy)
	loginLimit := newRateLimiter(10, 5*time.Minute, a.cfg.TrustProxy)
	lookupLimit := newRateLimiter(60, time.Minute, a.cfg.TrustProxy)

	// ---------- Public API (เว็บไซต์ลูกค้า + Botnoi Voice / AI Chatbot) ----------
	mux.Handle("GET /api/health", H(func(w http.ResponseWriter, r *http.Request) error {
		if err := a.store.Pool().Ping(r.Context()); err != nil {
			return httpx.NewError(503, "DB_UNAVAILABLE", "ฐานข้อมูลไม่พร้อมใช้งาน")
		}
		httpx.OK(w, map[string]any{"status": "ok", "time": a.store.Now()}, "")
		return nil
	}))
	mux.Handle("GET /api/shop-info", H(a.shopInfo))
	mux.Handle("GET /api/services", H(a.listServices))
	mux.Handle("GET /api/availability", H(a.availability))
	mux.Handle("POST /api/bookings", bookingLimit.wrap(H(a.botGuard(a.createBooking))))
	mux.Handle("GET /api/bookings/{id}", lookupLimit.wrap(H(a.getBooking)))
	mux.Handle("PATCH /api/bookings/{id}/cancel", cancelLimit.wrap(H(a.cancelBooking)))
	mux.Handle("GET /api/queue/status", lookupLimit.wrap(H(a.queueStatus)))

	// ---------- Admin API ----------
	mux.Handle("POST /api/admin/login", loginLimit.wrap(H(a.login)))

	adm := http.NewServeMux()
	adm.Handle("GET /api/admin/me", H(a.me))
	adm.Handle("POST /api/admin/me/password", H(a.changePassword))
	adm.Handle("GET /api/admin/users", H(ownerOnly(a.listUsers)))
	adm.Handle("POST /api/admin/users", H(ownerOnly(a.createUser)))
	adm.Handle("PATCH /api/admin/users/{id}", H(ownerOnly(a.setUserActive)))

	adm.Handle("GET /api/admin/dashboard", H(a.dashboard))
	adm.Handle("GET /api/admin/bookings", H(a.adminListBookings))
	adm.Handle("POST /api/admin/bookings", H(a.adminCreateBooking))
	adm.Handle("GET /api/admin/bookings/{id}", H(a.adminGetBooking))
	adm.Handle("GET /api/admin/bookings/{id}/availability", H(a.adminBookingAvailability))
	adm.Handle("PATCH /api/admin/bookings/{id}/status", H(a.adminUpdateStatus))
	adm.Handle("PATCH /api/admin/bookings/{id}/reschedule", H(a.adminReschedule))
	adm.Handle("PATCH /api/admin/bookings/{id}/therapist", H(a.adminAssignTherapist))

	adm.Handle("GET /api/admin/queue", H(a.adminQueue))
	adm.Handle("POST /api/admin/queue/call-next", H(a.adminCallNext))
	adm.Handle("POST /api/admin/queue/{id}/call", H(a.adminCallBooking))

	adm.Handle("GET /api/admin/services", H(a.adminListServices))
	adm.Handle("POST /api/admin/services", H(a.adminCreateService))
	adm.Handle("PUT /api/admin/services/{id}", H(a.adminUpdateService))
	adm.Handle("PATCH /api/admin/services/{id}/active", H(a.adminToggleService))

	adm.Handle("GET /api/admin/settings", H(a.adminGetSettings))
	adm.Handle("PUT /api/admin/settings", H(ownerOnly(a.adminUpdateSettings)))
	adm.Handle("PUT /api/admin/business-hours", H(ownerOnly(a.adminUpdateHours)))
	adm.Handle("POST /api/admin/holidays", H(ownerOnly(a.adminAddHoliday)))
	adm.Handle("DELETE /api/admin/holidays/{id}", H(ownerOnly(a.adminDeleteHoliday)))
	adm.Handle("POST /api/admin/therapists", H(ownerOnly(a.adminCreateTherapist)))
	adm.Handle("PUT /api/admin/therapists/{id}", H(ownerOnly(a.adminUpdateTherapist)))

	adm.HandleFunc("GET /api/admin/events", a.events)
	mux.Handle("/api/admin/", a.auth.Middleware(adm))

	mux.Handle("/api/", H(func(w http.ResponseWriter, r *http.Request) error {
		return httpx.NotFound("ไม่พบ API ที่ร้องขอ")
	}))

	// ---------- เสิร์ฟหน้าเว็บ (ถ้าตั้ง STATIC_DIR = frontend/dist) ----------
	if dir := a.cfg.StaticDir; dir != "" {
		mux.Handle("/", spaHandler(dir))
	}

	var h http.Handler = mux
	h = cors(a.cfg.AllowedOrigins)(h)
	h = securityHeaders(h)
	h = logging(h)
	h = recoverer(h)
	return h
}

// spaHandler เสิร์ฟไฟล์ static และส่ง index.html สำหรับ route ของ React Router
func spaHandler(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		p := filepath.Join(dir, filepath.Clean("/"+r.URL.Path))
		if info, err := os.Stat(p); err == nil && !info.IsDir() {
			if strings.HasPrefix(r.URL.Path, "/assets/") {
				w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			}
			fs.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-cache")
		http.ServeFile(w, r, filepath.Join(dir, "index.html"))
	})
}
