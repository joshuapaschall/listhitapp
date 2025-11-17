export class DomainService {
  static async listDomains() {
    const res = await fetch("/api/short-domains")
    if (!res.ok) throw new Error("Request failed")
    return res.json()
  }

  static async addDomain(hostname: string) {
    const res = await fetch("/api/short-domains", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hostname }),
    })
    if (!res.ok) throw new Error("Request failed")
    return res.json()
  }

  static async deleteDomain(id: string) {
    const res = await fetch(`/api/short-domains/${id}`, { method: "DELETE" })
    if (!res.ok) throw new Error("Request failed")
    return res.json()
  }
}

export default DomainService
