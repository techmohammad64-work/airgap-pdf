import data from '../../site/tools.json'

export interface ToolPage {
  slug: string
  tool: string
  mode?: string
  group: string
  icon: string
  name: string
  short: string
  title: string
  h1: string
  description: string
}

export const site = data.site
export const groups = data.groups
export const pages = data.pages as ToolPage[]
export const BASE = document.body.dataset.base || import.meta.env.BASE_URL

export const href = (slug = '') => `${BASE}${slug ? slug + '/' : ''}`
export const findPage = (slug?: string) => pages.find((p) => p.slug === slug)
