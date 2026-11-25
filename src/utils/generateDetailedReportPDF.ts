import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { Action, ConcernImage } from '@/data/sampleActions'

type RGB = [number, number, number]

const C = {
  navy: [17, 45, 99] as RGB,
  blue: [37, 99, 235] as RGB,
  green: [22, 128, 61] as RGB,
  greenSoft: [236, 247, 240] as RGB,
  slate: [30, 41, 59] as RGB,
  muted: [100, 116, 139] as RGB,
  line: [226, 232, 240] as RGB,
  soft: [244, 247, 251] as RGB,
  white: [255, 255, 255] as RGB,
}

const STATUS: Record<string, { label: string; fg: RGB; bg: RGB }> = {
  pending: { label: 'PENDING', fg: [161, 98, 7], bg: [254, 243, 199] },
  'in-progress': { label: 'UNDER ACTION', fg: [29, 78, 216], bg: [219, 234, 254] },
  'under-action': { label: 'UNDER ACTION', fg: [29, 78, 216], bg: [219, 234, 254] },
  'for-validation': { label: 'FOR VALIDATION', fg: [109, 40, 217], bg: [237, 233, 254] },
  completed: { label: 'COMPLETED', fg: [21, 128, 61], bg: [220, 252, 231] },
  resolved: { label: 'RESOLVED', fg: [21, 128, 61], bg: [220, 252, 231] },
  closed: { label: 'CLOSED', fg: [71, 85, 105], bg: [226, 232, 240] },
  unlocated: { label: 'UNLOCATED', fg: [185, 28, 28], bg: [254, 226, 226] },
}

const M = 14 // page margin (mm)
const MAX_PHOTOS = 6

interface Img {
  data: string
  w: number
  h: number
}

export interface DetailedReportMeta {
  title: string
  periodLabel: string
  statusLabel: string
}

// ---------- image loading ----------
// Fetch -> downscale to <= 900px JPEG so a report with many photos stays small.
async function loadImage(url: string, attempt = 1): Promise<Img> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) throw new Error('not an image')
    const bmp = await createImageBitmap(blob)
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height))
    const w = Math.max(1, Math.round(bmp.width * scale))
    const h = Math.max(1, Math.round(bmp.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close?.()
    return { data: canvas.toDataURL('image/jpeg', 0.8), w, h }
  } catch (err) {
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 400 * attempt))
      return loadImage(url, attempt + 1)
    }
    throw err
  }
}

async function preload(urls: string[]): Promise<Map<string, Img>> {
  const cache = new Map<string, Img>()
  let i = 0
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++]
      try {
        cache.set(url, await loadImage(url))
      } catch (e) {
        console.warn('[Detailed PDF] image failed:', url, e)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, urls.length) }, worker))
  return cache
}

// ---------- data helpers ----------
interface ActionBlock {
  heading: string
  office: string
  date: string
  notes: string
  otherInfo?: string
  photos: ConcernImage[]
}

const isImg = (p: ConcernImage) => p.fileType !== 'document' && !!p.url

function safeDate(v?: string | null, fmt = 'MMMM dd, yyyy'): string {
  if (!v) return '—'
  if (v === 'Ongoing') return 'Ongoing'
  const d = new Date(v)
  return isNaN(d.getTime()) ? v : format(d, fmt)
}

function actionBlocks(c: Action): ActionBlock[] {
  const hist = (c.actionHistory || []).filter(a => a.actionType !== 'initial')
  if (hist.length > 0) {
    return hist.map(a => ({
      heading: a.actionType === 'pgo' ? 'PGO Office Action' : 'Department Action',
      office: a.submittedBy || (a.actionType === 'pgo' ? 'PGO Office' : c.assignedTo) || '—',
      date: safeDate(a.actionDate || a.submittedAt),
      notes: a.notes || '',
      otherInfo: a.otherInfo,
      photos: (a.photos || []).filter(isImg),
    }))
  }
  if (c.actionTaken) {
    return [{
      heading: 'Department Action',
      office: c.actionTaken.submittedBy || (c.assignedTo !== 'N/A' ? c.assignedTo : '') || '—',
      date: safeDate(c.actionDate || c.actionTaken.submittedAt),
      notes: c.actionTaken.notes || '',
      otherInfo: c.actionTaken.otherInfo,
      photos: (c.actionTaken.photos || []).filter(isImg),
    }]
  }
  return []
}

// ---------- main ----------
export async function generateDetailedReportPDF(concerns: Action[], meta: DetailedReportMeta): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const CW = PW - M * 2
  const BOTTOM = PH - 16

  const sorted = [...concerns].sort(
    (a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime(),
  )

  // Preload every photo concurrently up front
  const urls = new Set<string>()
  sorted.forEach(c => {
    ;(c.concernPhotos || []).filter(isImg).slice(0, MAX_PHOTOS).forEach(p => urls.add(p.url))
    actionBlocks(c).forEach(b => b.photos.slice(0, MAX_PHOTOS).forEach(p => urls.add(p.url)))
  })
  const images = await preload([...urls])

  const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
  const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])

  // ---- cover / summary page ----
  setFill(C.navy)
  doc.rect(0, 0, PW, 42, 'F')
  setFill(C.blue)
  doc.rect(0, 42, PW, 1.5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  setText(C.white)
  doc.text(meta.title.toUpperCase(), M, 20)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.text('Detailed Concern & Action Taken Report', M, 28)
  doc.setFontSize(9)
  doc.text(`Generated ${format(new Date(), 'MMMM dd, yyyy  h:mm a')}`, M, 35)

  // stat cards
  const count = (fn: (c: Action) => boolean) => sorted.filter(fn).length
  const stats: { label: string; value: number; color: RGB }[] = [
    { label: 'TOTAL REPORTS', value: sorted.length, color: C.navy },
    { label: 'PENDING', value: count(c => c.status === 'pending'), color: [161, 98, 7] },
    { label: 'UNDER ACTION', value: count(c => c.status === 'in-progress' || c.status === 'under-action'), color: [29, 78, 216] },
    { label: 'COMPLETED', value: count(c => c.status === 'completed' || c.status === 'resolved' || c.status === 'closed'), color: C.green },
  ]
  const cardW = (CW - 9) / 4
  stats.forEach((s, i) => {
    const x = M + i * (cardW + 3)
    setFill(C.soft)
    setDraw(C.line)
    doc.roundedRect(x, 52, cardW, 22, 2, 2, 'FD')
    setFill(s.color)
    doc.roundedRect(x, 52, 1.8, 22, 0.9, 0.9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    setText(s.color)
    doc.text(String(s.value), x + 6, 64)
    doc.setFontSize(7)
    setText(C.muted)
    doc.text(s.label, x + 6, 70)
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  setText(C.muted)
  doc.text(`Period: ${meta.periodLabel}     |     Status filter: ${meta.statusLabel}`, M, 83)

  // index table (page numbers filled after layout)
  const startPages: number[] = []
  const pageCells: { page: number; x: number; y: number; w: number; h: number }[] = []
  const st_label = (c: Action) => STATUS[c.status]?.label ?? String(c.status).toUpperCase()
  const indexBody = sorted.map((c, i) => [
    String(i + 1),
    safeDate(c.dateReported, 'MMM dd, yyyy'),
    c.municipality,
    c.reportTitle,
    (STATUS[c.status]?.label ?? c.status.toUpperCase()),
    '',
  ])
  autoTable(doc, {
    startY: 88,
    head: [['#', 'Date Reported', 'Municipality', 'Report Title', 'Status', 'Page']],
    body: indexBody,
    theme: 'striped',
    margin: { left: M, right: M, bottom: 18 },
    headStyles: { fillColor: C.navy, textColor: 255, fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.2, textColor: C.slate, lineColor: C.line },
    alternateRowStyles: { fillColor: C.soft },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 28 },
      2: { cellWidth: 30 },
      4: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 14, halign: 'center' },
    },
    didDrawCell: d => {
      if (d.section === 'body' && d.column.index === 5) {
        pageCells[d.row.index] = { page: doc.getNumberOfPages() === 1 ? 1 : d.pageNumber, x: d.cell.x, y: d.cell.y, w: d.cell.width, h: d.cell.height }
      }
    },
    didParseCell: d => {
      if (d.section === 'body' && d.column.index === 4) {
        const s = Object.values(STATUS).find(v => v.label === d.cell.raw)
        if (s) d.cell.styles.textColor = s.fg
      }
    },
  })

  // ---- layout helpers ----
  let y = 0
  const newPage = () => {
    doc.addPage()
    y = 20
  }
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      newPage()
      return true
    }
    return false
  }

  const badge = (text: string, rightX: number, topY: number, fg: RGB, bg: RGB) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    const w = doc.getTextWidth(text) + 8
    setFill(bg)
    doc.roundedRect(rightX - w, topY, w, 6.5, 3.2, 3.2, 'F')
    setText(fg)
    doc.text(text, rightX - w / 2, topY + 4.5, { align: 'center' })
  }

  const sectionTitle = (text: string, color: RGB, count?: number) => {
    ensure(12)
    setFill(color)
    doc.roundedRect(M, y, 1.6, 6, 0.8, 0.8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    setText(C.slate)
    doc.text(count !== undefined ? `${text}  (${count})` : text, M + 4, y + 4.7)
    y += 9
  }

  const drawPhotos = (photos: ConcernImage[], accent: RGB) => {
    const list = photos.slice(0, MAX_PHOTOS)
    if (list.length === 0) {
      ensure(10)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8.5)
      setText(C.muted)
      doc.text('No photos attached.', M + 2, y + 4)
      y += 9
      return
    }
    // Large-photo layout: 1 photo = full width hero, 2 = side by side,
    // 3 = hero + 2, 4+ = 2-column grid. Photos are ~2.5x bigger than before.
    const gap = 4
    const n = list.length
    const rows: number[][] = []
    if (n === 1) rows.push([0])
    else if (n === 3) rows.push([0], [1, 2])
    else for (let k = 0; k < n; k += 2) rows.push(k + 1 < n ? [k, k + 1] : [k])
    for (const row of rows) {
      const cols = row.length
      const cellW = (CW - gap * (cols - 1)) / cols
      const cellH = cols === 1 ? Math.min(100, cellW * 0.58) : cellW * 0.78
      ensure(cellH + gap)
      for (let j = 0; j < cols; j++) {
        const x = M + j * (cellW + gap)
        setFill(C.soft)
        setDraw(C.line)
        doc.roundedRect(x, y, cellW, cellH, 2, 2, 'FD')
        const img = images.get(list[row[j]].url)
        if (img) {
          const r = img.w / img.h
          let w = cellW - 2
          let h = w / r
          if (h > cellH - 2) {
            h = cellH - 2
            w = h * r
          }
          doc.addImage(img.data, 'JPEG', x + (cellW - w) / 2, y + (cellH - h) / 2, w, h, undefined, 'FAST')
        } else {
          doc.setFont('helvetica', 'italic')
          doc.setFontSize(8)
          setText(C.muted)
          doc.text('Image unavailable', x + cellW / 2, y + cellH / 2, { align: 'center' })
        }
        setFill(accent)
        doc.circle(x + 5, y + 5, 3.4, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7.5)
        setText(C.white)
        doc.text(String(row[j] + 1), x + 5, y + 6.2, { align: 'center' })
      }
      y += cellH + gap
    }
    if (photos.length > MAX_PHOTOS) {
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(7.5)
      setText(C.muted)
      doc.text(`+ ${photos.length - MAX_PHOTOS} more photo(s) not shown`, M + 2, y + 2)
      y += 5
    }
  }

  const field = (label: string, value: string, x: number, w: number): number => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    setText(C.muted)
    doc.text(label.toUpperCase(), x, y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    setText(C.slate)
    const lines = doc.splitTextToSize(value || '—', w) as string[]
    doc.text(lines, x, y + 4.6)
    return lines.length * 4.3 + 4.6
  }

  // ---- one report per section ----
  sorted.forEach((c, idx) => {
    newPage()
    startPages[idx] = doc.getNumberOfPages()

    // title band
    setFill(C.navy)
    doc.roundedRect(M, y, CW, 15, 2, 2, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    setText([147, 179, 255])
    doc.text(`REPORT ${idx + 1} OF ${sorted.length}${c.trackingNo ? `   •   ${c.trackingNo}` : ''}`, M + 5, y + 5.5)
    doc.setFontSize(11.5)
    setText(C.white)
    const titleLines = doc.splitTextToSize(c.reportTitle || 'Untitled Report', CW - 52) as string[]
    doc.text(titleLines[0] + (titleLines.length > 1 ? '…' : ''), M + 5, y + 11.5)
    const st = STATUS[c.status] ?? { label: String(c.status).toUpperCase(), fg: C.slate, bg: C.line }
    badge(st.label, M + CW - 4, y + 4, st.fg, st.bg)
    y += 21

    // details grid
    const colW = (CW - 8) / 2
    const fullTitle = c.reportTitle || '—'
    let h1 = Math.max(
      field('Report Title', fullTitle, M, colW),
      field('Date Reported', safeDate(c.dateReported), M + colW + 8, colW),
    )
    y += h1 + 3
    h1 = Math.max(
      field('Municipality', c.municipality, M, colW),
      field('Category', c.category ? c.category.charAt(0).toUpperCase() + c.category.slice(1) : '—', M + colW + 8, colW),
    )
    y += h1 + 3
    h1 = Math.max(
      field('Location', c.location, M, colW),
      field('Reported By', c.reportedBy && c.reportedBy !== 'N/A' ? c.reportedBy : c.answeredBy, M + colW + 8, colW),
    )
    y += h1 + 2
    setDraw(C.line)
    doc.line(M, y, M + CW, y)
    y += 6

    if (c.caseRemarks) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const lines = doc.splitTextToSize(c.caseRemarks, CW - 8) as string[]
      const shown = lines.slice(0, 8)
      const bh = shown.length * 4.2 + 9
      ensure(bh + 4)
      setFill(C.soft)
      doc.roundedRect(M, y, CW, bh, 2, 2, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      setText(C.muted)
      doc.text('CONCERN DESCRIPTION', M + 4, y + 5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      setText(C.slate)
      doc.text(shown, M + 4, y + 10)
      y += bh + 6
    }

    // concern photos
    const cp = (c.concernPhotos || []).filter(isImg)
    sectionTitle('CONCERN PHOTOS', C.blue, cp.length)
    drawPhotos(cp, C.blue)
    y += 3

    // action taken
    const blocks = actionBlocks(c)
    if (blocks.length === 0) {
      sectionTitle('ACTION TAKEN', C.green)
      setFill(C.soft)
      doc.roundedRect(M, y, CW, 12, 2, 2, 'F')
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(9)
      setText(C.muted)
      doc.text('No action has been recorded for this report yet.', M + 4, y + 7.3)
      y += 16
    }
    blocks.forEach(b => {
      sectionTitle(`ACTION TAKEN — ${b.heading.toUpperCase()}`, C.green, b.photos.length)

      // meta card
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      const noteLines = (doc.splitTextToSize(b.notes || 'No action notes provided.', CW - 10) as string[]).slice(0, 14)
      const infoLines = b.otherInfo ? (doc.splitTextToSize(b.otherInfo, CW - 10) as string[]).slice(0, 4) : []
      const cardH = 24 + noteLines.length * 4.3 + (infoLines.length ? infoLines.length * 4.3 + 8 : 0)
      ensure(cardH + 4)
      setFill(C.greenSoft)
      setDraw([187, 222, 200])
      doc.roundedRect(M, y, CW, cardH, 2, 2, 'FD')

      const top = y
      y = top + 7
      const w3 = (CW - 8) / 3
      field('Department / Office', b.office, M + 4, w3 + 6)
      field('Date of Action', b.date, M + 4 + w3 + 10, w3 - 6)
      const stX = M + CW - 4
      badge(st_label(c), stX, top + 3, (STATUS[c.status] ?? { fg: C.slate }).fg, (STATUS[c.status] ?? { bg: C.line }).bg)
      y = top + 17

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7)
      setText(C.muted)
      doc.text('ACTION NOTES', M + 4, y)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      setText(C.slate)
      doc.text(noteLines, M + 4, y + 4.8)
      y += 4.8 + noteLines.length * 4.3
      if (infoLines.length) {
        y += 3
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(7)
        setText(C.muted)
        doc.text('OTHER INFORMATION', M + 4, y)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        setText(C.slate)
        doc.text(infoLines, M + 4, y + 4.8)
      }
      y = top + cardH + 5

      drawPhotos(b.photos, C.green)
      y += 3
    })
  })

  // ---- fill page numbers into the index ----
  pageCells.forEach((cell, i) => {
    if (!cell || !startPages[i]) return
    doc.setPage(cell.page)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    setText(C.blue)
    doc.text(String(startPages[i]), cell.x + cell.w / 2, cell.y + cell.h / 2 + 1, { align: 'center' })
  })

  // ---- footers ----
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    setDraw(C.line)
    doc.line(M, PH - 12, PW - M, PH - 12)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    setText(C.muted)
    doc.text(meta.title, M, PH - 7)
    doc.text(`Page ${p} of ${total}`, PW - M, PH - 7, { align: 'right' })
  }

  return doc
}
