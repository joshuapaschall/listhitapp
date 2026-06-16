"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { supabaseBrowser } from "@/lib/supabase-browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export default function SignupPage() {
  const supabase = useMemo(() => supabaseBrowser(), [])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [agreeToTerms, setAgreeToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [userExists, setUserExists] = useState(false)
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendMessage, setResendMessage] = useState<string | null>(null)
  const [resendError, setResendError] = useState<string | null>(null)
  const [isResending, setIsResending] = useState(false)

  const validate = () => {
    if (!isValidEmail(email)) {
      return "Please enter a valid email address."
    }
    if (password.length < 8) {
      return "Password must be at least 8 characters."
    }
    if (password !== confirmPassword) {
      return "Passwords do not match."
    }
    if (!agreeToTerms) {
      return "You must agree to the Terms of Service and Privacy Policy."
    }
    return null
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setUserExists(false)
    setSuccessMessage("")
    setResendMessage(null)
    setResendError(null)

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsSubmitting(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${
          process.env.NEXT_PUBLIC_SITE_URL || "https://app.listhit.io"
        }/auth/callback`,
      },
    })

    if (signUpError) {
      const message = signUpError.message
      const alreadyRegistered = message
        .toLowerCase()
        .includes("user already registered")
      setUserExists(alreadyRegistered)
      setError(
        alreadyRegistered
          ? "That email is already registered. You can sign in instead."
          : message
      )
      setIsSubmitting(false)
      return
    }

    setSuccessMessage("Check your email to confirm your account.")
    setIsSubmitting(false)
  }

  const handleResendConfirmation = async () => {
    setResendMessage(null)
    setResendError(null)
    setError(null)
    setIsResending(true)

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: "https://app.listhit.io/auth/callback" },
    })

    if (resendError) {
      setResendMessage(resendError.message)
      setResendError(resendError.message)
      setIsResending(false)
      return
    }

    setResendMessage("Confirmation email resent. Please check your inbox.")
    setIsResending(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md space-y-6">
        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-semibold">Create account</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter your details to get started
            </p>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex items-center space-x-2 text-left">
                <Checkbox
                  id="terms"
                  checked={agreeToTerms}
                  onCheckedChange={(checked) => setAgreeToTerms(!!checked)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="terms" className="text-sm font-normal">
                  I agree to the{" "}
                  <Link
                    href="https://listhit.io/terms"
                    className="text-primary underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    href="https://listhit.io/privacy"
                    className="text-primary underline underline-offset-4"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Privacy Policy
                  </Link>
                  .
                </Label>
              </div>
              {error ? (
                <div className="space-y-1 text-left text-sm text-destructive">
                  <p>{error}</p>
                  {userExists ? (
                    <p>
                      Already have an account?{" "}
                      <Link
                        href="/login"
                        className="text-primary underline underline-offset-4"
                      >
                        Sign in
                      </Link>
                      .
                    </p>
                  ) : null}
                </div>
              ) : null}
              {successMessage ? (
                <div className="space-y-2">
                  <p className="text-sm text-green-600">{successMessage}</p>
                  <Button
                    variant="link"
                    type="button"
                    className="h-auto p-0 text-sm"
                    onClick={handleResendConfirmation}
                    disabled={!email || isResending}
                  >
                    {isResending ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Resending...
                      </span>
                    ) : (
                      "Didn't get the email? Resend confirmation"
                    )}
                  </Button>
                  {resendMessage ? (
                    <p
                      className={`text-sm ${resendError ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {resendMessage}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="justify-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/login"
              className="ml-1 font-medium text-primary underline underline-offset-4"
            >
              Sign in
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
