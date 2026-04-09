# Family Clone Platform — Creator Onboarding & Family Access

## Context
The core product value is a deeply personal AI clone that behaves and speaks like the real person. To achieve that, creators need a guided onboarding questionnaire that captures their personality, values, family structure, and life story. The questionnaire answers feed directly into the clone's knowledge base and persona prompt. Family members are then invited via email; they can only interact with their family's clone. This transforms the app from a generic multi-clone browser into a private family experience.

**Key design decisions:**
- Multi-family platform: many creators can each have their own family
- Family join: email invite → 8-char invite code sent to member's email
- Questionnaire: typed text answers + mic button to speak (transcribed via existing STT)
- Family members see only their family's clone — fully private

---

## New Roles
Replace the hardcoded `ADMIN_EMAIL` binary with Cognito custom attribute `custom:role`:
| Role | Who | What they see |
|------|-----|--------------|
| `creator` | The person being cloned | Their own clone management + family management |
| `member` | Invited family member | Only their family's clone interaction screen |
| `platform_admin` | Platform operator | All clones (existing admin behavior) |

---

## Backend: New Models

### `backend/app/models/family.py`
```python
class Family(Base):
    id           = Column(String(36), primary_key=True)
    name         = Column(String(200))          # e.g. "The Johnson Family"
    creator_email= Column(String(200))          # Cognito email of the creator
    clone_id     = Column(String(36), ForeignKey("clones.id"))
    created_at   = Column(DateTime)
```

### `backend/app/models/family_member.py`
```python
class FamilyMember(Base):
    id           = Column(String(36), primary_key=True)
    family_id    = Column(String(36), ForeignKey("families.id"))
    email        = Column(String(200))          # invited email
    user_email   = Column(String(200), nullable=True)  # set when they accept
    role         = Column(String(50))           # "creator" | "member"
    invite_code  = Column(String(8))            # 8-char code sent via email
    accepted_at  = Column(DateTime, nullable=True)
    created_at   = Column(DateTime)
```

### Update `backend/app/models/clone.py`
- Add `creator_email = Column(String(200))` — which creator owns this clone

---

## Backend: New API Endpoints

### `backend/app/api/v1/routes/families.py` (new file)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/families` | creator JWT | Create family + link clone |
| `GET` | `/families/mine` | creator JWT | Get my family + members |
| `POST` | `/families/invite` | creator JWT | Invite member by email (sends code via SES) |
| `DELETE` | `/families/members/{id}` | creator JWT | Remove a member |
| `POST` | `/families/join` | member JWT | Accept invite using code |
| `GET` | `/families/my-clone` | member JWT | Get the family clone this member belongs to |

### Update `backend/app/api/v1/routes/clones.py`
- `GET /clones` — if `creator` role: return only their own clone; if `member` role: return the family's clone

---

## Backend: New Services

### `backend/app/services/email.py` (new)
- `send_invite_email(to_email, creator_name, family_name, invite_code)` using `boto3` SES client
- Simple HTML email with the 8-character invite code and app download instructions
- Requires `SES_SENDER_EMAIL` in `.env`

### `backend/app/services/persona_synthesis.py` (new)
- `synthesize_persona(answers: dict) -> str`
- Calls Bedrock Converse API with the questionnaire answers
- Returns a rich `persona_prompt` string (first-person, 200-300 words)
- Also returns `knowledge_text` — all Q&A answers formatted for ChromaDB ingestion

---

## Mobile: New Screens

### `RoleSelectScreen.js`
Shown once after first signup. Two large cards:
- **"Create My Clone"** — I want my family to interact with a version of me
- **"Join a Family"** — I was invited by a family member

### `CreatorOnboardingScreen.js`
Multi-step questionnaire (5 categories, 4 questions each). Progress bar at top.
Each question has a multiline TextInput + mic button (records → transcribes → fills field).
All 20 answers submitted together on the final step.

**Step 1 — About You**
1. What is your full name and what do people call you?
2. Describe your profession and career journey in your own words.
3. Where did you grow up and how did that shape who you are?
4. What is your educational background?

**Step 2 — Your Family**
5. Tell me about your spouse or partner.
6. How many children do you have? Tell me their names, ages, and something special about each one.
7. What family traditions are most important to you?
8. Share a favourite family memory.

**Step 3 — Values & Life Philosophy**
9. What are your top 3 core values and why do they matter to you?
10. What is the most important life lesson you have learned?
11. How do you handle adversity? What advice would you give about it?
12. What do you want your legacy to be?

**Step 4 — Personality & Communication**
13. How would your family describe you in 3 words?
14. What topics do you love discussing most?
15. How do you typically show love and care to your family?
16. Describe your sense of humor — share a joke or funny story.

**Step 5 — Wisdom for Your Family**
17. What advice would you give your children about relationships and love?
18. What do you wish you had known at 20 that you know now?
19. What are your hopes and dreams for your family's future?
20. Is there anything else you want your family to know and remember about you?

**On submission:**
1. Call Bedrock to synthesize `persona_prompt` from answers
2. Call `POST /clones` with synthesized persona
3. Ingest all Q&A answers into ChromaDB knowledge base
4. Call `POST /families` to create the family record
5. Navigate to `FamilyManagementScreen`

### `FamilyManagementScreen.js`
- Family name, creator's clone info
- List of invited members (email + status: pending / joined)
- "Invite Member" button → modal with email input → calls `POST /families/invite`
- Shows 8-char invite code inline (shareable via WhatsApp, message, etc.)
- Remove member button

### `JoinFamilyScreen.js`
Shown to `member` role users who haven't accepted an invite yet.
- Large input for 8-char invite code
- "Join Family" → calls `POST /families/join`
- On success → navigates to `InteractionScreen` with the family's clone

---

## Mobile: Navigation Changes

### `AppNavigator.js`
```
isAuthenticated:
  role === 'platform_admin' → AdminNavigator (existing)
  role === 'creator'        → CreatorNavigator (new)
  role === 'member'         → MemberNavigator (new)
  role === null/undefined   → RoleSelectScreen (first-time user)
```

### `CreatorNavigator.js` (new)
```
Stack: FamilyManagement → ManageClone → Interaction → Profile
```

### `MemberNavigator.js` (new)
```
Stack: JoinFamily (if no family yet) → Interaction → Profile
```

### `authStore.js`
- Read role from Cognito `custom:role` attribute instead of email comparison

### `authService.js`
- Add `setUserRole(role)` using `updateAttributes` to write `custom:role` to Cognito

---

## Files Changed Summary

| File | Change |
|------|--------|
| `backend/app/models/family.py` | New — Family + FamilyMember ORM |
| `backend/app/models/clone.py` | Add `creator_email` field |
| `backend/app/models/schemas.py` | Add family schemas |
| `backend/app/api/v1/routes/families.py` | New — 6 endpoints |
| `backend/app/api/v1/routes/clones.py` | Filter clones by creator_email / family |
| `backend/app/services/email.py` | New — AWS SES invite email |
| `backend/app/services/persona_synthesis.py` | New — Bedrock persona generation |
| `backend/app/main.py` | Register families router |
| `backend/.env.example` | Add `SES_SENDER_EMAIL` |
| `mobile/src/screens/RoleSelectScreen.js` | New |
| `mobile/src/screens/CreatorOnboardingScreen.js` | New — 20-question stepper with voice |
| `mobile/src/screens/FamilyManagementScreen.js` | New |
| `mobile/src/screens/JoinFamilyScreen.js` | New |
| `mobile/src/navigation/AppNavigator.js` | Add creator/member/null branches |
| `mobile/src/navigation/CreatorNavigator.js` | New |
| `mobile/src/navigation/MemberNavigator.js` | New |
| `mobile/src/store/authStore.js` | Role from Cognito custom attribute |
| `mobile/src/services/authService.js` | Add setUserRole, read custom:role |

---

## Implementation Order
1. Backend models (Family, FamilyMember) + families routes + persona synthesis service
2. Role storage in Cognito (`custom:role`) + authStore update
3. RoleSelectScreen + authService.setUserRole
4. CreatorOnboardingScreen (text first, mic second)
5. FamilyManagementScreen + invite flow (email via SES)
6. JoinFamilyScreen + member access control on clone endpoints
7. CreatorNavigator + MemberNavigator + AppNavigator routing update

---

## Verification Checklist
- [ ] Sign up as new user → RoleSelectScreen appears → tap "Create My Clone"
- [ ] Complete all 20 questions (mix typing and speaking into mic)
- [ ] Clone created, persona_prompt auto-generated from answers
- [ ] FamilyManagementScreen appears — invite a second email
- [ ] Invitee receives email with code → signs up → enters code → lands on InteractionScreen
- [ ] Clone responds with personality from questionnaire answers
- [ ] Creator logs back in → sees member listed as "joined"
- [ ] Uninvited account sees no clone / blocked
