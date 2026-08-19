import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { Action } from '@/data/sampleActions'
import { getDistrictFromMunicipality } from '@/data/municipalities'

export const generate1BACOverallSummaryPDF = async (
  concerns: Action[],
  dateRange: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 25
  let yPos = margin

  // Minimalist color palette - clean, professional, monochromatic
  const colors = {
    primary: [30, 30, 30] as [number, number, number],      // Dark gray for main text
    secondary: [120, 120, 120] as [number, number, number], // Medium gray for secondary text
    accent: [0, 0, 0] as [number, number, number],          // Black for emphasis
    lightGray: [245, 245, 245] as [number, number, number], // Very light gray for subtle backgrounds
    border: [220, 220, 220] as [number, number, number],    // Light border
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
    doc.text('1BAC Concerns Report', margin, pageHeight - 12)
    doc.text(format(new Date(), 'MMM dd, yyyy'), pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

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

  // Top municipalities
  const municipalityCounts: Record<string, number> = {}
  concerns.forEach(c => {
    municipalityCounts[c.municipality] = (municipalityCounts[c.municipality] || 0) + 1
  })
  const topMunicipalities = Object.entries(municipalityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Count report titles (case-insensitive)
  const reportTitleCounts: Record<string, number> = {}
  concerns.forEach(concern => {
    const normalizedTitle = concern.reportTitle.toLowerCase().trim()
    reportTitleCounts[normalizedTitle] = (reportTitleCounts[normalizedTitle] || 0) + 1
  })
  
  // Get the original casing for display
  const reportTitleDisplay: Record<string, string> = {}
  concerns.forEach(concern => {
    const normalizedTitle = concern.reportTitle.toLowerCase().trim()
    if (!reportTitleDisplay[normalizedTitle]) {
      reportTitleDisplay[normalizedTitle] = concern.reportTitle
    }
  })
  
  const topConcernTypes = Object.entries(reportTitleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([normalizedTitle, count]) => [reportTitleDisplay[normalizedTitle], count])

  const periodText = dateRange === 'all' ? 'All Time' : 
                     dateRange === 'today' ? 'Today' :
                     dateRange === 'week' ? 'Last 7 Days' :
                     dateRange === 'month' ? 'Last 30 Days' :
                     dateRange === 'year' ? 'Last 365 Days' : dateRange

  // Load logos
  const bataanLogo = await loadImageAsBase64('/images/bataanlogo.png')
  const actionCenterLogo = await loadImageAsBase64('/images/image.png')

  // ========== COVER PAGE - MINIMALIST DESIGN ==========
  
  // Logos at top corners - small and subtle
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
  
  // Thin top line - subtle accent
  doc.setDrawColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.setLineWidth(0.8)
  doc.line(margin, 40, pageWidth - margin, 40)

  // Organization header - small, unobtrusive
  yPos = 50
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text('PROVINCE OF BATAAN', pageWidth / 2, yPos, { align: 'center' })
  
  yPos += 5
  doc.setFontSize(7)
  doc.text('Office of the Governor · 1BAC Action Center', pageWidth / 2, yPos, { align: 'center' })

  // Main title - large, bold, clean
  yPos = 80
  doc.setFontSize(36)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('1BAC', pageWidth / 2, yPos, { align: 'center' })
  
  yPos += 14
  doc.setFontSize(18)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.text('Summary Report', pageWidth / 2, yPos, { align: 'center' })

  // Period badge - minimal
  yPos += 12
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text(periodText, pageWidth / 2, yPos, { align: 'center' })

  // Key metrics - clean boxes with just numbers
  yPos = 125
  const metricWidth = (pageWidth - 2 * margin - 10) / 3
  const metrics = [
    { label: 'Total Concerns', value: totalConcerns.toString() },
    { label: 'Resolved', value: resolvedCount.toString() },
    { label: 'Resolution Rate', value: `${completionRate}%` },
  ]

  metrics.forEach((metric, index) => {
    const xPos = margin + index * (metricWidth + 5)
    
    // Minimal border
    doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
    doc.setLineWidth(0.5)
    doc.rect(xPos, yPos, metricWidth, 32)
    
    // Label - small, uppercase
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(metric.label.toUpperCase(), xPos + metricWidth / 2, yPos + 10, { align: 'center' })
    
    // Value - large, bold
    doc.setFontSize(22)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.text(metric.value, xPos + metricWidth / 2, yPos + 24, { align: 'center' })
  })

  // Date range at bottom - subtle
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
    
    yPos += 5
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(`${concerns.length} concern${concerns.length !== 1 ? 's' : ''} analyzed across three legislative districts`, pageWidth / 2, yPos, { align: 'center' })
  }

  addPageFooter()

  // ========== STATUS OVERVIEW PAGE ==========
  doc.addPage()
  yPos = margin

  // Simple page header
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('Status Overview', margin, yPos)
  
  yPos += 3
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)
  
  yPos += 12

  // Status breakdown - clean lines
  const statusData = [
    { label: 'Pending', count: pendingCount },
    { label: 'Under Action', count: underActionCount },
    { label: 'Resolved', count: resolvedCount },
  ]

  statusData.forEach(status => {
    const percentage = totalConcerns > 0 ? Math.round((status.count / totalConcerns) * 100) : 0
    
    // Status label and count on same line
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.text(status.label, margin, yPos)
    
    doc.setFont('helvetica', 'bold')
    doc.text(`${status.count}`, pageWidth - margin - 25, yPos, { align: 'right' })
    
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(`${percentage}%`, pageWidth - margin, yPos, { align: 'right' })
    
    // Simple horizontal line as progress indicator
    yPos += 3
    const barWidth = (pageWidth - 2 * margin) * (percentage / 100)
    doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
    doc.rect(margin, yPos, barWidth, 1.5, 'F')
    
    // Light background line
    doc.setFillColor(colors.lightGray[0], colors.lightGray[1], colors.lightGray[2])
    doc.rect(margin + barWidth, yPos, (pageWidth - 2 * margin) - barWidth, 1.5, 'F')
    
    yPos += 8
  })

  yPos += 8

  // District comparison - simple table
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('District Comparison', margin, yPos)
  
  yPos += 3
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(margin, yPos, pageWidth - margin, yPos)
  
  yPos += 10

  const districtTableData = Object.entries(districtStats).map(([district, stats]) => [
    district,
    stats.total.toString(),
    stats.pending.toString(),
    stats.underAction.toString(),
    stats.resolved.toString(),
    stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}%` : '0%',
  ])

  autoTable(doc, {
    startY: yPos,
    head: [['District', 'Total', 'Pending', 'In Progress', 'Resolved', 'Rate']],
    body: districtTableData,
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
      fontSize: 9,
      cellPadding: { top: 4, right: 5, bottom: 4, left: 0 },
    },
    columnStyles: {
      0: { cellWidth: 50, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'right' },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (data) => {
      // Add subtle line between rows
      if (data.section === 'body' && data.row.index < districtTableData.length - 1) {
        data.cell.styles.lineWidth = { bottom: 0.2 }
        data.cell.styles.lineColor = colors.lightGray
      }
    },
  })

  yPos = (doc as any).lastAutoTable.finalY + 15

  // Top municipalities - minimal bars
  checkNewPage(70)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('Top Municipalities', margin, yPos)
  
  yPos += 3
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(margin, yPos, pageWidth - margin, yPos)
  
  yPos += 10

  if (topMunicipalities.length > 0) {
    topMunicipalities.forEach(([muni, count], index) => {
      const maxWidth = pageWidth - 2 * margin - 60
      const barWidth = (count / topMunicipalities[0][1]) * maxWidth
      
      // Municipality name
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.text(`${muni}`, margin, yPos + 4)
      
      // Bar - simple filled rectangle
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.rect(margin + 55, yPos, barWidth, 5, 'F')
      
      // Count
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.text(count.toString(), margin + 55 + barWidth + 4, yPos + 4)
      
      yPos += 9
    })
  }

  yPos += 8

  // ========== MONTHLY CONCERNS BREAKDOWN ==========
  checkNewPage(80)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('Monthly Concerns Breakdown', margin, yPos)
  
  yPos += 3
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(margin, yPos, pageWidth - margin, yPos)
  
  yPos += 10

  // Calculate monthly data
  const monthlyData: Record<string, number> = {}
  concerns.forEach(concern => {
    const date = new Date(concern.dateReported)
    const monthKey = format(date, 'MMM yyyy')
    monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1
  })

  // Sort by date (most recent first) and get last 12 months or all available
  const sortedMonths = Object.entries(monthlyData)
    .sort((a, b) => {
      const dateA = new Date(a[0])
      const dateB = new Date(b[0])
      return dateB.getTime() - dateA.getTime()
    })
    .slice(0, 12)
    .reverse() // Show oldest to newest in chart

  if (sortedMonths.length > 0) {
    const maxCount = Math.max(...sortedMonths.map(([_, count]) => count))
    const maxWidth = pageWidth - 2 * margin - 40

    sortedMonths.forEach(([month, count], index) => {
      // Check for new page every 4 bars
      if (index > 0 && index % 4 === 0) {
        checkNewPage(30)
      }
      
      const barWidth = (count / maxCount) * maxWidth
      
      // Month label
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.text(month, margin, yPos + 4)
      
      // Bar - simple filled rectangle
      doc.setFillColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.rect(margin + 35, yPos, barWidth, 5, 'F')
      
      // Count
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
      doc.text(count.toString(), margin + 35 + barWidth + 4, yPos + 4)
      
      yPos += 9
    })

    yPos += 5

    // Peak month insight
    checkNewPage(10)
    const peakMonth = sortedMonths.reduce((max, current) => 
      current[1] > max[1] ? current : max
    )
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text(
      `Peak reporting period: ${peakMonth[0]} with ${peakMonth[1]} concern${peakMonth[1] !== 1 ? 's' : ''} reported`,
      margin,
      yPos
    )
    yPos += 8
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
    doc.text('No monthly data available', margin, yPos)
    yPos += 8
  }

  // ========== TOP CONCERN TYPES SECTION ==========
  checkNewPage(90)
  
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(colors.accent[0], colors.accent[1], colors.accent[2])
  doc.text('Top Concern Types', margin, yPos)
  
  yPos += 3
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.line(margin, yPos, pageWidth - margin, yPos)
  
  yPos += 10

  if (topConcernTypes.length > 0) {
    const concernTableData = topConcernTypes.map(([type, count], index) => {
      const percentage = totalConcerns > 0 ? Math.round(((count as number) / totalConcerns) * 100) : 0
      return [
        (index + 1).toString(),
        type,
        count.toString(),
        `${percentage}%`
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['', 'Concern Type', 'Count', '%']],
      body: concernTableData,
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
        fontSize: 9,
        cellPadding: { top: 4, right: 5, bottom: 4, left: 0 },
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'right', textColor: colors.secondary },
        1: { cellWidth: 100 },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 15, halign: 'right', textColor: colors.secondary },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        // Add subtle line between rows
        if (data.section === 'body' && data.row.index < concernTableData.length - 1) {
          data.cell.styles.lineWidth = { bottom: 0.2 }
          data.cell.styles.lineColor = colors.lightGray
        }
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  }

  addPageFooter()

  return doc
}
