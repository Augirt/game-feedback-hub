import { useEffect, useRef } from 'react'

export function useModalFocus(onClose: () => void) {
  const modalRef = useRef<HTMLElement>(null)
  const previousFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const previous = previousFocus.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const modal = modalRef.current
    const selector = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]'
    if (modal && !modal.contains(document.activeElement)) (modal.querySelector<HTMLElement>(selector) || modal).focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return }
      if (event.key !== 'Tab' || !modal) return
      const items = Array.from(modal.querySelectorAll<HTMLElement>(selector)).filter((item) => item.getClientRects().length)
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); modal.focus(); return }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === modal)) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === modal)) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return modalRef
}
