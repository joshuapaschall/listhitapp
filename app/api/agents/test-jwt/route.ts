export const runtime = "nodejs"
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Simple endpoint to test JWT structure
  const mockJWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
  
  return NextResponse.json({
    token: mockJWT,
    expires_in: 3600,
    sip_username: "test",
    use_jwt_auth: true
  });
}
