export type Theme = 'light' | 'dark' | 'system'

function read(): Theme {
  try {
    return (localStorage.getItem('theme') as Theme) || 'system'
  } catch {
    return 'system'
  }
}

export const theme = $state({ value: read() })

export function setTheme(t: Theme) {
  theme.value = t
  try {
    localStorage.setItem('theme', t)
  } catch {}
  if (t === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
}
