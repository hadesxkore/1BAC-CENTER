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

const themes = ['light', 'dark', 'pink'] as const
type Theme = (typeof themes)[number]

const themeLabels: Record<Theme, string> = {
  light: 'Light',
  dark: 'Dark',
  pink: 'Pink',
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as Theme | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches

    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')
    setTheme(initialTheme)
    applyTheme(initialTheme)
  }, [])

  const applyTheme = (t: Theme) => {
    document.documentElement.classList.remove('dark', 'pink')
    if (t !== 'light') {
      document.documentElement.classList.add(t)
    }
  }

  const cycleTheme = () => {
    const currentIndex = themes.indexOf(theme)
    const nextTheme = themes[(currentIndex + 1) % themes.length]
    setTheme(nextTheme)
    localStorage.setItem('theme', nextTheme)
    applyTheme(nextTheme)
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            className="relative"
          >
            {/* Sun */}
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
            {/* Moon */}
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
            {/* Heart */}
            <motion.div
              initial={false}
              animate={{
                scale: theme === 'pink' ? 1 : 0,
                opacity: theme === 'pink' ? 1 : 0,
                rotate: theme === 'pink' ? 0 : -180,
              }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <HeartIcon className="h-5 w-5 text-pink-500" />
            </motion.div>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Theme: {themeLabels[theme]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}