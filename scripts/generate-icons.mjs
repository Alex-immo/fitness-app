// Draws the app icons (a simple dumbbell) and writes them as PNG into public/.
// Uses only Node built-ins so no image dependency is needed.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const BACKGROUND = [16, 20, 24]
const FOREGROUND = [110, 168, 255]

// Shapes in a 0..1 coordinate space: [x, y, width, height].
const SHAPES = [
  [0.3, 0.47, 0.4, 0.06],
  [0.24, 0.34, 0.07, 0.32],
  [0.69, 0.34, 0.07, 0.32],
  [0.17, 0.39, 0.06, 0.22],
  [0.77, 0.39, 0.06, 0.22],
]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function png(size) {
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 3 + 1)
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size
      const v = (y + 0.5) / size
      const inside = SHAPES.some(([sx, sy, w, h]) => u >= sx && u < sx + w && v >= sy && v < sy + h)
      const [r, g, b] = inside ? FOREGROUND : BACKGROUND
      const offset = rowStart + 1 + x * 3
      raw[offset] = r
      raw[offset + 1] = g
      raw[offset + 2] = b
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 2 // colour type RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync('public', { recursive: true })
for (const [name, size] of [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
]) {
  writeFileSync(`public/${name}`, png(size))
}
