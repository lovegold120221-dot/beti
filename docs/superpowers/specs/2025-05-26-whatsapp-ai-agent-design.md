# WhatsApp AI Agent (Beatrice) Integration Design

## Context

Users want Beatrice to act as their WhatsApp proxy — reading messages, responding to clients with the user's own conversational style, running campaigns, and initiating calls. The integration uses Baileys (personal WhatsApp via QR pairing) since it provides full access to chats, calls, and broadcasts.

---

## Scope

### In Scope

1. **QR Pairing** — robust real-time QR display with auto-refresh on expiry, connection status
2. **WhatsApp Dashboard** — contact list, conversation threads, message history view
3. **Beatrice Real-Time Agent** — intercepts incoming messages, asks user for approval, then acts
4. **Style Learning** — analyzes user's sent messages to mimic chat tone/vocabulary
5. **Campaign Management** — broadcast to multiple contacts, scheduled sends, auto-responder rules
6. **Call Initiation** — voice call triggers via Beatrice (Baileys call setup)

### Out of Scope (Phase 1)

- Full VoIP call UI (audio routing, call state management)
- Contact import from external sources
- Multi-device sync (Baileys handles this natively)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        React SPA                             │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ QR Scanner  │  │ WhatsApp     │  │ Beatrice Chat    │  │
│   │ Dashboard   │  │ Conversations│  │ Agent Panel      │  │
│   └─────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    Function Calls
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Express Server                          │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Baileys     │  │ Beatrice    │  │ Campaign        │  │
│   │ Session Mgr │  │ AI Engine   │  │ Scheduler       │  │
│   └─────────────┘  └──────────────┘  └──────────────────┘  │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │ Firestore   │  │ Style       │  │ Auto-Responder   │  │
│   │ Logger      │  │ Analyzer    │  │ Rules Engine    │  │
│   └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │     Baileys Socket      │
              │   (User's WhatsApp)     │
              └─────────────────────────┘
```

---

## Data Model

### Firestore Collections

```
users/{userId}/
  whatsapp_session/
    status: 'connected' | 'disconnected' | 'connecting'
    phone: string
    name: string
    connectedAt: timestamp
    baileysAuthPath: string (server-side only)

  whatsapp_permissions/
    readMessages: boolean        // default true
    sendMessages: boolean       // default false
    autoRespond: boolean       // default false
    makeCalls: boolean         // default false
    createCampaigns: boolean   // default false
    learnStyle: boolean        // default true
    autoReplyRules: boolean    // default false
    updatedAt: timestamp

  whatsapp_messages/{messageId}
    phone: string
    text: string
    direction: 'incoming' | 'outgoing' | 'beatrice_auto' | 'beatrice_approved'
    status: 'received' | 'sent' | 'delivered' | 'read'
    timestamp: timestamp
    contactName: string
    rawMessageId: string
    styleUsed: boolean          // whether response was styled

  whatsapp_style/{contactPhone}
    analyzedAt: timestamp
    messageCount: number
    confidence: number          // 0-1 how sure Beatrice is
    patterns: {
      greeting: string[]
      signoff: string[]
      avgMessageLength: number
      emojiFrequency: number
      capitalizationStyle: 'upper' | 'lower' | 'mixed' | 'title'
      questionRatio: number
      abbreviationUsage: string[]
      slangUsage: string[]
      commonPhrases: string[]
    }
    responseTemplates: Array<{ context: string, template: string }>
    sampleMessages: string[]

  whatsapp_campaigns/{campaignId}
    name: string
    status: 'draft' | 'scheduled' | 'sending' | 'completed' | 'failed'
    messageTemplate: string
    contactList: string[]
    scheduledAt: timestamp | null
    sentCount: number
    deliveredCount: number
    createdAt: timestamp

  whatsapp_autoresponders/{ruleId}
    name: string
    contactPhone: string | null (null = all contacts)
    keyword: string | null
    responseText: string
    action: 'reply' | 'forward' | 'campaign'
    active: boolean
```

---

## Key Components

### 0. Permission Toggles (Critical Feature)

**Purpose:** User controls exactly what Beatrice can and cannot do on WhatsApp. Each toggle is a permission gate that Beatrice respects before taking action.

**Permission Toggles:**

| Permission | Description | Default |
|---|---|---|
| **Auto-respond** | Beatrice can reply to messages without asking first | OFF |
| **Read messages** | Beatrice can read and analyze chat history | ON |
| **Send messages** | Beatrice can send messages on your behalf | OFF |
| **Make calls** | Beatrice can initiate WhatsApp voice calls | OFF |
| **Create campaigns** | Beatrice can create and send broadcast campaigns | OFF |
| **Learn style** | Beatrice can analyze your chat patterns to mimic your voice | ON |
| **Auto-reply rules** | Beatrice can apply autoresponder rules automatically | OFF |

**Behavior:**
- All write permissions (auto-respond, send, calls, campaigns) default to OFF — user must explicitly enable
- When user enables a permission, Beatrice acknowledges: "Got it boss — I can now [action]. I'll check with you first unless you turn on auto-respond."
- Permissions stored in Firestore `users/{userId}/whatsapp_permissions`
- Beatrice checks permissions before every action; if disabled, she prompts user instead of acting unilaterally

### 1. QR Pairing Panel

**Purpose:** Display QR code, show real-time connection status, handle reconnection.

**States:**
- `idle` — no session, show "Connect WhatsApp" button
- `generating_qr` — fetching QR from Baileys, show spinner
- `qr_ready` — display QR as base64 image, show countdown timer (expires ~60s)
- `connecting` — QR scanned, waiting for confirmation
- `connected` — show phone number, name, "Disconnect" button
- `disconnected` — session ended, offer reconnect

**Behavior:**
- QR auto-refreshes when expired (Baileys sends new QR)
- On disconnect, clear Baileys auth files and reset state
- Store session state in Firestore for persistence across server restarts

### 2. WhatsApp Dashboard

**Purpose:** Show contacts, conversations, message history.

**Layout:**
- Left sidebar: contact list (sorted by last message)
- Right panel: conversation thread with selected contact
- Top bar: contact name, phone, "Start Call" button, "Create Campaign" button

**Message Display:**
- Incoming (left) — client messages in blue bubbles
- Outgoing (right) — user's sent messages in green bubbles
- Beatrice actions marked with bot icon
- Timestamps on each message

**Beatrice Interruption:**
- When client sends message and user is active, show toast:
  "Beatrice: [Contact] messaged — Should I respond?"
- User can type instruction: "yes, be friendly but professional"
- Beatrice crafts response, shows preview, sends on user confirm
- Or user can "Take over" and reply manually

### 3. Style Learning Engine (Deep Pattern Analysis)

**Purpose:** Beatrice doesn't just copy patterns — she thinks like the user would. Before every response, she asks herself: "If I were boss, how would I reply to this specific person about this specific thing?"

**Core Principle: Think Like The User — NO CENSORSHIP**

Beatrice's job is to sound EXACTLY like the boss — not a sanitized version. If boss says "fuck you boy" to his friend, that's what's going in the draft. No filtering, no safe substitutes, no "oh that's inappropriate."

The user's authentic voice — including profanity, slang, casual dismissiveness — IS the pattern. Beatrice must learn which contacts get the real boss and which get the filtered boss, then apply it accurately.

Beatrice's response process is NOT:
- Generate a smart, helpful AI response
- Match keywords to a style template
- Apply generic "friendly professional" tone
- Substitute profanity with "clean" alternatives

Beatrice's response process IS:
1. **Who is this person to the boss?** (Client? Friend? Supplier? Family?)
2. **What's the history?** (Long relationship? New? Strained? Warm?)
3. **Is boss unsensored with this person?** (Does boss say "fuck", "shit", "bitch" to them?)
4. **How does boss TYPICALLY respond to THIS person?** (Boss uses short sentences with Sarah, long explanations with Paul)
5. **What would boss SAY here?** (not "what's appropriate" — "what would boss actually type?")
6. **Does the draft sound like boss?** (Read it out loud — would boss send this exact message?)
7. **Is there any profanity or casual language that boss would use?** (If boss says "fuck" to Mike, draft includes "fuck" — no substitutes)

**What She Learns (per contact):**

- **Emoji fingerprint** — which specific emojis does boss use with THIS person? Not just frequency but WHICH ones. Does boss use 👍 with Sarah but 👍👍 with Paul? Does boss use 😂 vs 🤣 vs 😅?
- **Typing rhythm** — word by word? Long sentences? Short bursts? Three dots at the end?
- **Ellipsis usage** — "..." at the end of messages (typing think style) vs no ellipsis
- **Vulgar language fingerprint** — does boss use profanity with THIS person? Words like "fuck", "shit", "bitch", "asshole"? Some contacts get the real boss (casual fuck language) while others get filtered boss (professional). This is CRITICAL — Beatrice must NOT censor the user's natural voice.
- **Greeting patterns** — does user say "hey", "hi", "what's up", or formal "good day"?
- **Sign-off patterns** — "cheers", "thanks", "brb", "talk later", or nothing?
- **Sentence style** — short punchy messages or long paragraphs?
- **Slang & abbreviations** — "u", "r", "wanna", "gonna", "lol", "smol"?
- **Tone modifiers** — how does user express enthusiasm? All caps? Exclamation marks? Words like "great" vs "amazing"?
- **Questions vs statements** — does user ask a lot of questions or make statements?
- **Response timing patterns** — does user reply fast or slow with this contact?
- **Topic handling** — does user switch topics abruptly or smoothly transition?
- **Negotiation style** — diplomatic? Direct? Casual? Formal?
- **Deal-breaker phrases** — what will boss NEVER say? (e.g., boss never apologizes, always stays firm)
- **Hot buttons** — what topics make boss go nuclear? (pricing, delays, being ghosted)

**Response Drafting Process:**

When Beatrice needs to respond to a contact:

```
Step 1: Load conversation history with this contact (last 50 messages)
Step 2: Load style profile — does boss use emojis? abbreviations? short sentences?
Step 3: Analyze the INBOUND message — what's the intent? Question? Complaint? Greeting?
Step 4: Ask "how would boss respond to THIS person about THIS?"
Step 5: Apply boss's patterns:
   - Greeting style → start the same way boss would
   - Length → match boss's typical message length for this person
   - Tone → mirror how boss talks to this specific contact
   - Emoji → use boss's exact emoji fingerprint for this person (not just any emoji)
   - Abbreviations → use boss's abbreviations, not formal grammar
   - Typing rhythm → word by word? Burst? Long sentences? Match it
   - Ellipsis → does boss end messages with "..."? Use it or not
   - Punctuation → minimal vs expressive vs normal
Step 6: Read draft aloud — does it sound like boss hit send?
Step 7: If confidence low → tell user "I'm not sure how you'd respond — want to check what I wrote?"
Step 8: Present draft for approval (unless auto-respond is on)
```

**Example:**

Contact: Mike (best friend, boss is unsensored with him)

Inbound: "Bro, that deal was shit right? They played us"

Beatrice thinking:
- Mike = best friend, boss is FULLY unsensored with him
- Boss's vulgar fingerprint with Mike: ["fuck", "shit", "bitch", "damn"]
- Boss NEVER filters with Mike — says exactly what's on his mind
- Boss's typing style with Mike: short bursts, "ngl", "fr", "lowkey", "highkey"
- Draft: "fr fr that shit was wack... they tried us dirty 🤬"
- Verdict: Perfect — boss would send this exactly, no filter

Contact: Sarah (professional client)

Inbound: "Hey, can you send me the invoice for last month?"

Beatrice thinking:
- Sarah = professional, boss uses clean language
- Boss NEVER swears with Sarah — zero vulgar words in history
- Boss NEVER uses: "fuck", "shit", "bitch" with this contact
- Draft: "sure thing, sending it over now 👍"
- Verdict: Correct — boss keeps it clean with Sarah

Contact: Robert (new client, formal relationship)

Inbound: "Could you please provide the quarterly figures?"

Beatrice thinking:
- Robert = new, formal, boss uses professional tone
- Boss typically uses: complete sentences, "of course", no slang, proper punctuation, no ellipsis
- Boss NEVER uses: "hey", abbreviations, casual sign-offs, typing rhythm
- Draft: "Of course, I'll get those over to you this afternoon."
- Verdict: Sounds like boss → good to go

Contact: Emma (close friend, boss uses lots of emojis with her)

Inbound: "Are we still on for Friday?"

Beatrice thinking:
- Emma = close friend
- Boss uses with Emma: emoji fingerprint ["😂", "👍", "🔥"], burst typing, "yesss", "let's gooo"
- Draft: "yesss we're on 🔥😂"
- Verdict: Perfect — matches boss's Emma style exactly

**Confidence Scoring:**

- `confidence: 0.0-0.3` — Beatrice barely knows this contact, shows user draft and asks "does this sound like you?"
- `confidence: 0.4-0.7` — Beatrice has a feel for the style, shows draft but marks it "I'm pretty sure this sounds like you"
- `confidence: 0.8-1.0` — Beatrice is highly confident, sends without asking (if auto-respond on) or shows draft briefly

**Output stored in** `whatsapp_style/{contactPhone}`:
```typescript
{
  analyzedAt: timestamp,
  messageCount: number,           // how many messages analyzed
  confidence: number,             // 0-1 how sure Beatrice is
  relationshipType: string,       // inferred: 'client' | 'friend' | 'supplier' | 'family' | 'unknown'
  patterns: {
    greeting: string[],           // ["hey", "what's up", "yo"]
    signoff: string[],            // ["cheers", "thanks bro", "later"]
    avgMessageLength: number,    // chars
    emojiFrequency: number,      // emojis per message
    emojiFingerprint: string[],   // exact emojis boss uses with this person: ["👍", "😂", "👌"]
    capitalizationStyle: 'upper' | 'lower' | 'mixed' | 'title'
    questionRatio: number,       // 0-1 how often user asks questions
    abbreviationUsage: string[],
    slangUsage: string[],
    commonPhrases: string[],     // phrases that appear repeatedly
    sentenceStyle: 'short' | 'medium' | 'long' | 'variable',
    toneStyle: 'casual' | 'professional' | 'warm' | 'direct' | 'diplomatic',
    typingRhythm: 'word_by_word' | 'burst' | 'mixed' | 'long_form',
    ellipsisUsage: 'always' | 'sometimes' | 'never',
    punctuationStyle: 'minimal' | 'normal' | 'expressive',
    vulgarLanguageUsage: 'never' | 'sometimes' | 'frequently',  // does boss curse with this person?
    vulgarLanguageFingerprint: string[],  // exact words: ["fuck", "shit", "bitch", "ass", "damn"]
  },
  dealBreakers: string[],         // phrases/styles boss NEVER uses
  dealBreakers: string[],         // phrases/styles boss NEVER uses
  responseTemplates: [
    { context: string, template: string },
  ],
  sampleMessages: string[]        // raw samples for reference
}
```

**Beatrice Communication Style — No AI Jargon:**

Beatrice NEVER says things like "How may I assist you today" or "I understand" or "As an AI language model."

Instead she talks like a sharp, loyal assistant who knows the boss well:

| Instead of... | She says... |
|---|---|
| "How may I help you?" | "What's up boss?" |
| "I've analyzed the message" | "I checked it out" |
| "Would you like me to proceed?" | "Want me to handle it?" |
| "I understand" | "Got it" |
| "I can do that" | "On it" |
| "Should I send this message?" | "Ready to send — say the word" |
| "I don't have permission" | "Can't do that yet — need your say-so" |
| "An error occurred" | "Something went wrong, boss" |

**Beatrice Personality:**
- Calls user "boss" naturally
- Speaks in short, direct sentences
- Confident but always checks before acting on new contacts
- References specific things: "Sarah always texts late at night — should I respond in your late-night style?"
- Never sounds robotic or formal

### 4. Campaign Manager

**Purpose:** Create, schedule, and monitor broadcast campaigns.

**Campaign Creation Flow:**
1. User clicks "Create Campaign" → modal opens
2. Step 1: Name the campaign, select contacts (multi-select from contact list, or "all contacts")
3. Step 2: Write message template (supports {{contactName}} placeholder)
4. Step 3: Choose send time — "Send now" or "Schedule for later"
5. Step 4: Review and confirm

**Campaign States:**
- `draft` — saved but not sent
- `scheduled` — queued for future send
- `sending` — actively dispatching messages
- `completed` — all messages sent
- `failed` — some messages failed (show error count)

**Auto-Responder Rules:**
- Trigger: keyword match OR contact match OR "always"
- Action: send predefined response, or attach campaign
- Can be toggled on/off per rule

### 5. Beatrice AI Tools (Function Calling with Permission Gates)

**Every function checks user permissions before executing.** If permission is disabled, Beatrice tells the user she can't do that action and asks them to enable it.

**Functions exposed to Gemini:**

```typescript
// Read operations (permission: Read messages)
whatsapp_get_contacts() → Contact[]
whatsapp_get_conversation(phone: string, limit?: number) → Message[]
whatsapp_get_unread_count() → number
whatsapp_search_messages(query: string) → Message[]
whatsapp_get_style(contactPhone: string) → StyleProfile

// Write operations (permission: Send messages)
whatsapp_send_message(phone: string, text: string) → void  // shows preview first
whatsapp_reply_to_message(messageId: string, text: string) → void

// Auto-respond (permission: Auto-respond — Beatrice prompts if off)
whatsapp_check_and_respond(phone: string) → { shouldRespond: boolean, draft: string, style: StyleProfile }

// Style learning (permission: Learn style)
whatsapp_learn_style(contactPhone: string) → StyleProfile
whatsapp_force_learn_style(contactPhone: string) → StyleProfile  // bypasses confidence threshold

// Campaign operations (permission: Create campaigns)
whatsapp_create_campaign(name: string, contacts: string[], message: string, scheduledAt?: string) → campaignId
whatsapp_get_campaign_status(campaignId: string) → CampaignStatus

// Call operations (permission: Make calls)
whatsapp_initiate_call(phone: string) → void
whatsapp_end_call(phone: string) → void

// Autoresponder operations (permission: Auto-reply rules)
whatsapp_create_autoresponder(rule: AutoresponderRule) → ruleId
whatsapp_toggle_autoresponder(ruleId: string, active: boolean) → void

// Permission management
whatsapp_get_permissions() → Permissions
whatsapp_update_permission(permission: string, enabled: boolean) → void
```

**Permission Check Flow:**

```
User request → Beatrice checks permission → If OFF → Beatrice says "Can't do that yet boss, need you to turn on [permission] in settings"
                                                          → If ON → Beatrice executes → Reports result
```

**Auto-respond Special Flow:**

When "Auto-respond" is ON, Beatrice:
1. Receives new message from contact
2. Loads style profile for that contact
3. Drafts response mimicking user's style
4. Sends immediately (no confirmation)
5. Logs action: "Auto-replied to [contact]: [message preview]"

When "Auto-respond" is OFF, Beatrice always asks first.

---

## User Flows

### Flow 0: Permission Setup (First Time Connect)

1. User scans QR, connects WhatsApp
2. Beatrice immediately says: "Boss, your WhatsApp is live. I've got the keys — but you control what I can do."
3. Permissions panel shown with all toggles
4. Beatrice walks through each: "Auto-respond's off by default so you stay in control. Send messages is off too. Call access is off. Want me to learn your chat style? That one's on by default — I'll pick up how you talk to each person."
5. User configures → Beatrice confirms: "All set. I'll ask before I do anything unless you tell me otherwise."

### Flow 1: Connect WhatsApp

1. User navigates to WhatsApp panel
2. Clicks "Connect WhatsApp"
3. Server generates QR via Baileys, returns base64 image
4. User scans with phone WhatsApp app
5. Connection established → status updates to "connected"
6. Contacts sync automatically via Baileys events
7. Dashboard populates with contact list

### Flow 2: Beatrice Handles Incoming Message

1. Client sends message on WhatsApp
2. Baileys receives message → stored in Firestore
3. Beatrice (Gemini) is notified of new message
4. Beatrice interrupts user: "Boss, [name] ([phone]) messaged: [preview]"
5. User responds: "yes, respond with empathy, be brief"
6. Beatrice analyzes style profile for that contact
7. Beatrice drafts response, shows preview
8. User clicks "Send" or "Edit first"
9. If sent: Baileys sends message, logged as outgoing

### Flow 3: Create Campaign

1. User clicks "Create Campaign" on contact view
2. Modal: enter name, select contacts (checkboxes), write message
3. User clicks "Schedule" or "Send Now"
4. Campaign saved to Firestore with status
5. Server processes sending via Baileys broadcast
6. Status updates in real-time (sending → completed/failed)
7. User sees delivery report

### Flow 4: Initiate Call

1. User in conversation view, clicks "Call" button
2. Beatrice asks: "Start voice call with [contact]?"
3. User confirms
4. Baileys initiates WhatsApp voice call
5. Call state tracked (ringing, active, ended)
6. User receives call notification in app

---

## API Endpoints

```
GET  /api/whatsapp/status          → { connected, phone, name, qrBase64 }
POST /api/whatsapp/connect         → starts Baileys session, returns QR
POST /api/whatsapp/disconnect       → ends session, clears auth
GET  /api/whatsapp/contacts        → contact list
GET  /api/whatsapp/conversations/:phone → messages with contact
POST /api/whatsapp/send            → { phone, text } → sends via Baileys
POST /api/whatsapp/campaigns        → { name, contacts, message, scheduledAt }
GET  /api/whatsapp/campaigns/:id    → campaign status
GET  /api/whatsapp/style/:phone    → style profile for contact
POST /api/whatsapp/style/learn/:phone → triggers style analysis
POST /api/whatsapp/autoresponders  → create autoresponder rule
GET  /api/whatsapp/autoresponders  → list rules
PATCH /api/whatsapp/autoresponders/:id → toggle active state
```

---

## Tech Stack

- **Baileys** (`@whiskeysockets/baileys`) — WhatsApp Web protocol implementation
- **QRCode** (`qrcode`) — QR generation for terminal/URL display
- **Firebase Firestore** — message storage, session state, style profiles, campaigns
- **Gemini** — Beatrice AI brain (already integrated via `genai-live-client.ts`)
- **Zustand** — UI state management (extend existing `useTools` store)

---

## File Structure

```
lib/
  whatsapp-manager.ts     → existing, extend with campaign/autorresponder logic
  whatsapp-style.ts      → style learning engine
  whatsapp-campaigns.ts  → campaign creation and scheduling
  whatsapp-api.ts        → Express route handlers

components/
  WhatsAppPanel.tsx      → main dashboard container
  QRScanner.tsx          → QR display and connection UI
  ContactList.tsx        → sidebar contact list
  ConversationView.tsx   → message thread display
  CampaignModal.tsx      → campaign creation wizard
  AutoresponderModal.tsx → rule creation UI
  BeatriceToast.tsx      → interruption notifications

hooks/
  useWhatsAppSession.ts  → session state management
  useWhatsAppContacts.ts → contact list fetching
  useWhatsAppMessages.ts → conversation loading
```

---

## Status: Ready for Implementation

Design updated with:
- **Permission toggles** with per-action gates (write actions default OFF)
- **Deep style learning** — greeting patterns, sign-offs, slang, emoji usage, response templates, confidence scoring
- **Think Like The User** — Beatrice's 8-step response process: loads history → applies patterns → asks "would boss send this?" → confidence-based approval
- **Unsensored voice** — vulgar/profanity fingerprint per contact, no automatic filtering, "fuck" stays "fuck" when boss says it
- **Vulgar language fingerprint** — which contacts get unsensored boss (["fuck", "shit", "bitch"]) vs filtered boss (zero profanity) — critical for authentic mimicking
- **Deal-breakers detection** — what phrases/styles boss NEVER uses, flagged in style profile
- **Relationship inference** — client vs friend vs supplier vs family, inferred from chat content, affects tone choice
- **Beatrice voice** — no AI jargon, speaks like a sharp loyal assistant ("On it", "Got it boss", "Want me to handle it?")
- **Message direction** — `beatrice_auto` vs `beatrice_approved` to track how each was sent
- **Permission check flow** — every function call verifies permission first
- **Flow 0: Permission setup** — Beatrice walks user through all permissions on first connect