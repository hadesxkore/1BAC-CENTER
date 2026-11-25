import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { Action } from '@/data/sampleActions'
import { getDistrictFromMunicipality } from '@/data/municipalities'

export const generateCategorySummaryPDF = async (
  concerns: Action[],
  category: 'agricultural' | 'environmental',
  reportType: 'action-center' | 'pnp',
  dateRange: string,
  municipality?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth  = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 18
  let yPos = margin

  // ── Design tokens ─────────────────────────────────────────────────────────
  // Primary navy used for headers/accents
  const navy: [number, number, number]   = [15, 40, 100]
  // Category accent (amber = agricultural, emerald = environmental)
  const accent: [number, number, number] =
    category === 'agricultural' ? [180, 90, 0] : [5, 130, 80]
  // Light tint of accent for backgrounds
  const accentLight: [number, number, number] =
    category === 'agricultural' ? [255, 243, 220] : [220, 250, 235]

  const WHITE:       [number, number, number] = [255, 255, 255]
  const GRAY_100:    [number, number, number] = [245, 246, 248]
  const GRAY_200:    [number, number, number] = [228, 231, 235]
  const GRAY_500:    [number, number, number] = [107, 114, 128]
  const GRAY_700:    [number, number, number] = [55,  65,  81]
  const GRAY_900:    [number, number, number] = [17,  24,  39]

  const STATUS_PENDING:    [number, number, number] = [180, 120, 0]
  const STATUS_PENDING_BG: [number, number, number] = [255, 247, 220]
  const STATUS_ACTION:     [number, number, number] = [30,  90, 200]
  const STATUS_ACTION_BG:  [number, number, number] = [220, 235, 255]
  const STATUS_DONE:       [number, number, number] = [5, 130, 60]
  const STATUS_DONE_BG:    [number, number, number] = [215, 250, 230]
  const STATUS_UNLOC:      [number, number, number] = [100, 110, 125]
  const STATUS_UNLOC_BG:   [number, number, number] = [235, 237, 240]

  // ── Helpers ───────────────────────────────────────────────────────────────
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror  = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch { return null }
  }

  const checkNewPage = (spaceNeeded: number) => {
    if (yPos + spaceNeeded > pageHeight - 20) {
      doc.addPage()
      addPageHeader()
      yPos = 30
      return true
    }
    return false
  }

  // Thin accent line used as section divider
  const drawSectionLine = (y: number) => {
    doc.setDrawColor(...accent)
    doc.setLineWidth(0.6)
    doc.line(margin, y, pageWidth - margin, y)
  }

  // Section heading (left-aligned, with small accent bar on the left)
  const drawSectionHeading = (text: string, y: number) => {
    doc.setFillColor(...accent)
    doc.rect(margin, y - 3, 2.5, 6, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY_900)
    doc.text(text, margin + 5, y + 1)
    return y + 8
  }

  // Repeating page header (all pages except cover)
  const addPageHeader = () => {
    // Slim navy top bar
    doc.setFillColor(...navy)
    doc.rect(0, 0, pageWidth, 10, 'F')
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...WHITE)
    doc.text(`${categoryLabel.toUpperCase()} SUMMARY REPORT`, margin, 7)
    if (municipality) {
      doc.text(`Municipality: ${municipality}`, pageWidth - margin, 7, { align: 'right' })
    } else {
      doc.text('Province of Bataan — 1BAC Action Center', pageWidth - margin, 7, { align: 'right' })
    }

    // Slim accent stripe
    doc.setFillColor(...accent)
    doc.rect(0, 10, pageWidth, 1.5, 'F')

    // Page footer
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    doc.text(`Page ${pageNum}`, pageWidth / 2, pageHeight - 6, { align: 'center' })
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, pageHeight - 6)
    doc.text('For Official Use Only', pageWidth - margin, pageHeight - 6, { align: 'right' })

    // Footer line
    doc.setDrawColor(...GRAY_200)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9)
  }

  // ── Load logos ────────────────────────────────────────────────────────────
  const bataanLogo      = await loadImageAsBase64('/images/bataanlogo.png')
  const actionCenterLogo = await loadImageAsBase64('/images/image.png')

  // ── Data calculations ─────────────────────────────────────────────────────
  const categoryConcerns = concerns
    .filter(c => c.category === category)
    .filter(c => !municipality || c.municipality === municipality)

  const totalConcerns   = categoryConcerns.length
  const pendingCount    = categoryConcerns.filter(c => c.status === 'pending').length
  const inProgressCount = categoryConcerns.filter(c => c.status === 'in-progress' || c.status === 'under-action').length
  const completedCount  = categoryConcerns.filter(c => c.status === 'completed' || c.status === 'closed' || c.status === 'resolved').length
  const unlocatedCount  = categoryConcerns.filter(c => c.status === 'unlocated').length
  const completionRate  = totalConcerns > 0 ? Math.round((completedCount / totalConcerns) * 100) : 0

  const districtStats: Record<string, any> = {
    'First District':  { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
    'Second District': { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
    'Third District':  { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
  }
  categoryConcerns.forEach(concern => {
    const district = getDistrictFromMunicipality(concern.municipality)
    if (district) {
      districtStats[district].total++
      if (concern.status === 'pending') districtStats[district].pending++
      if (concern.status === 'in-progress' || concern.status === 'under-action') districtStats[district].inProgress++
      if (concern.status === 'completed' || concern.status === 'closed' || concern.status === 'resolved') districtStats[district].completed++
      districtStats[district].municipalities[concern.municipality] = (districtStats[district].municipalities[concern.municipality] || 0) + 1
    }
  })

  const municipalityCounts: Record<string, number> = {}
  categoryConcerns.forEach(c => { municipalityCounts[c.municipality] = (municipalityCounts[c.municipality] || 0) + 1 })
  const topMunicipalities = Object.entries(municipalityCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const reportTitleCounts: Record<string, number> = {}
  const reportTitleDisplay: Record<string, string> = {}
  categoryConcerns.forEach(concern => {
    const key = concern.reportTitle.toLowerCase().trim()
    reportTitleCounts[key] = (reportTitleCounts[key] || 0) + 1
    if (!reportTitleDisplay[key]) reportTitleDisplay[key] = concern.reportTitle
  })
  const topConcernTypes = Object.entries(reportTitleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, count]) => [reportTitleDisplay[k], count])

  const categoryLabel = category === 'agricultural' ? 'Agricultural' : 'Environmental'

  const periodText =
    dateRange === 'all'    ? 'All Time'       :
    dateRange === 'today'  ? 'Today'           :
    dateRange === 'week'   ? 'Last 7 Days'    :
    dateRange === 'month'  ? 'Last 30 Days'   :
    dateRange === 'year'   ? 'Last Year'       :
    dateRange === 'custom' ? 'Selected Period' : 'All Time'

  // ════════════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ════════════════════════════════════════════════════════════════════════

  // Full white background
  doc.setFillColor(...WHITE)
  doc.rect(0, 0, pageWidth, pageHeight, 'F')

  // Navy header band
  doc.setFillColor(...navy)
  doc.rect(0, 0, pageWidth, 55, 'F')

  // Accent stripe at bottom of header
  doc.setFillColor(...accent)
  doc.rect(0, 55, pageWidth, 3, 'F')

  // Logos inside header
  if (bataanLogo) {
    try { doc.addImage(bataanLogo, 'PNG', margin, 10, 28, 28) } catch {}
  }
  if (actionCenterLogo) {
    try { doc.addImage(actionCenterLogo, 'PNG', pageWidth - margin - 28, 10, 28, 28) } catch {}
  }

  // Government text in header
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('PROVINCE OF BATAAN', pageWidth / 2, 18, { align: 'center' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 215, 240)
  doc.text('Office of the Governor', pageWidth / 2, 24, { align: 'center' })

  // Slim divider inside header
  doc.setDrawColor(255, 255, 255, 0.25)
  doc.setLineWidth(0.3)
  doc.line(pageWidth / 2 - 25, 27, pageWidth / 2 + 25, 27)

  doc.setFontSize(7.5)
  doc.setTextColor(200, 215, 240)
  doc.text('1BAC Action Center', pageWidth / 2, 32, { align: 'center' })

  // ── Title block (white area below header) ───────────────────────────────
  yPos = 72

  doc.setFontSize(26)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text(categoryLabel.toUpperCase(), pageWidth / 2, yPos, { align: 'center' })
  yPos += 10

  doc.setFontSize(14)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_700)
  doc.text('Summary Report', pageWidth / 2, yPos, { align: 'center' })
  yPos += 7

  // Accent underline
  const underlineW = 50
  doc.setFillColor(...accent)
  doc.rect(pageWidth / 2 - underlineW / 2, yPos, underlineW, 1.2, 'F')
  yPos += 8

  // Municipality chip (if filtered)
  if (municipality) {
    const chipText = `Municipality of ${municipality}`
    const chipW = 80, chipH = 8, chipX = pageWidth / 2 - chipW / 2
    doc.setFillColor(...accentLight)
    doc.roundedRect(chipX, yPos, chipW, chipH, 2, 2, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...accent)
    doc.text(chipText, pageWidth / 2, yPos + 5.5, { align: 'center' })
    yPos += chipH + 6
  }

  // ── Reporting period card ───────────────────────────────────────────────
  yPos += 4
  const rpCardW = pageWidth - margin * 2
  const rpCardH = 28

  doc.setFillColor(...GRAY_100)
  doc.setDrawColor(...GRAY_200)
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, yPos, rpCardW, rpCardH, 3, 3, 'FD')

  // Left accent strip on card
  doc.setFillColor(...accent)
  doc.roundedRect(margin, yPos, 3, rpCardH, 1.5, 1.5, 'F')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...GRAY_500)
  doc.text('REPORTING PERIOD', margin + 7, yPos + 8)

  if (categoryConcerns.length > 0) {
    const dates   = categoryConcerns.map(c => new Date(c.dateReported).getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...GRAY_900)
    doc.text(
      `${format(minDate, 'MMMM dd, yyyy')}  –  ${format(maxDate, 'MMMM dd, yyyy')}`,
      margin + 7, yPos + 17
    )
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    const scope = municipality ? `in ${municipality}` : 'across all districts'
    doc.text(
      `This report covers ${categoryConcerns.length} ${categoryLabel.toLowerCase()} concern${categoryConcerns.length !== 1 ? 's' : ''} ${scope}`,
      margin + 7, yPos + 24
    )
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    doc.text('No data available for the selected period', margin + 7, yPos + 16)
  }
  yPos += rpCardH + 10

  // ── Key metrics row ─────────────────────────────────────────────────────
  const metricCardW = (rpCardW - 8) / 3
  const metricCardH = 36
  const rateColor: [number, number, number] =
    completionRate >= 70 ? STATUS_DONE : completionRate >= 50 ? STATUS_PENDING : [200, 50, 50]
  const rateColorBg: [number, number, number] =
    completionRate >= 70 ? STATUS_DONE_BG : completionRate >= 50 ? STATUS_PENDING_BG : [255, 225, 220]

  const metrics = [
    { label: 'Total Concerns', value: totalConcerns.toString(), fg: navy,       bg: [230, 237, 255] as [number, number, number] },
    { label: 'Completed',      value: completedCount.toString(), fg: STATUS_DONE, bg: STATUS_DONE_BG },
    { label: 'Completion Rate', value: `${completionRate}%`,    fg: rateColor,  bg: rateColorBg },
  ]

  metrics.forEach((m, i) => {
    const x = margin + i * (metricCardW + 4)
    doc.setFillColor(...m.bg)
    doc.setDrawColor(...GRAY_200)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, yPos, metricCardW, metricCardH, 3, 3, 'FD')

    // Top accent strip
    doc.setFillColor(...m.fg)
    doc.roundedRect(x, yPos, metricCardW, 2.5, 1.5, 1.5, 'F')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...m.fg)
    doc.text(m.label.toUpperCase(), x + metricCardW / 2, yPos + 10, { align: 'center' })

    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...m.fg)
    doc.text(m.value, x + metricCardW / 2, yPos + 26, { align: 'center' })
  })
  yPos += metricCardH + 10

  // ── Status pill row ─────────────────────────────────────────────────────
  const pillW = (rpCardW - 12) / 4
  const pillData = [
    { label: 'Pending',     count: pendingCount,    fg: STATUS_PENDING, bg: STATUS_PENDING_BG },
    { label: 'Under Action',count: inProgressCount, fg: STATUS_ACTION,  bg: STATUS_ACTION_BG  },
    { label: 'Completed',   count: completedCount,  fg: STATUS_DONE,    bg: STATUS_DONE_BG    },
    { label: 'Unlocated',   count: unlocatedCount,  fg: STATUS_UNLOC,   bg: STATUS_UNLOC_BG   },
  ]
  pillData.forEach((p, i) => {
    const x = margin + i * (pillW + 4)
    doc.setFillColor(...p.bg)
    doc.setDrawColor(...p.fg)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, yPos, pillW, 14, 2, 2, 'FD')
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...p.fg)
    doc.text(p.label.toUpperCase(), x + pillW / 2, yPos + 5, { align: 'center' })
    doc.setFontSize(12)
    doc.text(p.count.toString(), x + pillW / 2, yPos + 12, { align: 'center' })
  })

  // ── Cover footer ────────────────────────────────────────────────────────
  doc.setFillColor(...GRAY_100)
  doc.rect(0, pageHeight - 18, pageWidth, 18, 'F')
  doc.setFillColor(...accent)
  doc.rect(0, pageHeight - 18, pageWidth, 1, 'F')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_500)
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, margin, pageHeight - 9)
  doc.text('Prepared by: 1BAC Action Center  |  For Official Use Only', pageWidth - margin, pageHeight - 9, { align: 'right' })

  // ════════════════════════════════════════════════════════════════════════
  // EXECUTIVE SUMMARY PAGE
  // ════════════════════════════════════════════════════════════════════════
  doc.addPage()
  addPageHeader()
  yPos = 20

  // Page title
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...navy)
  doc.text('Executive Summary', margin, yPos)
  drawSectionLine(yPos + 3)
  yPos += 10

  // Overview paragraph
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY_700)
  const overviewText = municipality
    ? `This report provides a comprehensive analysis of ${totalConcerns} ${categoryLabel.toLowerCase()} concern${totalConcerns !== 1 ? 's' : ''} recorded in the Municipality of ${municipality}${dateRange !== 'all' ? ` for the ${periodText.toLowerCase()} period` : ''}. The data provides detailed insights into the current status and response effectiveness of concerns within ${municipality}.`
    : `This report provides a comprehensive analysis of ${totalConcerns} ${categoryLabel.toLowerCase()} concern${totalConcerns !== 1 ? 's' : ''} recorded across the Province of Bataan${dateRange !== 'all' ? ` for the ${periodText.toLowerCase()} period` : ''}. The data encompasses all legislative districts and provides detailed insights into the current status, response effectiveness, and geographical distribution of concerns.`
  const overviewLines = doc.splitTextToSize(overviewText, pageWidth - margin * 2)
  doc.text(overviewLines, margin, yPos)
  yPos += overviewLines.length * 5 + 8

  // ── Status Overview ──────────────────────────────────────────────────────
  yPos = drawSectionHeading('STATUS OVERVIEW', yPos)
  yPos += 2

  const statusItems = [
    { label: 'Pending',     count: pendingCount,    fg: STATUS_PENDING, bg: STATUS_PENDING_BG },
    { label: 'Under Action',count: inProgressCount, fg: STATUS_ACTION,  bg: STATUS_ACTION_BG  },
    { label: 'Completed',   count: completedCount,  fg: STATUS_DONE,    bg: STATUS_DONE_BG    },
    ...(unlocatedCount > 0 ? [{ label: 'Unlocated', count: unlocatedCount, fg: STATUS_UNLOC, bg: STATUS_UNLOC_BG }] : []),
  ]
  const sCardCount = statusItems.length
  const sCardW = (pageWidth - margin * 2 - (sCardCount - 1) * 4) / sCardCount
  const sCardH = 26

  statusItems.forEach((s, i) => {
    const x = margin + i * (sCardW + 4)
    const pct = totalConcerns > 0 ? Math.round((s.count / totalConcerns) * 100) : 0
    doc.setFillColor(...s.bg)
    doc.setDrawColor(...s.fg)
    doc.setLineWidth(0.3)
    doc.roundedRect(x, yPos, sCardW, sCardH, 2, 2, 'FD')
    // left-side strip
    doc.setFillColor(...s.fg)
    doc.roundedRect(x, yPos, 2.5, sCardH, 1, 1, 'F')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...s.fg)
    doc.text(s.label.toUpperCase(), x + sCardW / 2 + 1, yPos + 7, { align: 'center' })
    doc.setFontSize(16)
    doc.text(s.count.toString(), x + sCardW / 2 + 1, yPos + 18, { align: 'center' })
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    doc.text(`${pct}%`, x + sCardW / 2 + 1, yPos + 24, { align: 'center' })
  })
  yPos += sCardH + 12

  // ── Key Insights ─────────────────────────────────────────────────────────
  yPos = drawSectionHeading('KEY INSIGHTS', yPos)
  yPos += 2

  const insights: { icon: string; text: string; color: [number, number, number] }[] = []
  if (completionRate >= 70) {
    insights.push({ icon: '✓', text: `Strong performance with a ${completionRate}% completion rate, demonstrating effective response and resolution capabilities.`, color: STATUS_DONE })
  } else if (completionRate >= 50) {
    insights.push({ icon: '~', text: `Moderate completion rate of ${completionRate}% — there is room for improvement in concern resolution processes.`, color: STATUS_PENDING })
  } else {
    insights.push({ icon: '!', text: `Completion rate of ${completionRate}% requires immediate attention and resource allocation to improve response effectiveness.`, color: [200, 50, 50] })
  }
  if (pendingCount > totalConcerns * 0.3) {
    insights.push({ icon: '!', text: `${pendingCount} pending concerns (${Math.round((pendingCount / totalConcerns) * 100)}%) require immediate action and prioritization.`, color: STATUS_PENDING })
  } else if (pendingCount > 0) {
    insights.push({ icon: '~', text: `${pendingCount} concern${pendingCount !== 1 ? 's' : ''} remain pending and should be monitored for timely resolution.`, color: STATUS_ACTION })
  }
  if (!municipality && topMunicipalities.length > 0) {
    insights.push({ icon: '★', text: `${topMunicipalities[0][0]} reports the highest number of concerns (${topMunicipalities[0][1]}), requiring focused attention and resources.`, color: navy })
  }
  if (topConcernTypes.length > 0) {
    const topTitle = topConcernTypes[0][0] as string
    const topCount = topConcernTypes[0][1] as number
    insights.push({ icon: '►', text: `Most common concern: "${topTitle}" with ${topCount} report${topCount !== 1 ? 's' : ''}.`, color: GRAY_700 })
  }

  insights.forEach(ins => {
    checkNewPage(12)
    // Icon dot
    doc.setFillColor(...ins.color)
    doc.circle(margin + 2.5, yPos - 1, 1.5, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_700)
    const lines = doc.splitTextToSize(ins.text, pageWidth - margin * 2 - 8)
    doc.text(lines, margin + 7, yPos)
    yPos += lines.length * 5 + 3
  })
  yPos += 6

  // ── District Comparison Table ─────────────────────────────────────────────
  checkNewPage(70)
  yPos = drawSectionHeading('DISTRICT COMPARISON', yPos)
  yPos += 2

  const districtTableData = Object.entries(districtStats).map(([district, stats]) => [
    district,
    stats.total.toString(),
    stats.pending.toString(),
    stats.inProgress.toString(),
    stats.completed.toString(),
    stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '0%',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['District', 'Total', 'Pending', 'Under Action', 'Completed', 'Rate']],
    body: districtTableData,
    theme: 'plain',
    headStyles: {
      fillColor: navy,
      textColor: WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 4,
    },
    bodyStyles: { fontSize: 8, cellPadding: 4, halign: 'center' },
    columnStyles: {
      0: { cellWidth: 50, halign: 'left' },
      1: { cellWidth: 20 },
      2: { cellWidth: 22 },
      3: { cellWidth: 28 },
      4: { cellWidth: 22 },
      5: { cellWidth: 20, fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: GRAY_100 },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const val = parseInt(data.cell.raw as string)
        if (val >= 70) { data.cell.styles.textColor = STATUS_DONE }
        else if (val >= 50) { data.cell.styles.textColor = STATUS_PENDING }
        else { data.cell.styles.textColor = [200, 50, 50] }
      }
    },
  })
  yPos = (doc as any).lastAutoTable.finalY + 12

  // ── Top Municipalities ────────────────────────────────────────────────────
  if (!municipality && topMunicipalities.length > 0) {
    checkNewPage(55)
    yPos = drawSectionHeading('TOP MUNICIPALITIES BY VOLUME', yPos)
    yPos += 3

    const maxCount = topMunicipalities[0][1] as number
    const barTrack = pageWidth - margin * 2 - 55

    topMunicipalities.forEach(([muni, count], idx) => {
      checkNewPage(12)
      const barW = ((count as number) / maxCount) * barTrack
      const pct  = totalConcerns > 0 ? Math.round(((count as number) / totalConcerns) * 100) : 0

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY_700)
      doc.text(`${idx + 1}. ${muni}`, margin, yPos + 5)

      // Track background
      doc.setFillColor(...GRAY_200)
      doc.roundedRect(margin + 48, yPos, barTrack, 7, 1, 1, 'F')
      // Fill bar
      doc.setFillColor(...accent)
      if (barW > 0) doc.roundedRect(margin + 48, yPos, barW, 7, 1, 1, 'F')

      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...accent)
      doc.text(`${count}  (${pct}%)`, margin + 48 + barTrack + 3, yPos + 5)

      yPos += 11
    })
    yPos += 6
  }

  // ── Monthly Breakdown ─────────────────────────────────────────────────────
  const monthlyData: Record<string, number> = {}
  categoryConcerns.forEach(c => {
    const key = format(new Date(c.dateReported), 'MMM yyyy')
    monthlyData[key] = (monthlyData[key] || 0) + 1
  })
  const sortedMonths = Object.entries(monthlyData)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(-12)

  if (sortedMonths.length > 0) {
    checkNewPage(60)
    yPos = drawSectionHeading('MONTHLY CONCERNS BREAKDOWN', yPos)
    yPos += 3

    const maxMo   = Math.max(...sortedMonths.map(([, v]) => v))
    const barTrackMo = pageWidth - margin * 2 - 32

    sortedMonths.forEach(([month, count]) => {
      if (yPos > pageHeight - 20) { checkNewPage(12) }
      const bw = (count / maxMo) * barTrackMo
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...GRAY_700)
      doc.text(month, margin, yPos + 5)
      doc.setFillColor(...GRAY_200)
      doc.roundedRect(margin + 26, yPos, barTrackMo, 7, 1, 1, 'F')
      doc.setFillColor(...accent)
      if (bw > 0) doc.roundedRect(margin + 26, yPos, bw, 7, 1, 1, 'F')
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...accent)
      doc.text(count.toString(), margin + 26 + barTrackMo + 3, yPos + 5)
      yPos += 10
    })

    const peak = sortedMonths.reduce((a, b) => b[1] > a[1] ? b : a)
    checkNewPage(10)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(...GRAY_500)
    doc.text(`Peak period: ${peak[0]} — ${peak[1]} concern${peak[1] !== 1 ? 's' : ''} reported`, margin, yPos + 2)
    yPos += 10
  }

  // ── Top Concern Types ─────────────────────────────────────────────────────
  if (topConcernTypes.length > 0) {
    checkNewPage(80)
    yPos = drawSectionHeading(`TOP ${categoryLabel.toUpperCase()} CONCERNS BY REPORT TITLE`, yPos)
    yPos += 2

    const ctData = topConcernTypes.map(([type, count], i) => {
      const pct = totalConcerns > 0 ? Math.round(((count as number) / totalConcerns) * 100) : 0
      return [i + 1, type, count.toString(), `${pct}%`]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Report Title', 'Count', '% of Total']],
      body: ctData,
      theme: 'plain',
      headStyles: {
        fillColor: GRAY_700,
        textColor: WHITE,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 4,
      },
      bodyStyles: { fontSize: 8, cellPadding: 3.5 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 95 },
        2: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 22, halign: 'center' },
      },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: margin, right: margin },
    })
    yPos = (doc as any).lastAutoTable.finalY + 12
  }

  // ════════════════════════════════════════════════════════════════════════
  // DISTRICT DETAIL PAGES
  // ════════════════════════════════════════════════════════════════════════
  const districts = ['First District', 'Second District', 'Third District']
  const districtRomanNumerals = ['DISTRICT I', 'DISTRICT II', 'DISTRICT III']
  const districtMunicipalities = [
    ['Abucay', 'Orani', 'Samal', 'Hermosa'],
    ['Balanga City', 'Pilar', 'Orion', 'Limay'],
    ['Bagac', 'Dinalupihan', 'Mariveles', 'Morong'],
  ]

  districts.forEach((district, dIdx) => {
    const dConcerns = categoryConcerns.filter(c => getDistrictFromMunicipality(c.municipality) === district)

    doc.addPage()
    addPageHeader()
    yPos = 20

    // District title row
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...navy)
    doc.text(districtRomanNumerals[dIdx], margin, yPos)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY_500)
    doc.text(districtMunicipalities[dIdx].join('  ·  '), margin, yPos + 7)
    drawSectionLine(yPos + 10)
    yPos += 16

    // ── No data card ───────────────────────────────────────────────────────
    if (dConcerns.length === 0) {
      const cardH = 32, cardW = 120
      const cx = (pageWidth - cardW) / 2, cy = pageHeight / 2 - 30
      doc.setFillColor(...GRAY_100)
      doc.setDrawColor(...GRAY_200)
      doc.setLineWidth(0.5)
      doc.roundedRect(cx, cy, cardW, cardH, 3, 3, 'FD')
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...GRAY_500)
      doc.text('No Data Available', pageWidth / 2, cy + 14, { align: 'center' })
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`No ${categoryLabel.toLowerCase()} concerns found for ${districtRomanNumerals[dIdx]}`, pageWidth / 2, cy + 23, { align: 'center' })
      return
    }

    // ── Stats cards ────────────────────────────────────────────────────────
    const dTotal      = dConcerns.length
    const dPending    = dConcerns.filter(c => c.status === 'pending').length
    const dInProgress = dConcerns.filter(c => c.status === 'in-progress' || c.status === 'under-action').length
    const dCompleted  = dConcerns.filter(c => c.status === 'completed' || c.status === 'closed' || c.status === 'resolved').length
    const dUnlocated  = dConcerns.filter(c => c.status === 'unlocated').length
    const dRate       = dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0

    const dCards = [
      { label: 'Total',       value: dTotal,      fg: navy,          bg: [230, 237, 255] as [number, number, number] },
      { label: 'Pending',     value: dPending,    fg: STATUS_PENDING, bg: STATUS_PENDING_BG },
      { label: 'Under Action',value: dInProgress, fg: STATUS_ACTION,  bg: STATUS_ACTION_BG  },
      { label: 'Completed',   value: dCompleted,  fg: STATUS_DONE,    bg: STATUS_DONE_BG    },
      ...(dUnlocated > 0 ? [{ label: 'Unlocated', value: dUnlocated, fg: STATUS_UNLOC, bg: STATUS_UNLOC_BG }] : []),
    ]
    const dcW = (pageWidth - margin * 2 - (dCards.length - 1) * 3) / dCards.length
    const dcH = 24

    dCards.forEach((c, i) => {
      const x = margin + i * (dcW + 3)
      doc.setFillColor(...c.bg)
      doc.setDrawColor(...c.fg)
      doc.setLineWidth(0.3)
      doc.roundedRect(x, yPos, dcW, dcH, 2, 2, 'FD')
      doc.setFillColor(...c.fg)
      doc.roundedRect(x, yPos, dcW, 2, 1, 1, 'F')
      doc.setFontSize(6.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...c.fg)
      doc.text(c.label.toUpperCase(), x + dcW / 2, yPos + 9, { align: 'center' })
      doc.setFontSize(14)
      doc.text(c.value.toString(), x + dcW / 2, yPos + 20, { align: 'center' })
    })
    yPos += dcH + 10

    // Rate chip
    const rChipFg = dRate >= 70 ? STATUS_DONE : dRate >= 50 ? STATUS_PENDING : [200, 50, 50] as [number, number, number]
    const rChipBg = dRate >= 70 ? STATUS_DONE_BG : dRate >= 50 ? STATUS_PENDING_BG : [255, 225, 220] as [number, number, number]
    const chipTxt = `Completion Rate: ${dRate}%`
    doc.setFillColor(...rChipBg)
    doc.setDrawColor(...rChipFg)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, yPos, 60, 8, 2, 2, 'FD')
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...rChipFg)
    doc.text(chipTxt, margin + 30, yPos + 5.5, { align: 'center' })
    yPos += 14

    // ── Top Concerns table ─────────────────────────────────────────────────
    yPos = drawSectionHeading(`TOP CONCERNS — ${districtRomanNumerals[dIdx]}`, yPos)
    yPos += 2

    const dTitleCounts: Record<string, { count: number; municipalities: Set<string>; originalTitle: string }> = {}
    dConcerns.forEach(concern => {
      const key = concern.reportTitle.toLowerCase().trim()
      if (!dTitleCounts[key]) dTitleCounts[key] = { count: 0, municipalities: new Set(), originalTitle: concern.reportTitle }
      dTitleCounts[key].count++
      dTitleCounts[key].municipalities.add(concern.municipality)
    })
    const topDistrictConcerns = Object.entries(dTitleCounts).sort((a, b) => b[1].count - a[1].count).slice(0, 10)
    const topCTData = topDistrictConcerns.map(([_, d], i) => [
      i + 1,
      d.originalTitle.length > 65 ? d.originalTitle.substring(0, 65) + '…' : d.originalTitle,
      d.count.toString(),
      Array.from(d.municipalities).sort().join(', '),
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Report Title', 'Count', 'Municipality/ies']],
      body: topCTData,
      theme: 'plain',
      headStyles: { fillColor: GRAY_700, textColor: WHITE, fontSize: 8, fontStyle: 'bold', halign: 'center', cellPadding: 3.5 },
      bodyStyles: { fontSize: 7.5, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 72 },
        2: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
        3: { cellWidth: 60 },
      },
      alternateRowStyles: { fillColor: GRAY_100 },
      margin: { left: margin, right: margin },
    })
    yPos = (doc as any).lastAutoTable.finalY + 10

    // ── Status detail tables ───────────────────────────────────────────────
    const statusConfigs: { statuses: string[]; label: string; fg: [number,number,number]; bg: [number,number,number] }[] = [
      { statuses: ['pending'],                              label: 'PENDING CONCERNS',              fg: STATUS_PENDING, bg: STATUS_PENDING_BG },
      { statuses: ['in-progress', 'under-action'],          label: 'UNDER ACTION / IN PROGRESS',    fg: STATUS_ACTION,  bg: STATUS_ACTION_BG  },
      { statuses: ['completed', 'closed', 'resolved'],      label: 'COMPLETED / CLOSED / RESOLVED', fg: STATUS_DONE,    bg: STATUS_DONE_BG    },
      { statuses: ['unlocated'],                            label: 'UNLOCATED',                     fg: STATUS_UNLOC,   bg: STATUS_UNLOC_BG   },
    ]

    statusConfigs.forEach(({ statuses, label, fg, bg }) => {
      const sConcerns = dConcerns
        .filter(c => statuses.includes(c.status))
        .sort((a, b) => {
          const mc = a.municipality.localeCompare(b.municipality)
          if (mc !== 0) return mc
          return new Date(a.dateReported).getTime() - new Date(b.dateReported).getTime()
        })
      if (sConcerns.length === 0) return

      checkNewPage(45)

      // Label pill
      doc.setFillColor(...bg)
      doc.setDrawColor(...fg)
      doc.setLineWidth(0.3)
      doc.roundedRect(margin, yPos, pageWidth - margin * 2, 9, 2, 2, 'FD')
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...fg)
      doc.text(`${label}  (${sConcerns.length})`, margin + 5, yPos + 6)
      yPos += 12

      const tData = sConcerns.map((c, i) => [
        i + 1,
        c.municipality,
        c.reportTitle.length > 65 ? c.reportTitle.substring(0, 65) + '…' : c.reportTitle,
        format(new Date(c.dateReported), 'MMM dd, yyyy'),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Municipality', 'Report Title', 'Date Reported']],
        body: tData,
        theme: 'plain',
        headStyles: { fillColor: fg, textColor: WHITE, fontSize: 7.5, fontStyle: 'bold', halign: 'center', cellPadding: 3 },
        bodyStyles: { fontSize: 7.5, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 9,  halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 90 },
          3: { cellWidth: 24, halign: 'center' },
        },
        alternateRowStyles: { fillColor: GRAY_100 },
        margin: { left: margin, right: margin },
      })
      yPos = (doc as any).lastAutoTable.finalY + 10
    })

    // ── District summary stats ─────────────────────────────────────────────
    checkNewPage(40)
    yPos = drawSectionHeading(`${districtRomanNumerals[dIdx]} — STATUS SUMMARY`, yPos)
    yPos += 2

    const sumData = [
      ['Total Concerns',  dTotal.toString()],
      ['Pending',         `${dPending}  (${dTotal > 0 ? Math.round((dPending / dTotal) * 100) : 0}%)`],
      ['Under Action',    `${dInProgress}  (${dTotal > 0 ? Math.round((dInProgress / dTotal) * 100) : 0}%)`],
      ['Completed',       `${dCompleted}  (${dTotal > 0 ? Math.round((dCompleted / dTotal) * 100) : 0}%)`],
      ['Completion Rate', `${dRate}%`],
    ]

    autoTable(doc, {
      startY: yPos,
      body: sumData,
      theme: 'plain',
      bodyStyles: { fontSize: 8.5, cellPadding: 4 },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold', textColor: GRAY_700 },
        1: { cellWidth: 65, halign: 'right',   textColor: GRAY_700 },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === 0 || data.row.index === 4) {
          data.cell.styles.fillColor    = GRAY_100
          data.cell.styles.fontStyle    = 'bold'
        }
        if (data.row.index === 1) data.cell.styles.textColor = STATUS_PENDING
        if (data.row.index === 2) data.cell.styles.textColor = STATUS_ACTION
        if (data.row.index === 3) data.cell.styles.textColor = STATUS_DONE
      },
    })
    yPos = (doc as any).lastAutoTable.finalY + 6
  })

  return doc
}
