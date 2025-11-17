export interface Email {
  id: string
  from: string
  to: string
  subject: string
  body: string
  date: string
}

export interface Thread {
  id: string
  messages: Email[]
}

export const mockThreads: Thread[] = [
  {
    id: "t1",
    messages: [
      {
        id: "m1",
        from: "alice@example.com",
        to: "user@example.com",
        subject: "Welcome to DispoTool",
        body: "Hi there, welcome to DispoTool. Let us know if you have questions.",
        date: "2024-01-01T10:00:00Z",
      },
      {
        id: "m2",
        from: "user@example.com",
        to: "alice@example.com",
        subject: "Re: Welcome to DispoTool",
        body: "Thanks Alice! I\'m exploring the features now.",
        date: "2024-01-01T12:00:00Z",
      },
    ],
  },
  {
    id: "t2",
    messages: [
      {
        id: "m3",
        from: "bob@example.com",
        to: "user@example.com",
        subject: "Property Inquiry",
        body: "Do you have any new listings in Denver?",
        date: "2024-02-05T09:30:00Z",
      },
      {
        id: "m4",
        from: "user@example.com",
        to: "bob@example.com",
        subject: "Re: Property Inquiry",
        body: "Yes, I\'ll send you details shortly.",
        date: "2024-02-05T10:00:00Z",
      },
    ],
  },
  {
    id: "t3",
    messages: [
      {
        id: "m5",
        from: "carol@example.com",
        to: "user@example.com",
        subject: "Draft contract",
        body: "Attached is the draft contract for review.",
        date: "2024-03-10T14:15:00Z",
      },
    ],
  },
]
