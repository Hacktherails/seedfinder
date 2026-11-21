/**
 * Seedfinder mark: a seed with a two-leaf sprout. Filled, takes the current text color (green by default),
 * drawn on a 16 px grid so it stays crisp from 12 px (inline) to 28 px (logo). Same shape as public/favicon.svg.
 */
export default function SeedIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={`inline-block shrink-0 text-[var(--green)] ${className}`} fill="currentColor">
      <path d="M8 13V7.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M7.7 8.6C7.6 6.2 5.8 4.7 2.6 4.8c0 2.7 2 4.1 5.1 3.8Z" />
      <path d="M8.3 7.4C8.4 4.4 10.4 2.4 14 2.5c0 3.4-2.2 5.2-5.7 4.9Z" />
      <path d="M8 15.6c-2.1 0-3.6-.9-3.6-2.1S5.9 11.4 8 11.4s3.6.9 3.6 2.1-1.5 2.1-3.6 2.1Z" />
    </svg>
  )
}
