self.addEventListener("push", (event) => {
  let data = {}
  try {
    data = event.data.json()
  } catch {}
  const title = data.title || "DispoTool"
  const options = {
    body: data.body || "",
    icon: "/placeholder-logo.png",
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clis) => {
      for (const client of clis) {
        if (client.url.includes("/")) {
          return client.focus()
        }
      }
      return clients.openWindow("/")
    })
  )
})
