#!/usr/bin/env node
// Generates resources/icon.icns, resources/icon.ico, and resources/icon.png from resources/icon.svg
// Requires: macOS (uses sips + iconutil); .ico uses a PNG renamed with .ico extension
// For a proper multi-resolution .ico on Windows, install ImageMagick: brew install imagemagick

import { execSync } from 'child_process'
import { mkdirSync, rmSync, existsSync, copyFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resources = join(root, 'resources')
const svg = join(resources, 'icon.svg')
const iconsetDir = join(resources, 'icon.iconset')

if (!existsSync(svg)) {
  console.error('resources/icon.svg not found')
  process.exit(1)
}

// Rasterize SVG → 1024×1024 PNG
const tmpPng = join(resources, '_icon_tmp.png')

try {
  execSync(`qlmanage -t -s 1024 -o "${resources}" "${svg}"`, { stdio: 'pipe' })
  const rendered = join(resources, 'icon.svg.png')
  if (!existsSync(rendered)) throw new Error('qlmanage produced no output')
  execSync(`mv "${rendered}" "${tmpPng}"`)
} catch {
  console.error('qlmanage failed — trying rsvg-convert...')
  try {
    execSync(`rsvg-convert -w 1024 -h 1024 "${svg}" -o "${tmpPng}"`)
  } catch {
    console.error(
      'Could not rasterize SVG.\n' +
      'Option A: brew install librsvg then re-run.\n' +
      'Option B: open resources/icon.svg in Preview, export as 1024×1024 PNG to resources/_icon_tmp.png, then re-run.'
    )
    process.exit(1)
  }
}

// Build macOS iconset
if (existsSync(iconsetDir)) rmSync(iconsetDir, { recursive: true })
mkdirSync(iconsetDir)

const sizes = [16, 32, 64, 128, 256, 512]
for (const s of sizes) {
  execSync(`sips -z ${s} ${s} "${tmpPng}" --out "${join(iconsetDir, `icon_${s}x${s}.png`)}"`, { stdio: 'pipe' })
  execSync(`sips -z ${s * 2} ${s * 2} "${tmpPng}" --out "${join(iconsetDir, `icon_${s}x${s}@2x.png`)}"`, { stdio: 'pipe' })
}

// Create .icns
execSync(`iconutil -c icns "${iconsetDir}" -o "${join(resources, 'icon.icns')}"`)

// icon.png (512px)
copyFileSync(join(iconsetDir, 'icon_512x512.png'), join(resources, 'icon.png'))

// icon.ico — try ImageMagick first, fall back to a 256px PNG renamed .ico
// (electron-builder accepts PNG-in-.ico for basic use; for a real multi-res .ico use ImageMagick)
const ico256 = join(iconsetDir, 'icon_256x256.png')
const icoPath = join(resources, 'icon.ico')
try {
  execSync(
    `convert "${ico256}" \
      \\( -clone 0 -resize 256x256 \\) \
      \\( -clone 0 -resize 128x128 \\) \
      \\( -clone 0 -resize 64x64 \\) \
      \\( -clone 0 -resize 48x48 \\) \
      \\( -clone 0 -resize 32x32 \\) \
      \\( -clone 0 -resize 16x16 \\) \
      -delete 0 "${icoPath}"`,
    { stdio: 'pipe' }
  )
  console.log('Built multi-resolution .ico with ImageMagick')
} catch {
  // ImageMagick not available — use a 256px PNG as a .ico stand-in
  copyFileSync(ico256, icoPath)
  console.warn(
    'ImageMagick not found — created a single-size .ico (256px).\n' +
    'For a proper multi-resolution .ico: brew install imagemagick && npm run generate-icons'
  )
}

// Cleanup
rmSync(iconsetDir, { recursive: true })
rmSync(tmpPng)

console.log('Generated: resources/icon.icns, resources/icon.ico, resources/icon.png')
