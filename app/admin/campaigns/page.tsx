"use client"

import { useEffect, useMemo, useState } from "react"
import MainLayout from "@/components/layout/main-layout"
import EmailBuilder, { type EmailBuilderValue } from "@/components/email-builder/email-builder"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import GroupTreeSelector from "@/components/buyers/group-tree-selector"
import LocationFilterSelector from "@/components/buyers/location-filter-selector"
import TagFilterSelector from "@/components/buyers/tag-filter-selector"
import { useBuyerSuggestions } from "@/components/buyers/use-buyer-suggestions"
import type { Group, Tag, Buyer } from "@/lib/supabase"
import { getGroups } from "@/lib/group-service"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface EmailTemplateRow {
  id: string
  name: string
  subject: string
  content: string
  content_format: string
  blocks?: any
  preview_text?: string | null
  created_at?: string
  updated_at?: string
}

interface CampaignDefinition {
  id: string
  name: string
  subject: string
  content: string
  content_format: string
  blocks?: any
  target_groups?: string[] | null
  target_segments?: any
  sendfox_lists?: number[] | null
  scheduled_for?: string | null
  status?: string
  created_at?: string
}

function useUsers() {
  const [value, setValue] = useState<Buyer[]>([])
  const [inputValue, setInputValue] = useState("")
  const [open, setOpen] = useState(false)
  const { results } = useBuyerSuggestions(inputValue, open)
  const add = (buyer: Buyer) => {
    if (!value.find((b) => b.id === buyer.id)) {
      setValue([...value, buyer])
    }
    setOpen(false)
    setInputValue("")
  }
  const remove = (id: string) => setValue(value.filter((b) => b.id !== id))
  return { value, add, remove, inputValue, setInputValue, open, setOpen, results }
}

export default function CampaignAdminPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<EmailTemplateRow[]>([])
  const [campaigns, setCampaigns] = useState<CampaignDefinition[]>([])
  const [queue, setQueue] = useState<any[]>([])
  const [templateName, setTemplateName] = useState("")
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [builderValue, setBuilderValue] = useState<EmailBuilderValue>({
    subject: "",
    html: "",
    blocks: [],
    markdown: "",
    previewText: "",
    format: "blocks",
  })
  const [groups, setGroups] = useState<string[]>([])
  const [groupLabels, setGroupLabels] = useState<Record<string, string>>({})
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [locations, setLocations] = useState<string[]>([])
  const [sendfoxLists, setSendfoxLists] = useState<string>("")
  const [campaignName, setCampaignName] = useState("")
  const [scheduledFor, setScheduledFor] = useState("")
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [savingCampaign, setSavingCampaign] = useState(false)
  const buyers = useUsers()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
    getGroups().then((list) => {
      const map: Record<string, string> = {}
      list.forEach((g: Group) => {
        map[g.id] = g.name
      })
      setGroupLabels(map)
    })
    supabase
      .from("tags")
      .select("id,label,color")
      .then(({ data }) => setAvailableTags(data || []))
  }, [])

  const loadTemplates = async () => {
    const { data } = await supabase
      .from("email_builder_templates")
      .select("*")
      .order("created_at", { ascending: false })
    setTemplates(data || [])
  }

  const loadCampaigns = async () => {
    const { data } = await supabase
      .from("email_campaign_definitions")
      .select("*")
      .order("created_at", { ascending: false })
    setCampaigns(data || [])
  }

  const loadQueue = async () => {
    const { data } = await supabase
      .from("email_campaign_queue")
      .select("*")
      .order("scheduled_for", { ascending: true })
      .limit(25)
    setQueue(data || [])
  }

  useEffect(() => {
    loadTemplates()
    loadCampaigns()
    loadQueue()
  }, [])

  const selectedTemplate = useMemo(() => templates.find((t) => t.id === selectedTemplateId), [templates, selectedTemplateId])

  useEffect(() => {
    if (selectedTemplate) {
      setTemplateName(selectedTemplate.name)
      setBuilderValue({
        subject: selectedTemplate.subject,
        html: selectedTemplate.content,
        blocks: selectedTemplate.blocks?.blocks || selectedTemplate.blocks || [],
        markdown: selectedTemplate.blocks?.markdown || "",
        previewText: selectedTemplate.preview_text || "",
        format: (selectedTemplate.content_format as "blocks" | "markdown") || "blocks",
      })
    }
  }, [selectedTemplate])

  const handleSaveTemplate = async () => {
    if (!userId) {
      toast.error("You must be signed in to save templates")
      return
    }
    if (!builderValue.subject.trim()) {
      toast.error("Subject is required for templates")
      return
    }
    setSavingTemplate(true)
    try {
      const payload: any = {
        name: templateName || builderValue.subject,
        subject: builderValue.subject,
        content: builderValue.html,
        content_format: builderValue.format,
        blocks: { blocks: builderValue.blocks, markdown: builderValue.markdown, previewText: builderValue.previewText },
        preview_text: builderValue.previewText,
        created_by: userId,
      }
      if (selectedTemplateId) {
        await supabase
          .from("email_builder_templates")
          .update(payload)
          .eq("id", selectedTemplateId)
      } else {
        await supabase.from("email_builder_templates").insert(payload)
      }
      toast.success("Template saved")
      setSelectedTemplateId(null)
      setTemplateName("")
      loadTemplates()
    } catch (err) {
      console.error(err)
      toast.error("Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleSaveCampaign = async () => {
    if (!userId) {
      toast.error("You must be signed in to save campaigns")
      return
    }
    if (!campaignName.trim()) {
      toast.error("Campaign name required")
      return
    }
    if (!builderValue.subject.trim() || !builderValue.html.trim()) {
      toast.error("Subject and content required")
      return
    }
    setSavingCampaign(true)
    try {
      const listIds = sendfoxLists
        .split(",")
        .map((l) => Number(l.trim()))
        .filter((n) => !Number.isNaN(n))
      const payload: any = {
        name: campaignName,
        template_id: selectedTemplateId,
        subject: builderValue.subject,
        content: builderValue.html,
        content_format: builderValue.format,
        blocks: { blocks: builderValue.blocks, markdown: builderValue.markdown, previewText: builderValue.previewText },
        target_groups: groups.length ? groups : null,
        target_segments:
          selectedTags.length || locations.length || buyers.value.length
            ? {
                tags: selectedTags,
                locations,
                buyers: buyers.value.map((b) => b.id),
              }
            : null,
        sendfox_lists: listIds.length ? listIds : null,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        status: scheduledFor ? "scheduled" : "draft",
        created_by: userId,
      }
      await supabase.from("email_campaign_definitions").insert(payload)
      toast.success("Campaign definition saved")
      setCampaignName("")
      setScheduledFor("")
      setGroups([])
      setSelectedTags([])
      setLocations([])
      buyers.value.forEach((b) => buyers.remove(b.id))
      loadCampaigns()
      loadQueue()
    } catch (err) {
      console.error(err)
      toast.error("Failed to save campaign")
    } finally {
      setSavingCampaign(false)
    }
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Email Builder & Campaigns</h1>
            <p className="text-muted-foreground">Design email templates, schedule sends, and monitor delivery.</p>
          </div>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
            <TabsTrigger value="queue">Queue</TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Save template</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Template name</Label>
                    <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Welcome drip" />
                  </div>
                  <div className="space-y-1">
                    <Label>Attach existing</Label>
                    <select
                      className="w-full rounded-md border bg-background p-2 text-sm"
                      value={selectedTemplateId || ""}
                      onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                    >
                      <option value="">New template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end justify-end gap-2">
                    <Button variant="outline" onClick={() => setSelectedTemplateId(null)}>
                      Reset
                    </Button>
                    <Button onClick={handleSaveTemplate} disabled={savingTemplate}>
                      {savingTemplate ? "Saving..." : "Save Template"}
                    </Button>
                  </div>
                </div>
                <EmailBuilder value={builderValue} onChange={setBuilderValue} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Existing templates</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => setSelectedTemplateId(t.id)}>
                        <TableCell>{t.name}</TableCell>
                        <TableCell className="font-medium">{t.subject}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {t.updated_at ? new Date(t.updated_at).toLocaleString() : ""}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!templates.length && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          No templates yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="campaigns" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Campaign definition</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>Name</Label>
                    <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="July buyers" />
                  </div>
                  <div className="space-y-1">
                    <Label>Schedule</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledFor}
                      onChange={(e) => setScheduledFor(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Groups</Label>
                    <GroupTreeSelector value={groups} onChange={setGroups} allowCreate={false} />
                  </div>
                  <div className="space-y-1">
                    <Label>Tags</Label>
                    <TagFilterSelector availableTags={availableTags} selectedTags={selectedTags} onChange={setSelectedTags} />
                  </div>
                  <div className="space-y-1">
                    <Label>Locations</Label>
                    <LocationFilterSelector selectedLocations={locations} onChange={setLocations} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label>SendFox Lists (comma separated)</Label>
                    <Input
                      value={sendfoxLists}
                      onChange={(e) => setSendfoxLists(e.target.value)}
                      placeholder="123,456"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Target buyers</Label>
                    <Textarea
                      readOnly
                      value={buyers.value.map((b) => `${b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim()}`).join(", ")}
                      placeholder="Use search below to add"
                    />
                    <Input
                      placeholder="Search buyers..."
                      value={buyers.inputValue}
                      onChange={(e) => buyers.setInputValue(e.target.value)}
                      onFocus={() => buyers.setOpen(true)}
                    />
                    {buyers.open && buyers.results.length > 0 && (
                      <div className="rounded-md border bg-card p-2 text-sm space-y-1">
                        {buyers.results.map((b) => (
                          <div
                            key={b.id}
                            className="cursor-pointer rounded px-2 py-1 hover:bg-muted"
                            onMouseDown={() => buyers.add(b)}
                          >
                            {b.full_name || `${b.fname || ""} ${b.lname || ""}`.trim() || b.id}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCampaignName("")}>Clear</Button>
                  <Button onClick={handleSaveCampaign} disabled={savingCampaign}>
                    {savingCampaign ? "Saving..." : "Save Campaign"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Scheduled campaigns</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Targets</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>{c.name}</TableCell>
                        <TableCell>{c.subject}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 text-xs">
                            {(c.target_groups || []).map((g) => (
                              <Badge key={g} variant="secondary">
                                {groupLabels[g] || g}
                              </Badge>
                            ))}
                            {c.target_segments?.tags?.map((t: string) => (
                              <Badge key={t} variant="outline">
                                Tag: {t}
                              </Badge>
                            ))}
                            {c.target_segments?.locations?.map((l: string) => (
                              <Badge key={l} variant="outline">
                                {l}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.scheduled_for ? new Date(c.scheduled_for).toLocaleString() : "Not scheduled"}
                        </TableCell>
                        <TableCell>
                          <Badge>{c.status || "draft"}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!campaigns.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No campaign definitions yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Email Queue</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Contacts</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queue.map((q) => (
                      <TableRow key={q.id}>
                        <TableCell className="font-mono text-xs">{q.id}</TableCell>
                        <TableCell className="font-mono text-xs">{q.campaign_id || "-"}</TableCell>
                        <TableCell>{q.contact_count}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {q.scheduled_for ? new Date(q.scheduled_for).toLocaleString() : ""}
                        </TableCell>
                        <TableCell>
                          <Badge variant={q.status === "error" ? "destructive" : "outline"}>{q.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!queue.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          Queue is empty
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  )
}
