import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileDownloadIcon, FileXIcon } from '@hugeicons/core-free-icons'
import { db } from '@/config/firebase'
import { collection, query, orderBy, getDocs, where, Timestamp } from 'firebase/firestore'
import { toast } from 'sonner'
import jsPDF from 'jspdf'
import ExcelJS from 'exceljs'
import { format } from 'date-fns'
import type { Action } from '@/data/sampleActions'

export default function Report() {
  const [isLoading, setIsLoading] = useState(false)
  const [concerns, setConcerns] = useState<Action[]>([])
  const [reportType, setReportType] = useState<'action-center' | 'pnp'>('action-center')
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')

  // Fetch data based on filters
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const collectionName = reportType === 'action-center' ? 'concerns' : 'pnp_reports'
      let q = query(collection(db, collectionName), orderBy('createdAt', 'desc'))

      // Apply date range filter
      if (dateRange !== 'all') {
        const now = new Date()
        let startDate = new Date()

        switch (dateRange) {
          case 'today':
            startDate.setHours(0, 0, 0, 0)
            break
          case 'week':
            startDate.setDate(now.getDate() - 7)
            break
          case 'month':
            startDate.setMonth(now.getMonth() - 1)
            break
          case 'year':
            startDate.setFullYear(now.getFullYear() - 1)
            break
        }

        q = query(
          collection(db, collectionName),
          where('createdAt', '>=', Timestamp.fromDate(startDate)),
          orderBy('createdAt', 'desc')
        )
      }

      const snapshot = await getDocs(q)
      const data: Action[] = []

      snapshot.forEach((doc) => {
        const docData = doc.data()
        data.push({
          id: doc.id,
          dateReported: docData.dateReported,
          dateUploaded: docData.dateUploaded instanceof Timestamp
            ? docData.dateUploaded.toDate().toISOString()
            : new Date().toISOString(),
          municipality: docData.municipality,
          category: docData.category || 'N/A',
          assignedTo: docData.assignedTo || 'N/A',
          reportTitle: docData.reportTitle,
          caseRemarks: docData.caseRemarks || docData.remarks || '',
          location: docData.location,
          concernPhotos: docData.concernPhotos || docData.beforePhotos || [],
          answeredBy: docData.answeredBy || docData.reportedBy || 'N/A',
          actionTaken: docData.actionTaken || (docData.afterPhotos ? {
            photos: docData.afterPhotos.photos || [],
            notes: docData.afterPhotos.notes || '',
            submittedBy: docData.afterPhotos.submittedBy || '',
            submittedAt: docData.afterPhotos.submittedAt || '',
          } : null),
          actionDate: docData.actionDate || null,
          status: docData.status,
          reportedBy: docData.reportedBy || 'N/A',
          createdAt: docData.createdAt instanceof Timestamp
            ? docData.createdAt.toDate().toISOString()
            : new Date().toISOString(),
        })
      })

      // Apply status filter
      const filteredData = statusFilter === 'all'
        ? data
        : data.filter(item => item.status === statusFilter)

      setConcerns(filteredData)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [reportType, dateRange, statusFilter])

  // Generate PDF Report with Card Style Layout
  const generatePDF = async () => {
    if (concerns.length === 0) {
      toast.error('No data to export')
      return
    }

    toast.info('Generating PDF with images...')

    try {
      const doc = new jsPDF('p', 'mm', 'a4') // Portrait orientation
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 15
      const cardWidth = pageWidth - (margin * 2)
      const cardHeight = (pageHeight - (margin * 3)) / 2 // 2 cards per page

      // Helper function to load image as base64
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
          console.error('Error loading image:', error)
          return null
        }
      }

      // Helper function to draw a card
      const drawCard = async (concern: Action, yPosition: number) => {
        const cardX = margin
        const cardY = yPosition
        
        // Card background with subtle shadow effect
        doc.setFillColor(255, 255, 255)
        doc.setDrawColor(230, 230, 230)
        doc.setLineWidth(0.3)
        doc.rect(cardX, cardY, cardWidth, cardHeight)

        // Status indicator bar on left
        const statusColor: [number, number, number] = concern.status === 'completed' 
          ? [16, 185, 129] // Green
          : [251, 191, 36] // Yellow
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
        doc.rect(cardX, cardY, 3, cardHeight, 'F')

        // Title section
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 30, 30)
        const titleText = concern.reportTitle.length > 65 
          ? concern.reportTitle.substring(0, 65) + '...' 
          : concern.reportTitle
        const titleLines = doc.splitTextToSize(titleText, cardWidth - 50)
        doc.text(titleLines.slice(0, 2), cardX + 8, cardY + 8)

        // Status badge (top right)
        const badgeWidth = 28
        const badgeHeight = 6
        const badgeX = cardX + cardWidth - badgeWidth - 5
        const badgeY = cardY + 5
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2])
        doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 1.5, 1.5, 'F')
        doc.setFontSize(8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(255, 255, 255)
        doc.text(concern.status.toUpperCase(), badgeX + badgeWidth / 2, badgeY + 4.5, { align: 'center' })

        // Divider line
        doc.setDrawColor(240, 240, 240)
        doc.setLineWidth(0.3)
        doc.line(cardX + 8, cardY + 18, cardX + cardWidth - 8, cardY + 18)

        // Info grid
        let currentY = cardY + 25
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')

        // Row 1
        doc.text('DATE REPORTED', cardX + 8, currentY)
        doc.text('MUNICIPALITY', cardX + 60, currentY)
        
        doc.setTextColor(30, 30, 30)
        doc.setFont('helvetica', 'bold')
        doc.text(format(new Date(concern.dateReported), 'MMM dd, yyyy'), cardX + 8, currentY + 4)
        doc.text(concern.municipality, cardX + 60, currentY + 4)

        currentY += 12

        // Row 2
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')
        doc.text('LOCATION', cardX + 8, currentY)
        
        doc.setTextColor(30, 30, 30)
        doc.setFont('helvetica', 'bold')
        const locationText = concern.location.length > 55 
          ? concern.location.substring(0, 55) + '...' 
          : concern.location
        doc.text(locationText, cardX + 8, currentY + 4)

        currentY += 12

        // Row 3
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')
        doc.text('REPORTED BY', cardX + 8, currentY)
        
        doc.setTextColor(30, 30, 30)
        doc.setFont('helvetica', 'bold')
        doc.text(concern.answeredBy, cardX + 8, currentY + 4)

        currentY += 12

        // Remarks section
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')
        doc.text('REMARKS', cardX + 8, currentY)
        
        doc.setTextColor(50, 50, 50)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(7.5)
        const remarksText = concern.caseRemarks.length > 120 
          ? concern.caseRemarks.substring(0, 120) + '...' 
          : concern.caseRemarks
        const remarksLines = doc.splitTextToSize(remarksText, cardWidth - 16)
        doc.text(remarksLines.slice(0, 2), cardX + 8, currentY + 4)

        currentY += 14

        // Photos section
        const photoWidth = 28
        const photoHeight = 28
        const photoSpacing = 3

        // Before/Concern Photos
        doc.setFontSize(8)
        doc.setTextColor(100, 100, 100)
        doc.setFont('helvetica', 'normal')
        doc.text(reportType === 'action-center' ? 'CONCERN PHOTOS' : 'BEFORE PHOTOS', cardX + 8, currentY)
        
        currentY += 3
        const concernPhotos = concern.concernPhotos.slice(0, 3)
        for (let i = 0; i < concernPhotos.length; i++) {
          const photo = concernPhotos[i]
          const imgData = await loadImageAsBase64(photo.url)
          if (imgData) {
            const photoX = cardX + 8 + (i * (photoWidth + photoSpacing))
            doc.addImage(imgData, 'JPEG', photoX, currentY, photoWidth, photoHeight)
            doc.setDrawColor(220, 220, 220)
            doc.setLineWidth(0.2)
            doc.rect(photoX, currentY, photoWidth, photoHeight)
          }
        }

        // Action/After Photos
        if (concern.actionTaken && concern.actionTaken.photos.length > 0) {
          const actionPhotoY = currentY + photoHeight + 5
          doc.setFontSize(8)
          doc.setTextColor(100, 100, 100)
          doc.setFont('helvetica', 'normal')
          doc.text('ACTION PHOTOS', cardX + 8, actionPhotoY)
          
          const actionPhotos = concern.actionTaken.photos.slice(0, 3)
          for (let i = 0; i < actionPhotos.length; i++) {
            const photo = actionPhotos[i]
            const imgData = await loadImageAsBase64(photo.url)
            if (imgData) {
              const photoX = cardX + 8 + (i * (photoWidth + photoSpacing))
              doc.addImage(imgData, 'JPEG', photoX, actionPhotoY + 3, photoWidth, photoHeight)
              doc.setDrawColor(220, 220, 220)
              doc.setLineWidth(0.2)
              doc.rect(photoX, actionPhotoY + 3, photoWidth, photoHeight)
            }
          }

          // Action notes
          if (concern.actionTaken.notes) {
            const notesY = actionPhotoY + photoHeight + 7
            doc.setFontSize(7)
            doc.setTextColor(100, 100, 100)
            doc.setFont('helvetica', 'normal')
            doc.text('ACTION NOTES', cardX + 8, notesY)
            
            doc.setTextColor(50, 50, 50)
            doc.setFontSize(7)
            const notesText = concern.actionTaken.notes.length > 100 
              ? concern.actionTaken.notes.substring(0, 100) + '...' 
              : concern.actionTaken.notes
            const notesLines = doc.splitTextToSize(notesText, cardWidth - 16)
            doc.text(notesLines.slice(0, 2), cardX + 8, notesY + 3)
          }
        }
      }

      // Generate cards (2 per page)
      let pageNumber = 1
      for (let i = 0; i < concerns.length; i++) {
        const isFirstCard = i % 2 === 0
        
        if (i > 0 && isFirstCard) {
          doc.addPage()
          pageNumber++
        }

        const yPosition = isFirstCard ? margin : margin + cardHeight + margin
        await drawCard(concerns[i], yPosition)

        // Add footer on last card of page
        if (i === concerns.length - 1 || i % 2 === 1) {
          doc.setFontSize(7)
          doc.setFont('helvetica', 'normal')
          doc.setTextColor(150, 150, 150)
          
          // Left: Report type
          doc.text(
            reportType === 'action-center' ? 'Action Center Report' : 'PNP Report',
            margin,
            pageHeight - 8
          )
          
          // Center: Page number
          doc.text(
            `Page ${pageNumber}`,
            pageWidth / 2,
            pageHeight - 8,
            { align: 'center' }
          )
          
          // Right: Date
          doc.text(
            format(new Date(), 'MMM dd, yyyy'),
            pageWidth - margin,
            pageHeight - 8,
            { align: 'right' }
          )
        }
      }

      // Save PDF
      const fileName = `${reportType}_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      doc.save(fileName)

      toast.success('PDF with images generated successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // Generate Excel Report with Images
  const generateExcel = async () => {
    if (concerns.length === 0) {
      toast.error('No data to export')
      return
    }

    toast.info('Generating Excel with images...')

    try {
      // Create workbook and worksheet
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Report', {
        pageSetup: { paperSize: 9, orientation: 'landscape' }
      })

      // Set column widths
      worksheet.columns = [
        { header: '#', key: 'index', width: 5 },
        { header: 'Date Reported', key: 'dateReported', width: 15 },
        { header: 'Municipality', key: 'municipality', width: 20 },
        { header: 'Report Title', key: 'reportTitle', width: 35 },
        { header: 'Location', key: 'location', width: 35 },
        { header: 'Case Remarks', key: 'caseRemarks', width: 40 },
        { header: 'Answered By', key: 'answeredBy', width: 20 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Action Date', key: 'actionDate', width: 15 },
        { header: 'Action Notes', key: 'actionNotes', width: 40 },
        { header: 'Concern Photos', key: 'concernPhotos', width: 50 },
        { header: 'Action Photos', key: 'actionPhotos', width: 50 },
      ]

      // Style header row
      worksheet.getRow(1).font = { bold: true, size: 11 }
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      }
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
      worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' }
      worksheet.getRow(1).height = 25

      // Helper function to fetch image as base64
      const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
        try {
          const response = await fetch(url)
          const blob = await response.blob()
          return new Promise((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = reader.result as string
              // Remove data URL prefix
              const base64Data = base64.split(',')[1]
              resolve(base64Data)
            }
            reader.onerror = () => resolve(null)
            reader.readAsDataURL(blob)
          })
        } catch (error) {
          console.error('Error fetching image:', error)
          return null
        }
      }

      // Add data rows with images
      let currentRow = 2
      for (let i = 0; i < concerns.length; i++) {
        const concern = concerns[i]
        
        // Calculate row height based on number of images
        const concernPhotoCount = concern.concernPhotos.length
        const actionPhotoCount = concern.actionTaken?.photos.length || 0
        const maxPhotos = Math.max(concernPhotoCount, actionPhotoCount)
        const rowHeight = maxPhotos > 0 ? Math.max(80, maxPhotos * 80) : 30

        // Add text data
        const row = worksheet.addRow({
          index: i + 1,
          dateReported: format(new Date(concern.dateReported), 'MMM dd, yyyy'),
          municipality: concern.municipality,
          reportTitle: concern.reportTitle,
          location: concern.location,
          caseRemarks: concern.caseRemarks,
          answeredBy: concern.answeredBy,
          status: concern.status.toUpperCase(),
          actionDate: concern.actionDate ? format(new Date(concern.actionDate), 'MMM dd, yyyy') : '-',
          actionNotes: concern.actionTaken?.notes || '-',
          concernPhotos: `${concernPhotoCount} photo(s)`,
          actionPhotos: `${actionPhotoCount} photo(s)`,
        })

        row.height = rowHeight
        row.alignment = { vertical: 'top', wrapText: true }

        // Add concern photos
        if (concernPhotoCount > 0) {
          const concernPhotosToShow = concern.concernPhotos.slice(0, 3) // Max 3 photos
          for (let j = 0; j < concernPhotosToShow.length; j++) {
            const photo = concernPhotosToShow[j]
            const base64 = await fetchImageAsBase64(photo.url)
            
            if (base64) {
              const imageId = workbook.addImage({
                base64: base64,
                extension: 'jpeg',
              })

              worksheet.addImage(imageId, {
                tl: { col: 10, row: currentRow - 1 + (j * 0.33) },
                ext: { width: 70, height: 70 },
              })
            }
          }
        }

        // Add action photos
        if (actionPhotoCount > 0 && concern.actionTaken) {
          const actionPhotosToShow = concern.actionTaken.photos.slice(0, 3) // Max 3 photos
          for (let j = 0; j < actionPhotosToShow.length; j++) {
            const photo = actionPhotosToShow[j]
            const base64 = await fetchImageAsBase64(photo.url)
            
            if (base64) {
              const imageId = workbook.addImage({
                base64: base64,
                extension: 'jpeg',
              })

              worksheet.addImage(imageId, {
                tl: { col: 11, row: currentRow - 1 + (j * 0.33) },
                ext: { width: 70, height: 70 },
              })
            }
          }
        }

        currentRow++
      }

      // Add borders to all cells
      worksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          }
        })
      })

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${reportType}_report_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)

      toast.success('Excel with images generated successfully!')
    } catch (error) {
      console.error('Error generating Excel:', error)
      toast.error('Failed to generate Excel')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-heading font-bold">Reports</h2>
          <p className="text-muted-foreground mt-1">
            Generate and export reports in PDF or Excel format
          </p>
        </div>
      </div>

      {/* Report Configuration */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Card>
          <CardHeader>
            <CardTitle>Report Configuration</CardTitle>
            <CardDescription>
              Select report type and filters to generate your report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reportType">Report Type</Label>
                <Select value={reportType} onValueChange={(value: any) => setReportType(value)}>
                  <SelectTrigger id="reportType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="action-center">Action Center</SelectItem>
                    <SelectItem value="pnp">PNP Reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateRange">Date Range</Label>
                <Select value={dateRange} onValueChange={(value: any) => setDateRange(value)}>
                  <SelectTrigger id="dateRange">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Time</SelectItem>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="month">Last 30 Days</SelectItem>
                    <SelectItem value="year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="statusFilter">Status</Label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger id="statusFilter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                    <p className="text-3xl font-bold mt-2">{concerns.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-3xl font-bold mt-2 text-yellow-600">
                      {concerns.filter(c => c.status === 'pending').length}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-3xl font-bold mt-2 text-green-600">
                      {concerns.filter(c => c.status === 'completed').length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Export Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              <Button
                onClick={generatePDF}
                disabled={isLoading || concerns.length === 0}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                Export as PDF
              </Button>

              <Button
                onClick={generateExcel}
                disabled={isLoading || concerns.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <HugeiconsIcon icon={FileXIcon} className="w-4 h-4 mr-2" />
                Export as Excel
              </Button>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Preview Section */}
      {concerns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Showing {concerns.length} record(s) based on your filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>✓ Data is ready to export</p>
                <p>✓ Click the export buttons above to generate your report</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
