import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { THEME_KEY } from './share/urlState'

// Bring back the theme the viewer picked last time (otherwise the system setting applies).
try {
  const theme = localStorage.getItem(THEME_KEY)
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch {
  // Storage blocked: follow the system setting.
}

const app = mount(App, {
  target: document.getElementById('app')!,
})

export default app
