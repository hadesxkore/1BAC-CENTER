export const BATAAN_MUNICIPALITIES = [
  'Abucay',
  'Bagac',
  'Balanga City',
  'Dinalupihan',
  'Hermosa',
  'Limay',
  'Mariveles',
  'Morong',
  'Orani',
  'Orion',
  'Pilar',
  'Samal',
] as const

export type Municipality = typeof BATAAN_MUNICIPALITIES[number]

// Bataan Districts
export const BATAAN_DISTRICTS = {
  'First District': ['Abucay', 'Orani', 'Samal', 'Hermosa'],
  'Second District': ['Balanga City', 'Pilar', 'Orion', 'Limay'],
  'Third District': ['Bagac', 'Dinalupihan', 'Mariveles', 'Morong'],
} as const

export type District = keyof typeof BATAAN_DISTRICTS

// Helper function to get district from municipality
export const getDistrictFromMunicipality = (municipality: string): District | null => {
  for (const [district, municipalities] of Object.entries(BATAAN_DISTRICTS)) {
    if ((municipalities as readonly string[]).includes(municipality)) {
      return district as District
    }
  }
  return null
}

export const ENVIRONMENTAL_DEPARTMENTS = [
  'PGENRO',
  'MENRO',
  'PENRO',
  'CENRO',
] as const

export type EnvironmentalDepartment = typeof ENVIRONMENTAL_DEPARTMENTS[number]

export const ROLES = {
  STAFF: 'staff',
  ENVIRONMENTAL: 'environmental',
  AGRICULTURAL: 'agricultural',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]
