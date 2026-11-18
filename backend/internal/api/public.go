package api

import (
	"crypto/subtle"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/thaithai/massage-booking/internal/app"
	"github.com/thaithai/massage-booking/internal/httpx"
)

// ---------- GET /api/services ----------

func (a *API) listServices(w http.ResponseWriter, r *http.Request) error {
	svcs, err := a.store.ListServices(r.Context(), false)
	if err != nil {
		return err
	}
	httpx.OK(w, svcs, fmt.Sprintf("พบบริการ %d รายการ", len(svcs)))
	return nil
}

// ---------- GET /api/shop-info ----------

func (a *API) shopInfo(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	st, err := a.store.GetSettings(ctx, nil)
	if err != nil {
		return err
	}
	hours, err := a.store.ListBusinessHours(ctx)
	if err != nil {
		return err
	}
	today := a.store.Today()
	hol, err := a.store.ListHolidays(ctx, today)
	if err != nil {
		return err
	}
	httpx.OK(w, map[string]any{
		"name":                   "ร้านนวดไท๊ไทย (Thai Thai Massage)",
		"today":                  today,
		"business_hours":         hours,
		"holidays":               hol,
		"booking_advance_days":   st.BookingAdvanceDays,
		"cancel_before_hours":    st.CancelBeforeHours,
		"max_guests_per_booking": st.MaxGuestsPerBooking,
		"phone":                  st.ShopPhone,
		"address":                st.ShopAddress,
		"line_id":                st.ShopLineID,
		"map_url":                st.ShopMapURL,
	}, "")
	return nil
}

// parseServiceIDs รองรับ ?service_ids=1,2  ?service_id=3  หรือ ?service=นวดน้ำมัน
func (a *API) parseServiceIDs(r *http.Request) ([]int, error) {
	q := r.URL.Query()
	var ids []int
	raw := q.Get("service_ids")
	if raw == "" {
		raw = q.Get("service_id")
	}
	for _, p := range strings.Split(raw, ",") {
		if p = strings.TrimSpace(p); p == "" {
			continue
		}
		id, err := strconv.Atoi(p)
		if err != nil || id <= 0 {
			return nil, httpx.Validation(map[string]string{"service_id": "service_id ไม่ถูกต้อง"})
		}
		ids = append(ids, id)
	}
	if len(ids) == 0 && q.Get("service") != "" {
		sv, err := a.store.FindServiceByName(r.Context(), q.Get("service"))
		if err != nil {
			return nil, err
		}
		ids = []int{sv.ID}
	}
	if len(ids) == 0 {
		return nil, httpx.Validation(map[string]string{"service_id": "กรุณาระบุบริการ (service_id, service_ids หรือ service)"})
	}
	return ids, nil
}

func atoiDefault(s string, def int) int {
	if n, err := strconv.Atoi(strings.TrimSpace(s)); err == nil {
		return n
	}
	return def
}

// ---------- GET /api/availability ----------
// ?date=2026-11-18&service_id=3[&guests=1][&time=14:00]
// ถ้าระบุ time → ตอบว่าว่างหรือไม่ (รูปแบบเดียวกับตัวอย่างในสเปก) พร้อมเวลาแนะนำ
// ถ้าไม่ระบุ time → คืนรายการช่วงเวลาทั้งหมดของวัน
func (a *API) availability(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	q := r.URL.Query()
	date := q.Get("date")
	if date == "" {
		date = a.store.Today()
	}
	ids, err := a.parseServiceIDs(r)
	if err != nil {
		return err
	}
	svcs, duration, unitPrice, err := a.store.DurationForServices(ctx, ids)
	if err != nil {
		return err
	}
	guests := atoiDefault(q.Get("guests"), 1)
	if guests < 1 || guests > 20 {
		return httpx.Validation(map[string]string{"guests": "จำนวนผู้ใช้บริการไม่ถูกต้อง"})
	}
	names := make([]string, len(svcs))
	for i, s := range svcs {
		names[i] = s.Name
	}
	serviceName := strings.Join(names, " + ")

	day, err := a.store.DayAvailability(ctx, date, duration, guests, "")
	if err != nil {
		return err
	}
	freeTimes := []string{}
	for _, s := range day.Slots {
		if s.Available {
			freeTimes = append(freeTimes, s.Time)
		}
	}

	base := map[string]any{
		"success":          true,
		"date":             day.Date,
		"service":          serviceName,
		"service_ids":      ids,
		"duration_minutes": duration,
		"guests":           guests,
		"price":            unitPrice * guests,
	}

	if t := q.Get("time"); t != "" {
		slot, err := a.store.CheckSlot(ctx, date, t, duration, guests)
		if err != nil {
			return err
		}
		base["time"] = slot.Time
		base["end_time"] = slot.EndTime
		base["available"] = slot.Available
		base["remaining"] = slot.Remaining
		if slot.Available {
			base["message"] = "มีเวลาว่าง"
		} else {
			base["message"] = slot.Reason
			base["suggested_times"] = nearestTimes(freeTimes, t, 3)
		}
		httpx.JSON(w, http.StatusOK, base)
		return nil
	}

	base["available"] = len(freeTimes) > 0
	base["is_open"] = day.IsOpen
	base["open_time"] = day.OpenTime
	base["close_time"] = day.CloseTime
	base["break_start"] = day.BreakStart
	base["break_end"] = day.BreakEnd
	base["available_times"] = freeTimes
	base["slots"] = day.Slots
	base["message"] = day.Message
	httpx.JSON(w, http.StatusOK, base)
	return nil
}

// ---------- POST /api/bookings ----------

func (a *API) createBooking(w http.ResponseWriter, r *http.Request) error {
	var in app.CreateBookingInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	// ถ้าตั้ง BOT_API_KEY ไว้ การจองในนาม botnoi ต้องแนบ X-API-Key ที่ถูกต้องเสมอ
	if in.Source == "botnoi" && a.botKey != "" &&
		subtle.ConstantTimeCompare([]byte(r.Header.Get("X-API-Key")), []byte(a.botKey)) != 1 {
		return httpx.NewError(http.StatusUnauthorized, "INVALID_API_KEY", "API key ไม่ถูกต้องหรือไม่ได้ส่งมา")
	}
	// ลูกค้าภายนอกระบุ source ได้เฉพาะ web หรือ botnoi
	b, err := a.store.CreateBooking(r.Context(), in, []string{"web", "botnoi"})
	if err != nil {
		return err
	}
	msg := "จองคิวสำเร็จ! หมายเลขการจองของคุณคือ " + b.BookingID
	if b.Status == app.StatusPending {
		msg += " (รอร้านยืนยัน)"
	}
	httpx.Created(w, b, msg)
	return nil
}

// ---------- GET /api/bookings/{id}?phone= ----------

func (a *API) getBooking(w http.ResponseWriter, r *http.Request) error {
	b, err := a.store.GetBookingForCustomer(r.Context(), r.PathValue("id"), r.URL.Query().Get("phone"))
	if err != nil {
		return err
	}
	httpx.OK(w, b, "สถานะการจอง: "+b.StatusLabel)
	return nil
}

// ---------- PATCH /api/bookings/{id}/cancel ----------

func (a *API) cancelBooking(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Phone  string `json:"phone"`
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	b, err := a.store.CancelByCustomer(r.Context(), r.PathValue("id"), in.Phone, in.Reason)
	if err != nil {
		return err
	}
	httpx.OK(w, b, "ยกเลิกการจอง "+b.BookingID+" เรียบร้อยแล้ว")
	return nil
}

// ---------- GET /api/queue/status ----------
// ?date=YYYY-MM-DD  (ไม่บังคับ, ค่าเริ่มต้น = วันนี้)
// ?booking_id=TTXXXXXX&phone=08xxxxxxxx (ไม่บังคับ) → บอกตำแหน่งคิวของลูกค้า

func (a *API) queueStatus(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	date := q.Get("date")
	var mine *app.Booking
	if code := q.Get("booking_id"); code != "" {
		b, err := a.store.GetBookingForCustomer(r.Context(), code, q.Get("phone"))
		if err != nil {
			return err
		}
		mine = b
		date = b.ServiceDate
	}
	if date == "" {
		date = a.store.Today()
	}
	qs, err := a.store.PublicQueueStatus(r.Context(), date, mine)
	if err != nil {
		return err
	}
	msg := qs.Message
	if qs.MyBooking != nil {
		msg = qs.MyBooking.Message
	}
	httpx.OK(w, qs, msg)
	return nil
}

// nearestTimes เลือกเวลาว่างที่ใกล้กับเวลาที่ลูกค้าต้องการมากที่สุด (สำหรับให้ Chatbot เสนอทางเลือก)
func nearestTimes(free []string, want string, n int) []string {
	w, _ := app.ParseHM(want)
	sorted := append([]string(nil), free...)
	sort.SliceStable(sorted, func(i, j int) bool {
		a, _ := app.ParseHM(sorted[i])
		b, _ := app.ParseHM(sorted[j])
		return abs(a-w) < abs(b-w)
	})
	if len(sorted) > n {
		sorted = sorted[:n]
	}
	sort.Strings(sorted)
	return sorted
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}
