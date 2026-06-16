"use client"

import { FormEvent, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { usePermissions } from "@/hooks/use-permissions"

type Organization = {
  id: string
  name: string | null
  business_name: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  country: string | null
  website_url: string | null
  phone: string | null
  owner_id: string | null
}

type OrganizationForm = {
  business_name: string
  address_line1: string
  address_line2: string
  city: string
  state: string
  zip: string
  country: string
  website_url: string
  phone: string
}

const emptyForm: OrganizationForm = {
  business_name: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  zip: "",
  country: "",
  website_url: "",
  phone: "",
}

function formFromOrganization(organization: Organization): OrganizationForm {
  return {
    business_name: organization.business_name ?? "",
    address_line1: organization.address_line1 ?? "",
    address_line2: organization.address_line2 ?? "",
    city: organization.city ?? "",
    state: organization.state ?? "",
    zip: organization.zip ?? "",
    country: organization.country ?? "",
    website_url: organization.website_url ?? "",
    phone: organization.phone ?? "",
  }
}

export default function OrganizationSettingsPage() {
  const { loading: permissionsLoading, can } = usePermissions()
  const hasAccess = can("settings.organization")
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [form, setForm] = useState<OrganizationForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (permissionsLoading || !hasAccess) {
      setLoading(false)
      return
    }

    let active = true

    async function loadOrganization() {
      setLoading(true)
      try {
        const response = await fetch("/api/organization")
        if (!response.ok) throw new Error("Failed to load organization")
        const nextOrganization = (await response.json()) as Organization
        if (!active) return
        setOrganization(nextOrganization)
        setForm(formFromOrganization(nextOrganization))
      } catch (error) {
        console.error("Organization load failed", error)
        if (active) toast.error("Failed to load organization")
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadOrganization()

    return () => {
      active = false
    }
  }, [hasAccess, permissionsLoading])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)

    try {
      const response = await fetch("/api/organization", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) throw new Error("Failed to save organization")

      const updatedOrganization = (await response.json()) as Organization
      setOrganization(updatedOrganization)
      setForm(formFromOrganization(updatedOrganization))
      toast.success("Organization saved")
    } catch (error) {
      console.error("Organization save failed", error)
      toast.error("Failed to save organization")
    } finally {
      setSaving(false)
    }
  }

  if (permissionsLoading) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking access…
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization settings</CardTitle>
            <CardDescription>You don&apos;t have access to organization settings.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Organization</h1>
          <p className="text-sm text-muted-foreground">
            Manage business details used across the app and email footers.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Business details</CardTitle>
            <CardDescription>
              Update your organization name, address, website, and phone number.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading organization…
              </div>
            ) : (
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="business_name">Business name</Label>
                    <Input
                      id="business_name"
                      value={form.business_name}
                      onChange={(event) => setForm((current) => ({ ...current, business_name: event.target.value }))}
                      placeholder={organization?.name ?? "Your business name"}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address_line1">Address line 1</Label>
                    <Input
                      id="address_line1"
                      value={form.address_line1}
                      onChange={(event) => setForm((current) => ({ ...current, address_line1: event.target.value }))}
                      placeholder="Street address"
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address_line2">Address line 2</Label>
                    <Input
                      id="address_line2"
                      value={form.address_line2}
                      onChange={(event) => setForm((current) => ({ ...current, address_line2: event.target.value }))}
                      placeholder="Suite, unit, or floor"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={form.state}
                      onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
                      placeholder="State"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zip">ZIP</Label>
                    <Input
                      id="zip"
                      value={form.zip}
                      onChange={(event) => setForm((current) => ({ ...current, zip: event.target.value }))}
                      placeholder="ZIP code"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
                      placeholder="Country"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="website_url">Website</Label>
                    <Input
                      id="website_url"
                      value={form.website_url}
                      onChange={(event) => setForm((current) => ({ ...current, website_url: event.target.value }))}
                      placeholder="https://example.com"
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
                </div>

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={saving}
                    className=""
                  >
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Save organization
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
