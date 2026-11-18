package api

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/thaithai/massage-booking/internal/app"
	"github.com/thaithai/massage-booking/internal/auth"
	"github.com/thaithai/massage-booking/internal/httpx"
)

func pathInt(r *http.Request, name string) (int, error) {
	id, err := strconv.Atoi(r.PathValue(name))
	if err != nil || id <= 0 {
		return 0, httpx.BadRequest("รหัสไม่ถูกต้อง")
	}
	return id, nil
}

func (a *API) dateParam(r *http.Request) string {
	if d := r.URL.Query().Get("date"); d != "" {
		return d
	}
	return a.store.Today()
}

// ---------- Auth ----------

func (a *API) login(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	token, u, err := a.auth.Login(r.Context(), in.Email, in.Password)
	if err != nil {
		return err
	}
	httpx.OK(w, map[string]any{"token": token, "user": u}, "เข้าสู่ระบบสำเร็จ")
	return nil
}

func (a *API) me(w http.ResponseWriter, r *http.Request) error {
	httpx.OK(w, auth.UserFrom(r.Context()), "")
	return nil
}

func (a *API) changePassword(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Current string `json:"current_password"`
		New     string `json:"new_password"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := a.auth.ChangePassword(r.Context(), auth.UserFrom(r.Context()).ID, in.Current, in.New); err != nil {
		return err
	}
	httpx.OK(w, nil, "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว")
	return nil
}

func ownerOnly(next httpx.Handler) httpx.Handler {
	return func(w http.ResponseWriter, r *http.Request) error {
		if u := auth.UserFrom(r.Context()); u == nil || u.Role != "owner" {
			return httpx.NewError(http.StatusForbidden, "FORBIDDEN", "เฉพาะเจ้าของร้านเท่านั้นที่ทำรายการนี้ได้")
		}
		return next(w, r)
	}
}

func (a *API) listUsers(w http.ResponseWriter, r *http.Request) error {
	users, err := a.auth.ListUsers(r.Context())
	if err != nil {
		return err
	}
	httpx.OK(w, users, "")
	return nil
}

func (a *API) createUser(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		FullName string `json:"full_name"`
		Role     string `json:"role"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	u, err := a.auth.CreateUser(r.Context(), in.Email, in.Password, in.FullName, in.Role)
	if err != nil {
		return err
	}
	httpx.Created(w, u, "เพิ่มผู้ใช้งานเรียบร้อยแล้ว")
	return nil
}

func (a *API) setUserActive(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		IsActive bool `json:"is_active"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if err := a.auth.SetUserActive(r.Context(), auth.UserFrom(r.Context()).ID, r.PathValue("id"), in.IsActive); err != nil {
		return err
	}
	httpx.OK(w, nil, "อัปเดตผู้ใช้งานเรียบร้อยแล้ว")
	return nil
}

// ---------- Dashboard ----------

func (a *API) dashboard(w http.ResponseWriter, r *http.Request) error {
	d, err := a.store.Dashboard(r.Context(), a.dateParam(r))
	if err != nil {
		return err
	}
	httpx.OK(w, d, "")
	return nil
}

// ---------- Bookings ----------

func (a *API) adminListBookings(w http.ResponseWriter, r *http.Request) error {
	q := r.URL.Query()
	page, err := a.store.ListBookings(r.Context(), app.BookingFilter{
		Query: q.Get("q"), Date: q.Get("date"), DateFrom: q.Get("date_from"), DateTo: q.Get("date_to"),
		Status: q.Get("status"), Page: atoiDefault(q.Get("page"), 1), PageSize: atoiDefault(q.Get("page_size"), 20),
	})
	if err != nil {
		return err
	}
	httpx.OK(w, page, "")
	return nil
}

func (a *API) adminGetBooking(w http.ResponseWriter, r *http.Request) error {
	b, err := a.store.GetBookingByID(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	httpx.OK(w, b, "")
	return nil
}

func (a *API) adminCreateBooking(w http.ResponseWriter, r *http.Request) error {
	var in app.CreateBookingInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	if in.Source == "" {
		in.Source = "admin"
	}
	b, err := a.store.CreateBooking(r.Context(), in, []string{"admin", "phone", "web"})
	if err != nil {
		return err
	}
	httpx.Created(w, b, "สร้างการจอง "+b.BookingID+" เรียบร้อยแล้ว")
	return nil
}

func (a *API) adminUpdateStatus(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	u := auth.UserFrom(r.Context())
	b, err := a.store.UpdateStatus(r.Context(), r.PathValue("id"), in.Status, in.Reason, "admin:"+u.FullName)
	if err != nil {
		return err
	}
	httpx.OK(w, b, fmt.Sprintf("เปลี่ยนสถานะเป็น \"%s\" เรียบร้อยแล้ว", b.StatusLabel))
	return nil
}

func (a *API) adminReschedule(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Date string `json:"date"`
		Time string `json:"time"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	b, err := a.store.Reschedule(r.Context(), r.PathValue("id"), in.Date, in.Time)
	if err != nil {
		return err
	}
	httpx.OK(w, b, "แก้ไขวันและเวลาเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminAssignTherapist(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		TherapistID *int `json:"therapist_id"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	b, err := a.store.AssignTherapist(r.Context(), r.PathValue("id"), in.TherapistID)
	if err != nil {
		return err
	}
	httpx.OK(w, b, "บันทึกหมอนวดเรียบร้อยแล้ว")
	return nil
}

// GET /api/admin/bookings/{id}/availability?date= — เวลาว่างสำหรับย้ายนัด (ไม่นับการจองนี้เอง)
func (a *API) adminBookingAvailability(w http.ResponseWriter, r *http.Request) error {
	b, err := a.store.GetBookingByID(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	day, err := a.store.DayAvailability(r.Context(), a.dateParam(r), b.TotalDuration, b.Guests, b.ID)
	if err != nil {
		return err
	}
	httpx.OK(w, day, day.Message)
	return nil
}

// ---------- Queue ----------

func (a *API) adminQueue(w http.ResponseWriter, r *http.Request) error {
	date := a.dateParam(r)
	list, err := a.store.DayQueue(r.Context(), date)
	if err != nil {
		return err
	}
	status, err := a.store.PublicQueueStatus(r.Context(), date, nil)
	if err != nil {
		return err
	}
	httpx.OK(w, map[string]any{"date": date, "items": list, "status": status}, "")
	return nil
}

func (a *API) adminCallNext(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Date string `json:"date"`
	}
	_ = httpx.Decode(r, &in)
	if in.Date == "" {
		in.Date = a.store.Today()
	}
	b, err := a.store.CallNext(r.Context(), in.Date)
	if err != nil {
		return err
	}
	httpx.OK(w, b, fmt.Sprintf("เรียกคิว %s คุณ%s", b.QueueCode, b.CustomerName))
	return nil
}

func (a *API) adminCallBooking(w http.ResponseWriter, r *http.Request) error {
	b, err := a.store.CallBooking(r.Context(), r.PathValue("id"))
	if err != nil {
		return err
	}
	httpx.OK(w, b, fmt.Sprintf("เรียกคิว %s อีกครั้ง", b.QueueCode))
	return nil
}

// ---------- Services ----------

func (a *API) adminListServices(w http.ResponseWriter, r *http.Request) error {
	svcs, err := a.store.ListServices(r.Context(), true)
	if err != nil {
		return err
	}
	httpx.OK(w, svcs, "")
	return nil
}

func (a *API) adminCreateService(w http.ResponseWriter, r *http.Request) error {
	var in app.ServiceInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	sv, err := a.store.CreateService(r.Context(), in)
	if err != nil {
		return err
	}
	httpx.Created(w, sv, "เพิ่มบริการเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminUpdateService(w http.ResponseWriter, r *http.Request) error {
	id, err := pathInt(r, "id")
	if err != nil {
		return err
	}
	var in app.ServiceInput
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	sv, err := a.store.UpdateService(r.Context(), id, in)
	if err != nil {
		return err
	}
	httpx.OK(w, sv, "บันทึกบริการเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminToggleService(w http.ResponseWriter, r *http.Request) error {
	id, err := pathInt(r, "id")
	if err != nil {
		return err
	}
	var in struct {
		IsActive bool `json:"is_active"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	sv, err := a.store.SetServiceActive(r.Context(), id, in.IsActive)
	if err != nil {
		return err
	}
	msg := "เปิดให้บริการ \"" + sv.Name + "\" แล้ว"
	if !sv.IsActive {
		msg = "ปิดบริการ \"" + sv.Name + "\" ชั่วคราวแล้ว"
	}
	httpx.OK(w, sv, msg)
	return nil
}

// ---------- Settings ----------

func (a *API) adminGetSettings(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	st, err := a.store.GetSettings(ctx, nil)
	if err != nil {
		return err
	}
	hours, err := a.store.ListBusinessHours(ctx)
	if err != nil {
		return err
	}
	from := time.Now().AddDate(0, -1, 0).Format(app.DateLayout)
	hol, err := a.store.ListHolidays(ctx, from)
	if err != nil {
		return err
	}
	th, err := a.store.ListTherapists(ctx)
	if err != nil {
		return err
	}
	httpx.OK(w, map[string]any{"settings": st, "business_hours": hours, "holidays": hol, "therapists": th}, "")
	return nil
}

func (a *API) adminUpdateSettings(w http.ResponseWriter, r *http.Request) error {
	var in app.Settings
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	st, err := a.store.UpdateSettings(r.Context(), in)
	if err != nil {
		return err
	}
	httpx.OK(w, st, "บันทึกการตั้งค่าเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminUpdateHours(w http.ResponseWriter, r *http.Request) error {
	var in []app.BusinessHour
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	hours, err := a.store.UpdateBusinessHours(r.Context(), in)
	if err != nil {
		return err
	}
	httpx.OK(w, hours, "บันทึกเวลาทำการเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminAddHoliday(w http.ResponseWriter, r *http.Request) error {
	var in struct {
		Date string `json:"date"`
		Name string `json:"name"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	h, err := a.store.AddHoliday(r.Context(), in.Date, in.Name)
	if err != nil {
		return err
	}
	httpx.Created(w, h, "เพิ่มวันหยุดเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminDeleteHoliday(w http.ResponseWriter, r *http.Request) error {
	id, err := pathInt(r, "id")
	if err != nil {
		return err
	}
	if err := a.store.DeleteHoliday(r.Context(), id); err != nil {
		return err
	}
	httpx.OK(w, nil, "ลบวันหยุดเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminCreateTherapist(w http.ResponseWriter, r *http.Request) error {
	var in app.Therapist
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	t, err := a.store.CreateTherapist(r.Context(), in)
	if err != nil {
		return err
	}
	httpx.Created(w, t, "เพิ่มหมอนวดเรียบร้อยแล้ว")
	return nil
}

func (a *API) adminUpdateTherapist(w http.ResponseWriter, r *http.Request) error {
	id, err := pathInt(r, "id")
	if err != nil {
		return err
	}
	var in app.Therapist
	if err := httpx.Decode(r, &in); err != nil {
		return err
	}
	t, err := a.store.UpdateTherapist(r.Context(), id, in)
	if err != nil {
		return err
	}
	httpx.OK(w, t, "บันทึกข้อมูลหมอนวดเรียบร้อยแล้ว")
	return nil
}

// ---------- Real-time (Server-Sent Events) ----------

func (a *API) events(w http.ResponseWriter, r *http.Request) {
	rc := http.NewResponseController(w)
	_ = rc.SetWriteDeadline(time.Time{}) // ปิด write timeout สำหรับการเชื่อมต่อค้าง
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	fmt.Fprint(w, "retry: 3000\nevent: ready\ndata: {}\n\n")
	if err := rc.Flush(); err != nil {
		return
	}
	ch := a.store.Events.Subscribe()
	defer a.store.Events.Unsubscribe(ch)
	ping := time.NewTicker(25 * time.Second)
	defer ping.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprintf(w, "event: change\ndata: %s\n\n", msg)
		case <-ping.C:
			fmt.Fprint(w, ": ping\n\n")
		}
		if err := rc.Flush(); err != nil {
			return
		}
	}
}
