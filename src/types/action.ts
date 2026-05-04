export type ActionStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled'
export type ActionPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ActionCategory = 'environmental' | 'agricultural' | 'infrastructure' | 'health' | 'safety'

export interface Action {
  id: string
  title: string
  description: string
  category: ActionCategory
  status: ActionStatus
  priority: ActionPriority
  municipality: string
  department: string
  assignedTo: string
  reportedBy: string
  createdAt: string
  updatedAt: string
  dueDate: string
}
