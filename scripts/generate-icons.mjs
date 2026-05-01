#!/usr/bin/env node
// Generates resources/icon.icns, resources/icon.ico, and resources/icon.png from resources/icon.svg
// Cross-platform: uses Python (cairosvg + Pillow) for rasterization and icon building.
// Install deps once: pip install cairosvg Pillow
// macOS native fallback: sips + iconutil (used automatically when Python libs are unavailable)

import { execSync } from 'child_process'
import { mkdirSync, rmSync, existsSync, copyFileSync, writeFileSync, mkdtempSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const resources = join(root, 'resources')
const svg = join(resources, 'icon.svg')

if (!existsSync(svg)) {
  console.error('resources/icon.svg not found')
  process.exit(1)
}

// Try Python-based cross-platform generation first (cairosvg + Pillow)
// This correctly preserves SVG transparency so rounded-rect icons have transparent corners.
const pythonScript = `
import cairosvg, io, os, sys
from PIL import Image

svg_path = sys.argv[1]
resources = sys.argv[2]

png_data = cairosvg.svg2png(url=svg_path, output_width=1024, output_height=1024, background_color=None)
img1024 = Image.open(io.BytesIO(png_data)).convert('RGBA')

img512 = img1024.resize((512, 512), Image.LANCZOS)
img512.save(os.path.join(resources, 'icon.png'), 'PNG')

icns_sizes = [16, 32, 64, 128, 256, 512, 1024]
imgs = [img1024.resize((s, s), Image.LANCZOS) for s in icns_sizes]
imgs[0].save(os.path.join(resources, 'icon.icns'), format='ICNS',
             sizes=[(s, s) for s in icns_sizes], append_images=imgs[1:])

ico_sizes = [(256,256),(128,128),(64,64),(48,48),(32,32),(16,16)]
ico_imgs = [img1024.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_imgs[0].save(os.path.join(resources, 'icon.ico'), format='ICO',
                 sizes=ico_sizes, append_images=ico_imgs[1:])

print('Generated: resources/icon.icns, resources/icon.ico, resources/icon.png')
`

const tmpDir = mkdtempSync(join(tmpdir(), 'generate-icons-'))
const tmpScript = join(tmpDir, 'gen_icons.py')
try {
  writeFileSync(tmpScript, pythonScript)
  execSync(`python3 "${tmpScript}" "${svg}" "${resources}"`, { stdio: 'inherit' })
  process.exit(0)
} catch {
  console.warn('Python/cairosvg generation failed — falling back to macOS native tools (sips + iconutil).')
  console.warn('For cross-platform support: pip install cairosvg Pillow')
} finally {
  rmSync(tmpDir, { recursive: true })
}

// macOS-only fallback: rsvg-convert / qlmanage → sips → iconutil
const iconsetDir = join(resources, 'icon.iconset')
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
      'Option A: pip install cairosvg Pillow then re-run.\n' +
      'Option B: brew install librsvg then re-run.\n' +
      'Option C: open resources/icon.svg in Preview, export as 1024×1024 PNG to resources/_icon_tmp.png, then re-run.'
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
