import { useEffect, useId, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { makeMeltMaterial, MATERIAL_HEIGHT, MELT_START } from './tilted-grid-material'
import './tilted-grid-hero.css'

const CAMERA = 1.6
const SLICES = 16
const toDegrees = 180 / Math.PI
type Variables = CSSProperties & { [name: `--${string}`]: string | number }

export type TiltedGridImage = { src: string; alt?: string }
type ReelPhoto = TiltedGridImage & { material?: string }
type ReelImages = { input: readonly TiltedGridImage[]; aspect: number; photos: ReelPhoto[] }

export type TiltedGridHeroProps = ComponentProps<'div'> & {
  images: readonly TiltedGridImage[]
  speed?: number
  tileHeight?: number
  aspectRatio?: number
  gap?: number
  axis?: number
  curve?: number
  fade?: number
}

function measure(width: number, height: number, tileHeight: number, aspect: number, gap: number, curve: number) {
  const h = Math.min(height * tileHeight / 100, width * .55 / aspect)
  const bend = curve / toDegrees
  // The frame edge projects to exactly half the stage width at this radius.
  const radius = width * (CAMERA - 1 + Math.cos(bend)) / (2 * CAMERA * Math.sin(bend))
  if (!(h > 0 && radius > 0)) return null
  const w = h * aspect
  const unit = h / radius * toDegrees
  const pitch = (aspect + gap / 100) * unit
  const limit = curve + aspect * unit / 2
  const columns = Math.min(60, Math.max(2, Math.ceil(2 * limit / pitch + .5)))
  const sweep = columns * pitch / 2
  const hide = Math.max(0, (sweep - limit) / (2 * sweep) * 100)
  return { h, w, radius, unit, columns, sweep, hide }
}

function CurvedTile({ slot, columns, photos, orbit, seconds, children }: {
  slot: number
  columns: number
  photos: readonly ReelPhoto[]
  orbit: string
  seconds: number
  children: ReactNode
}) {
  const [advance, setAdvance] = useState(0)
  const image = photos[(columns - 1 - slot + advance) % photos.length]
  return (
    <div className="tilted-grid__tile" data-molten={Boolean(image.material)} style={{
      animationName: orbit,
      '--photo': `url(${JSON.stringify(image.material ?? image.src)})`,
      '--offset': `${-(slot + (columns % 2) * .5) * seconds}s`,
      '--melt-period': `${6.8 + slot % 3 * .9}s`, '--melt-offset': `${-slot * 1.73}s`,
    } as Variables}
      onAnimationIteration={event => {
        if (event.target !== event.currentTarget || event.animationName !== orbit) return
        const lap = Math.round(event.elapsedTime / (columns * seconds))
        setAdvance(lap * columns % photos.length)
      }}>
      <div className="tilted-grid__face">{children}</div>
      {image.material && <div className="tilted-grid__flow">{children}</div>}
    </div>
  )
}

export function TiltedGridHero({
  images, speed = 4, tileHeight = 26, aspectRatio = 16 / 9, gap = 6,
  axis = 56, curve = 80, fade = 12, className, style, children, ...props
}: TiltedGridHeroProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const orbit = 'tilted-grid-' + useId().replace(/[^A-Za-z0-9-]/g, '')
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [reel, setReel] = useState<ReelImages | null>(null)
  const aspect = Math.max(.25, aspectRatio)
  const photos = reel?.input === images && reel.aspect === aspect ? reel.photos : []
  const seconds = Math.max(.25, speed)
  const layout = measure(size.width, size.height, tileHeight, aspect, Math.max(0, gap), Math.min(85, Math.max(5, curve)))

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const resize = () => {
      const { width, height } = stage.getBoundingClientRect()
      setSize(prev => prev.width === width && prev.height === height ? prev : { width, height })
    }
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    observer?.observe(stage)
    const initial = requestAnimationFrame(resize)
    if (!observer) window.addEventListener('resize', resize)

    let visible = typeof IntersectionObserver === 'undefined'
    const sync = () => { stage.dataset.playing = String(visible && !document.hidden) }
    const view = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      sync()
    })
    view?.observe(stage)
    document.addEventListener('visibilitychange', sync)
    sync()
    return () => {
      cancelAnimationFrame(initial)
      observer?.disconnect()
      if (!observer) window.removeEventListener('resize', resize)
      view?.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  useEffect(() => {
    let active = true
    const textures: string[] = []
    const decoded = images.map(async (photo, index) => {
      const image = new Image()
      image.decoding = 'async'
      image.src = photo.src
      try {
        await image.decode()
        return { photo, image, index }
      } catch {
        return null
      }
    })
    void Promise.all(decoded).then(async result => {
      if (!active) return
      const loaded = result.filter(entry => entry !== null)
      const prepared: ReelPhoto[] = loaded.map(entry => entry.photo)
      setReel({ input: images, aspect, photos: [...prepared] })
      // Keep the original row visible until every new texture is decoded, then swap in one paint.
      for (const [position, { photo, image, index }] of loaded.entries()) {
        if (!active) return
        try {
          const blob = await makeMeltMaterial(image, aspect, index)
          if (!active || !blob) continue
          const url = URL.createObjectURL(blob)
          textures.push(url)
          const texture = new Image()
          texture.src = url
          await texture.decode()
          prepared[position] = { ...photo, material: url }
        } catch {
          // The original photograph can still be shown when its pixels cannot be sampled.
        }
      }
      if (active) setReel({ input: images, aspect, photos: prepared })
    })
    return () => {
      active = false
      textures.forEach(url => URL.revokeObjectURL(url))
    }
  }, [images, aspect])

  const stageStyle: Variables = { ...style, '--axis': `${axis}%`, '--fade': `${Math.max(0, Math.min(fade, 45))}%` }
  let band = null
  if (layout && photos.length) {
    const { w, h, radius, unit, columns, sweep, hide } = layout
    const duration = columns * seconds
    const strip = w / SLICES
    Object.assign(stageStyle, {
      '--camera': `${radius * CAMERA}px`, '--radius': `${radius}px`,
      '--tile-w': `${w}px`, '--tile-h': `${h}px`, '--strip-w': `${strip}px`,
      '--melt-start': `${h * MELT_START}px`, '--material-h': `${h * MATERIAL_HEIGHT}px`,
      '--duration': `${duration}s`,
    })
    const facets = Array.from({ length: SLICES }, (_, k) => (
      <span key={k} className="tilted-grid__facet" style={{
        '--slice-turn': `${(.5 - (k + .5) / SLICES) * aspect * unit}deg`,
        '--image-left': `${-k * strip}px`,
      } as Variables} />
    ))
    // The extra travel at either end is outside the mask; the photo can change there.
    const frames = `@keyframes ${orbit} {
      from { transform: rotateY(${-sweep}deg); } to { transform: rotateY(${sweep}deg); }
      0%, ${hide}%, ${100-hide}%, 100% { visibility: hidden; }
      ${hide+.001}%, ${100-hide-.001}% { visibility: visible; }
    }`
    band = (
      <div className="tilted-grid__window" aria-hidden="true">
        <style>{frames}</style>
        <div key={columns} className="tilted-grid__camera">
          {Array.from({ length: columns }, (_, slot) => (
            <CurvedTile key={slot} slot={slot} columns={columns} photos={photos} orbit={orbit} seconds={seconds}>
              {facets}
            </CurvedTile>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div {...props} ref={stageRef} className={cn('tilted-grid', className)} style={stageStyle}>
      {band}
      {children}
    </div>
  )
}

export default TiltedGridHero
