# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start Expo dev server
npx expo start

# Platform-specific
npx expo start --android
npx expo start --ios

# Tests
npm test
npm run test:coverage
```

## Architecture Overview

Expo SDK 54 / React Native 0.81.5 app. No new architecture (Hermes JS engine — note: `Symbol.asyncIterator` is not supported, so async iterators/streaming iterables from AWS SDKs will fail).

### Auth & User Flow

Auth is handled entirely via `amazon-cognito-identity-js` (NOT Amplify Auth). The custom `SyncStorage` wrapper (`src/utils/syncStorage.js`) provides synchronous reads required by the Cognito SDK, backed by an in-memory mirror hydrated from AsyncStorage on app boot.

**AppNavigator** dispatches by role after auth init:
```
Unauthenticated → AuthNavigator (Login → Signup → Verify → ForgotPassword)
No role         → RoleSelectScreen
role=admin      → AdminNavigator
role=creator    → CreatorNavigator → MainTabs (Home | Chat | Profile)
role=member     → MemberNavigator (Profile only)
```

New users without a `custom:role` Cognito attribute are auto-assigned `creator` in `authStore.js`.

### State Management

Single `AuthProvider` (React Context + `useReducer`) in `src/store/authStore.js`. Access via `useAuth()`. User shape: `{ username, displayName, role }`.

### AWS / Bedrock

Direct Bedrock calls (no backend required) via Identity Pool credential exchange:
1. Get Cognito ID token from `amazon-cognito-identity-js` session
2. Exchange via `CognitoIdentityClient` (GetId → GetCredentialsForIdentity)
3. Call `BedrockRuntimeClient.send(new ConverseCommand(...))` — use `ConverseCommand` only, not `ConverseStreamCommand` (Hermes incompatibility)

Model: `us.amazon.nova-pro-v1:0`  
Identity Pool ID lives in `src/config/aws.js` as `identityPoolId`.

### Data Persistence

All creator data (assessment answers, chat history) is stored in AsyncStorage, namespaced per user:
```js
storageKey(username, KEYS.assessmentAnswers)  // → "user@email.com:assessment_answers"
storageKey(username, KEYS.chatHistory)         // → "user@email.com:chat_history"
```
`storageKey` and `KEYS` are in `src/utils/userStorage.js`.

### Adaptive Onboarding (`FamilyAssessmentScreen`)

Questions are **not a static array** — they branch based on prior answers. Key exports:
- `QUESTION_BANK` — object of all question definitions, each with `type: 'mcq' | 'text'`
- `getQuestionSequence(answers)` — returns the ordered array of question keys to show (max 10)

Branching logic: number of children drives child-detail questions; living situation drives meeting-frequency question.

System prompt in `ChatScreen.buildSystemPrompt(answers)` reads named answer keys (`q_children_count`, `q_child1_name`, `q_living_with`, etc.) — not a loop over a question array.

### Chat Opening Message

On first chat open (no saved history), `ChatScreen` automatically triggers a personalised opening message from the clone via a hidden Bedrock call. The trigger message is never persisted — only the clone's response is stored as the first message.

### Navigation Notes

- **`MainTabNavigator`**: Chat tab is hidden (`tabBarButton: () => null`) until `assessmentAnswers` exists in AsyncStorage. Uses `useFocusEffect` to re-check on every tab focus.
- **`CreatorNavigator`**: Stack with `FamilyAssessment` (full-screen, no tab bar) → `MainTabs`.
- **Back navigation**: never call `navigation.replace()` in a way that removes `MainTabs` from the stack (causes GO_BACK crash on retake). Use `navigation.navigate()` instead.

### Theme

All design tokens in `src/theme/`:
- `colors.js` — semantic tokens (primary, gradientStart/End, surface, border, textPrimary/Secondary/Muted, etc.)
- `typography.js` — `typography.xs/sm/base/md/lg/xl` are **font size numbers**, not style objects. Preset style objects: `typography.bodySmall`, `typography.headingMedium`, etc.
- `spacing.js` — `spacing[N]` where N is a multiple of 4 (base unit). Also exports `radius` and `shadows`.

### Key Config

`src/config/aws.js` — Cognito User Pool config + Identity Pool ID  
`src/config/apiConfig.js` — Backend API base URL (env var `EXPO_PUBLIC_API_URL`, default `localhost:8000`)  
`src/config/adminConfig.js` — Hardcoded admin email fallback

### Path Aliases (babel)

`@screens`, `@components`, `@navigation`, `@services`, `@store`, `@theme`, `@utils`, `@config` all map to their `src/` subdirectories.

### Services

| File | Purpose |
|------|---------|
| `authService.js` | Cognito operations (signUp, signIn, signOut, setUserRole, etc.) — all return `{ data, error }` |
| `bedrockService.js` | `streamCloneResponse(systemPrompt, messages, onChunk)` — wraps Converse API |
| `apiService.js` | Axios client with Cognito JWT interceptor (for backend calls) |
| `familyService.js` | Family group CRUD, persona synthesis via backend |
| `cloneService.js` | Clone CRUD + knowledge ingestion via backend |
| `voiceService.js` | WebSocket voice session (backend-dependent) |

### MVP Branch vs Main

The `mvp` branch operates without any backend server. It uses only Cognito + direct Bedrock. Screens registered in `CreatorNavigator` on this branch: `FamilyAssessment` + `MainTabs` only. Other screens (CloneTypeSelect, CreatorOnboarding, PersonalClone, FamilyManagement, ManageClone, Interaction, JoinFamily) exist as files but are not registered.
