// Package httpx รวมเครื่องมือสำหรับตอบกลับ JSON ในรูปแบบมาตรฐานเดียวกันทั้งระบบ
//
//	สำเร็จ:   {"success": true,  "message": "...", "data": {...}}
//	ผิดพลาด: {"success": false, "message": "...", "error": {"code": "...", "fields": {...}}}
package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

type APIError struct {
	Status  int               `json:"-"`
	Code    string            `json:"code"`
	Message string            `json:"-"`
	Fields  map[string]string `json:"fields,omitempty"`
	Extra   map[string]any    `json:"-"`
}

func (e *APIError) Error() string { return e.Message }

func NewError(status int, code, msg string) *APIError {
	return &APIError{Status: status, Code: code, Message: msg}
}

func BadRequest(msg string) *APIError { return NewError(http.StatusBadRequest, "BAD_REQUEST", msg) }
func NotFound(msg string) *APIError   { return NewError(http.StatusNotFound, "NOT_FOUND", msg) }
func Conflict(code, msg string) *APIError {
	return NewError(http.StatusConflict, code, msg)
}

// Validation สร้าง error 422 พร้อมรายละเอียดรายฟิลด์
func Validation(fields map[string]string) *APIError {
	return &APIError{Status: http.StatusUnprocessableEntity, Code: "VALIDATION_ERROR", Message: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง", Fields: fields}
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}

func OK(w http.ResponseWriter, data any, message string) {
	JSON(w, http.StatusOK, map[string]any{"success": true, "message": message, "data": data})
}

func Created(w http.ResponseWriter, data any, message string) {
	JSON(w, http.StatusCreated, map[string]any{"success": true, "message": message, "data": data})
}

func Fail(w http.ResponseWriter, r *http.Request, err error) {
	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		slog.Error("internal error", "method", r.Method, "path", r.URL.Path, "err", err)
		apiErr = NewError(http.StatusInternalServerError, "INTERNAL_ERROR", "ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง")
	}
	body := map[string]any{"success": false, "message": apiErr.Message, "error": apiErr}
	for k, v := range apiErr.Extra {
		body[k] = v
	}
	JSON(w, apiErr.Status, body)
}

// Handler คือ handler ที่คืน error ได้ เพื่อลดโค้ดซ้ำ
type Handler func(w http.ResponseWriter, r *http.Request) error

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if err := h(w, r); err != nil {
		Fail(w, r, err)
	}
}

// Decode อ่าน JSON body (จำกัด 1MB)
func Decode(r *http.Request, v any) error {
	if ct := r.Header.Get("Content-Type"); ct != "" && !strings.Contains(ct, "application/json") {
		return NewError(http.StatusUnsupportedMediaType, "UNSUPPORTED_MEDIA_TYPE", "กรุณาส่งข้อมูลเป็น JSON")
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	if err := dec.Decode(v); err != nil {
		if errors.Is(err, io.EOF) {
			return BadRequest("ไม่พบข้อมูลที่ส่งมา")
		}
		return BadRequest("รูปแบบข้อมูล JSON ไม่ถูกต้อง")
	}
	return nil
}
