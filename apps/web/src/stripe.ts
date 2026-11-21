import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { api } from './api/client'

const BUILD_PK = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined

let pk: Promise<string | null> | null = null
let stripe: Promise<Stripe | null> | null = null

/** Build-time key in dev (Vite reads the root .env), runtime key from the API in the deployed image. */
export const publishableKey = () =>
  (pk ??= BUILD_PK
    ? Promise.resolve(BUILD_PK)
    : api.config().then(
        (c) => c.stripe_publishable_key ?? null,
        () => null,
      ))

/** Embedded Checkout needs the publishable key; without it we fall back to the hosted page. */
export const canEmbedCheckout = async () => Boolean(await publishableKey())

export const getStripe = () => (stripe ??= publishableKey().then((k) => (k ? loadStripe(k) : null)))
