import { useState, useCallback } from 'react';
import { ModelManager } from '../runanywhere';

export interface ModelLoaderState {
  status: 'idle' | 'downloading' | 'loading' | 'ready' | 'error';
  progress: number;        // 0–100
  error: string | null;
}

export default function useModelLoader(modelId: string) {
  const [state, setState] = useState<ModelLoaderState>({
    status: 'idle',
    progress: 0,
    error: null,
  });

  const downloadAndLoad = useCallback(async (): Promise<void> => {
    try {
      // Step 1: Start downloading
      setState(prev => ({ ...prev, status: 'downloading', progress: 0, error: null }));

      // Step 2: Download the model
      // Note: Checking RunAnywhere docs for progress callback support
      // For now, using a simple progress simulation since we need to verify the actual API
      setState(prev => ({ ...prev, progress: 50 }));
      await ModelManager.downloadModel(modelId);
      setState(prev => ({ ...prev, progress: 100 }));

      // Step 3: Start loading into memory
      setState(prev => ({ ...prev, status: 'loading', progress: 100 }));

      // Step 4: Load the model
      await ModelManager.loadModel(modelId);

      // Step 5: Ready to use
      setState(prev => ({ ...prev, status: 'ready' }));

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage,
      }));
    }
  }, [modelId]);

  return {
    state,
    downloadAndLoad,
  };
}