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
