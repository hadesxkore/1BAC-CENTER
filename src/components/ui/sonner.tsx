import { sileo } from "sileo"

// Re-export sileo as toast for compatibility
export const toast = {
  success: (message: string, options?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) => {
    sileo.success({
      title: message,
      description: options?.description,
      duration: options?.duration,
      button: options?.action ? {
        title: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    })
  },
  error: (message: string, options?: { description?: string; duration?: number; action?: { label: string; onClick: () => void } }) => {
    sileo.error({
      title: message,
      description: options?.description,
      duration: options?.duration,
      button: options?.action ? {
        title: options.action.label,
        onClick: options.action.onClick,
      } : undefined,
    })
  },
  info: (message: string, options?: { description?: string; duration?: number }) => {
    sileo.info({
      title: message,
      description: options?.description,
      duration: options?.duration,
    })
  },
  warning: (message: string, options?: { description?: string; duration?: number }) => {
    sileo.warning({
      title: message,
      description: options?.description,
      duration: options?.duration,
    })
  },
}

export { sileo }
