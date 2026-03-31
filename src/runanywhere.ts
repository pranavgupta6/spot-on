/**
 * RunAnywhere SDK initialization and model catalog for SpotOn.
 *
 * This module handles:
 * 1. SDK initialization with proper environment setup
 * 2. Model registration for all SpotOn AI features
 * 3. VLM worker wiring for skin analysis
 * 4. Cache diagnostics for offline capability
 */

import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
  type CompactModelDef,
} from '@runanywhere/web'
import { LlamaCPP, VLMWorkerBridge } from '@runanywhere/web-llamacpp'
import { ONNX } from '@runanywhere/web-onnx'

// @ts-ignore — Vite-specific ?worker&url syntax
import vlmWorkerUrl from './workers/vlm-worker?worker&url'

// ---------------------------------------------------------------------------
// Model catalog for SpotOn
// ---------------------------------------------------------------------------

export const MODELS: CompactModelDef[] = [
  // LLM for Chat tab — public LiquidAI repo
  {
    id: 'lfm2-350m-q4_k_m',
    name: 'LFM2 350M (Chat)',
    repo: 'LiquidAI/LFM2-350M-GGUF',
    files: ['LFM2-350M-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 250_000_000,
  },

  // VLM — keep existing working model (already cached)
  {
    id: 'lfm2-vl-450m-q4_0',
    name: 'LFM2-VL 450M (Vision)',
    repo: 'runanywhere/LFM2-VL-450M-GGUF',
    files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },

  // STT — public URL with artifactType archive
  {
    id: 'sherpa-onnx-whisper-tiny.en',
    name: 'Whisper Tiny EN (STT)',
    url: 'https://huggingface.co/runanywhere/sherpa-onnx-whisper-tiny.en/resolve/main/sherpa-onnx-whisper-tiny.en.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 105_000_000,
    artifactType: 'archive' as const,
  },

  // TTS — official RunAnywhere repo
  {
    id: 'vits-piper-en_US-lessac-medium',
    name: 'Piper TTS',
    url: 'https://huggingface.co/runanywhere/vits-piper-en_US-lessac-medium/resolve/main/vits-piper-en_US-lessac-medium.tar.gz',
    framework: LLMFramework.ONNX,
    modality: ModelCategory.SpeechSynthesis,
    memoryRequirement: 65_000_000,
    artifactType: 'archive' as const,
  },

  // VAD — required for voice pipeline
  {
    id: 'silero-vad-v5',
    name: 'Silero VAD',
    url: 'https://huggingface.co/runanywhere/silero-vad-v5/resolve/main/silero_vad.onnx',
    files: ['silero_vad.onnx'],
    framework: LLMFramework.ONNX,
    modality: ModelCategory.Audio,
    memoryRequirement: 5_000_000,
  },
]

// ---------------------------------------------------------------------------
// SDK Initialization
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null

/**
 * Initialize the RunAnywhere SDK for SpotOn.
 * Safe to call multiple times - will return the same promise.
 */
export async function initializeSDK(): Promise<void> {
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    try {
      // Step 1: Initialize core SDK
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
        debug: false,
      })

      // Step 2: Register LlamaCPP backend
      await LlamaCPP.register()

      // Step 3: Register ONNX backend for STT/TTS/VAD
      await ONNX.register()

      // Step 4: Register model catalog
      RunAnywhere.registerModels(MODELS)

      // Step 5: Wire up VLM worker
      VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl
      RunAnywhere.setVLMLoader({
        get isInitialized() {
          return VLMWorkerBridge.shared.isInitialized
        },
        init: () => VLMWorkerBridge.shared.init(),
        loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
        unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
      })
    } catch (err) {
      _initPromise = null
      throw new Error(
        'SpotOn SDK initialization failed: ' +
          (err instanceof Error ? err.message : String(err))
      )
    }
  })()

  return _initPromise
}

// ---------------------------------------------------------------------------
// Cache Diagnostics (for debugging offline capability)
// ---------------------------------------------------------------------------

/**
 * Check which models are cached and ready for offline use.
 * Call this from browser console: window.checkModelCache()
 */
export async function checkModelCache() {
  console.log('🔍 Checking model cache status...\n')
  
  for (const model of MODELS) {
    try {
      const isCached = await ModelManager.isModelDownloaded(model.id)
      const sizeMB = Math.round(model.memoryRequirement / 1_000_000)
      
      if (isCached) {
        console.log(`✅ ${model.name} (${model.id}) - CACHED (~${sizeMB}MB)`)
      } else {
        console.log(`❌ ${model.name} (${model.id}) - NOT CACHED (~${sizeMB}MB)`)
      }
    } catch (err) {
      console.error(`⚠️ ${model.name} (${model.id}) - Error checking cache:`, err)
    }
  }
  
  console.log('\n💡 Cached models work 100% offline. Non-cached models need internet to download first.')
}

// Expose cache checker to window for debugging
if (typeof window !== 'undefined') {
  (window as any).checkModelCache = checkModelCache
}

// Re-export convenience items
export { ModelManager, VLMWorkerBridge, ModelCategory, ONNX }