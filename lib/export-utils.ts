import type { Buyer } from "@/lib/supabase"

export function exportBuyersToCSV(buyers: Buyer[], filename = "buyers-export.csv") {
  // Define the headers for the CSV
  const headers = [
    "First Name",
    "Last Name",
    "Email",
    "Phone",
    "Phone 2",
    "Phone 3",
    "Company",
    "Score",
    "Notes",
    "Mailing Address",
    "Mailing City",
    "Mailing State",
    "Mailing ZIP",
    "Locations",
    "Tags",
    "VIP",
    "Vetted",
    "Can Receive Email",
    "Can Receive SMS",
    "Property Types",
    "Asking Price Min",
    "Asking Price Max",
    "Timeline",
    "Source",
    "Status",
    "Created Date",
  ]

  // Convert buyers data to CSV rows
  const rows = buyers.map((buyer) => [
    buyer.fname || "",
    buyer.lname || "",
    buyer.email || "",
    buyer.phone || "",
    buyer.phone2 || "",
    buyer.phone3 || "",
    buyer.company || "",
    buyer.score || 0,
    buyer.notes || "",
    buyer.mailing_address || "",
    buyer.mailing_city || "",
    buyer.mailing_state || "",
    buyer.mailing_zip || "",
    buyer.locations?.join("; ") || "",
    buyer.tags?.join("; ") || "",
    buyer.vip ? "Yes" : "No",
    buyer.vetted ? "Yes" : "No",
    buyer.can_receive_email ? "Yes" : "No",
    buyer.can_receive_sms ? "Yes" : "No",
    buyer.property_type?.join("; ") || "",
    buyer.asking_price_min || "",
    buyer.asking_price_max || "",
    buyer.timeline || "",
    buyer.source || "",
    buyer.status || "",
    new Date(buyer.created_at).toLocaleDateString(),
  ])

  // Combine headers and rows
  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((field) => {
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          const stringField = String(field)
          if (stringField.includes(",") || stringField.includes("\"") || stringField.includes("\n")) {
            return `"${stringField.replace(/"/g, "\"\"")}"`
          }
          return stringField
        })
        .join(","),
    )
    .join("\n")

  // Create and download the file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}

export function exportBuyersToJSON(buyers: Buyer[], filename = "buyers-export.json") {
  const jsonContent = JSON.stringify(buyers, null, 2)
  const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
  const link = document.createElement("a")

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", filename)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }
}
