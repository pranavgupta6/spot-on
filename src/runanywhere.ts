/**
 * RunAnywhere SDK initialization and model catalog for SpotOn.
 *
 * This module handles:
 * 1. SDK initialization with proper environment setup
 * 2. Model registration for all SpotOn AI features
 * 3. VLM worker wiring for skin analysis
 */

import {
  RunAnywhere,
  SDKEnvironment,
  ModelManager,
  ModelCategory,
  LLMFramework,
} from '@runanywhere/web';

import { LlamaCPP, VLMWorkerBridge } from '@runanywhere/web-llamacpp';

// @ts-ignore — Vite-specific ?worker&url syntax
import vlmWorkerUrl from './workers/vlm-worker?worker&url';

// ---------------------------------------------------------------------------
// Model catalog for SpotOn
// ---------------------------------------------------------------------------

export const MODELS: Array<{
  id: string
  name: string
  repo: string
  files: string[]
  framework: LLMFramework
  modality: ModelCategory
  memoryRequirement: number
}> = [
  // Model 1 — LLM for Chat
  {
    id: 'lfm2-350m',
    name: 'LFM2 350M (Chat)',
    repo: 'runanywhere/LFM2-350M-Instruct-GGUF',
    files: ['LFM2-350M-Instruct-Q4_K_M.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Language,
    memoryRequirement: 350_000_000,
  },

  // Model 2 — VLM for Vision Analysis
  {
    id: 'lfm2-vl-450m-q4_0',
    name: 'LFM2-VL 450M (Vision)',
    repo: 'runanywhere/LFM2-VL-450M-GGUF',
    files: ['LFM2-VL-450M-Q4_0.gguf', 'mmproj-LFM2-VL-450M-Q8_0.gguf'],
    framework: LLMFramework.LlamaCpp,
    modality: ModelCategory.Multimodal,
    memoryRequirement: 500_000_000,
  },

  // Model 3 — STT for Voice Input
  {
    id: 'whisper-tiny-en',
    name: 'Whisper Tiny (Speech)',
    repo: 'runanywhere/whisper-tiny-en-sherpa-onnx',
    files: ['whisper-tiny-en.tar.bz2'],
    framework: LLMFramework.LlamaCpp, // Placeholder - will fix when we know correct enum
    modality: ModelCategory.SpeechRecognition,
    memoryRequirement: 80_000_000,
  },

  // Model 4 — TTS for Voice Output
  {
    id: 'piper-en-us-amy',
    name: 'Piper Amy TTS',
    repo: 'runanywhere/piper-en-us-amy-sherpa-onnx',
    files: ['piper-en-us-amy.tar.bz2'],
    framework: LLMFramework.LlamaCpp, // Placeholder - will fix when we know correct enum
    modality: ModelCategory.Language, // Placeholder - will use Language until we find TextToSpeech
    memoryRequirement: 60_000_000,
  },
];

// ---------------------------------------------------------------------------
// SDK Initialization
// ---------------------------------------------------------------------------

let _initPromise: Promise<void> | null = null;

/**
 * Initialize the RunAnywhere SDK for SpotOn.
 * Safe to call multiple times - will return the same promise.
 */
export async function initializeSDK(): Promise<void> {
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    try {
      // Step 1: Initialize core SDK
      await RunAnywhere.initialize({
        environment: SDKEnvironment.Development,
        debug: false
      });

      // Step 2: Register LlamaCPP backend
      await LlamaCPP.register();

      // Step 3: Register model catalog
      RunAnywhere.registerModels(MODELS);

      // Step 4: Wire up VLM worker
      VLMWorkerBridge.shared.workerUrl = vlmWorkerUrl;
      RunAnywhere.setVLMLoader({
        get isInitialized() {
          return VLMWorkerBridge.shared.isInitialized;
        },
        init: () => VLMWorkerBridge.shared.init(),
        loadModel: (params) => VLMWorkerBridge.shared.loadModel(params),
        unloadModel: () => VLMWorkerBridge.shared.unloadModel(),
      });

    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`SpotOn SDK initialization failed: ${message}`);
    }
  })();

  return _initPromise;
}

// Re-export convenience items
export { ModelManager, VLMWorkerBridge, ModelCategory };