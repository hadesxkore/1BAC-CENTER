import { useState } from 'react'
import { motion } from 'framer-motion'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { doc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/config/firebase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { HugeiconsIcon } from '@hugeicons/react'
import { UserAdd01Icon } from '@hugeicons/core-free-icons'
import { BATAAN_MUNICIPALITIES, ENVIRONMENTAL_DEPARTMENTS, ROLES, type Role } from '@/data/municipalities'
import { toast } from 'sonner'

export default function Users() {
  // Personal Information
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [contactNumber, setContactNumber] = useState('63')
  const [role, setRole] = useState<Role | ''>('')
  const [municipality, setMunicipality] = useState('')
  const [department, setDepartment] = useState('')

  // Account Information
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI States
  const [isLoading, setIsLoading] = useState(false)

  // Auto-set department based on role and municipality
  const handleRoleChange = (value: Role) => {
    setRole(value)
    setMunicipality('')
    setDepartment('')
    
    if (value === ROLES.STAFF) {
      setDepartment('Administration')
    }
  }

  const handleMunicipalityChange = (value: string) => {
    setMunicipality(value)
    
    if (role === ROLES.AGRICULTURAL) {
      // Format: AGRI-BALANGA CITY -> AGRI-BALANGA
      const municipalityName = value.replace(' City', '').toUpperCase()
      setDepartment(`AGRI-${municipalityName}`)
    } else {
      setDepartment('')
    }
  }

  const handleContactNumberChange = (value: string) => {
    // Only allow numbers and ensure it starts with 63
    const cleaned = value.replace(/\D/g, '')
    if (cleaned.startsWith('63')) {
      setContactNumber(cleaned)
    } else if (cleaned === '') {
      setContactNumber('63')
    }
  }

  const validateForm = () => {
    if (!fullName.trim()) return 'Full name is required'
    if (!email.trim()) return 'Email is required'
    if (!contactNumber || contactNumber.length < 12) return 'Valid contact number is required (63 + 10 digits)'
    if (!contactNumber.substring(2).startsWith('9')) return 'Contact number must start with 9 after 63'
    if (!role) return 'Role is required'
    if (role !== ROLES.STAFF && !municipality) return 'Municipality is required'
    if (role === ROLES.ENVIRONMENTAL && !department) return 'Department is required'
    if (!username.trim()) return 'Username is required'
    if (!password) return 'Password is required'
    if (password.length < 8) return 'Password must be at least 8 characters'
    if (password !== confirmPassword) return 'Passwords do not match'
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationError = validateForm()
    if (validationError) {
      toast.error('Validation Error', {
        description: validationError,
      })
      return
    }

    setIsLoading(true)

    try {
      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)
      const user = userCredential.user

      // Update display name
      await updateProfile(user, {
        displayName: fullName
      })

      // Create user document in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        fullName,
        email,
        contactNumber,
        role,
        municipality: role === ROLES.STAFF ? null : municipality,
        department,
        username,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isActive: true,
        displayName: fullName,
      })

      // Create username mapping
      await setDoc(doc(db, 'usernames', username), {
        uid: user.uid,
        email: email,
      })

      toast.success('User Created Successfully!', {
        description: `Account created for ${fullName} with username: ${username}`,
      })
      
      // Reset form
      setFullName('')
      setEmail('')
      setContactNumber('63')
      setRole('')
      setMunicipality('')
      setDepartment('')
      setUsername('')
      setPassword('')
      setConfirmPassword('')

    } catch (err: any) {
      console.error('Error creating user:', err)
      let errorMessage = 'Failed to create user account'
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email is already in use'
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak'
      } else if (err.message) {
        errorMessage = err.message
      }

      toast.error('Error Creating User', {
        description: errorMessage,
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-heading font-bold">Users Management</h2>
        <p className="text-muted-foreground mt-1">
          Create and manage user accounts for the monitoring system
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={UserAdd01Icon} className="w-5 h-5" strokeWidth={2} />
              <CardTitle>Create New User</CardTitle>
            </div>
            <CardDescription>
              Fill in the information below to create a new user account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-4">Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Juan Dela Cruz"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="juan@bataan.gov.ph"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="contactNumber">Contact Number *</Label>
                      <Input
                        id="contactNumber"
                        type="tel"
                        placeholder="639123456789"
                        value={contactNumber}
                        onChange={(e) => handleContactNumberChange(e.target.value)}
                        disabled={isLoading}
                        maxLength={12}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: 63 + 10 digits (must start with 9)
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="role">Role *</Label>
                      <Select value={role} onValueChange={handleRoleChange} disabled={isLoading}>
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ROLES.STAFF}>Staff</SelectItem>
                          <SelectItem value={ROLES.ENVIRONMENTAL}>Environmental</SelectItem>
                          <SelectItem value={ROLES.AGRICULTURAL}>Agricultural</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {role && role !== ROLES.STAFF && (
                      <div className="space-y-2">
                        <Label htmlFor="municipality">Municipality *</Label>
                        <Select value={municipality} onValueChange={handleMunicipalityChange} disabled={isLoading}>
                          <SelectTrigger id="municipality">
                            <SelectValue placeholder="Select municipality" />
                          </SelectTrigger>
                          <SelectContent>
                            {BATAAN_MUNICIPALITIES.map((muni) => (
                              <SelectItem key={muni} value={muni}>
                                {muni}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {role === ROLES.ENVIRONMENTAL && municipality && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Department *</Label>
                        <Select value={department} onValueChange={setDepartment} disabled={isLoading}>
                          <SelectTrigger id="department">
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {ENVIRONMENTAL_DEPARTMENTS.map((dept) => (
                              <SelectItem key={dept} value={dept}>
                                {dept}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {role === ROLES.STAFF && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          type="text"
                          value="Administration"
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    )}

                    {role === ROLES.AGRICULTURAL && municipality && (
                      <div className="space-y-2">
                        <Label htmlFor="department">Department</Label>
                        <Input
                          id="department"
                          type="text"
                          value={department}
                          disabled
                          className="bg-muted"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Account Information Section */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-4">Account Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="username">Username *</Label>
                      <Input
                        id="username"
                        type="text"
                        placeholder="juan.delacruz"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))}
                        disabled={isLoading}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">Password *</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="Minimum 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        minLength={8}
                        required
                      />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="confirmPassword">Confirm Password *</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="Re-enter password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={isLoading}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <HugeiconsIcon icon={UserAdd01Icon} className="w-4 h-4 mr-2" strokeWidth={2} />
                      Create User Account
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
