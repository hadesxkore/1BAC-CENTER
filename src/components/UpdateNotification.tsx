import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { RefreshIcon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { registerSW } from 'virtual:pwa-register'

export function UpdateNotification() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null)

  useEffect(() => {
    const sw = registerSW({
      onNeedRefresh() {
        setNeedRefresh(true)
      },
      onOfflineReady() {
        console.log('App ready to work offline')
      },
    })
    setUpdateSW(() => sw)
  }, [])

  const handleUpdate = () => {
    updateSW?.(true)
  }

  const handleDismiss = () => {
    setNeedRefresh(false)
  }

  return (
    <AnimatePresence>
      {needRefresh && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <Card className="shadow-xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-900">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                    <HugeiconsIcon icon={RefreshIcon} className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base">System Updated</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      New version available
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleDismiss}
                  className="shrink-0"
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                A new update is ready! Refresh to get the latest features and improvements.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleUpdate} className="flex-1" size="sm">
                  <HugeiconsIcon icon={RefreshIcon} className="h-4 w-4 mr-2" />
                  Update Now
                </Button>
                <Button onClick={handleDismiss} variant="outline" size="sm">
                  Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
