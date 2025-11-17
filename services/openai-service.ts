const apiKey = process.env.OPENAI_API_KEY

if (!apiKey) {
  throw new Error("OpenAI API key not configured")
}

async function openaiRequest(body: any): Promise<string> {
  if (!apiKey) throw new Error("OpenAI API key not configured")
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content?.trim() || ""
}

export async function generateCopy(prompt: string): Promise<string> {
  return openaiRequest({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
  })
}

export async function chat(
  messages: { role: string; content: string }[],
): Promise<string> {
  return openaiRequest({
    model: "gpt-4o",
    messages,
    temperature: 0.7,
    max_tokens: 300,
  })
}

export default { generateCopy, chat }
