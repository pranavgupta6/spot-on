import { useState, useCallback, useEffect } from 'react'
import { ModelManager, EventBus } from '@runanywhere/web'

export interface ModelLoaderState {
  status: 'idle' | 'checking' | 'downloading' | 'loading' | 'ready' | 'error'
  progress: number
  error: string | null
  isCached: boolean
}

export default function useModelLoader(modelId: string) {
  const [state, setState] = useState<ModelLoaderState>({
    status: 'idle',
    progress: 0,
    error: null,
    isCached: false,
  })

  // Check if model is already cached on mount
  useEffect(() => {
    const checkCache = async () => {
      try {
        console.log(`[useModelLoader] 🔍 Checking if model "${modelId}" is cached...`)
        setState(prev => ({ ...prev, status: 'checking' }))
        
        // Check if model is already downloaded by finding it in the catalog
        const allModels = ModelManager.getModels()
        const model = allModels.find(m => m.id === modelId)
        
        if (!model) {
          console.error(`[useModelLoader] ❌ Model "${modelId}" not found in catalog`)
          setState({ status: 'error', progress: 0, error: `Model "${modelId}" not registered`, isCached: false })
          return
        }
        
        // Check if model status is Downloaded or Loaded
        const isCached = model.status === 'downloaded' || model.status === 'loaded'
        
        console.log(`[useModelLoader] Cache status for "${modelId}":`, isCached ? '✅ CACHED' : '❌ NOT CACHED', `(status: ${model.status})`)
        
        if (isCached) {
          // Model is cached, skip download and just load it
          console.log(`[useModelLoader] 🚀 Loading "${modelId}" from cache (no download needed)`)
          setState({ status: 'loading', progress: 100, error: null, isCached: true })
          
          await ModelManager.loadModel(modelId, { coexist: true } as any)
          
          console.log(`[useModelLoader] ✅ Model "${modelId}" loaded successfully from cache`)
          setState({ status: 'ready', progress: 100, error: null, isCached: true })
        } else {
          // Model not cached, need to download
          console.log(`[useModelLoader] ⬇️ Model "${modelId}" needs to be downloaded (first time use)`)
          setState({ status: 'idle', progress: 0, error: null, isCached: false })
        }
      } catch (err) {
        // If check fails, assume not cached and allow manual download
        console.warn('[useModelLoader] ⚠️ Cache check failed:', err)
        setState({ status: 'idle', progress: 0, error: null, isCached: false })
      }
    }

    checkCache()
  }, [modelId])

  const downloadAndLoad = useCallback(async () => {
    try {
      console.log(`[useModelLoader] ⬇️ Starting download for "${modelId}"`)
      setState({ status: 'downloading', progress: 0, error: null, isCached: false })

      let lastProgress = -1 // Track last logged progress to avoid duplicates

      // Listen to download progress via EventBus
      const unsub = EventBus.shared.on('model.downloadProgress', (evt: any) => {
        if (evt.modelId === modelId) {
          const pct = Math.round((evt.progress ?? 0) * 100)
          
          // Only update if progress actually changed (prevents glitchy progress bar)
          if (pct !== lastProgress) {
            lastProgress = pct
            console.log(`[useModelLoader] Download progress: ${pct}%`)
            setState(prev => ({ ...prev, progress: pct }))
          }
        }
      })

      await ModelManager.downloadModel(modelId)
      unsub()
      console.log(`[useModelLoader] ✅ Download complete for "${modelId}"`)

      setState({ status: 'loading', progress: 100, error: null, isCached: true })
      console.log(`[useModelLoader] 🚀 Loading "${modelId}" into memory...`)

      // Use coexist: true so multiple models stay in memory (needed for voice)
      await ModelManager.loadModel(modelId, { coexist: true } as any)

      console.log(`[useModelLoader] ✅ Model "${modelId}" ready!`)
      setState({ status: 'ready', progress: 100, error: null, isCached: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[useModelLoader] ❌ Error loading "${modelId}":`, message)
      setState({ status: 'error', progress: 0, error: message, isCached: false })
    }
  }, [modelId])

  return { state, downloadAndLoad }
}