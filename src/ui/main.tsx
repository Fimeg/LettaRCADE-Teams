import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

function ensureCrashOverlay() {
  let el = document.getElementById('global-crash-overlay')
  if (!el) {
    el = document.createElement('div')
    el.id = 'global-crash-overlay'
    el.style.position = 'fixed'
    el.style.inset = '0'
    el.style.zIndex = '999999'
    el.style.background = 'rgba(40, 20, 10, 0.96)'
    el.style.color = '#ffe8d6'
    el.style.padding = '16px'
    el.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    el.style.fontSize = '12px'
    el.style.whiteSpace = 'pre-wrap'
    el.style.overflow = 'auto'
    el.style.display = 'none'
    document.body.appendChild(el)
  }
  return el
}

function showCrash(kind: string, detail: unknown) {
  const overlay = ensureCrashOverlay()
  const text =
    detail instanceof Error
      ? `${detail.name}: ${detail.message}\n\n${detail.stack ?? ''}`
      : typeof detail === 'string'
      ? detail
      : JSON.stringify(detail, null, 2)
  overlay.textContent = `[${kind}] Uncaught runtime error\n\n${text}`
  overlay.style.display = 'block'
  console.error(`[global-crash] ${kind}`, detail)
}

window.addEventListener('error', (event) => {
  showCrash('error', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  showCrash('unhandledrejection', event.reason)
})

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App />
	</StrictMode>
)
