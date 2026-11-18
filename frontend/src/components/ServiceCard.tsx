import { ArrowRight, Clock, Star } from 'lucide-react'
import { Link } from 'react-router'
import { baht, durationText } from '../lib/format'
import type { Service } from '../lib/types'
import { ServiceIcon } from './Illustrations'

export default function ServiceCard({ service, index = 0 }: { service: Service; index?: number }) {
  return (
    <article className="card group relative flex flex-col overflow-hidden p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_-18px_rgba(16,35,26,0.35)] animate-fade-up"
      style={{ animationDelay: `${index * 60}ms` }}>
      <div className="absolute -right-10 -top-10 size-32 rounded-full bg-gold-200/50 transition-transform duration-500 group-hover:scale-125" aria-hidden />
      <div className="relative flex items-start justify-between">
        <div className="rounded-2xl bg-forest-800 p-3 text-gold-300 shadow-sm">
          <ServiceIcon name={service.name} />
        </div>
        {service.is_popular && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 px-2.5 py-1 text-xs font-medium text-gold-700">
            <Star className="size-3 fill-current" />ยอดนิยม
          </span>
        )}
      </div>
      <h3 className="relative mt-5 text-lg font-semibold text-forest-900">{service.name}</h3>
      <p className="relative mt-2 flex-1 text-sm leading-relaxed text-forest-600">{service.description}</p>
      <div className="relative mt-5 flex items-end justify-between border-t border-dashed border-cream-300 pt-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs text-forest-500"><Clock className="size-3.5" />{durationText(service.duration_minutes)}</p>
          <p className="mt-0.5 text-2xl font-semibold text-forest-900">{service.price.toLocaleString('th-TH')}<span className="ml-1 text-sm font-normal text-forest-500">บาท</span></p>
        </div>
        <Link to={`/booking?service=${service.id}`} className="btn-primary btn-sm group/btn" aria-label={`จองคิว ${service.name} ราคา ${baht(service.price)}`}>
          จองคิว<ArrowRight className="size-3.5 transition-transform group-hover/btn:translate-x-0.5" />
        </Link>
      </div>
    </article>
  )
}
