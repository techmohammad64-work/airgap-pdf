import type { PDFPage } from 'pdf-lib'
import { normRotation, type Rotation } from './assemble'

/**
 * Page geometry. "Visual" coordinates are points measured from the top-left
 * corner of the page as a viewer displays it (after /Rotate is applied), with
 * y growing downwards. This is what the UI works in.
 */
export interface PageGeom {
  x0: number
  y0: number
  w: number
  h: number
  rotation: Rotation
}

export function pageGeom(page: PDFPage): PageGeom {
  const box = page.getCropBox()
  return { x0: box.x, y0: box.y, w: box.width, h: box.height, rotation: normRotation(page.getRotation().angle) }
}

export function visualSize(g: PageGeom): { width: number; height: number } {
  return g.rotation % 180 === 0 ? { width: g.w, height: g.h } : { width: g.h, height: g.w }
}

/** Maps a visual point to PDF user space. */
export function toPdf(g: PageGeom, vx: number, vy: number): { x: number; y: number } {
  const { x0, y0, w, h } = g
  switch (g.rotation) {
    case 0:
      return { x: x0 + vx, y: y0 + h - vy }
    case 90:
      return { x: x0 + vy, y: y0 + vx }
    case 180:
      return { x: x0 + w - vx, y: y0 + vy }
    case 270:
      return { x: x0 + w - vy, y: y0 + h - vx }
  }
}

/**
 * Anchor (PDF space) and rotation for drawing an item whose bottom-left corner
 * sits at visual (vx, vy) so it appears upright to the viewer. `angle` is an
 * extra counter-clockwise tilt in degrees around that corner.
 */
export function anchor(g: PageGeom, vx: number, vy: number, angle = 0) {
  const p = toPdf(g, vx, vy)
  return { x: p.x, y: p.y, rotate: g.rotation + angle }
}

/**
 * Bottom-left anchor for an item of size (w, h) centred on visual (cx, cy) and
 * tilted counter-clockwise by `angle` degrees.
 */
export function centredAnchor(g: PageGeom, cx: number, cy: number, w: number, h: number, angle: number) {
  const a = (angle * Math.PI) / 180
  // Unit vectors of the item's right and up directions in visual (y-down) space.
  const rx = Math.cos(a)
  const ry = -Math.sin(a)
  const ux = -Math.sin(a)
  const uy = -Math.cos(a)
  const vx = cx - (w / 2) * rx - (h / 2) * ux
  const vy = cy - (w / 2) * ry - (h / 2) * uy
  return anchor(g, vx, vy, angle)
}
