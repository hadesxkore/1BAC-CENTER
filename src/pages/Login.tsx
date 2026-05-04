import { useState } from 'react'
import { motion } from 'framer-motion'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

// Floating glass panel data
const glassPanels = [
  { width: 260, height: 160, top: '8%',  left: '6%',  rotate: -8,  delay: 0,    duration: 18 },
  { width: 180, height: 220, top: '18%', left: '55%', rotate: 12,  delay: 2,    duration: 22 },
  { width: 320, height: 120, top: '55%', left: '10%', rotate: 5,   delay: 1.5,  duration: 20 },
  { width: 140, height: 140, top: '72%', left: '60%', rotate: -14, delay: 3,    duration: 16 },
  { width: 200, height: 100, top: '38%', left: '38%', rotate: 8,   delay: 0.8,  duration: 24 },
  { width: 100, height: 180, top: '5%',  left: '70%', rotate: -5,  delay: 4,    duration: 19 },
  { width: 240, height: 90,  top: '85%', left: '28%', rotate: 3,   delay: 2.5,  duration: 21 },
]

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser, setIsLoading: setGlobalLoading } = useAppStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    setGlobalLoading(true)

    try {
      const usernameDoc = await getDoc(doc(db, 'usernames', username))
      if (!usernameDoc.exists()) throw new Error('Invalid username or password')

      const { email, uid } = usernameDoc.data()
      await signInWithEmailAndPassword(auth, email, password)

      const userDoc = await getDoc(doc(db, 'users', uid))
      if (!userDoc.exists()) throw new Error('User data not found')

      const userData = userDoc.data()
      setUser({
        id: uid,
        email: userData.email,
        name: userData.displayName || userData.username,
        username: userData.username,
        role: userData.role,
      })
    } catch (err: any) {
      console.error('Login error:', err)
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Invalid username or password')
      } else if (err.code === 'auth/too-many-requests') {
        setError('Too many failed attempts. Please try again later.')
      } else {
        setError(err.message || 'Failed to login')
      }
    } finally {
      setIsLoading(false)
      setGlobalLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT PANEL ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        className="hidden lg:flex lg:w-[60%] relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #e8f0fe 0%, #f0f4ff 50%, #eaf3fb 100%)' }}
      >
        {/* Subtle noise grain overlay */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
            backgroundSize: '200px 200px',
          }}
        />

        {/* Soft glow orbs */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 600, height: 600,
            top: '-10%', left: '-15%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(99,130,255,0.12) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            width: 500, height: 500,
            bottom: '-5%', right: '-10%',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(56,189,248,0.1) 0%, transparent 70%)',
          }}
        />

        {/* ── Floating glass panels ── */}
        {glassPanels.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{
              opacity: 1,
              y: [0, -18, 0],
              rotate: [p.rotate, p.rotate + 3, p.rotate],
            }}
            transition={{
              opacity: { delay: p.delay, duration: 1.2 },
              y: { delay: p.delay, duration: p.duration, repeat: Infinity, ease: 'easeInOut' },
              rotate: { delay: p.delay, duration: p.duration * 1.3, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              position: 'absolute',
              top: p.top,
              left: p.left,
              width: p.width,
              height: p.height,
              borderRadius: 16,
              background: 'rgba(255,255,255,0.45)',
              border: '1px solid rgba(255,255,255,0.75)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              boxShadow: '0 8px 32px rgba(99,130,255,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
          />
        ))}

        {/* ── Center content ── */}
        <div className="relative z-10 flex flex-col justify-center w-full px-16">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8 max-w-sm"
          >
            {/* Logo — still, no bounce */}
            <div className="flex items-center gap-4">
              <div
                style={{
                  width: 64, height: 64,
                  borderRadius: 16,
                  background: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.9)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 20px rgba(99,130,255,0.12)',
                }}
              >
                <img
                  src="/images/bataanlogo.png"
                  alt="Bataan Logo"
                  style={{ width: 44, height: 44, objectFit: 'contain' }}
                />
              </div>
              <span style={{ fontSize: 11, letterSpacing: '0.18em', color: 'rgba(30,40,80,0.45)', fontWeight: 600, textTransform: 'uppercase' }}>
                Bataan Province
              </span>
            </div>

            {/* Headline */}
            <div className="space-y-3">
              <h1
                style={{
                  fontSize: 44,
                  fontWeight: 700,
                  lineHeight: 1.05,
                  color: '#1a2340',
                  letterSpacing: '-0.02em',
                }}
              >
                1 Bataan<br />Action Center
              </h1>
              <p style={{ fontSize: 15, color: 'rgba(30,40,80,0.5)', fontWeight: 400, lineHeight: 1.6 }}>
                Monitoring System — Real-time response<br />and incident tracking platform.
              </p>
            </div>

            {/* Thin divider */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.9, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              style={{
                height: 1,
                width: 64,
                background: 'rgba(30,40,80,0.15)',
                transformOrigin: 'left',
              }}
            />

            {/* Stat pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.1, duration: 0.8 }}
              className="flex gap-3 flex-wrap"
            >
              {['Active Monitoring', 'Secure Access', 'Real-time Data'].map((label) => (
                <span
                  key={label}
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    color: 'rgba(30,40,80,0.5)',
                    background: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.8)',
                    borderRadius: 999,
                    padding: '5px 14px',
                  }}
                >
                  {label}
                </span>
              ))}
            </motion.div>
          </motion.div>
        </div>

        {/* Bottom fade */}
        <div
          className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(232,240,254,0.6), transparent)' }}
        />
      </motion.div>

      {/* ── RIGHT PANEL — login form (unchanged logic, light cosmetic tweak) ── */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="w-full lg:w-[40%] flex items-center justify-center p-8 bg-background"
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="lg:hidden flex flex-col items-center mb-8 space-y-4"
          >
            <img
              src="/images/bataanlogo.png"
              alt="Bataan Logo"
              className="w-24 h-24 object-contain"
            />
            <div className="text-center">
              <h2 className="text-2xl font-heading font-bold">1 Bataan Action Center</h2>
              <p className="text-sm text-muted-foreground">Monitoring System</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-heading">Welcome back</CardTitle>
                <CardDescription>
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <a
                        href="#"
                        className="text-sm text-primary hover:underline"
                        onClick={(e) => e.preventDefault()}
                      >
                        Forgot password?
                      </a>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="current-password"
                    />
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg"
                    >
                      {error}
                    </motion.div>
                  )}

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Signing in…' : 'Sign in'}
                  </Button>
                </form>

                <div className="mt-6 text-center text-sm text-muted-foreground">
                  Don't have an account?{' '}
                  <a href="#" className="text-primary hover:underline font-medium">
                    Contact administrator
                  </a>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-center text-xs text-muted-foreground mt-8"
          >
            © 2026 1 Bataan Action Center. All rights reserved.
          </motion.p>
        </div>
      </motion.div>
    </div>
  )
}