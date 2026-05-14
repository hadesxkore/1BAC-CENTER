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
  const margin = 20
  let yPos = margin

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

  // Helper for new page
  const checkNewPage = (spaceNeeded: number) => {
    if (yPos + spaceNeeded > pageHeight - 25) {
      doc.addPage()
      yPos = margin
      return true
    }
    return false
  }

  // Load logos
  const bataanLogo = await loadImageAsBase64('/images/bataanlogo.png')
  const actionCenterLogo = await loadImageAsBase64('/images/image.png')

  // Filter and calculate statistics
  const totalConcerns = concerns.length
  const pendingCount = concerns.filter(c => c.status === 'pending').length
  const inProgressCount = concerns.filter(c => c.status === 'in-progress').length
  const completedCount = concerns.filter(c => c.status === 'completed').length
  const completionRate = totalConcerns > 0 ? Math.round((completedCount / totalConcerns) * 100) : 0

  // District statistics
  const districtStats: Record<string, any> = {
    'First District': { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
    'Second District': { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
    'Third District': { total: 0, pending: 0, inProgress: 0, completed: 0, municipalities: {} },
  }

  concerns.forEach(concern => {
    const district = getDistrictFromMunicipality(concern.municipality)
    if (district) {
      districtStats[district].total++
      if (concern.status === 'pending') districtStats[district].pending++
      if (concern.status === 'in-progress') districtStats[district].inProgress++
      if (concern.status === 'completed') districtStats[district].completed++
      
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

  // Analyze concern keywords - removed for 1BAC (no categories)

  const categoryLabel = '1BAC'
  const categoryColor: [number, number, number] = [147, 51, 234] // Purple for 1BAC
  const periodText = dateRange === 'all' ? 'All Time' : 
                     dateRange === 'today' ? 'Today' :
                     dateRange === 'week' ? 'Last 7 Days' :
                     dateRange === 'month' ? 'Last 30 Days' :
                     dateRange === 'year' ? 'Last 365 Days' : dateRange

  // ========== COVER PAGE ==========
  // Modern gradient background with multiple layers
  doc.setFillColor(30, 64, 175)
  doc.rect(0, 0, pageWidth, 100, 'F')
  
  // Accent gradient stripe
  doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.rect(0, 100, pageWidth, 8, 'F')
  
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 108, pageWidth, pageHeight - 108, 'F')

  // Logos
  if (bataanLogo) {
    try {
      doc.addImage(bataanLogo, 'PNG', margin, 12, 30, 30)
    } catch (e) {}
  }
  
  if (actionCenterLogo) {
    try {
      doc.addImage(actionCenterLogo, 'PNG', pageWidth - margin - 30, 12, 30, 30)
    } catch (e) {}
  }

  // Title section with better hierarchy
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 255, 255)
  doc.text('PROVINCE OF BATAAN', pageWidth / 2, 22, { align: 'center' })
  
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255, 0.9)
  doc.text('Office of the Governor', pageWidth / 2, 28, { align: 'center' })
  
  // Divider line
  doc.setDrawColor(255, 255, 255, 0.3)
  doc.setLineWidth(0.5)
  doc.line(pageWidth / 2 - 30, 32, pageWidth / 2 + 30, 32)

  doc.setFontSize(9)
  doc.setTextColor(255, 255, 255, 0.95)
  doc.text('1BAC Action Center', pageWidth / 2, 38, { align: 'center' })

  // Main title
  doc.setFontSize(28)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('1BAC CONCERNS', pageWidth / 2, 58, { align: 'center' })
  
  doc.setFontSize(20)
  doc.text('SUMMARY REPORT', pageWidth / 2, 70, { align: 'center' })

  // Period badge
  doc.setFillColor(255, 255, 255, 0.2)
  const periodBadgeWidth = 80
  doc.roundedRect(pageWidth / 2 - periodBadgeWidth / 2, 78, periodBadgeWidth, 12, 2, 2, 'F')
  
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text(periodText, pageWidth / 2, 86, { align: 'center' })

  // Data range information box with enhanced design
  yPos = 118
  const infoBoxWidth = pageWidth - 2 * margin
  const infoBoxHeight = 32
  
  // Box with gradient border effect
  doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.roundedRect(margin - 1, yPos - 1, infoBoxWidth + 2, infoBoxHeight + 2, 3, 3, 'F')
  
  doc.setFillColor(255, 255, 255)
  doc.roundedRect(margin, yPos, infoBoxWidth, infoBoxHeight, 3, 3, 'F')
  
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('REPORTING PERIOD', margin + 10, yPos + 10)
  
  // Calculate date range from actual data
  if (concerns.length > 0) {
    const dates = concerns.map(c => new Date(c.dateReported).getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 41, 59)
    doc.text(
      `${format(minDate, 'MMMM dd, yyyy')} - ${format(maxDate, 'MMMM dd, yyyy')}`,
      margin + 10,
      yPos + 19
    )
    
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(
      `This report analyzes ${concerns.length} 1BAC concern${concerns.length !== 1 ? 's' : ''} across all districts`,
      margin + 10,
      yPos + 26
    )
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text('No data available for the selected period', margin + 10, yPos + 18)
  }

  yPos += infoBoxHeight + 10

  // Key metrics cards with enhanced design
  const coverCardWidth = (pageWidth - 2 * margin - 8) / 3
  const coverCardHeight = 38

  // Three metric cards
  const metricsData = [
    { label: 'TOTAL CONCERNS', value: totalConcerns.toString(), color: categoryColor, icon: '#' },
    { label: 'COMPLETED', value: completedCount.toString(), color: [34, 197, 94] as [number, number, number], icon: '+' },
    { label: 'COMPLETION RATE', value: `${completionRate}%`, color: completionRate >= 70 ? [34, 197, 94] : completionRate >= 50 ? [234, 179, 8] : [239, 68, 68] as [number, number, number], icon: '%' },
  ]

  metricsData.forEach((metric, index) => {
    const xPos = margin + index * (coverCardWidth + 4)
    
    // Card shadow
    doc.setFillColor(0, 0, 0, 0.08)
    doc.roundedRect(xPos + 1, yPos + 1, coverCardWidth, coverCardHeight, 3, 3, 'F')
    
    // Card background
    doc.setFillColor(metric.color[0], metric.color[1], metric.color[2])
    doc.roundedRect(xPos, yPos, coverCardWidth, coverCardHeight, 3, 3, 'F')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255, 0.9)
    doc.text(metric.label, xPos + coverCardWidth / 2, yPos + 10, { align: 'center' })
    
    doc.setFontSize(26)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(metric.value, xPos + coverCardWidth / 2, yPos + 27, { align: 'center' })
    
    // Small icon at bottom
    doc.setFontSize(7)
    doc.setTextColor(255, 255, 255, 0.7)
    doc.text(`[${metric.icon}]`, xPos + coverCardWidth / 2, yPos + 34, { align: 'center' })
  })

  yPos += coverCardHeight + 12

  // Footer
  yPos = pageHeight - 30
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, pageWidth / 2, yPos, { align: 'center' })
  doc.text('Prepared by: 1BAC Action Center | For Official Use Only', pageWidth / 2, yPos + 5, { align: 'center' })

  // ========== EXECUTIVE SUMMARY PAGE ==========
  doc.addPage()
  yPos = margin

  // Page header
  doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.rect(0, 0, pageWidth, 15, 'F')
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('EXECUTIVE SUMMARY', pageWidth / 2, 10, { align: 'center' })

  yPos = 25

  // Overview paragraph
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)
  
  const overviewText = `This report provides a comprehensive analysis of ${totalConcerns} 1BAC concern${totalConcerns !== 1 ? 's' : ''} recorded across the Province of Bataan${dateRange !== 'all' ? ` during the ${periodText.toLowerCase()} period` : ''}. The data encompasses ${Object.keys(districtStats).length} legislative districts and provides detailed insights into the current status and geographical distribution of concerns.`
  
  const overviewLines = doc.splitTextToSize(overviewText, pageWidth - 2 * margin)
  doc.text(overviewLines, margin, yPos)
  yPos += overviewLines.length * 5 + 10

  // Status breakdown section
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('STATUS OVERVIEW', margin, yPos)
  yPos += 8

  // Status cards in a row
  const statusCardWidth = (pageWidth - 2 * margin - 8) / 3
  const statusCardHeight = 28

  const statusData = [
    { label: 'Pending', count: pendingCount, color: [251, 191, 36], icon: '!' },
    { label: 'In Progress', count: inProgressCount, color: [59, 130, 246], icon: '~' },
    { label: 'Completed', count: completedCount, color: [34, 197, 94], icon: '+' },
  ]

  statusData.forEach((status, index) => {
    const xPos = margin + index * (statusCardWidth + 4)
    const percentage = totalConcerns > 0 ? Math.round((status.count / totalConcerns) * 100) : 0
    
    doc.setFillColor(status.color[0], status.color[1], status.color[2])
    doc.setDrawColor(status.color[0] - 20, status.color[1] - 20, status.color[2] - 20)
    doc.setLineWidth(0.5)
    doc.roundedRect(xPos, yPos, statusCardWidth, statusCardHeight, 2, 2, 'FD')
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(status.label.toUpperCase(), xPos + statusCardWidth / 2, yPos + 7, { align: 'center' })
    
    doc.setFontSize(20)
    doc.text(status.count.toString(), xPos + statusCardWidth / 2, yPos + 18, { align: 'center' })
    
    doc.setFontSize(7)
    doc.text(`${percentage}% of total`, xPos + statusCardWidth / 2, yPos + 24, { align: 'center' })
  })

  yPos += statusCardHeight + 12

  // Key insights with intelligent analysis
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('KEY INSIGHTS', margin, yPos)
  yPos += 8

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(60, 60, 60)

  const insights = []
  
  // Completion rate insight
  if (completionRate >= 70) {
    insights.push(`[+] Strong performance with ${completionRate}% completion rate, demonstrating effective response and resolution capabilities.`)
  } else if (completionRate >= 50) {
    insights.push(`[~] Moderate completion rate of ${completionRate}% indicates room for improvement in concern resolution processes.`)
  } else {
    insights.push(`[!] Completion rate of ${completionRate}% requires immediate attention and resource allocation to improve response effectiveness.`)
  }

  // Pending concerns insight
  if (pendingCount > totalConcerns * 0.3) {
    insights.push(`[!] ${pendingCount} pending concerns (${Math.round((pendingCount / totalConcerns) * 100)}%) require immediate action and prioritization.`)
  } else if (pendingCount > 0) {
    insights.push(`[~] ${pendingCount} concerns remain pending and should be monitored for timely resolution.`)
  }

  // Geographical insight
  if (topMunicipalities.length > 0) {
    insights.push(`[*] ${topMunicipalities[0][0]} reports the highest number of concerns (${topMunicipalities[0][1]}), requiring focused attention and resources.`)
  }

  // Top concern types insight
  if (topConcernTypes.length > 0) {
    const topThree = topConcernTypes.slice(0, 3).map(([name, count]) => `${name} (${count})`).join(', ')
    insights.push(`[*] Most common concerns: ${topThree}.`)
  }

  insights.forEach(insight => {
    const lines = doc.splitTextToSize(insight, pageWidth - 2 * margin - 5)
    doc.text(lines, margin + 3, yPos)
    yPos += lines.length * 5 + 2
  })

  yPos += 8

  // District comparison table
  checkNewPage(60)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('DISTRICT COMPARISON', margin, yPos)
  yPos += 8

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
    head: [['District', 'Total', 'Pending', 'In Progress', 'Completed', 'Rate']],
    body: districtTableData,
    theme: 'grid',
    headStyles: { 
      fillColor: categoryColor,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: { 
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 50, halign: 'left' },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 },
    },
    margin: { left: margin, right: margin },
  })

  yPos = (doc as any).lastAutoTable.finalY + 12

  // Top municipalities chart
  checkNewPage(50)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('TOP 5 MUNICIPALITIES', margin, yPos)
  yPos += 8

  topMunicipalities.forEach(([muni, count], index) => {
    const barWidth = (count / topMunicipalities[0][1]) * (pageWidth - 2 * margin - 50)
    
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(60, 60, 60)
    doc.text(`${index + 1}. ${muni}`, margin, yPos + 4)
    
    doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
    doc.roundedRect(margin + 45, yPos, barWidth, 6, 1, 1, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
    doc.text(count.toString(), margin + 45 + barWidth + 3, yPos + 4)
    
    yPos += 10
  })

  yPos += 8

  // Monthly concerns breakdown
  checkNewPage(80)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('MONTHLY CONCERNS BREAKDOWN', margin, yPos)
  yPos += 8

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
    const rowHeight = 8
    const maxBarWidth = pageWidth - 2 * margin - 35

    sortedMonths.forEach(([month, count], index) => {
      const barWidth = (count / maxCount) * maxBarWidth
      
      // Month label on left
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(60, 60, 60)
      doc.text(month, margin, yPos + 5)
      
      // Horizontal bar
      doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
      doc.roundedRect(margin + 30, yPos, barWidth, rowHeight, 1, 1, 'F')
      
      // Count at end of bar
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
      doc.text(count.toString(), margin + 30 + barWidth + 3, yPos + 5)
      
      yPos += rowHeight + 3
    })

    yPos += 5

    // Peak month insight
    const peakMonth = sortedMonths.reduce((max, current) => 
      current[1] > max[1] ? current : max
    )
    
    doc.setFontSize(8)
    doc.setFont('helvetica', 'italic')
    doc.setTextColor(100, 100, 100)
    doc.text(
      `[*] Peak reporting period: ${peakMonth[0]} with ${peakMonth[1]} concern${peakMonth[1] !== 1 ? 's' : ''} reported`,
      margin,
      yPos
    )
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text('No monthly data available', margin, yPos)
  }

  yPos += 10

  // ========== TOP CONCERNS SECTION ==========
  checkNewPage(80)
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(categoryColor[0], categoryColor[1], categoryColor[2])
  doc.text('TOP CONCERNS BY REPORT TITLE', margin, yPos)
  yPos += 8

  if (topConcernTypes.length > 0) {
    // Create table data
    const concernTableData = topConcernTypes.map(([type, count], index) => {
      const percentage = totalConcerns > 0 ? Math.round(((count as number) / totalConcerns) * 100) : 0
      return [
        index + 1,
        type,
        count.toString(),
        `${percentage}%`
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Report Title', 'Count', '% of Total']],
      body: concernTableData,
      theme: 'striped',
      headStyles: { 
        fillColor: categoryColor,
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { 
        fontSize: 8,
        cellPadding: 3,
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 90 },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 25, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 10
  } else {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 114, 128)
    doc.text('No concern type data available', margin, yPos)
    yPos += 10
  }

  // ========== DISTRICT DETAIL PAGES ==========
  const districts = ['First District', 'Second District', 'Third District']
  const districtRomanNumerals = ['DISTRICT I', 'DISTRICT II', 'DISTRICT III']
  const districtMunicipalities = [
    ['Abucay', 'Orani', 'Samal', 'Hermosa'],
    ['Balanga City', 'Pilar', 'Orion', 'Limay'],
    ['Bagac', 'Dinalupihan', 'Mariveles', 'Morong'],
  ]
  
  districts.forEach((district, districtIndex) => {
    const districtConcerns = concerns.filter(c => getDistrictFromMunicipality(c.municipality) === district)

    doc.addPage()
    yPos = margin

    // District header with gradient
    doc.setFillColor(categoryColor[0], categoryColor[1], categoryColor[2])
    doc.rect(0, 0, pageWidth, 25, 'F')
    
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text(districtRomanNumerals[districtIndex], margin, 11)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${categoryLabel} Concerns`, pageWidth - margin, 11, { align: 'right' })

    // Municipalities subtitle
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(255, 255, 255, 0.9)
    const municipalitiesText = districtMunicipalities[districtIndex].join(' | ')
    doc.text(municipalitiesText, margin, 18)

    yPos = 32

    // If no data, show message card and skip to next district
    if (districtConcerns.length === 0) {
      // Center message card
      const cardWidth = 140
      const cardHeight = 60
      const cardX = (pageWidth - cardWidth) / 2
      const cardY = (pageHeight - cardHeight) / 2 - 20

      // Draw card background
      doc.setFillColor(249, 250, 251)
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(1)
      doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 4, 4, 'FD')

      // Icon circle
      doc.setFillColor(243, 244, 246)
      doc.circle(pageWidth / 2, cardY + 20, 8, 'F')

      // Info icon (i)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(156, 163, 175)
      doc.text('i', pageWidth / 2, cardY + 23, { align: 'center' })

      // Message text
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(75, 85, 99)
      doc.text('No Data Available', pageWidth / 2, cardY + 38, { align: 'center' })

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(107, 114, 128)
      doc.text(`No 1BAC concerns recorded`, pageWidth / 2, cardY + 46, { align: 'center' })
      doc.text(`for ${districtRomanNumerals[districtIndex]} in this period.`, pageWidth / 2, cardY + 52, { align: 'center' })

      return // Skip to next district
    }

    // District statistics cards
    const districtTotal = districtConcerns.length
    const districtPending = districtConcerns.filter(c => c.status === 'pending').length
    const districtInProgress = districtConcerns.filter(c => c.status === 'in-progress').length
    const districtCompleted = districtConcerns.filter(c => c.status === 'completed').length
    const districtRate = districtTotal > 0 ? Math.round((districtCompleted / districtTotal) * 100) : 0

    const districtCardWidth = (pageWidth - 2 * margin - 12) / 4
    const districtCardHeight = 25

    const districtCards = [
      { label: 'Total', value: districtTotal, color: [100, 116, 139] },
      { label: 'Pending', value: districtPending, color: [251, 191, 36] },
      { label: 'In Progress', value: districtInProgress, color: [59, 130, 246] },
      { label: 'Completed', value: districtCompleted, color: [34, 197, 94] },
    ]

    districtCards.forEach((card, index) => {
      const xPos = margin + index * (districtCardWidth + 4)
      
      doc.setFillColor(card.color[0], card.color[1], card.color[2])
      doc.roundedRect(xPos, yPos, districtCardWidth, districtCardHeight, 2, 2, 'F')
      
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.text(card.label.toUpperCase(), xPos + districtCardWidth / 2, yPos + 6, { align: 'center' })
      
      doc.setFontSize(16)
      doc.text(card.value.toString(), xPos + districtCardWidth / 2, yPos + 16, { align: 'center' })
      
      if (index > 0) {
        const pct = districtTotal > 0 ? Math.round((card.value / districtTotal) * 100) : 0
        doc.setFontSize(6)
        doc.text(`${pct}%`, xPos + districtCardWidth / 2, yPos + 21, { align: 'center' })
      }
    })

    yPos += districtCardHeight + 12

    // Top Concerns in this District - Count by report title
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(`TOP CONCERNS IN ${districtRomanNumerals[districtIndex]}`, margin, yPos)
    yPos += 7

    // Count report titles in this district (case-insensitive)
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

    // Sort by count and get top 10
    const topDistrictConcerns = Object.entries(districtTitleCounts)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)

    const topConcernsTableData = topDistrictConcerns.map(([_, data], index) => [
      index + 1,
      data.originalTitle.length > 60 ? data.originalTitle.substring(0, 60) + '...' : data.originalTitle,
      data.count.toString(),
      Array.from(data.municipalities).sort().join(', ')
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Report Title', 'Count', 'Municipalities']],
      body: topConcernsTableData,
      theme: 'grid',
      headStyles: { 
        fillColor: [100, 116, 139],
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
      },
      bodyStyles: { 
        fontSize: 7,
        cellPadding: 2,
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 70 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 57 },
      },
      margin: { left: margin, right: margin },
    })

    yPos = (doc as any).lastAutoTable.finalY + 12

    // Status tables
    const statuses: Array<{ status: 'pending' | 'in-progress' | 'completed', label: string, headerColor: [number, number, number] }> = [
      { status: 'pending', label: 'PENDING CONCERNS', headerColor: [251, 191, 36] },
      { status: 'in-progress', label: 'IN-PROGRESS CONCERNS', headerColor: [59, 130, 246] },
      { status: 'completed', label: 'COMPLETED CONCERNS', headerColor: [34, 197, 94] },
    ]

    statuses.forEach(({ status, label, headerColor }) => {
      const statusConcerns = districtConcerns
        .filter(c => c.status === status)
        .sort((a, b) => {
          // Sort by municipality first, then by date
          const muniCompare = a.municipality.localeCompare(b.municipality)
          if (muniCompare !== 0) return muniCompare
          // Then by date ascending (oldest first)
          const dateA = new Date(a.dateReported).getTime()
          const dateB = new Date(b.dateReported).getTime()
          return dateA - dateB
        })

      if (statusConcerns.length === 0) return

      checkNewPage(40)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(headerColor[0], headerColor[1], headerColor[2])
      doc.text(`${label} (${statusConcerns.length})`, margin, yPos)
      yPos += 7

      const tableData = statusConcerns.map((concern, index) => [
        index + 1,
        concern.municipality,
        concern.reportTitle.length > 60 ? concern.reportTitle.substring(0, 60) + '...' : concern.reportTitle,
        format(new Date(concern.dateReported), 'MMM dd, yyyy'),
      ])

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Municipality', 'Report Title', 'Date']],
        body: tableData,
        theme: 'striped',
        headStyles: { 
          fillColor: headerColor,
          fontSize: 8,
          fontStyle: 'bold',
          halign: 'center',
        },
        bodyStyles: { 
          fontSize: 7,
          cellPadding: 3,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 30 },
          2: { cellWidth: 90 },
          3: { cellWidth: 25, halign: 'center' },
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245],
        },
        margin: { left: margin, right: margin },
      })

      yPos = (doc as any).lastAutoTable.finalY + 10
    })

    // Add district summary table at the bottom
    checkNewPage(40)
    
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(100, 116, 139)
    doc.text(`${districtRomanNumerals[districtIndex]} - STATUS SUMMARY`, margin, yPos)
    yPos += 7

    const summaryTableData = [
      ['Total Concerns', districtTotal.toString()],
      ['Pending', `${districtPending} (${districtTotal > 0 ? Math.round((districtPending / districtTotal) * 100) : 0}%)`],
      ['In Progress', `${districtInProgress} (${districtTotal > 0 ? Math.round((districtInProgress / districtTotal) * 100) : 0}%)`],
      ['Completed', `${districtCompleted} (${districtTotal > 0 ? Math.round((districtCompleted / districtTotal) * 100) : 0}%)`],
      ['Completion Rate', `${districtRate}%`],
    ]

    autoTable(doc, {
      startY: yPos,
      body: summaryTableData,
      theme: 'plain',
      bodyStyles: { 
        fontSize: 9,
        cellPadding: 4,
      },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold', textColor: [60, 60, 60] },
        1: { cellWidth: 60, halign: 'right', textColor: [100, 100, 100] },
      },
      margin: { left: margin, right: margin },
      didParseCell: (data) => {
        if (data.row.index === 0) {
          data.cell.styles.fillColor = [241, 245, 249]
          data.cell.styles.fontStyle = 'bold'
        }
        if (data.row.index === 1) {
          data.cell.styles.textColor = [161, 98, 7]
        }
        if (data.row.index === 2) {
          data.cell.styles.textColor = [29, 78, 216]
        }
        if (data.row.index === 3) {
          data.cell.styles.textColor = [22, 163, 74]
        }
        if (data.row.index === 4) {
          data.cell.styles.fillColor = [241, 245, 249]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    yPos = (doc as any).lastAutoTable.finalY + 5
  })

  return doc
}
