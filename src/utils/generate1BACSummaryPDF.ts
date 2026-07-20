import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { Action } from '@/data/sampleActions'
import { getDistrictFromMunicipality } from '@/data/municipalities'

export const generate1BACSummaryPDF = async (
  concerns: Action[],
  dateRange: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 25
  let yPos = margin

  // Minimalist color palette
  const colors = {
    primary: [30, 30, 30] as [number, number, number],
    secondary: [120, 120, 120] as [number, number, number],
    accent: [0, 0, 0] as [number, number, number],
    lightGray: [245, 245, 245] as [number, number, number],
    border: [220, 220, 220] as [number, number, number],
  }

  // Helper to load images
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(blob)
      })
    } catch (error) {
      return null
    }
  }

  // Helper for new page with consistent footer
  const checkNewPage = (spaceNeeded: number) => {
    if (yPos + spaceNeeded > pageHeight - 30) {
      addPageFooter()
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Add consistent minimal footer
  const addPageFooter = () => {
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20)
    
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    
    const pageNum = (doc as any).internal.getCurrentPageInfo().pageNumber
    doc.text(`${pageNum}`, pageWidth / 2, pageHeight - 12, { align: 'center' })
    doc.text('1BAC Per-District Report', margin, pageHeight - 12)
    doc.text(format(new Date(), 'MMM dd, yyyy'), pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

  // Load logos
  const bataanLogo = await loadImageAsBase64('/images/bataanlogo.png')
  const actionCenterLogo = await loadImageAsBase64('/images/image.png')

  // Calculate statistics
  const totalConcerns = concerns.length
  const pendingCount = concerns.filter(c => c.status === 'pending').length
  const underActionCount = concerns.filter(c => c.status === 'under-action' || c.status === 'in-progress').length
  const resolvedCount = concerns.filter(c => c.status === 'resolved' || c.status === 'closed' || c.status === 'completed').length
  const completionRate = totalConcerns > 0 ? Math.round((resolvedCount / totalConcerns) * 100) : 0

  // District statistics
  const districtStats: Record<string, any> = {
    'First District': { total: 0, pending: 0, underAction: 0, resolved: 0, municipalities: {} },
    'Second District': { total: 0, pending: 0, underAction: 0, resolved: 0, municipalities: {} },
    'Third District': { total: 0, pending: 0, underAction: 0, resolved: 0, municipalities: {} },
  }

  concerns.forEach(concern => {
    const district = getDistrictFromMunicipality(concern.municipality)
    if (district) {
      districtStats[district].total++
      if (concern.status === 'pending') districtStats[district].pending++
      if (concern.status === 'under-action' || concern.status === 'in-progress') districtStats[district].underAction++
      if (concern.status === 'resolved' || concern.status === 'closed' || concern.status === 'completed') districtStats[district].resolved++
      
      if (!districtStats[district].municipalities[concern.municipality]) {
        districtStats[district].municipalities[concern.municipality] = 0
      }
      districtStats[district].municipalities[concern.municipality]++
    }
  })

  const periodText = dateRange === 'all' ? 'All Time' : 
                     dateRange === 'today' ? 'Today' :
                     dateRange === 'week' ? 'Last 7 Days' :
                     dateRange === 'month' ? 'Last 30 Days' :
                     dateRange === 'year' ? 'Last 365 Days' : dateRange

  // ========== COVER PAGE - MINIMALIST DESIGN ==========
  
  // Logos at top corners
  if (bataanLogo) {
    try {
      doc.addImage(bataanLogo, 'PNG', margin, 15, 20, 20)
    } catch (e) {
      console.error('Failed to load Bataan logo')
    }
  }
  
  if (actionCenterLogo) {
    try {
      doc.addImage(actionCenterLogo, 'PNG', pageWidth - margin - 20, 15, 20, 20)
    } catch (e) {
      console.error('Failed to load Action Center logo')
    }
  }
  
  // Thin top line
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setLineWidth(0.8)
  doc.line(margin, 40, pageWidth - margin, 40)

  // Organization header
  yPos = 50
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text('PROVINCE OF BATAAN', pageWidth / 2, yPos, { align: 'center' })
  
  yPos += 5
  doc.setFontSize(7)
  doc.text('Office of the Governor · 1BAC Action Center', pageWidth / 2, yPos, { align: 'center' })

  // Main title
  yPos = 80
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('1BAC', pageWidth / 2, yPos, { align: 'center' })
  
  yPos += 14
  doc.setFontSize(18)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.text('Per-District Report', pageWidth / 2, yPos, { align: 'center' })

  // Period
  yPos += 12
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text(periodText, pageWidth / 2, yPos, { align: 'center' })

  // Summary metrics - clean minimal boxes
  yPos = 125
  const metricWidth = (pageWidth - 2 * margin - 10) / 3
  const metrics = [
    { label: 'Total Concerns', value: totalConcerns.toString() },
    { label: 'Resolved', value: resolvedCount.toString() },
    { label: 'Resolution Rate', value: `${completionRate}%` },
  ]

  metrics.forEach((metric, index) => {
    const xPos = margin + index * (metricWidth + 5)
    
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
    doc.setLineWidth(0.5)
    doc.rect(xPos, yPos, metricWidth, 32)
    
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(metric.label.toUpperCase(), xPos + metricWidth / 2, yPos + 10, { align: 'center' })
    
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.text(metric.value, xPos + metricWidth / 2, yPos + 24, { align: 'center' })
  })

  // Date range at bottom
  if (concerns.length > 0) {
    const dates = concerns.map(c => new Date(c.dateReported).getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    
    yPos = pageHeight - 40
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text('REPORTING PERIOD', pageWidth / 2, yPos, { align: 'center' })
    
    yPos += 5
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.text(
      `${format(minDate, 'MMMM dd, yyyy')} — ${format(maxDate, 'MMMM dd, yyyy')}`,
      pageWidth / 2,
      yPos,
      { align: 'center' }
    )
  }

  addPageFooter()

  // ========== DISTRICT DETAIL PAGES ==========
  const districts = ['First District', 'Second District', 'Third District']
  const districtLabels = ['District I', 'District II', 'District III']
  const districtMunicipalities = [
    ['Abucay', 'Orani', 'Samal', 'Hermosa'],
    ['Balanga City', 'Pilar', 'Orion', 'Limay'],
    ['Bagac', 'Dinalupihan', 'Mariveles', 'Morong'],
  ]
  
  districts.forEach((district, districtIndex) => {
    const districtConcerns = concerns.filter(c => getDistrictFromMunicipality(c.municipality) === district)

    doc.addPage()
    yPos = margin

    // District header - clean and minimal
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
    doc.text(districtLabels[districtIndex], margin, yPos)
    
    yPos += 4
    doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.setLineWidth(0.8)
    doc.line(margin, yPos, pageWidth - margin, yPos)

    // Municipality list
    yPos += 8
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(districtMunicipalities[districtIndex].join('  ·  '), margin, yPos)

    yPos += 10

    // If no data, show clean message
    if (districtConcerns.length === 0) {
      yPos += 40
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
      doc.text('No concerns recorded for this district', pageWidth / 2, yPos, { align: 'center' })
      
      yPos += 5
      doc.setFontSize(8)
      doc.text('in the selected reporting period', pageWidth / 2, yPos, { align: 'center' })
      
      addPageFooter()
      return
    }

    // District statistics - minimal boxes
    const districtTotal = districtConcerns.length
    const districtPending = districtConcerns.filter(c => c.status === 'pending').length
    const districtUnderAction = districtConcerns.filter(c => c.status === 'under-action' || c.status === 'in-progress').length
    const districtResolved = districtConcerns.filter(c => c.status === 'resolved' || c.status === 'closed' || c.status === 'completed').length

    const districtCardWidth = (pageWidth - 2 * margin - 9) / 4
    const districtCards = [
      { label: 'Total', value: districtTotal },
      { label: 'Pending', value: districtPending },
      { label: 'In Progress', value: districtUnderAction },
      { label: 'Resolved', value: districtResolved },
    ]

    districtCards.forEach((card, index) => {
      const xPos = margin + index * (districtCardWidth + 3)
      
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
      doc.setLineWidth(0.5)
      doc.rect(xPos, yPos, districtCardWidth, 24)
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
      doc.text(card.label.toUpperCase(), xPos + districtCardWidth / 2, yPos + 7, { align: 'center' })
      
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.text(card.value.toString(), xPos + districtCardWidth / 2, yPos + 17, { align: 'center' })
    })

    yPos += 30

    // Count report titles in this district
    const districtTitleCounts: Record<string, { count: number, municipalities: Set<string>, originalTitle: string }> = {}
    districtConcerns.forEach(concern => {
      const normalizedTitle = concern.reportTitle.toLowerCase().trim()
      if (!districtTitleCounts[normalizedTitle]) {
        districtTitleCounts[normalizedTitle] = {
          count: 0,
          municipalities: new Set(),
          originalTitle: concern.reportTitle
        }
      }
      districtTitleCounts[normalizedTitle].count++
      districtTitleCounts[normalizedTitle].municipalities.add(concern.municipality)
    })

    // Top concerns in district
    const topDistrictConcerns = Object.entries(districtTitleCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)

    if (topDistrictConcerns.length > 0) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
      doc.text('Top Concerns', margin, yPos)
      
      yPos += 3
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      
      yPos += 8

      const topConcernsTableData = topDistrictConcerns.map(([_, data], index) => [
        (index + 1).toString(),
        data.originalTitle,
        data.count.toString(),
        Array.from(data.municipalities).sort().join(', ')
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['', 'Concern Type', 'Count', 'Municipalities']],
        body: topConcernsTableData,
        theme: 'plain',
        headStyles: { 
          fillColor: [255, 255, 255],
          textColor: colors.secondary,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: { top: 2, right: 5, bottom: 4, left: 0 },
          lineWidth: { bottom: 0.5 },
          lineColor: colors.border,
        },
        bodyStyles: { 
          textColor: colors.primary,
          fontSize: 8,
          cellPadding: { top: 4, right: 5, bottom: 4, left: 0 },
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'right', textColor: colors.secondary },
          1: { cellWidth: 72 },
          2: { cellWidth: 15, halign: 'right', fontStyle: 'bold' },
          3: { cellWidth: 55, textColor: colors.secondary, fontSize: 7 },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index < topConcernsTableData.length - 1) {
            data.cell.styles.lineWidth = { bottom: 0.2 }
            data.cell.styles.lineColor = colors.lightGray
          }
        },
      })

      yPos = (doc as any).lastAutoTable.finalY + 15
    }

    // Status breakdown tables
    const statuses: Array<{ label: string, filter: (c: Action) => boolean }> = [
      { label: 'Pending Concerns', filter: (c) => c.status === 'pending' },
      { label: 'In Progress', filter: (c) => c.status === 'under-action' || c.status === 'in-progress' },
      { label: 'Resolved Concerns', filter: (c) => c.status === 'resolved' || c.status === 'closed' || c.status === 'completed' },
    ]

    statuses.forEach(({ label, filter }) => {
      const statusConcerns = districtConcerns
        .filter(filter)
        .sort((a, b) => {
          const muniCompare = a.municipality.localeCompare(b.municipality)
          if (muniCompare !== 0) return muniCompare
          return new Date(a.dateReported).getTime() - new Date(b.dateReported).getTime()
        })

      if (statusConcerns.length === 0) return

      checkNewPage(50)

      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
      doc.text(`${label} (${statusConcerns.length})`, margin, yPos)
      
      yPos += 3
      doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
      doc.setLineWidth(0.5)
      doc.line(margin, yPos, pageWidth - margin, yPos)
      
      yPos += 8

      const tableData = statusConcerns.map((concern, index) => [
        (index + 1).toString(),
        concern.municipality,
        concern.reportTitle,
        format(new Date(concern.dateReported), 'MMM dd, yyyy'),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['', 'Municipality', 'Report Title', 'Date']],
        body: tableData,
        theme: 'plain',
        headStyles: { 
          fillColor: [255, 255, 255],
          textColor: colors.secondary,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'left',
          cellPadding: { top: 2, right: 5, bottom: 4, left: 0 },
          lineWidth: { bottom: 0.5 },
          lineColor: colors.border,
        },
        bodyStyles: { 
          textColor: colors.primary,
          fontSize: 8,
          cellPadding: { top: 4, right: 5, bottom: 4, left: 0 },
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'right', textColor: colors.secondary },
          1: { cellWidth: 32, fontStyle: 'bold' },
          2: { cellWidth: 82 },
          3: { cellWidth: 28, halign: 'right', textColor: colors.secondary },
        },
        margin: { left: margin, right: margin },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index < tableData.length - 1) {
            data.cell.styles.lineWidth = { bottom: 0.2 }
            data.cell.styles.lineColor = colors.lightGray
          }
        },
      })

      yPos = (doc as any).lastAutoTable.finalY + 12
    })

    addPageFooter()
  })

  return doc
}
