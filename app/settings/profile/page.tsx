"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  display_name: string | null
  phone: string | null
  role: string | null
  org_id: string | null
  sip_username: string | null
}

type ProfileForm = {
  full_name: string
  display_name: string
  phone: string
}

const emptyForm: ProfileForm = {
  full_name: "",
  display_name: "",
  phone: "",
}

function formFromProfile(profile: Profile): ProfileForm {
  return {
    full_name: profile.full_name ?? "",
    display_name: profile.display_name ?? "",
    phone: profile.phone ?? "",
  }
}

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let active = true

    async function loadProfile() {
      setLoading(true)
      try {
        const response = await fetch("/api/me")
        if (!response.ok) throw new Error("Failed to load profile")
        const nextProfile = (await response.json()) as Profile
        if (!active) return
        setProfile(nextProfile)
        setForm(formFromProfile(nextProfile))
      } catch (error) {
        console.error("Profile load failed", error)
        if (active) toast.error("Failed to load profile")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) throw new Error("Failed to save profile")

      const updatedProfile = (await response.json()) as Profile
      setProfile(updatedProfile)
      setForm(formFromProfile(updatedProfile))
      toast.success("Profile saved")
    } catch (error) {
      console.error("Profile save failed", error)
      toast.error("Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your name, display name, and phone number.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal details</CardTitle>
            <CardDescription>
              These details identify you inside ListHit. Email and role are managed by your organization.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading profile…
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input
                      id="full_name"
                      value={form.full_name}
                      onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
                      placeholder="Jane Doe"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display name</Label>
                    <Input
                      id="display_name"
                      value={form.display_name}
                      onChange={(event) => setForm((current) => ({ ...current, display_name: event.target.value }))}
                      placeholder="Jane"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      placeholder="(555) 555-5555"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile?.email ?? ""} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" value={profile?.role ?? "user"} readOnly className="bg-muted capitalize" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className="bg-[#059669] hover:bg-[#047857]"
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save profile
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
