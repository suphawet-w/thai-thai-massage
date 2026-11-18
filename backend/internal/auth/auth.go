// Package auth จัดการการเข้าสู่ระบบของ Admin (bcrypt + JWT)
package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/thaithai/massage-booking/internal/httpx"
)

type User struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	FullName string `json:"full_name"`
	Role     string `json:"role"`
}

type Service struct {
	pool   *pgxpool.Pool
	secret []byte
	ttl    time.Duration
}

func New(pool *pgxpool.Pool, secret string, ttl time.Duration) *Service {
	return &Service{pool: pool, secret: []byte(secret), ttl: ttl}
}

// EnsureOwner สร้างบัญชีเจ้าของร้านจาก ADMIN_EMAIL/ADMIN_PASSWORD เมื่อยังไม่มีผู้ใช้ในระบบ
func (s *Service) EnsureOwner(ctx context.Context, email, password, name string) (bool, error) {
	var count int
	if err := s.pool.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&count); err != nil {
		return false, err
	}
	if count > 0 || email == "" || password == "" {
		return false, nil
	}
	if len(password) < 8 {
		return false, errors.New("ADMIN_PASSWORD ต้องยาวอย่างน้อย 8 ตัวอักษร")
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return false, err
	}
	_, err = s.pool.Exec(ctx, `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,'owner')`, email, string(hash), name)
	return err == nil, err
}

var errBadLogin = httpx.NewError(http.StatusUnauthorized, "INVALID_CREDENTIALS", "อีเมลหรือรหัสผ่านไม่ถูกต้อง")

// dummyHash ใช้เทียบเวลาเมื่อไม่พบผู้ใช้ เพื่อป้องกันการเดาอีเมลจากเวลาตอบสนอง
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-password-for-timing"), bcrypt.DefaultCost)

func (s *Service) Login(ctx context.Context, email, password string) (string, *User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || password == "" {
		return "", nil, httpx.Validation(map[string]string{"email": "กรุณากรอกอีเมลและรหัสผ่าน"})
	}
	var u User
	var hash string
	var active bool
	err := s.pool.QueryRow(ctx, `SELECT id::text, email, full_name, role, password_hash, is_active FROM users WHERE email=$1`, email).
		Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &hash, &active)
	if errors.Is(err, pgx.ErrNoRows) {
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return "", nil, errBadLogin
	}
	if err != nil {
		return "", nil, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil || !active {
		return "", nil, errBadLogin
	}
	token, err := s.issue(&u)
	return token, &u, err
}

type claims struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) issue(u *User) (string, error) {
	now := time.Now()
	c := claims{Email: u.Email, Name: u.FullName, Role: u.Role, RegisteredClaims: jwt.RegisteredClaims{
		Subject: u.ID, IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(s.ttl)), Issuer: "thaithai-massage",
	}}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, c).SignedString(s.secret)
}

func (s *Service) Verify(token string) (*User, error) {
	var c claims
	_, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) { return s.secret, nil },
		jwt.WithValidMethods([]string{"HS256"}), jwt.WithIssuer("thaithai-massage"))
	if err != nil {
		return nil, err
	}
	return &User{ID: c.Subject, Email: c.Email, FullName: c.Name, Role: c.Role}, nil
}

type ctxKey struct{}

func UserFrom(ctx context.Context) *User {
	u, _ := ctx.Value(ctxKey{}).(*User)
	return u
}

// Middleware ตรวจสอบ Bearer token (หรือ ?access_token= สำหรับ EventSource)
func (s *Service) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" || token == r.Header.Get("Authorization") {
			token = r.URL.Query().Get("access_token")
		}
		if token == "" {
			httpx.Fail(w, r, httpx.NewError(http.StatusUnauthorized, "UNAUTHORIZED", "กรุณาเข้าสู่ระบบ"))
			return
		}
		u, err := s.Verify(token)
		if err != nil {
			httpx.Fail(w, r, httpx.NewError(http.StatusUnauthorized, "UNAUTHORIZED", "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่"))
			return
		}
		// ตรวจว่าผู้ใช้ยังใช้งานได้อยู่
		var active bool
		if err := s.pool.QueryRow(r.Context(), `SELECT is_active FROM users WHERE id::text=$1`, u.ID).Scan(&active); err != nil || !active {
			httpx.Fail(w, r, httpx.NewError(http.StatusUnauthorized, "UNAUTHORIZED", "บัญชีนี้ไม่สามารถใช้งานได้"))
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	})
}

// ChangePassword เปลี่ยนรหัสผ่านของผู้ใช้ปัจจุบัน
func (s *Service) ChangePassword(ctx context.Context, userID, current, next string) error {
	if len(next) < 8 {
		return httpx.Validation(map[string]string{"new_password": "รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร"})
	}
	var hash string
	if err := s.pool.QueryRow(ctx, `SELECT password_hash FROM users WHERE id::text=$1`, userID).Scan(&hash); err != nil {
		return err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(current)) != nil {
		return httpx.Validation(map[string]string{"current_password": "รหัสผ่านปัจจุบันไม่ถูกต้อง"})
	}
	nh, err := bcrypt.GenerateFromPassword([]byte(next), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = s.pool.Exec(ctx, `UPDATE users SET password_hash=$2, updated_at=now() WHERE id::text=$1`, userID, string(nh))
	return err
}

// ---------- จัดการผู้ใช้ (เฉพาะเจ้าของร้าน) ----------

type UserRecord struct {
	User
	IsActive bool `json:"is_active"`
}

func (s *Service) ListUsers(ctx context.Context) ([]UserRecord, error) {
	rows, err := s.pool.Query(ctx, `SELECT id::text, email, full_name, role, is_active FROM users ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []UserRecord{}
	for rows.Next() {
		var u UserRecord
		if err := rows.Scan(&u.ID, &u.Email, &u.FullName, &u.Role, &u.IsActive); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (s *Service) CreateUser(ctx context.Context, email, password, name, role string) (*UserRecord, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	name = strings.TrimSpace(name)
	f := map[string]string{}
	if !strings.Contains(email, "@") || len(email) > 200 {
		f["email"] = "อีเมลไม่ถูกต้อง"
	}
	if len(password) < 8 {
		f["password"] = "รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร"
	}
	if name == "" {
		f["full_name"] = "กรุณากรอกชื่อ"
	}
	if role != "owner" && role != "staff" {
		f["role"] = "บทบาทไม่ถูกต้อง"
	}
	if len(f) > 0 {
		return nil, httpx.Validation(f)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	u := UserRecord{IsActive: true}
	err = s.pool.QueryRow(ctx, `INSERT INTO users (email, password_hash, full_name, role) VALUES ($1,$2,$3,$4)
		RETURNING id::text, email, full_name, role`, email, string(hash), name, role).Scan(&u.ID, &u.Email, &u.FullName, &u.Role)
	if err != nil {
		if strings.Contains(err.Error(), "23505") {
			return nil, httpx.Conflict("DUPLICATE_EMAIL", "อีเมลนี้มีผู้ใช้งานแล้ว")
		}
		return nil, err
	}
	return &u, nil
}

func (s *Service) SetUserActive(ctx context.Context, actorID, id string, active bool) error {
	if actorID == id && !active {
		return httpx.BadRequest("ไม่สามารถปิดการใช้งานบัญชีของตัวเองได้")
	}
	tag, err := s.pool.Exec(ctx, `UPDATE users SET is_active=$2, updated_at=now() WHERE id::text=$1`, id, active)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return httpx.NotFound("ไม่พบผู้ใช้")
	}
	return nil
}
