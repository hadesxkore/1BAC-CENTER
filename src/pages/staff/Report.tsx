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
import { toast } from '@/components/ui/sonner'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns'
import type { Action } from '@/data/sampleActions'
import { getDistrictFromMunicipality } from '@/data/municipalities'
import ExportSummaryDialog from '@/components/ExportSummaryDialog'
import Export1BACTypeDialog from '@/components/Export1BACTypeDialog'
import { generateCategorySummaryPDF } from '@/utils/generateCategorySummaryPDF'
import { generate1BACSummaryPDF } from '@/utils/generate1BACSummaryPDF'
import { generate1BACOverallSummaryPDF } from '@/utils/generate1BACOverallSummaryPDF'
import { generatePNPSummaryPDF } from '@/utils/generatePNPSummaryPDF'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import type { DateRange } from 'react-day-picker'

export default function Report() {
  const [isLoading, setIsLoading] = useState(false)
  const [concerns, setConcerns] = useState<Action[]>([])
  const [oneBACConcerns, setOneBACConcerns] = useState<Action[]>([])
  const [reportType, setReportType] = useState<'action-center' | 'pnp' | '1bac'>('action-center')
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month' | 'year' | 'custom'>('all')
  const [customDateRange, setCustomDateRange] = useState<DateRange | undefined>()
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [showSummaryDialog, setShowSummaryDialog] = useState(false)
  const [show1BACTypeDialog, setShow1BACTypeDialog] = useState(false)
  const [show1BACSummaryLoading, setShow1BACSummaryLoading] = useState(false)
  const [showPNPSummaryLoading, setShowPNPSummaryLoading] = useState(false)

  // Fetch data based on filters
  const fetchData = async () => {
    setIsLoading(true)
    try {
      const collectionName = reportType === 'action-center' ? 'concerns' : reportType === 'pnp' ? 'pnp_reports' : '1bac_concerns'
      
      // For date filtering, we need to fetch all data first since dateReported is a string, not a Timestamp
      let q = query(collection(db, collectionName), orderBy('createdAt', 'desc'))

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

      // Apply date range filter based on dateReported
      let filteredByDate = data
      if (dateRange === 'custom' && customDateRange?.from) {
        const startDate = startOfDay(customDateRange.from)
        const endDate = customDateRange.to ? endOfDay(customDateRange.to) : endOfDay(customDateRange.from)

        filteredByDate = data.filter(item => {
          const reportDate = new Date(item.dateReported)
          return isWithinInterval(reportDate, { start: startDate, end: endDate })
        })
      } else if (dateRange !== 'all') {
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

        filteredByDate = data.filter(item => {
          const reportDate = new Date(item.dateReported)
          return reportDate >= startDate
        })
      }

      // Apply status filter
      const filteredData = statusFilter === 'all'
        ? filteredByDate
        : filteredByDate.filter(item => item.status === statusFilter)

      if (reportType === '1bac') {
        setOneBACConcerns(filteredData)
      } else {
        setConcerns(filteredData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      toast.error('Failed to fetch data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [reportType, dateRange, statusFilter, customDateRange])

  // Generate PDF Report with Table Style organized by District
  const generatePDF = async () => {
    if (concerns.length === 0) {
      toast.error('No data to export')
      return
    }

    toast.info('Generating PDF report...')

    try {
      const doc = new jsPDF('l', 'mm', 'a4') // Landscape orientation for table
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()

      // Group concerns by district
      const concernsByDistrict: Record<string, Action[]> = {
        'First District': [],
        'Second District': [],
        'Third District': [],
        'Unknown': [],
      }

      concerns.forEach(concern => {
        const district = getDistrictFromMunicipality(concern.municipality)
        if (district) {
          concernsByDistrict[district].push(concern)
        } else {
          concernsByDistrict['Unknown'].push(concern)
        }
      })

      // Sort concerns within each district by municipality
      Object.keys(concernsByDistrict).forEach(district => {
        concernsByDistrict[district].sort((a, b) => 
          a.municipality.localeCompare(b.municipality)
        )
      })

      let isFirstPage = true

      // Generate table for each district
      Object.entries(concernsByDistrict).forEach(([district, districtConcerns]) => {
        if (districtConcerns.length === 0) return

        // Add new page for each district (except first)
        if (!isFirstPage) {
          doc.addPage()
        }
        isFirstPage = false

        // Header
        doc.setFontSize(18)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 64, 175) // Blue
        doc.text(
          reportType === 'action-center' ? 'ACTION CENTER REPORT' : 'PNP REPORT',
          pageWidth / 2,
          15,
          { align: 'center' }
        )

        // District Title
        doc.setFontSize(14)
        doc.setTextColor(0, 0, 0)
        doc.text(district, pageWidth / 2, 23, { align: 'center' })

        // Date and summary
        doc.setFontSize(9)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 100, 100)
        doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy HH:mm')}`, 14, 30)
        doc.text(
          `Total: ${districtConcerns.length} | Pending: ${districtConcerns.filter(c => c.status === 'pending').length} | Completed: ${districtConcerns.filter(c => c.status === 'completed').length}`,
          pageWidth - 14,
          30,
          { align: 'right' }
        )

        // Prepare table data
        const tableData = districtConcerns.map((concern, index) => [
          index + 1,
          format(new Date(concern.dateReported), 'MMM dd, yyyy'),
          concern.municipality,
          concern.reportTitle.length > 40 ? concern.reportTitle.substring(0, 40) + '...' : concern.reportTitle,
          concern.location.length > 35 ? concern.location.substring(0, 35) + '...' : concern.location,
          concern.answeredBy,
          concern.actionTaken?.notes 
            ? (concern.actionTaken.notes.length > 30 ? concern.actionTaken.notes.substring(0, 30) + '...' : concern.actionTaken.notes)
            : '-',
          concern.actionTaken?.otherInfo
            ? (concern.actionTaken.otherInfo.length > 30 ? concern.actionTaken.otherInfo.substring(0, 30) + '...' : concern.actionTaken.otherInfo)
            : '-',
          concern.actionDate 
            ? (concern.actionDate === 'Ongoing' ? 'Ongoing' : format(new Date(concern.actionDate), 'MMM dd, yyyy'))
            : '-',
          concern.status.toUpperCase(),
        ])

        // Generate table
        autoTable(doc, {
          startY: 35,
          head: [[
            '#',
            'Date Reported',
            'Municipality',
            'Report Title',
            'Location',
            'Reported By',
            'Action Notes',
            'Other Info',
            'Action Date',
            'Status'
          ]],
          body: tableData,
          theme: 'grid',
          headStyles: {
            fillColor: [30, 64, 175], // Blue
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: 'bold',
            halign: 'center',
            valign: 'middle',
            cellPadding: 3,
          },
          bodyStyles: {
            fontSize: 7,
            cellPadding: 2,
            valign: 'top',
          },
          columnStyles: {
            0: { cellWidth: 8, halign: 'center' }, // #
            1: { cellWidth: 22 }, // Date Reported
            2: { cellWidth: 22 }, // Municipality
            3: { cellWidth: 45 }, // Report Title
            4: { cellWidth: 40 }, // Location
            5: { cellWidth: 22 }, // Reported By
            6: { cellWidth: 35 }, // Action Notes
            7: { cellWidth: 35 }, // Other Info
            8: { cellWidth: 22 }, // Action Date
            9: { cellWidth: 18, halign: 'center' }, // Status
          },
          didParseCell: (data) => {
            // Color code status column
            if (data.column.index === 9 && data.section === 'body') {
              const status = data.cell.raw as string
              if (status === 'COMPLETED') {
                data.cell.styles.fillColor = [220, 252, 231] // Light green
                data.cell.styles.textColor = [22, 163, 74] // Dark green
                data.cell.styles.fontStyle = 'bold'
              } else if (status === 'PENDING') {
                data.cell.styles.fillColor = [254, 249, 195] // Light yellow
                data.cell.styles.textColor = [161, 98, 7] // Dark yellow
                data.cell.styles.fontStyle = 'bold'
              } else if (status === 'IN-PROGRESS') {
                data.cell.styles.fillColor = [219, 234, 254] // Light blue
                data.cell.styles.textColor = [29, 78, 216] // Dark blue
                data.cell.styles.fontStyle = 'bold'
              }
            }
          },
          margin: { top: 35, left: 14, right: 14, bottom: 20 },
          didDrawPage: (data) => {
            // Footer
            const pageCount = (doc as any).internal.getNumberOfPages()
            const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber

            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            doc.setTextColor(150, 150, 150)

            // Left: District
            doc.text(district, 14, pageHeight - 10)

            // Center: Page number
            doc.text(
              `Page ${currentPage} of ${pageCount}`,
              pageWidth / 2,
              pageHeight - 10,
              { align: 'center' }
            )

            // Right: Report type
            doc.text(
              reportType === 'action-center' ? 'Action Center' : 'PNP Report',
              pageWidth - 14,
              pageHeight - 10,
              { align: 'right' }
            )
          },
        })
      })

      // Save PDF
      // Generate filename with date range
      let dateRangeText = ''
      if (dateRange === 'custom' && customDateRange?.from) {
        const startMonth = format(customDateRange.from, 'MMM-yyyy')
        const endMonth = customDateRange.to ? format(customDateRange.to, 'MMM-yyyy') : startMonth
        dateRangeText = startMonth === endMonth ? `_${startMonth}` : `_${startMonth}_to_${endMonth}`
      } else if (dateRange !== 'all') {
        dateRangeText = `_${dateRange}`
      } else {
        dateRangeText = '_all-time'
      }
      
      const fileName = `${reportType}_report_by_district${dateRangeText}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      doc.save(fileName)

      toast.success('PDF report generated successfully!')
    } catch (error) {
      console.error('Error generating PDF:', error)
      toast.error('Failed to generate PDF')
    }
  }

  // Generate Summary PDF Report - REMOVED (will be replaced with separate Agricultural and Environmental reports)
  const handleExportSummary = async (category: 'agricultural' | 'environmental') => {
    if (concerns.length === 0) {
      toast.error('No data to export')
      return
    }

    const categoryConcerns = concerns.filter(c => c.category === category)
    if (categoryConcerns.length === 0) {
      toast.error(`No ${category} concerns found`)
      return
    }

    toast.info('Generating summary report...')

    try {
      const doc = await generateCategorySummaryPDF(concerns, category, reportType as 'action-center' | 'pnp', dateRange)
      
      // Generate filename with date range
      let dateRangeText = ''
      if (dateRange === 'custom' && customDateRange?.from) {
        const startMonth = format(customDateRange.from, 'MMM-yyyy')
        const endMonth = customDateRange.to ? format(customDateRange.to, 'MMM-yyyy') : startMonth
        dateRangeText = startMonth === endMonth ? `_${startMonth}` : `_${startMonth}_to_${endMonth}`
      } else if (dateRange !== 'all') {
        dateRangeText = `_${dateRange}`
      } else {
        dateRangeText = '_all-time'
      }
      
      const fileName = `${reportType}_${category}_summary${dateRangeText}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      doc.save(fileName)
      toast.success('Summary report generated successfully!')
    } catch (error) {
      console.error('Error generating summary:', error)
      toast.error('Failed to generate summary')
    }
  }

  // Export 1BAC Summary PDF - Show dialog to choose type
  const export1BACSummaryPDF = async () => {
    if (oneBACConcerns.length === 0) {
      toast.error('No 1BAC data to export')
      return
    }

    // Show dialog to choose between overall or per-district
    setShow1BACTypeDialog(true)
  }

  // Handle 1BAC export type selection
  const handle1BACExport = async (type: 'overall' | 'per-district') => {
    setShow1BACSummaryLoading(true)
    toast.info(`Generating 1BAC ${type === 'overall' ? 'overall' : 'per-district'} summary report...`)

    try {
      let doc
      if (type === 'overall') {
        doc = await generate1BACOverallSummaryPDF(oneBACConcerns, dateRange)
      } else {
        doc = await generate1BACSummaryPDF(oneBACConcerns, dateRange)
      }
      
      // Generate filename with date range
      let dateRangeText = ''
      if (dateRange === 'custom' && customDateRange?.from) {
        const startMonth = format(customDateRange.from, 'MMM-yyyy')
        const endMonth = customDateRange.to ? format(customDateRange.to, 'MMM-yyyy') : startMonth
        dateRangeText = startMonth === endMonth ? `_${startMonth}` : `_${startMonth}_to_${endMonth}`
      } else if (dateRange !== 'all') {
        dateRangeText = `_${dateRange}`
      } else {
        dateRangeText = '_all-time'
      }
      
      const typeText = type === 'overall' ? '_overall' : '_per-district'
      const fileName = `1bac_summary${typeText}${dateRangeText}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      doc.save(fileName)
      toast.success('1BAC summary report generated successfully!')
    } catch (error) {
      console.error('Error generating 1BAC summary:', error)
      toast.error('Failed to generate 1BAC summary')
    } finally {
      setShow1BACSummaryLoading(false)
    }
  }

  // Export PNP Summary PDF
  const exportPNPSummaryPDF = async () => {
    if (concerns.length === 0) {
      toast.error('No PNP data to export')
      return
    }

    setShowPNPSummaryLoading(true)
    toast.info('Generating PNP summary report...')

    try {
      const doc = await generatePNPSummaryPDF(concerns, dateRange)
      
      // Generate filename with date range
      let dateRangeText = ''
      if (dateRange === 'custom' && customDateRange?.from) {
        const startMonth = format(customDateRange.from, 'MMM-yyyy')
        const endMonth = customDateRange.to ? format(customDateRange.to, 'MMM-yyyy') : startMonth
        dateRangeText = startMonth === endMonth ? `_${startMonth}` : `_${startMonth}_to_${endMonth}`
      } else if (dateRange !== 'all') {
        dateRangeText = `_${dateRange}`
      } else {
        dateRangeText = '_all-time'
      }
      
      const fileName = `pnp_summary${dateRangeText}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`
      doc.save(fileName)
      toast.success('PNP summary report generated successfully!')
    } catch (error) {
      console.error('Error generating PNP summary:', error)
      toast.error('Failed to generate PNP summary')
    } finally {
      setShowPNPSummaryLoading(false)
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
      
      // Generate filename with date range
      let dateRangeText = ''
      if (dateRange === 'custom' && customDateRange?.from) {
        const startMonth = format(customDateRange.from, 'MMM-yyyy')
        const endMonth = customDateRange.to ? format(customDateRange.to, 'MMM-yyyy') : startMonth
        dateRangeText = startMonth === endMonth ? `_${startMonth}` : `_${startMonth}_to_${endMonth}`
      } else if (dateRange !== 'all') {
        dateRangeText = `_${dateRange}`
      } else {
        dateRangeText = '_all-time'
      }
      
      link.download = `${reportType}_report${dateRangeText}_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)

      toast.success('Excel with images generated successfully!')
    } catch (error) {
      console.error('Error generating Excel:', error)
      toast.error('Failed to generate Excel')
    }
  }

  return (
    <>
      <ExportSummaryDialog
        open={showSummaryDialog}
        onOpenChange={setShowSummaryDialog}
        onExport={handleExportSummary}
        isLoading={isLoading}
      />

      <Export1BACTypeDialog
        open={show1BACTypeDialog}
        onOpenChange={setShow1BACTypeDialog}
        onExport={handle1BACExport}
        isLoading={show1BACSummaryLoading}
      />

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
                    <SelectItem value="1bac">1BAC Concerns</SelectItem>
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
                    <SelectItem value="custom">Custom Range</SelectItem>
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

            {/* Custom Date Range Picker */}
            {dateRange === 'custom' && (
              <div className="space-y-2">
                <Label>Select Custom Date Range</Label>
                <DateRangePicker
                  dateRange={customDateRange}
                  onDateRangeChange={setCustomDateRange}
                  placeholder="Pick a date range"
                />
              </div>
            )}

            <Separator />

            {/* Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-2">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Total Reports</p>
                    <p className="text-3xl font-bold mt-2">{reportType === '1bac' ? oneBACConcerns.length : concerns.length}</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Pending</p>
                    <p className="text-3xl font-bold mt-2 text-yellow-600">
                      {reportType === '1bac' 
                        ? oneBACConcerns.filter(c => c.status === 'pending').length
                        : concerns.filter(c => c.status === 'pending').length}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-2 border-green-200">
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground">Completed</p>
                    <p className="text-3xl font-bold mt-2 text-green-600">
                      {reportType === '1bac'
                        ? oneBACConcerns.filter(c => c.status === 'completed').length
                        : concerns.filter(c => c.status === 'completed').length}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Export Buttons */}
            {reportType === '1bac' ? (
              // 1BAC has summary export only
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={export1BACSummaryPDF}
                  disabled={show1BACSummaryLoading || oneBACConcerns.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                  Export 1BAC Summary
                </Button>
              </div>
            ) : reportType === 'pnp' ? (
              // PNP has summary + detailed PDF + Excel
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={exportPNPSummaryPDF}
                  disabled={showPNPSummaryLoading || concerns.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                  Export PNP Summary
                </Button>
                
                <Button
                  onClick={generatePDF}
                  disabled={isLoading || concerns.length === 0}
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                >
                  <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                  Export Detailed PDF
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
            ) : (
              // Action Center has category summary + detailed PDF + Excel
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => setShowSummaryDialog(true)}
                  disabled={isLoading || concerns.length === 0}
                  className="flex-1 bg-purple-600 hover:bg-purple-700"
                >
                  <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                  Export Summary
                </Button>
                
                <Button
                  onClick={generatePDF}
                  disabled={isLoading || concerns.length === 0}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  <HugeiconsIcon icon={FileDownloadIcon} className="w-4 h-4 mr-2" />
                  Export Detailed PDF
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
            )}

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
      {(reportType === '1bac' ? oneBACConcerns.length > 0 : concerns.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardHeader>
              <CardTitle>Data Preview</CardTitle>
              <CardDescription>
                Showing {reportType === '1bac' ? oneBACConcerns.length : concerns.length} record(s) based on your filters
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
    </>
  )
}
