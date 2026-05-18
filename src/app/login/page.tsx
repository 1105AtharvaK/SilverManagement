"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import toast from "react-hot-toast"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [fullName, setFullName] = useState("")
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()

  const validateEmail = (email: string) => {
    const allowedDomains = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com"];
    const domain = email.split("@")[1]?.toLowerCase();
    
    const basicRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!basicRegex.test(email)) return "Invalid email format";
    
    if (isSignUp && !allowedDomains.includes(domain)) {
      return "Please use a verified email provider (Gmail, Yahoo, Outlook, etc.)";
    }
    return null;
  };

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(pass)) return "Password must contain at least one uppercase letter";
    if (!/[0-9]/.test(pass)) return "Password must contain at least one number";
    if (!/[!@#$%^&*]/.test(pass)) return "Password must contain at least one special character (!@#$%^&*)";
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const emailError = validateEmail(email);
    if (emailError) {
      toast.error(emailError);
      return;
    }

    if (isSignUp) {
      const passError = validatePassword(password);
      if (passError) {
        toast.error(passError);
        return;
      }
    }

    setLoading(true)
    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName
            }
          }
        })
        if (error) throw error
        toast.success("Signed up successfully! Please check your email for verification.")
        setIsSignUp(false)
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        toast.success("Logged in successfully!")
        router.push("/dashboard")
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-primary to-green-300">
            SilverTrack
          </CardTitle>
          <CardDescription>
            {isSignUp ? "Create a new account" : "Enter your credentials to access your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full h-11 orange-gradient border-0 font-bold shadow-lg shadow-orange-500/10" disabled={loading}>
              {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Create one"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
