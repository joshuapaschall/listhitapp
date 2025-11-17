import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  console.log("🔔 ANSWER WEBHOOK - Just answering immediately")
  
  // Just answer - nothing else
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Answer/>
</Response>`,
    {
      headers: { 
        "Content-Type": "application/xml",
        "Cache-Control": "no-cache"
      },
      status: 200,
    }
  );
}

export async function GET(request: NextRequest) {
  console.log("🔔 ANSWER WEBHOOK GET - Just answering immediately")
  
  // Support GET requests too
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Answer/>
</Response>`,
    {
      headers: { 
        "Content-Type": "application/xml",
        "Cache-Control": "no-cache"
      },
      status: 200,
    }
  );
}