export type ActionStatus = 'pending' | 'in-progress' | 'completed' | 'unlocated' | 'under-action' | 'resolved' | 'closed'
export type ActionCategory = 'environmental' | 'agricultural'

export interface ConcernImage {
  url: string
  publicId: string
  fileType?: 'image' | 'document'
  fileName?: string
  fileSize?: number
}

export interface ActionTaken {
  photos: ConcernImage[]
  notes: string
  otherInfo?: string
  submittedBy: string
  submittedAt: string
}

export interface Action {
  id: string
  trackingNo?: string
  dateReported: string
  dateUploaded: string
  municipality: string
  category: ActionCategory
  assignedTo: string
  reportTitle: string
  caseRemarks: string
  remarks?: string
  location: string
  coordinates?: { lat: number; lng: number }
  concernPhotos: ConcernImage[]
  answeredBy: string
  actionTaken: ActionTaken | null
  actionDate: string | null
  status: ActionStatus
  reportedBy: string
  createdAt: string
}

export const sampleActions: Action[] = [
  {
    id: 'ACT-001',
    dateReported: '2026-05-01',
    dateUploaded: '2026-05-01T08:30:00',
    municipality: 'Bagac',
    category: 'environmental',
    assignedTo: 'Juan Dela Cruz - MENRO',
    reportTitle: 'Illegal Logging in Bagac Forest',
    caseRemarks: 'Report of illegal logging activities in the protected forest area. Multiple trees have been cut down without proper permits.',
    location: 'Brgy. Binuangan, Bagac, Bataan',
    concernPhotos: [
      {
        url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400',
        publicId: 'sample1'
      }
    ],
    answeredBy: 'Staff Admin',
    actionTaken: {
      photos: [
        {
          url: 'https://images.unsplash.com/photo-1473186578172-c141e6798cf4?w=400',
          publicId: 'action1'
        }
      ],
      notes: 'Conducted site inspection and issued cease and desist order',
      submittedBy: 'Juan Dela Cruz',
      submittedAt: '2026-05-03T14:20:00'
    },
    actionDate: '2026-05-03',
    status: 'completed',
    reportedBy: 'Maria Santos',
    createdAt: '2026-05-01T08:30:00',
  },
  {
    id: 'ACT-002',
    dateReported: '2026-05-02',
    dateUploaded: '2026-05-02T10:15:00',
    municipality: 'Balanga City',
    category: 'agricultural',
    assignedTo: 'AGRI-BALANGA',
    reportTitle: 'Crop Disease Outbreak',
    caseRemarks: 'Rice fields affected by bacterial leaf blight disease. Approximately 5 hectares affected.',
    location: 'Brgy. Tuyo, Balanga City, Bataan',
    concernPhotos: [
      {
        url: 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400',
        publicId: 'sample2'
      }
    ],
    answeredBy: 'Staff Admin',
    actionTaken: null,
    actionDate: null,
    status: 'pending',
    reportedBy: 'Farmer Association',
    createdAt: '2026-05-02T10:15:00',
  },
  {
    id: 'ACT-003',
    dateReported: '2026-05-03',
    dateUploaded: '2026-05-03T07:45:00',
    municipality: 'Limay',
    category: 'environmental',
    assignedTo: 'Pedro Garcia - PENRO',
    reportTitle: 'Water Pollution in Limay River',
    caseRemarks: 'Industrial waste detected in the river affecting local water supply. Foul odor reported by residents.',
    location: 'Brgy. Duale, Limay, Bataan',
    concernPhotos: [
      {
        url: 'https://images.unsplash.com/photo-1621451537084-482c73073a0f?w=400',
        publicId: 'sample3'
      }
    ],
    answeredBy: 'Staff Admin',
    actionTaken: null,
    actionDate: null,
    status: 'pending',
    reportedBy: 'Ana Reyes',
    createdAt: '2026-05-03T07:45:00',
  },
]
