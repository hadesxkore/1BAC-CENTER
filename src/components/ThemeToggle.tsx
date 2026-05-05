import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { Sun03Icon, Moon02Icon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Check for saved theme preference or default to light
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    
    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
          >
            <motion.div
              initial={false}
              animate={{
                scale: theme === 'light' ? 1 : 0,
                opacity: theme === 'light' ? 1 : 0,
                rotate: theme === 'light' ? 0 : 180,
              }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <HugeiconsIcon icon={Sun03Icon} className="h-5 w-5" />
            </motion.div>
            <motion.div
              initial={false}
              animate={{
                scale: theme === 'dark' ? 1 : 0,
                opacity: theme === 'dark' ? 1 : 0,
                rotate: theme === 'dark' ? 0 : -180,
              }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <HugeiconsIcon icon={Moon02Icon} className="h-5 w-5" />
            </motion.div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
