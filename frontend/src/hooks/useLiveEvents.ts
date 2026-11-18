import { useEffect, useRef, useState } from 'react'
import { adminApi } from '../lib/api'

/**
 * เชื่อมต่อ Server-Sent Events ของ Admin เพื่อรับการเปลี่ยนแปลงแบบ Real-time
 * เรียก onChange ทุกครั้งที่มีการจอง/เปลี่ยนสถานะ (มี debounce เล็กน้อย)
 */
export function useLiveEvents(onChange: () => void) {
  const [connected, setConnected] = useState(false)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const es = new EventSource(adminApi.eventsUrl())
    es.addEventListener('ready', () => setConnected(true))
    es.addEventListener('change', () => {
      clearTimeout(timer)
      timer = setTimeout(() => cb.current(), 250)
    })
    es.onerror = () => setConnected(false)
    // สำรอง: รีเฟรชทุก 60 วินาที เผื่อการเชื่อมต่อหลุด
    const poll = setInterval(() => cb.current(), 60_000)
    return () => {
      es.close()
      clearTimeout(timer)
      clearInterval(poll)
    }
  }, [])

  return connected
}
