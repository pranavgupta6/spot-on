# CLAUDE.md — SpotOn Project Context

> This file is read by Claude Code at the start of every session. Follow all instructions here strictly.

---

## 🔁 Mandatory Workflow Rules (follow after EVERY prompt)

1. **Always check official documentation before implementing any SDK, library, or framework feature.**
   - RunAnywhere Web SDK docs: https://docs.runanywhere.ai/web/introduction
   - If using a new RunAnywhere API (VLM, STT, TTS, VAD, Tool Calling, VoicePipeline), read the relevant doc page before writing any code.
   - For React, Vite, or TypeScript patterns, verify against official docs (react.dev, vitejs.dev, typescriptlang.org).
   - Do not assume API signatures from memory — always verify.

2. **After completing every prompt, run the following and fix ALL errors before considering the task done:**
   ```bash
   npx tsc --noEmit       # TypeScript type checking
   npm run lint           # ESLint
   npm run build          # Vite production build (catches bundler errors)
   ```
   - If `npm run lint` doesn't exist, check `package.json` scripts and use the correct lint command.
   - Fix every TypeScript error, ESLint warning, and build failure — do not leave `// @ts-ignore` unless absolutely unavoidable (and document why).
   - If a type is genuinely unknown from an external SDK, use `unknown` and narrow it properly, not `any`.

3. **Never break existing working functionality.** If a refactor changes behavior, explicitly call it out.

---

## 🏥 Project Overview — SpotOn

**SpotOn** is a privacy-first, on-device AI skin health analyzer built as a web app for the general public. It helps users identify and understand common skin conditions (acne, eczema, rashes, moles, dryness, etc.) using their device camera or uploaded photos.

**Core value proposition:** All AI inference runs 100% locally in the browser via WebAssembly using the RunAnywhere Web SDK. No photos, voice recordings, or personal health data ever leave the user's device. No account required, no API keys needed at runtime.

**Target audience:** General public — anyone curious about a skin spot, rash, or condition who wants a quick, private first look before deciding whether to see a doctor.

**Hackathon requirement:** Must use the RunAnywhere Web SDK (`@runanywhere/web`, `@runanywhere/web-llamacpp`, `@runanywhere/web-onnx`).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript |
| Bundler | Vite |
| AI SDK | RunAnywhere Web SDK (WASM) |
| LLM/VLM backend | `@runanywhere/web-llamacpp` (llama.cpp → WASM) |
| STT/TTS/VAD backend | `@runanywhere/web-onnx` (sherpa-onnx → WASM) |
| Styling | CSS (custom design system in `src/styles/index.css`) |
| Deployment | Vercel (COOP/COEP headers configured in `vercel.json`) |

---

## 📁 Project File Structure

```
spot-on/
├── CLAUDE.md                    ← You are here
├── index.html                   ← Entry HTML, do not add inline scripts here
├── vite.config.ts               ← Vite config — includes worker: { format: 'es' } for VLM worker
├── vercel.json                  ← COOP/COEP headers for SharedArrayBuffer support
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx                 ← React root, mounts <App />
    ├── App.tsx                  ← Top-level layout: Header + tab navigation (Scan | Chat | Voice | History)
    ├── runanywhere.ts           ← SDK initialization, model registry, VLM worker wiring
    ├── workers/
    │   └── vlm-worker.ts        ← VLM Web Worker entry point (calls startVLMWorkerRuntime())
    ├── hooks/
    │   ├── useModelLoader.ts    ← Shared hook: model download + load state management
    │   └── useSkinHistory.ts    ← Hook: read/write scan history to localStorage
    ├── components/
    │   ├── ScanTab.tsx          ← PRIMARY FEATURE: camera capture → VLM skin analysis → structured report
    │   ├── ChatTab.tsx          ← AI derma chat: LLM streaming Q&A about skin concerns
    │   ├── VoiceTab.tsx         ← Voice symptom checker: VAD → STT → LLM → TTS
    │   ├── HistoryTab.tsx       ← Past scan results stored in localStorage
    │   ├── ModelBanner.tsx      ← Download progress bar shown while models are loading
    │   ├── ScanReport.tsx       ← Renders a structured skin analysis report card
    │   └── PrivacyBadge.tsx     ← Small reusable badge: "🔒 On-device · Never uploaded"
    └── styles/
        └── index.css            ← Full design system: CSS variables, typography, components
```

---

## 🎨 Design System

**Brand identity:** Clinical trust meets modern consumer app. Clean, minimal, confident. Not scary or overly medical — approachable.

**Color palette (CSS variables to define in `index.css`):**
```css
--color-bg:           #0d0f12    /* near-black background */
--color-surface:      #161920    /* card/panel background */
--color-surface-2:    #1e2229    /* elevated surface */
--color-border:       #2a2f3a    /* subtle borders */
--color-primary:      #4f8ef7    /* brand blue — primary actions */
--color-primary-dark: #3a6fd4    /* hover state */
--color-accent:       #34d399    /* success/safe green */
--color-warning:      #fbbf24    /* caution yellow */
--color-danger:       #f87171    /* alert red */
--color-text:         #e8eaf0    /* primary text */
--color-text-muted:   #8b92a5    /* secondary/muted text */
--color-text-dim:     #555c6e    /* disabled/placeholder */
```

**Typography:**
- Font: `Inter` (import from Google Fonts in `index.html`)
- Base size: 15px
- Headings: weight 600–700
- Body: weight 400–500

**Key UI principles:**
- Rounded corners everywhere (`border-radius: 12px` for cards, `8px` for buttons/inputs)
- Subtle backdrop blur on modals/overlays
- Smooth transitions (200–300ms ease)
- Mobile-first layout — must work well on phones (this is a health app, users will be on mobile)
- Never show raw JSON to the user — always render structured reports as cards

---

## 🤖 AI Features & SDK Usage

### Feature 1: Skin Scan (ScanTab.tsx) — CORE FEATURE
- Uses **VLM** (`VLMWorkerBridge` + `VideoCapture` from `@runanywhere/web-llamacpp`)
- Model: `lfm2-vl-450m-q4_0` (LFM2-VL 450M — fastest, ~500MB)
- Flow: Camera preview → user taps "Scan" → capture frame at 256px → VLM processes with skin-focused prompt → render ScanReport card
- VLM prompt (embed directly in the prompt, NOT as systemPrompt — VLMWorkerBridge doesn't support systemPrompt):
  ```
  "You are a dermatology assistant. Analyze this skin image and respond ONLY in this exact JSON format with no extra text:
  {
    \"condition\": \"<most likely condition name>\",
    \"confidence\": \"<High|Medium|Low>\",
    \"description\": \"<1-2 sentence plain English description>\",
    \"severity\": \"<Mild|Moderate|Severe>\",
    \"recommendations\": [\"<rec 1>\", \"<rec 2>\", \"<rec 3>\"],
    \"seeDoctor\": <true|false>
  }"
  ```
- Always wrap VLM calls in try/catch — handle `memory access out of bounds` WASM crashes gracefully with a retry message.

### Feature 2: AI Derma Chat (ChatTab.tsx)
- Uses **LLM** (`TextGeneration` streaming from `@runanywhere/web-llamacpp`)
- Model: `lfm2-350m` (text-only LFM2 350M)
- System prompt: "You are SpotOn's AI dermatology assistant. Help users understand skin conditions, symptoms, and when to seek medical care. Be clear, empathetic, and always recommend consulting a doctor for diagnosis. Never diagnose definitively."
- Streaming output — show tokens as they arrive
- Chat history maintained in component state (not persisted)

### Feature 3: Voice Symptom Checker (VoiceTab.tsx)
- Uses **VoicePipeline** from `@runanywhere/web`
- Full STT → LLM → TTS pipeline
- Models: Whisper STT + LFM2 LLM + Piper TTS
- User speaks their symptoms → transcription shown → LLM responds → response spoken aloud
- System prompt: "You are a voice-based skin health assistant. The user is describing their skin symptoms verbally. Listen carefully and give a concise, helpful response in 2-3 sentences max. Always recommend seeing a doctor for anything concerning."

### Feature 4: Scan History (HistoryTab.tsx)
- No AI — pure UI feature
- Stores past ScanReport results in `localStorage` (key: `spoton_history`)
- Each entry: `{ id, timestamp, condition, confidence, severity, seeDoctor, thumbnailDataUrl }`
- Shows a scrollable list of past scans with date, condition name, severity badge
- Allow deleting individual entries or clearing all history

---

## 📦 Model Registry (in runanywhere.ts)

Register these models:

```typescript
// LLM (text only)
{
  id: 'lfm2-350m',
  name: 'LFM2 350M',
  repo: 'runanywhere/LFM2-350M-Instruct-GGUF',
  files: ['LFM2-350M-Instruct-Q4_K_M.gguf'],
  framework: LLMFramework.LlamaCpp,
  modality: ModelCategory.Language,
  memoryRequirement: 350_000_000,
}

// VLM (vision + language)
{
  id: 'lfm2-vl-450m-q4_0',
  name: 'LFM2-VL 450M',
  repo: 'runanywhere/LFM2-VL-450M-GGUF',
  files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
  framework: LLMFramework.LlamaCpp,
  modality: ModelCategory.Multimodal,
  memoryRequirement: 500_000_000,
}

// STT
{
  id: 'whisper-tiny-en',
  name: 'Whisper Tiny EN',
  repo: 'runanywhere/whisper-tiny-en-sherpa-onnx',
  files: ['whisper-tiny-en.tar.bz2'],
  framework: LLMFramework.SherpaOnnx,
  modality: ModelCategory.SpeechRecognition,
  memoryRequirement: 80_000_000,
}

// TTS
{
  id: 'piper-en-us-amy',
  name: 'Piper Amy (EN)',
  repo: 'runanywhere/piper-en-us-amy-sherpa-onnx',
  files: ['piper-en-us-amy.tar.bz2'],
  framework: LLMFramework.SherpaOnnx,
  modality: ModelCategory.TextToSpeech,
  memoryRequirement: 60_000_000,
}
```

---

## ⚠️ Known SDK Gotchas (read before implementing)

1. **VLMWorkerBridge.process() does NOT support `systemPrompt`** — embed instructions directly in the prompt string.
2. **Always wait for camera readiness** before calling `captureFrame()` — listen for `loadedmetadata` event or check `videoElement.videoWidth > 0`. Calling too early causes `getImageData: source width is 0` error.
3. **WASM memory crashes are recoverable** — catch `memory access out of bounds` errors and show a retry UI, don't crash the whole app.
4. **Cross-Origin Isolation is required** — `vercel.json` must set `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` for SharedArrayBuffer to work.
5. **VLM worker uses Vite `?worker&url` syntax** — requires `// @ts-ignore` on that import line. This is expected and documented.
6. **Capture at 256px max** — larger images dramatically slow down VLM encoding in WASM.
7. **Models are large** — show a clear download progress UI (ModelBanner) before any feature is usable. First load can take minutes on slow connections.

---

## 🚀 Deployment

- **Platform:** Vercel
- **Build command:** `npm run build`
- **Output dir:** `dist`
- `vercel.json` must include COOP/COEP headers (already present in starter kit — do not remove)

---

## 🩺 Disclaimer (show in UI)

> SpotOn is not a medical device and does not provide medical diagnoses. Always consult a qualified dermatologist or healthcare provider for any skin concerns. This tool is for informational purposes only.

Show this disclaimer on first launch (dismissible modal) and in small print in the footer.