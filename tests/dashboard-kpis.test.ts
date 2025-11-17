import { describe, expect, test } from "@jest/globals"
import { fetchKpis } from "../services/dashboard-service"

describe("dashboard kpis", () => {
  test("fetchKpis returns all metrics", async () => {
    const res = await fetchKpis("week")
    const keys = [
      "buyersAdded",
      "propertiesAdded",
      "activeProperties",
      "underContract",
      "soldProperties",
      "totalProperties",
      "hotBuyers",
      "followUpsDue",
      "totalContacts",
      "textsSent",
      "textsSentDelta",
      "textsReceived",
      "textsReceivedDelta",
      "callsMade",
      "callsMadeDelta",
      "callsReceived",
      "callsReceivedDelta",
      "voicemailsLeft",
      "emailsSent",
      "emailsSentDelta",
      "emailsReceived",
      "emailsReceivedDelta",
      "emailsOpened",
      "emailBounces",
      "openRate",
      "clickRate",
      "bounceRate",
      "smsUnsubscribes",
      "emailUnsubscribes",
      "unsubscribeRate",
      "unsubscribeRateDelta",
      "campaignsRunning",
      "campaignRoi",
      "offersCreated",
      "offersCreatedDelta",
      "offersAccepted",
      "offersAcceptedDelta",
      "offersDeclined",
      "offersCountered",
      "showingsScheduled",
      "showingsScheduledDelta",
      "showingsRescheduled",
      "showingsCancelled",
      "showingsCompleted",
      "grossProfit",
      "netProfit",
      "avgAssignmentFee",
      "closeRate",
    ]
    keys.forEach((k) => {
      expect(res).toHaveProperty(k)
      expect(typeof (res as any)[k]).toBe("number")
    })
  })
})
