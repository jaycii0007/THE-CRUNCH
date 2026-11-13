// The upper face and the moving lower band sample this same transparent texture.
export const MELT_START = .65
export const MATERIAL_HEIGHT = 1.25

function meltContour(width: number, height: number, index: number) {
  const baseline = height * .96
  const radius = Math.min(width * .035, height * .055)
  const edge = new Path2D()
  edge.moveTo(0, baseline - radius)
  edge.quadraticCurveTo(0, baseline, radius, baseline)
  let previousX = radius
  let previousY = baseline

  const flows = [.20, .50, .80].map((position, i) => {
    const phase = index * 2.4 + i * 2.1
    const size = (index + i) % 3
    const depth = [.245, .135, index % 2 ? .038 : .07][size] * height
    const center = (position + .024 * Math.sin(phase)) * width
    const shoulder = (.087 + .20 * depth / height) * width
    const neck = Math.min(shoulder * .5, depth * [.23, .32, .48][size])
    const lean = Math.min(shoulder * .25, depth * .19) * Math.cos(phase + .3)
    const tip = center + lean
    const rootY = baseline + height * .018 * Math.sin(phase - .6)
    const exitY = baseline + height * .018 * Math.sin(phase + 1.15)
    const startX = center - shoulder
    const bridge = (startX + previousX) / 2
    edge.bezierCurveTo(bridge, previousY, bridge, rootY, startX, rootY)
    edge.bezierCurveTo(center - shoulder * .40, rootY, center - neck, rootY + depth * .17,
      center - neck * .84 + lean * .45, rootY + depth * .54)
    edge.bezierCurveTo(tip - neck * .82, rootY + depth * .73, tip - neck * 1.13, rootY + depth,
      tip, rootY + depth)
    edge.bezierCurveTo(tip + neck * 1.05, rootY + depth, tip + neck * .76, rootY + depth * .72,
      center + neck + lean * .4, rootY + depth * .51)
    previousX = center + shoulder
    previousY = exitY
    edge.bezierCurveTo(center + neck * 1.35, rootY + depth * .15, center + shoulder * .48, exitY,
      previousX, exitY)
    return { center, shoulder, tip, depth, rootY }
  })

  const bridge = (previousX + width - radius) / 2
  edge.bezierCurveTo(bridge, previousY, bridge, baseline, width - radius, baseline)
  edge.quadraticCurveTo(width, baseline, width, baseline - radius)
  const outline = new Path2D(edge)
  outline.lineTo(width, radius)
  outline.quadraticCurveTo(width, 0, width - radius, 0)
  outline.lineTo(radius, 0)
  outline.quadraticCurveTo(0, 0, 0, radius)
  outline.closePath()
  return { outline, edge, flows, baseline }
}

export async function makeMeltMaterial(image: HTMLImageElement, aspect: number, index: number) {
  const cropWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect)
  const cropHeight = cropWidth / aspect
  const width = Math.max(1, Math.round(Math.min(832, 640 * aspect, cropWidth)))
  const height = Math.max(1, Math.round(width / aspect))
  const join = Math.floor(height * MELT_START)
  const surface = document.createElement('canvas')
  surface.width = width
  surface.height = Math.ceil(height * MATERIAL_HEIGHT)
  const ctx = surface.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  const { outline, edge, flows, baseline } = meltContour(width, height, index)
  ctx.fillStyle = '#2b1b11'
  ctx.fillRect(0, 0, width, height)
  ctx.drawImage(image, (image.naturalWidth - cropWidth) / 2, (image.naturalHeight - cropHeight) / 2,
    cropWidth, cropHeight, 0, 0, width, height)
  const source = ctx.getImageData(0, join, width, height - join).data

  // Read the silhouette once to find the actual length of each column of liquid.
  ctx.globalCompositeOperation = 'destination-in'
  ctx.fill(outline)
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, join, width, surface.height - join)
  ctx.save()
  ctx.beginPath()
  ctx.rect(0, join, width, surface.height - join)
  ctx.clip()
  ctx.fill(outline)
  ctx.restore()
  const band = ctx.getImageData(0, join, width, surface.height - join)
  const pixels = band.data
  for (let x = 0; x < width; x++) {
    let last = band.height - 1
    while (last > 0 && pixels[(last * width + x) * 4 + 3] === 0) last--
    const length = last + pixels[(last * width + x) * 4 + 3] / 255
    const stretch = length - (height - join)
    let gather = 0
    for (const { center, shoulder, depth } of flows) {
      const dx = (x - center) / shoulder
      gather += dx * Math.exp(-4 * dx * dx) * depth * .48
    }

    for (let y = 0; y <= last; y++) {
      const dest = (y * width + x) * 4
      if (!pixels[dest + 3]) continue
      const fall = Math.min(1, y / Math.max(1, length)) ** 2
      const sx = Math.max(0, Math.min(width - 1, x + gather * fall))
      const sy = Math.max(0, Math.min(height - join - 1, y - stretch * fall))
      const col = Math.floor(sx), row = Math.floor(sy)
      const a = (row * width + col) * 4
      const b = a + (col + 1 < width ? 4 : 0)
      const next = row + 1 < height - join ? width * 4 : 0
      const fx = sx - col, fy = sy - row
      for (let channel = 0; channel < 3; channel++) {
        const top = source[a + channel] * (1 - fx) + source[b + channel] * fx
        const bottom = source[a + next + channel] * (1 - fx) + source[b + next + channel] * fx
        pixels[dest + channel] = top + (bottom - top) * fy
      }
    }
  }
  ctx.putImageData(band, 0, join)
  ctx.globalCompositeOperation = 'source-atop'

  const warmth = ctx.createLinearGradient(0, height * .72, 0, height * 1.21)
  warmth.addColorStop(0, 'rgba(216,96,32,0)')
  warmth.addColorStop(.63, 'rgba(226,104,31,.07)')
  warmth.addColorStop(1, 'rgba(255,133,47,.24)')
  ctx.fillStyle = warmth
  ctx.fillRect(0, join, width, surface.height - join)

  const rim = ctx.createLinearGradient(0, 0, 0, baseline)
  rim.addColorStop(0, 'rgba(255,229,187,.62)')
  rim.addColorStop(.55, 'rgba(90,53,29,.34)')
  rim.addColorStop(1, 'rgba(112,55,24,.78)')
  ctx.lineWidth = height * .014
  ctx.strokeStyle = rim
  ctx.stroke(outline)
  for (const { tip, depth, shoulder, rootY } of flows) {
    const y = rootY + depth * .86
    const glint = ctx.createRadialGradient(tip, y, 0, tip, y, shoulder * 1.25)
    glint.addColorStop(0, 'rgba(255,213,146,.94)')
    glint.addColorStop(.38, 'rgba(251,146,64,.74)')
    glint.addColorStop(1, 'rgba(224,105,37,0)')
    ctx.strokeStyle = glint
    ctx.lineWidth = height * .021
    ctx.stroke(edge)
  }
  return new Promise<Blob | null>(resolve => surface.toBlob(resolve, 'image/png'))
}
