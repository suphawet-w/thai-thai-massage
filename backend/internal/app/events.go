package app

import (
	"encoding/json"
	"sync"
)

// Hub กระจาย event แบบ real-time ให้หน้า Admin ผ่าน Server-Sent Events
type Hub struct {
	mu   sync.Mutex
	subs map[chan []byte]struct{}
}

func NewHub() *Hub { return &Hub{subs: map[chan []byte]struct{}{}} }

func (h *Hub) Subscribe() chan []byte {
	ch := make(chan []byte, 16)
	h.mu.Lock()
	h.subs[ch] = struct{}{}
	h.mu.Unlock()
	return ch
}

func (h *Hub) Unsubscribe(ch chan []byte) {
	h.mu.Lock()
	delete(h.subs, ch)
	h.mu.Unlock()
}

type Event struct {
	Type      string `json:"type"`
	BookingID string `json:"booking_id,omitempty"`
	Date      string `json:"date,omitempty"`
	Status    string `json:"status,omitempty"`
}

func (h *Hub) Publish(e Event) {
	b, _ := json.Marshal(e)
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- b:
		default: // client ช้าเกินไป ข้าม event นี้
		}
	}
}
