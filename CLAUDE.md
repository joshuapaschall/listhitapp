# CLAUDE.md - DispoTool Project Guide

## Project Overview
**DispoTool** is a comprehensive real estate buyer CRM built with Next.js 14 App Router, designed to mirror InvestorLift functionality but tailored for real estate disposition workflows. It combines SMS/MMS messaging, email management, voice calling, property management, and marketing campaigns into a unified platform.

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with CSS custom properties
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Theme**: Next-themes with dark mode support

### Backend & Database
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime subscriptions
- **Storage**: Supabase Storage for media files

### Communication Services
- **SMS/MMS & Voice**: Telnyx (WebRTC for voice calls)
- **Email**: Gmail API integration
- **Email Campaigns**: SendFox
- **URL Shortening**: Short.io

### Development Tools
- **Package Manager**: pnpm
- **Testing**: Jest with React Testing Library
- **E2E Testing**: Cypress
- **Linting**: ESLint with Next.js config
- **TypeScript**: Strict mode enabled

## Project Structure

```
finaldispotool/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── admin/             # Admin pages
│   ├── campaigns/         # Campaign management
│   ├── gmail/             # Gmail integration
│   ├── inbox/             # SMS/MMS inbox
│   ├── properties/        # Property management
│   └── ...
├── components/            # React components
│   ├── buyers/           # Buyer management components
│   ├── campaigns/        # Campaign components
│   ├── gmail/            # Gmail components
│   ├── inbox/            # Inbox components
│   ├── ui/               # shadcn/ui components
│   └── voice/            # Voice calling components
├── services/             # Business logic services
├── lib/                  # Utilities and shared logic
├── hooks/                # Custom React hooks
├── utils/                # Helper functions
├── migrations/           # Database migrations
├── scripts/              # Setup and maintenance scripts
└── tests/                # Test files
```

## Code Patterns & Conventions

### TypeScript
- Strict mode enabled with comprehensive type definitions
- Interface definitions in `/lib/supabase.ts`
- Service classes use static methods
- Proper error handling with typed responses

### Component Architecture
- Functional components with hooks
- shadcn/ui components for consistent styling
- Custom hooks for reusable logic (`use-*` pattern)
- Modal components follow `*-modal.tsx` naming

### API Routes
- RESTful endpoints in `/app/api/`
- Proper error handling and status codes
- Authentication via Supabase service role key
- Webhook handlers for external services

### Database Access
- Supabase client instances (public and admin)
- Service layer pattern for data access
- Real-time subscriptions for live updates
- Row-level security policies

### Styling
- Tailwind CSS with custom CSS variables
- Theme system with light/dark mode
- Consistent spacing and typography
- Responsive design patterns

## Key Features

### Buyer Management
- Comprehensive buyer profiles with scoring
- Tag and group organization
- Location-based filtering
- Property matching algorithms
- Bulk operations support

### Communication
- **SMS/MMS**: Telnyx integration with media support
- **Email**: Gmail API for threading and management
- **Voice**: WebRTC calling via Telnyx
- **Campaigns**: Mass SMS/email with scheduling

### Property Management
- Property listings with media
- Mapbox integration for location services
- Automated URL shortening
- Property-buyer matching

### Marketing & Analytics
- Campaign creation and scheduling
- Click tracking and analytics
- Template management
- AI-powered content generation (OpenAI)

## Development Commands

```bash
# Setup (always run first)
./scripts/setup.sh

# Development
pnpm dev

# Testing
pnpm test
pnpm run cy

# Linting
pnpm run lint

# Build
pnpm run build

# Database
pnpm run db:schedule
```

## Environment Variables

### Required Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Telnyx (SMS/Voice)
TELNYX_API_KEY=
TELNYX_PUBLIC_KEY=
TELNYX_MESSAGING_PROFILE_ID=
TELNYX_VOICE_CONNECTION_ID=
CALL_CONTROL_APP_ID=

# Gmail
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=
GMAIL_FROM=

# Short.io
SHORTIO_API_KEY=
SHORTIO_DOMAIN=

# URLs
DISPOTOOL_BASE_URL=
NEXT_PUBLIC_BASE_URL=
```

### Optional Variables
```env
# OpenAI (for AI features)
OPENAI_API_KEY=

# SendFox (email campaigns)
SENDFOX_API_TOKEN=
# SENDFOX_API_KEY is accepted as a fallback but will be removed later

# Mapbox (location services)
NEXT_PUBLIC_MAPBOX_TOKEN=

# Development
SKIP_TELNYX_SIG=1
VOICE_SYNC_SECRET_KEY=
```

## Database Schema

### Core Tables
- **buyers**: Buyer profiles and preferences
- **properties**: Property listings
- **message_threads**: SMS conversation threads
- **messages**: Individual SMS/MMS messages
- **gmail_threads**: Email thread management
- **campaigns**: Marketing campaigns
- **showings**: Property showings
- **offers**: Buyer offers on properties
- **tags**: Buyer categorization
- **groups**: Buyer groupings
- **ai_prompts**: AI prompt templates

## API Endpoints

### Buyer Management
- `GET /api/buyers` - List buyers with filters
- `POST /api/buyers` - Create buyer
- `PUT /api/buyers/[id]` - Update buyer
- `DELETE /api/buyers/[id]` - Delete buyer

### Communication
- `POST /api/messages/send` - Send SMS/MMS
- `GET /api/gmail/threads` - Get email threads
- `POST /api/gmail/send` - Send email
- `POST /api/calls/outbound` - Make voice call

### Campaigns
- `POST /api/campaigns/send` - Send campaign
- `POST /api/campaigns/send-now` - Send immediate campaign

### Webhooks
- `POST /api/webhooks/telnyx-incoming-sms` - Handle incoming SMS
- `POST /api/webhooks/telnyx-voice` - Handle voice events
- `POST /api/webhooks/telnyx-status` - Handle delivery status

## Testing Strategy

### Unit Tests
- Service layer methods
- Utility functions
- Component logic
- API route handlers

### Integration Tests
- Database operations
- External API integrations
- Webhook handlers

### E2E Tests
- Critical user flows
- Campaign creation and sending
- Message threading

## Security Considerations

### Authentication
- Supabase Auth for user management
- Service role key for server operations
- Row-level security policies

### Data Protection
- Encrypted environment variables
- Secure webhook signature validation
- Media file access controls

### Rate Limiting
- SMS rate limiting per carrier
- API endpoint throttling
- Bulk operation limits

## Deployment Notes

### Vercel Configuration
- Environment variables in Build and Runtime
- Static file optimization disabled
- TypeScript and ESLint errors ignored during build

### Database Setup
1. Run SQL scripts in order: `01-schema.sql`, `02-enable-security.sql`, `03-seed-data.sql`, `04-scheduler.sql`
2. Configure Supabase Edge Functions
3. Set up cron jobs for scheduled tasks

### External Service Configuration
- Telnyx webhooks pointing to deployment URL
- Gmail OAuth redirect URLs
- Short.io domain verification

## Common Tasks

### Adding New Features
1. Define TypeScript interfaces in `/lib/supabase.ts`
2. Create service methods in `/services/`
3. Build UI components in `/components/`
4. Add API routes in `/app/api/`
5. Write tests in `/tests/`

### Database Changes
1. Create migration file in `/migrations/`
2. Update TypeScript interfaces
3. Update service methods
4. Run tests to verify changes

### New Integrations
1. Add environment variables
2. Create service wrapper
3. Add webhook handlers if needed
4. Update documentation

## Performance Optimization

### Frontend
- Next.js Image optimization disabled for compatibility
- Component lazy loading where appropriate
- Efficient re-rendering with React keys

### Backend
- Supabase query optimization
- Proper indexing on frequently queried columns
- Rate limiting to prevent abuse

### Media Handling
- Automatic audio conversion to MP3
- File size limits (1MB max)
- Supabase Storage for persistent files

## Troubleshooting

### Common Issues
1. **WSL Connection Issues**: Use `npm run dev -- -H 0.0.0.0` or access via WSL IP
2. **Missing Dependencies**: Always run `./scripts/setup.sh` first
3. **Environment Variables**: Verify all required variables are set
4. **Database Issues**: Check Supabase connection and RLS policies

### Debug Commands
```bash
# Check environment
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"

# Test database connection
pnpm ts-node -e "import { supabase } from './lib/supabase'; console.log(await supabase.from('buyers').select('count').single())"

# Verify webhooks
curl -X POST http://localhost:3000/api/test-mirror
```

## Key Files to Understand

### Configuration
- `/next.config.mjs` - Next.js configuration
- `/tailwind.config.ts` - Tailwind CSS setup
- `/lib/env-check.ts` - Environment validation

### Core Logic
- `/lib/supabase.ts` - Database client and types
- `/services/buyer-service.ts` - Buyer management logic
- `/lib/sms-rate-limiter.ts` - SMS throttling
- `/lib/gmail-utils.ts` - Gmail integration

### UI Components
- `/components/ui/` - Base UI components
- `/components/buyers/` - Buyer management UI
- `/components/inbox/` - Message management UI

---

## Detailed Telnyx Integration

### Overview
The DispoTool implements a comprehensive Telnyx integration supporting SMS/MMS messaging, voice calling via WebRTC, and webhook handling. The implementation is production-ready with proper security, rate limiting, and compliance features.

### 1. Core Configuration & Security

#### Environment Variables
```env
TELNYX_API_KEY=                    # Main API authentication
TELNYX_PUBLIC_KEY=                 # Ed25519 signature verification
TELNYX_MESSAGING_PROFILE_ID=       # SMS/MMS profile
TELNYX_VOICE_CONNECTION_ID=        # Credential connection for SIP users
CALL_CONTROL_APP_ID=               # Voice API application for outbound calls
SKIP_TELNYX_SIG=1                  # Dev mode signature bypass
```

#### Signature Verification (`lib/telnyx.ts`)
- Uses Ed25519 cryptographic signature verification
- Validates all incoming webhook requests
- Implements `verifyTelnyxRequest()` with noble/ed25519 library
- Supports dev mode bypass with `SKIP_TELNYX_SIG=1`

### 2. SMS/MMS Implementation

#### Message Sending (`/api/messages/send`)
**Flow:**
1. **Rate Limiting**: Uses carrier-specific rate limiting
2. **Phone Validation**: Normalizes to E.164 format
3. **Media Handling**: Converts media URLs to public Supabase URLs
4. **Carrier Lookup**: Determines carrier for proper rate limiting
5. **Telnyx API Call**: Sends via messaging profile
6. **Database Storage**: Records in `messages` table

**Key Features:**
- **Carrier-aware rate limiting** (T-Mobile special handling)
- **Media URL mirroring** to Supabase Storage
- **Thread management** with buyer linking
- **Bulk message support** with campaign tracking

#### Message Receiving (`/api/webhooks/telnyx-incoming-sms`)
**Flow:**
1. **Signature Verification**: Validates webhook authenticity
2. **Media Mirroring**: Downloads and stores media in Supabase
3. **Buyer Matching**: Matches phone numbers to buyers
4. **Thread Upsert**: Creates/updates conversation threads
5. **STOP Processing**: Handles unsubscribe requests

**Advanced Features:**
- **Multi-phone matching** (phone, phone2, phone3 fields)
- **Anonymous thread support** for unknown senders
- **Campaign association** for reply tracking
- **Automatic STOP compliance** (sets `can_receive_sms: false`)

### 3. Rate Limiting & Compliance

#### SMS Rate Limiter (`lib/sms-rate-limiter.ts`)
```typescript
// Configurable limits
globalMps: 12,           // Global messages per second
carrierMps: 4,           // Per-carrier messages per second
tmobileSegments: 10000,  // Daily T-Mobile limit
```

**Architecture:**
- **Bottleneck.js** for queue management
- **Carrier-specific queues** with individual limits
- **T-Mobile special handling** with daily segment limits
- **Segment calculation** for proper rate limiting
- **Automatic carrier lookup** via Telnyx API

#### SMS Segment Calculation (`lib/sms-utils.ts`)
- **GSM-7 encoding detection** (160 chars/segment)
- **UCS-2 Unicode support** (70 chars/segment)
- **Multi-segment calculation** (153/67 chars respectively)
- **Extended GSM character handling** (counts as 2 chars)

### 4. Voice/WebRTC Implementation

#### WebRTC Device Provider (`components/voice/TelnyxDeviceProvider.tsx`)
**Features:**
- **Token-based authentication** via `/api/telnyx/token`
- **Automatic connection management** with error handling
- **Call state tracking** (idle, connecting, on-call, error)
- **Context provider** for app-wide voice features

**Call Controls:**
- `connectCall()` - Outbound calling
- `disconnectCall()` - Hang up
- `toggleMute()` - Mute/unmute
- `toggleHold()` - Hold/resume
- `startRecording()` / `stopRecording()` - Call recording
- `transfer()` - Call transfer

#### Token Management (`/api/telnyx/token`)
**Flow:**
1. **Credential Reuse**: Checks for existing valid credentials
2. **Auto-Creation**: Creates new telephony credentials if needed
3. **Token Generation**: Requests short-lived login token
4. **24-hour Cleanup**: Automatic credential expiration

#### Outbound Calling (`/api/calls/outbound`)
**Process:**
1. **Buyer Association**: Links calls to buyer profiles
2. **Caller ID Selection**: Uses stored or provided caller ID
3. **Telnyx API Call**: Initiates call with webhook URLs
4. **Database Recording**: Stores call record immediately
5. **Caller ID Persistence**: Saves successful caller IDs

### 5. Webhook Handlers

#### Voice Webhook (`/api/webhooks/telnyx-voice`)
**Handles:**
- **call.initiated**: Creates call record, bridges incoming calls
- **call.answered**: Updates answered timestamp
- **call.recording.saved**: Stores recording URL

**Incoming Call Bridging:**
```xml
<Response>
  <Connect>
    <Client>listhitapp</Client>
  </Connect>
</Response>
```

#### SMS Status Webhook (`/api/webhooks/telnyx-status`)
**Tracks:**
- **Delivery status** updates for campaigns
- **Error handling** for failed messages
- **Campaign recipient** status updates

### 6. Database Schema Integration

#### Key Tables:
- **`messages`**: SMS/MMS message storage
- **`message_threads`**: Conversation threading
- **`calls`**: Voice call records
- **`telnyx_credentials`**: WebRTC credentials
- **`campaign_recipients`**: Bulk message tracking

#### Thread Management:
- **Buyer association** via phone number matching
- **Campaign linking** for reply tracking
- **Unread/starred flags** for UI state
- **Soft deletion** support

### 7. Media Handling

#### MMS Support (`utils/mms.server.ts`)
**Supported Formats:**
- **Images**: jpg, jpeg, png, gif, bmp, webp
- **Audio**: m4a, mp3, wav, ogg, oga, opus, amr, webm
- **Video**: mp4, 3gp, webm
- **Documents**: pdf

**Processing:**
- **Audio conversion** to MP3 format
- **File size limits** (1MB max)
- **Public URL generation** for Supabase Storage
- **Automatic cleanup** of temporary files

### 8. Advanced Features

#### Carrier Intelligence
- **Real-time carrier lookup** for rate limiting
- **Carrier-specific queues** with proper throttling
- **T-Mobile compliance** with daily limits
- **Caching** to reduce API calls

#### Campaign Integration
- **Bulk messaging** with rate limiting
- **Status tracking** via webhooks
- **Reply association** with original campaigns
- **Delivery analytics** and reporting

#### Error Handling
- **Comprehensive logging** with structured messages
- **Graceful degradation** for missing configurations
- **Retry mechanisms** for transient failures
- **User-friendly error messages**

### 9. Security Considerations

#### Authentication
- **Ed25519 signature verification** for all webhooks
- **Bearer token authentication** for API calls
- **Environment variable protection** for sensitive data
- **CORS handling** for WebRTC connections

#### Data Protection
- **Phone number normalization** to prevent duplicates
- **Media URL expiration** handling
- **Secure credential storage** with automatic cleanup
- **SQL injection prevention** via parameterized queries

### 10. Production Deployment

#### Webhook Configuration
```
Answer URL: https://yourdomain.com/api/webhooks/telnyx-voice
Webhook URL: https://yourdomain.com/api/webhooks/telnyx-voice
SMS Webhook: https://yourdomain.com/api/webhooks/telnyx-incoming-sms
Status Webhook: https://yourdomain.com/api/webhooks/telnyx-status
```

#### Performance Optimizations
- **Connection pooling** for database access
- **Async processing** for webhook handlers
- **Rate limiting** to prevent carrier violations
- **Caching** for frequently accessed data

---

This project follows modern React/Next.js patterns with comprehensive TypeScript support, focusing on real estate disposition workflows with multi-channel communication capabilities.