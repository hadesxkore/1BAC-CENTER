import jsPDF from 'jspdf'
import type { Action } from '@/data/sampleActions'
import { format } from 'date-fns'

// Adjust these two imports to match the actual filenames in
// src/assets (e.g. logo1.png / logo2.png, or .svg/.jpg — whatever
// you have there). Vite will turn each into a bundled URL string.
import logo1 from '@/assets/logo1.png'
import logo2 from '@/assets/logo2.png'

const STATUS_LABELS: Record<string, string> = {
  'under-action': 'Under Action',
  'in-progress': 'Under Action',
  resolved: 'Resolved',
  closed: 'Closed',
  completed: 'Completed',
  pending: 'Pending',
  unlocated: 'Unlocated',
}

// ---------- Color palette ----------
const COLORS = {
  navy: [0, 51, 102] as [number, number, number],
  green: [46, 125, 50] as [number, number, number],
  greenLight: [232, 245, 233] as [number, number, number],
  greenBorder: [178, 214, 184] as [number, number, number],
  darkNavy: [25, 55, 109] as [number, number, number],
  navyLight: [235, 240, 250] as [number, number, number],
  grayBg: [246, 246, 246] as [number, number, number],
  grayBorder: [210, 210, 210] as [number, number, number],
  textDark: [30, 30, 30] as [number, number, number],
  textMuted: [110, 110, 110] as [number, number, number],
  statusGreen: [34, 197, 94] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  sectionBgGreen: [241, 248, 242] as [number, number, number],
  sectionBgNavy: [238, 242, 250] as [number, number, number],
}

const MARGIN = 15

function imageFormatFromDataUrl(dataUrl: string): string {
  const match = /^data:image\/(\w+);/.exec(dataUrl)
  const type = (match?.[1] || 'jpeg').toLowerCase()
  if (type === 'jpg') return 'JPEG'
  return type.toUpperCase()
}

// Scales an image down (never up) to fit inside a maxW x maxH box while
// preserving its real aspect ratio, so logos never look stretched or
// squeezed just because the box they're dropped into is a different
// shape than the source file. Falls back to the box dimensions if jsPDF
// can't read the image's intrinsic size for some reason.
function fitImageInBox(doc: jsPDF, imgData: string, maxW: number, maxH: number): { w: number; h: number } {
  try {
    const props = doc.getImageProperties(imgData)
    const ratio = props.width / props.height
    let w = maxW
    let h = w / ratio
    if (h > maxH) {
      h = maxH
      w = h * ratio
    }
    return { w, h }
  } catch {
    return { w: maxW, h: maxH }
  }
}

// The default jsPDF font (Helvetica) looks dated / "default template".
// We load a clean, minimalist sans-serif (Poppins) at runtime and embed
// it into the PDF. FONT_FAMILY is swapped from 'helvetica' to 'Poppins'
// only if the font successfully loads, so the report still works fine
// offline or if the font CDN is unreachable.
let FONT_FAMILY: string = 'helvetica'

async function loadFontsIntoDoc(doc: jsPDF): Promise<void> {
  try {
    const [regular, bold] = await Promise.all([
      fetchFontAsBase64('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Regular.ttf'),
      fetchFontAsBase64('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/poppins/Poppins-Bold.ttf'),
    ])
    doc.addFileToVFS('Poppins-Regular.ttf', regular)
    doc.addFont('Poppins-Regular.ttf', 'Poppins', 'normal')
    doc.addFileToVFS('Poppins-Bold.ttf', bold)
    doc.addFont('Poppins-Bold.ttf', 'Poppins', 'bold')
    FONT_FAMILY = 'Poppins'
  } catch {
    // Offline / CDN blocked — silently keep using helvetica so report
    // generation never fails just because of the font.
    FONT_FAMILY = 'helvetica'
  }
}

async function fetchFontAsBase64(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to fetch font: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export async function generatePGOReport(concerns: Action[]): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'legal' })
  const pgoInvolvedConcerns = concerns.filter(c => c.pgoInvolved)

  // Collect every image URL that will appear in the report up front, then
  // fetch them all AT THE SAME TIME instead of one-by-one during render.
  // This is the single biggest speedup — network latency is paid once
  // (in parallel) instead of once per image (in sequence).
  const urls = new Set<string>()
  for (const concern of pgoInvolvedConcerns) {
    if (concern.concernPhotos?.[0]) urls.add(concern.concernPhotos[0].url)

    const deptActions = concern.actionHistory?.filter(a => a.actionType === 'department') || []
    const legacyAction = !deptActions.length && concern.actionTaken ? concern.actionTaken : null
    const deptRecord = deptActions[deptActions.length - 1] || legacyAction
    ;((deptRecord?.photos || []) as any[]).filter(p => p.fileType !== 'document').slice(0, 3).forEach(p => urls.add(p.url))

    const pgoActions = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
    const pgoRecord = pgoActions[pgoActions.length - 1]
    ;((pgoRecord?.photos || []) as any[]).filter(p => p.fileType !== 'document').slice(0, 2).forEach(p => urls.add(p.url))
  }
  const [imageCache, , logoData] = await Promise.all([
    preloadImages(Array.from(urls)),
    loadFontsIntoDoc(doc),
    preloadImages([logo1, logo2]),
  ])

  let isFirstPage = true
  for (const concern of pgoInvolvedConcerns) {
    if (!isFirstPage) doc.addPage()
    isFirstPage = false
    renderConcernPage(doc, concern, imageCache, {
      logo1: logoData.get(logo1),
      logo2: logoData.get(logo2),
    })
  }

  return doc
}

// Fetch + decode every image concurrently. Failures are swallowed per-image
// (caller falls back to a placeholder box) so one bad URL can't slow/break
// the rest.
async function preloadImages(urls: string[]): Promise<Map<string, string>> {
  const cache = new Map<string, string>()
  await runWithConcurrencyLimit(urls, 5, async url => {
    try {
      cache.set(url, await loadImage(url))
    } catch (err) {
      // leave unset; renderer draws a placeholder. Logged (not swallowed
      // silently) so a real cause — expired signed URL, CORS, 404 — shows
      // up in the browser console instead of just being an unexplained gap.
      console.warn(`[PGO Report] Failed to load image: ${url}`, err)
    }
  })
  return cache
}

interface LogoData {
  logo1?: string
  logo2?: string
}

function renderConcernPage(doc: jsPDF, concern: Action, imageCache: Map<string, string>, logos: LogoData) {
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let y = 12

  y = renderHeader(doc, pageWidth, y, logos)
  y = renderConcernDetails(doc, concern, pageWidth, y, imageCache)

  const deptActions = concern.actionHistory?.filter(a => a.actionType === 'department') || []
  const legacyAction = !deptActions.length && concern.actionTaken ? concern.actionTaken : null
  const hasLGU = deptActions.length > 0 || !!legacyAction

  const pgoActions = concern.actionHistory?.filter(a => a.actionType === 'pgo') || []
  const hasPGO = pgoActions.length > 0

  // Everything below the concern details has to live on THIS page — no
  // second page. So instead of letting each section take whatever space
  // it wants, we split what's left of the page between the two sections
  // up front, and each one auto-shrinks (photos, then font size) to fit
  // its allotted budget.
  const bottomMargin = 12
  const sectionGap = hasLGU && hasPGO ? 6 : 0
  const remaining = Math.max(0, pageHeight - bottomMargin - y - sectionGap)
  const lguBudget = hasLGU && hasPGO ? remaining * 0.48 : remaining
  const pgoBudget = hasLGU && hasPGO ? remaining * 0.52 : remaining

  if (hasLGU) {
    y = renderActionSection(doc, concern, deptActions[deptActions.length - 1] || legacyAction, {
      title: 'ACTION TAKEN BY LGU',
      headerColor: COLORS.green,
      boxColor: COLORS.greenLight,
      maxPhotos: 3,
      defaultOffice: 'LGU',
      maxSectionHeight: lguBudget,
      y, pageWidth, pageHeight,
    }, imageCache) + sectionGap
  }

  if (hasPGO) {
    renderActionSection(doc, concern, pgoActions[pgoActions.length - 1], {
      title: 'ACTION TAKEN BY PGO OFFICE',
      headerColor: COLORS.darkNavy,
      boxColor: COLORS.navyLight,
      maxPhotos: 2,
      defaultOffice: 'PGO - Environment Desk',
      maxSectionHeight: pgoBudget,
      y, pageWidth, pageHeight,
    }, imageCache)
  }
}

// ---------- Header ----------
function renderHeader(doc: jsPDF, pageWidth: number, y: number, logos: LogoData): number {
  // Left logo — fit inside a 16x16 box, preserving its natural aspect
  // ratio (instead of forcing a fixed square), so a non-square source
  // image never looks squeezed.
  const logoBoxL = 16
  if (logos.logo1) {
    const { w, h } = fitImageInBox(doc, logos.logo1, logoBoxL, logoBoxL)
    const dx = MARGIN + (logoBoxL - w) / 2
    const dy = y + (logoBoxL - h) / 2
    doc.addImage(logos.logo1, imageFormatFromDataUrl(logos.logo1), dx, dy, w, h)
  } else {
    doc.setDrawColor(...COLORS.navy)
    doc.setLineWidth(0.5)
    doc.circle(MARGIN + 8, y + 8, 8, 'S')
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.navy)
    doc.text('LOGO', MARGIN + 8, y + 9, { align: 'center' })
  }

  // Title
  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(19)
  doc.setTextColor(...COLORS.navy)
  doc.text('ENVIRONMENTAL CONCERN', pageWidth / 2, y + 6, { align: 'center' })
  doc.setFontSize(16)
  doc.setTextColor(...COLORS.green)
  doc.text('ACTION TAKEN REPORT', pageWidth / 2, y + 13, { align: 'center' })

  // Right logo / badge — same fit-within-box treatment. This is the one
  // that was getting squeezed before (forced into a fixed 32x15 box
  // regardless of its real proportions).
  const logoBoxR_W = 32
  const logoBoxR_H = 15
  const boxR_X = pageWidth - MARGIN - logoBoxR_W
  if (logos.logo2) {
    const { w, h } = fitImageInBox(doc, logos.logo2, logoBoxR_W, logoBoxR_H)
    const dx = boxR_X + (logoBoxR_W - w) / 2
    const dy = y + (logoBoxR_H - h) / 2
    doc.addImage(logos.logo2, imageFormatFromDataUrl(logos.logo2), dx, dy, w, h)
  } else {
    doc.setFillColor(...COLORS.navy)
    doc.roundedRect(boxR_X, y, logoBoxR_W, 15, 2, 2, 'F')
    doc.setTextColor(...COLORS.white)
    doc.setFontSize(11)
    doc.text('1BATAAN', boxR_X + 16, y + 6.5, { align: 'center' })
    doc.setFillColor(200, 40, 40)
    doc.roundedRect(boxR_X + 1, y + 8.5, 30, 5, 1, 1, 'F')
    doc.setFontSize(7.5)
    doc.text('ACTION CENTER', boxR_X + 16, y + 12, { align: 'center' })
  }

  y += 19
  doc.setDrawColor(...COLORS.grayBorder)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y, pageWidth - MARGIN, y)
  return y + 6
}

// ---------- Small vector icons (no emoji font dependency) ----------
function drawIcon(doc: jsPDF, type: 'calendar' | 'pin' | 'warning' | 'person' | 'check' | 'document', x: number, y: number, size: number, color: [number, number, number]) {
  doc.setDrawColor(...color)
  doc.setFillColor(...color)
  doc.setLineWidth(0.35)
  switch (type) {
    case 'document':
      doc.roundedRect(x, y, size, size, 0.4, 0.4, 'S')
      doc.line(x + size * 0.2, y + size * 0.32, x + size * 0.8, y + size * 0.32)
      doc.line(x + size * 0.2, y + size * 0.55, x + size * 0.8, y + size * 0.55)
      doc.line(x + size * 0.2, y + size * 0.78, x + size * 0.55, y + size * 0.78)
      break
    case 'calendar':
      doc.roundedRect(x, y, size, size, 0.4, 0.4, 'S')
      doc.line(x, y + size * 0.32, x + size, y + size * 0.32)
      doc.line(x + size * 0.25, y - 0.5, x + size * 0.25, y + 0.8)
      doc.line(x + size * 0.75, y - 0.5, x + size * 0.75, y + 0.8)
      break
    case 'pin': {
      const cx = x + size / 2
      const r = size * 0.32
      doc.circle(cx, y + r, r, 'S')
      doc.triangle(cx - r * 0.75, y + r * 1.55, cx + r * 0.75, y + r * 1.55, cx, y + size, 'S')
      doc.circle(cx, y + r, r * 0.32, 'F')
      break
    }
    case 'warning':
      doc.triangle(x + size / 2, y, x, y + size, x + size, y + size, 'S')
      doc.setLineWidth(0.5)
      doc.line(x + size / 2, y + size * 0.4, x + size / 2, y + size * 0.68)
      doc.circle(x + size / 2, y + size * 0.82, 0.3, 'F')
      break
    case 'person':
      doc.circle(x + size / 2, y + size * 0.22, size * 0.2, 'S')
      doc.roundedRect(x + size * 0.15, y + size * 0.48, size * 0.7, size * 0.5, 1, 1, 'S')
      break
    case 'check':
      doc.setLineWidth(0.6)
      doc.line(x, y + size * 0.55, x + size * 0.35, y + size * 0.85)
      doc.line(x + size * 0.35, y + size * 0.85, x + size, y + size * 0.1)
      break
  }
}

function sectionHeaderBar(doc: jsPDF, x: number, y: number, w: number, label: string, color: [number, number, number]) {
  doc.setFillColor(...color)
  doc.roundedRect(x, y, w, 7, 1.5, 1.5, 'F')
  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...COLORS.white)
  doc.text(label, x + 3, y + 4.8)
}

function iconDetailRow(doc: jsPDF, x: number, y: number, maxWidth: number, icon: 'calendar' | 'pin' | 'warning' | 'person' | 'document', label: string, value: string, color: [number, number, number]): number {
  drawIcon(doc, icon, x, y - 3, 3.5, color)
  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.textDark)
  doc.text(label, x + 6, y)
  doc.setFont(FONT_FAMILY, 'normal')
  doc.setFontSize(9.5)
  const lines = doc.splitTextToSize(value, maxWidth)
  doc.text(lines, x + 6, y + 4.5)
  return y + 4.5 + lines.length * 4
}

// ---------- Concern Details (photo + 2-column detail grid) ----------
// Previously this rendered a 3-column layout: photo | icon-detail rows
// (stacked one under another) | a green "concern description" box. The
// description box has been removed, and the detail rows (REPORT TITLE,
// DATE REPORTED, LOCATION, TYPE OF CONCERN) now use the freed-up width
// to sit in a 2-column x 2-row grid instead of 4 stacked rows.
function renderConcernDetails(doc: jsPDF, concern: Action, pageWidth: number, y: number, imageCache: Map<string, string>): number {
  sectionHeaderBar(doc, MARGIN, y, 58, 'CONCERN DETAILS', COLORS.green)
  y += 11

  const colA = MARGIN // photo
  const colB = MARGIN + 62 // details grid start

  const photoW = 55
  const photoH = 42

  // Photo (already fetched during preload — just look it up)
  const concernPhotoUrl = concern.concernPhotos?.[0]?.url
  const concernImgData = concernPhotoUrl ? imageCache.get(concernPhotoUrl) : undefined
  if (concernImgData) {
    // Detect the real image format instead of assuming JPEG — forcing
    // the wrong format here is what was rendering some photos (PNGs,
    // WEBPs, etc.) as a blank white box instead of throwing a visible
    // error.
    doc.addImage(concernImgData, imageFormatFromDataUrl(concernImgData), colA, y, photoW, photoH)
  } else {
    doc.setDrawColor(...COLORS.grayBorder)
    doc.rect(colA, y, photoW, photoH)
    if (concernPhotoUrl) {
      doc.setFontSize(9)
      doc.setTextColor(...COLORS.textMuted)
      doc.text('Image unavailable', colA + photoW / 2, y + photoH / 2, { align: 'center' })
    }
  }

  // Details grid — now spans the full width to the right of the photo,
  // since there's no description box eating the right-hand side anymore.
  const detailsWidth = pageWidth - MARGIN - colB
  const gap = 8
  const colWidth = (detailsWidth - gap) / 2
  const col1X = colB
  const col2X = colB + colWidth + gap
  const rowWidth = colWidth - 4

  let ry = y + 3

  // Row 1: REPORT TITLE | DATE REPORTED
  const row1Left = iconDetailRow(doc, col1X, ry, rowWidth, 'document', 'REPORT TITLE', concern.reportTitle, COLORS.green)
  const row1Right = iconDetailRow(doc, col2X, ry, rowWidth, 'calendar', 'DATE REPORTED', format(new Date(concern.dateReported), 'MMMM dd, yyyy'), COLORS.green)
  ry = Math.max(row1Left, row1Right) + 4

  // Row 2: LOCATION | TYPE OF CONCERN
  const row2Left = iconDetailRow(doc, col1X, ry, rowWidth, 'pin', 'LOCATION', concern.location, COLORS.green)
  const row2Right = iconDetailRow(doc, col2X, ry, rowWidth, 'warning', 'TYPE OF CONCERN', concern.category.charAt(0).toUpperCase() + concern.category.slice(1), COLORS.green)
  ry = Math.max(row2Left, row2Right)

  doc.setFontSize(7.5)
  doc.setTextColor(...COLORS.textMuted)
  doc.text(`Tracking ID: ${concern.id.slice(0, 18)}`, col1X, ry + 4)

  return y + Math.max(photoH, ry - y + 8) + 8
}

// ---------- Shared action section (LGU / PGO) ----------
interface ActionSectionOpts {
  title: string
  headerColor: [number, number, number]
  boxColor: [number, number, number]
  maxPhotos: number
  defaultOffice: string
  maxSectionHeight: number
  y: number
  pageWidth: number
  pageHeight: number
}

// Shrinks font size (and truncates as a last resort) so a block of text
// always fits within maxHeight — this is what keeps the PGO notes from
// pushing the report onto a second page.
function fitTextToHeight(doc: jsPDF, text: string, maxWidth: number, maxHeight: number): { lines: string[]; fontSize: number; lineHeight: number } {
  const trySizes = [9, 8.5, 8, 7.5, 7, 6.5, 6]
  let result = { lines: [text], fontSize: 6, lineHeight: 3.16 }
  for (const fontSize of trySizes) {
    doc.setFont(FONT_FAMILY, 'normal')
    doc.setFontSize(fontSize)
    const lineHeight = fontSize * 0.46 + 0.4
    const lines = doc.splitTextToSize(text, maxWidth) as string[]
    result = { lines, fontSize, lineHeight }
    if (lines.length * lineHeight <= maxHeight) return result
  }
  // Even the smallest readable size doesn't fit — truncate with an ellipsis.
  const maxLines = Math.max(1, Math.floor(maxHeight / result.lineHeight))
  if (result.lines.length > maxLines) {
    const truncated = result.lines.slice(0, maxLines)
    truncated[maxLines - 1] = truncated[maxLines - 1].replace(/\s*$/, '') + '…'
    result = { ...result, lines: truncated }
  }
  return result
}

function renderActionSection(doc: jsPDF, concern: Action, actionRecord: any, opts: ActionSectionOpts, imageCache: Map<string, string>): number {
  const { title, headerColor, boxColor, maxPhotos, defaultOffice, maxSectionHeight, pageWidth } = opts
  let y = opts.y
  const sectionTop = y

  const headerWidth = Math.min(pageWidth - MARGIN * 2, title.length * 2.05 + 20)
  sectionHeaderBar(doc, MARGIN, y, headerWidth, title, headerColor)
  y += 12

  const contentWidth = pageWidth - MARGIN * 2
  const gap = 4
  const photoW = (contentWidth - gap * (maxPhotos - 1)) / maxPhotos

  // How much room is left for photos + the details box after the header.
  const spaceForBody = Math.max(28, maxSectionHeight - (y - sectionTop))

  const photos = (actionRecord?.photos || []).filter((p: any) => p.fileType !== 'document').slice(0, maxPhotos)
  const defaultPhotoH = maxPhotos === 3 ? 38 : 48
  const captionSpace = 3 // just breathing room below the photo now that there's no filename caption

  // Photos get at most half the remaining budget; shrink them (down to a
  // 20mm floor) if the section is tight, so the text box below always has
  // room to breathe.
  let photoH = 0
  if (photos.length > 0) {
    const maxPhotoBudget = spaceForBody * 0.55
    photoH = Math.min(defaultPhotoH, maxPhotoBudget - captionSpace)
    photoH = Math.max(20, photoH)

    for (let i = 0; i < photos.length; i++) {
      const xPos = MARGIN + i * (photoW + gap)
      const imgData = imageCache.get(photos[i].url)
      if (imgData) {
        // Detect the real image format instead of assuming JPEG — forcing
        // the wrong format is what was rendering some photos as a blank
        // white box instead of a visible error.
        doc.addImage(imgData, imageFormatFromDataUrl(imgData), xPos, y, photoW, photoH)
      } else {
        doc.setDrawColor(...COLORS.grayBorder)
        doc.rect(xPos, y, photoW, photoH)
      }
      // Number badge
      doc.setFillColor(...headerColor)
      doc.circle(xPos + 5, y + 5, 4, 'F')
      doc.setFont(FONT_FAMILY, 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...COLORS.white)
      doc.text(String(i + 1), xPos + 5, y + 6.3, { align: 'center' })
    }
    y += photoH + captionSpace + 1
  }

  // Details box (notes left, meta + status right). Sized to the content
  // when it's short, but capped to whatever budget is left in this
  // section — long notes shrink their font to stay within that cap
  // instead of pushing the report onto a second page.
  const notesWidth = contentWidth * 0.62
  const notes = actionRecord?.notes || 'No action notes provided'
  const availableBoxH = Math.max(26, sectionTop + maxSectionHeight - y)
  const metaBlockH = 26 // two icon rows + status badge clearance

  const naturalFit = fitTextToHeight(doc, notes, notesWidth - 5, 9999)
  const naturalBoxH = Math.max(metaBlockH, 11 + naturalFit.lines.length * naturalFit.lineHeight)

  let boxH: number
  let fit: { lines: string[]; fontSize: number; lineHeight: number }
  if (naturalBoxH <= availableBoxH) {
    boxH = naturalBoxH
    fit = naturalFit
  } else {
    boxH = availableBoxH
    fit = fitTextToHeight(doc, notes, notesWidth - 5, boxH - 11)
  }

  doc.setFillColor(...boxColor)
  doc.roundedRect(MARGIN, y, contentWidth, boxH, 2, 2, 'F')
  doc.setDrawColor(...COLORS.grayBorder)
  doc.roundedRect(MARGIN, y, contentWidth, boxH, 2, 2, 'S')

  doc.setFillColor(...headerColor)
  doc.roundedRect(MARGIN + 3, y + 3, 45, 5.5, 1, 1, 'F')
  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.white)
  doc.text('ACTION TAKEN DETAILS', MARGIN + 5, y + 6.8)

  doc.setFont(FONT_FAMILY, 'normal')
  doc.setFontSize(fit.fontSize)
  doc.setTextColor(...COLORS.textDark)
  fit.lines.forEach((line, i) => {
    doc.text(line, MARGIN + 3, y + 13 + i * fit.lineHeight)
  })

  // Meta column
  const metaX = MARGIN + notesWidth + 6
  let metaY = y + 5
  metaY = iconDetailRow(doc, metaX, metaY, contentWidth - notesWidth - 12, 'calendar', 'DATE ACTION TAKEN',
    (() => {
      const actionDate = actionRecord?.actionDate || concern.actionDate || 'N/A'
      return actionDate === 'Ongoing' || actionDate === 'N/A' ? actionDate : format(new Date(actionDate), 'MMMM dd, yyyy')
    })(), headerColor)

  metaY += 3
  iconDetailRow(doc, metaX, metaY, contentWidth - notesWidth - 12, 'person', 'RESPONSIBLE OFFICE',
    actionRecord?.submittedBy || defaultOffice, headerColor)

  // Status badge (bottom-right of box)
  const badgeW = 37
  const badgeX = MARGIN + contentWidth - badgeW - 3
  const badgeY = y + boxH - 9
  doc.setFillColor(...COLORS.statusGreen)
  doc.roundedRect(badgeX, badgeY, badgeW, 7, 1.5, 1.5, 'F')
  drawIcon(doc, 'check', badgeX + 3, badgeY + 1.5, 3.5, COLORS.white)
  doc.setFont(FONT_FAMILY, 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...COLORS.white)
  doc.text(STATUS_LABELS[concern.status] || concern.status, badgeX + 8, badgeY + 4.8)

  return y + boxH
}

// Loads an image and returns it as a base64 data URL.
// Uses fetch()+blob instead of <img>+canvas: the canvas approach silently
// fails ("tainted canvas") on some CORS setups even when the image itself
// loads fine visually, which is what was causing "Image unavailable" on
// pictures that clearly exist. fetch() gives the raw bytes directly.
// Retries once on failure since bursts of many simultaneous requests can
// trip rate limits / connection limits on the image host.
async function loadImage(url: string, attempt = 1): Promise<string> {
  try {
    const response = await fetch(url, { mode: 'cors' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const blob = await response.blob()
    // A 200 response doesn't guarantee we actually got image bytes — an
    // expired/private URL can still return 200 with an HTML login or
    // error page. Rendering THAT as an image is exactly what produces a
    // blank white box with no visible error. Catch it here instead so it
    // becomes a real, loggable failure.
    if (!blob.type.startsWith('image/')) {
      throw new Error(`Response was not an image (content-type: "${blob.type || 'unknown'}") — the URL may require authentication, be private, or have expired`)
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to read image blob'))
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 300 * attempt))
      return loadImage(url, attempt + 1)
    }
    throw err
  }
}

// Runs async tasks with a concurrency cap instead of firing everything at
// once — large reports (many concerns × several photos each) were tripping
// browser/server connection limits, causing otherwise-valid images to fail.
async function runWithConcurrencyLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0
  async function next(): Promise<void> {
    const current = index++
    if (current >= items.length) return
    await worker(items[current])
    await next()
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()))
}