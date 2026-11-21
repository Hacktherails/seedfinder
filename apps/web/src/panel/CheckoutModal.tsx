import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import type { Quote } from '../api/types'
import { fmtPrice } from '../format'
import { getStripe } from '../stripe'

interface Props {
  clientSecret: string
  quote: Quote
  onComplete: () => void
  onClose: () => void
}

export default function CheckoutModal({ clientSecret, quote, onComplete, onClose }: Props) {
  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/30 p-3 backdrop-blur-[2px]">
      <div className="pop flex max-h-full w-[min(560px,100%)] flex-col overflow-hidden rounded-3xl bg-[var(--card)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-3">
          <div className="text-[13px]">
            <span className="font-medium">Secure payment</span>
            {quote.points_used > 0 && (
              <span className="ml-2 rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[11px] font-medium text-[var(--green)]">
                🌿 −{fmtPrice(quote.discount_cents, quote.currency)} with {quote.points_used} EcoTokens
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            className="grid size-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)] hover:text-[var(--ink)]"
          >
            ✕
          </button>
        </header>
        <div className="min-h-[420px] overflow-y-auto">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret, onComplete }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  )
}
