import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'

interface BuildingPermitItem {
  id: string
  dateReported: string
  dateUploaded: string
  municipality: string
  reportTitle: string
  location: string
  remarks: string
  status: 'pending' | 'for-validation' | 'completed'
  reportedBy: string
}

export const generateBuildingPermitSummaryPDF = async (
  concerns: BuildingPermitItem[],
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
    } catch {
      return null
    }
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
    doc.text('Building Permit Summary Report', margin, pageHeight - 12)
    doc.text(format(new Date(), 'MMM dd, yyyy'), pageWidth - margin, pageHeight - 12, { align: 'right' })
  }

  // Load logos
  const bataanLogo = await loadImageAsBase64('/images/bataanlogo.png')
  const actionCenterLogo = await loadImageAsBase64('/images/image.png')

  // Header Logos
  const logoSize = 12
  if (bataanLogo) {
    try {
      doc.addImage(bataanLogo, 'PNG', margin, yPos, logoSize, logoSize)
    } catch (e) {
      console.warn('Failed to add Bataan logo to PDF:', e)
    }
  }
  if (actionCenterLogo) {
    try {
      doc.addImage(actionCenterLogo, 'PNG', pageWidth - margin - logoSize, yPos, logoSize, logoSize)
    } catch (e) {
      console.warn('Failed to add Action Center logo to PDF:', e)
    }
  }

  // Header Title
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(colors.primary[0], colors.primary[1], colors.primary[2])
  doc.text('PROVINCE OF BATAAN', pageWidth / 2, yPos + 4, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text('Building Permit Monitoring Summary', pageWidth / 2, yPos + 9, { align: 'center' })

  yPos += 20

  // Divider line
  doc.setDrawColor(colors.border[0], colors.border[1], colors.border[2])
  doc.setLineWidth(0.5)
  doc.line(margin, yPos, pageWidth - margin, yPos)

  yPos += 8

  // Calculate statistics
  const totalConcerns = concerns.length
  const completedCount = concerns.filter(c => c.status === 'completed').length
  const pendingCount = concerns.filter(c => c.status === 'pending').length
  const validationCount = concerns.filter(c => c.status === 'for-validation').length

  // Date range info
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(colors.secondary[0], colors.secondary[1], colors.secondary[2])
  doc.text(`Period: ${dateRange}`, margin, yPos)
  doc.text(`Total Records: ${totalConcerns} | Pending: ${pendingCount} | Validation: ${validationCount} | Completed: ${completedCount}`, pageWidth - margin, yPos, { align: 'right' })

  yPos += 8

  // Table Columns
  const tableColumns = [
    { header: 'Date Reported', dataKey: 'dateReported' },
    { header: 'Municipality', dataKey: 'municipality' },
    { header: 'Permit / Title', dataKey: 'reportTitle' },
    { header: 'Location', dataKey: 'location' },
    { header: 'Status', dataKey: 'status' },
    { header: 'Reported By', dataKey: 'reportedBy' },
  ]

  const tableRows = concerns.map(c => ({
    dateReported: c.dateReported ? format(new Date(c.dateReported), 'MMM dd, yyyy') : 'N/A',
    municipality: c.municipality,
    reportTitle: c.reportTitle,
    location: c.location || 'N/A',
    status: c.status.toUpperCase(),
    reportedBy: c.reportedBy || 'Admin',
  }))

  autoTable(doc, {
    startY: yPos,
    head: [tableColumns.map(col => col.header)],
    body: tableRows.map(row => Object.values(row)),
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: {
      fillColor: [31, 41, 55],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    didDrawPage: () => {
      addPageFooter()
    },
  })

  // Save the PDF
  doc.save(`Building_Permit_Summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`)
}
