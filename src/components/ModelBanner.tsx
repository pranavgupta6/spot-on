import { useEffect } from 'react';
import useModelLoader from '../hooks/useModelLoader';
import { MODELS } from '../runanywhere';

interface ModelBannerProps {
  modelId: string;
  modelName: string;
  description: string;   // e.g. "Required for skin scanning"
  onReady: () => void;
  autoLoad?: boolean;    // If true, automatically start downloading on mount
}

export function ModelBanner({ modelId, modelName, description, onReady, autoLoad = false }: ModelBannerProps) {
  const { state, downloadAndLoad } = useModelLoader(modelId);

  // Find the model to get memory requirement
  const model = MODELS.find(m => m.id === modelId);
  const sizeInMB = model?.memoryRequirement ? Math.round(model.memoryRequirement / 1_000_000) : 0;

  // Auto-load on mount if autoLoad is true
  useEffect(() => {
    if (autoLoad && state.status === 'idle') {
      downloadAndLoad();
    }
  }, [autoLoad, state.status, downloadAndLoad]);

  // Call onReady when model becomes ready
  useEffect(() => {
    if (state.status === 'ready') {
      onReady();
    }
  }, [state.status, onReady]);

  if (state.status === 'ready') {
    return null; // Hide banner when ready
  }

  return (
    <div className="card animate-slideUp" style={{ margin: '16px' }}>
      {state.status === 'checking' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="animate-spin"
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%'
            }}
          />
          <span>Checking for cached model...</span>
        </div>
      )}

      {state.status === 'idle' && (
        <>
          {/* Top row: model name + size badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontWeight: 600 }}>{modelName}</div>
            <div className="badge badge-blue">~{sizeInMB} MB</div>
          </div>

          {/* Description */}
          <div style={{
            color: 'var(--color-text-muted)',
            fontSize: '13px',
            margin: '8px 0'
          }}>
            {description}
          </div>

          {/* Important notice about internet requirement */}
          <div style={{
            background: 'rgba(79,142,247,0.1)',
            borderLeft: '3px solid var(--color-primary)',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '13px',
            margin: '12px 0',
            lineHeight: 1.5
          }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--color-primary)' }}>
              ⚠️ First-time download requires internet
            </div>
            <div style={{ color: 'var(--color-text-muted)', fontSize: '12px' }}>
              Keep WiFi connected during initial download. After that, works 100% offline.
            </div>
          </div>

          {/* Download button */}
          <button className="btn btn-primary w-full" onClick={downloadAndLoad}>
            📥 Download Model (~{sizeInMB} MB)
          </button>

          {/* Small note */}
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-dim)',
            textAlign: 'center',
            marginTop: '8px'
          }}>
            Downloaded once · Cached forever · Works offline after
          </div>
        </>
      )}

      {state.status === 'downloading' && (
        <>
          <div style={{ fontWeight: 600, marginBottom: '12px' }}>
            Downloading {modelName}...
          </div>

          {/* Progress bar */}
          <div style={{
            background: 'var(--color-surface-2)',
            borderRadius: '999px',
            height: '8px',
            overflow: 'hidden',
            margin: '12px 0'
          }}>
            <div style={{
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))',
              height: '100%',
              borderRadius: '999px',
              width: state.progress + '%',
              transition: 'width 300ms ease'
            }} />
          </div>

          <div style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            marginBottom: '12px'
          }}>
            {state.progress}% complete
          </div>

          {/* WiFi warning */}
          <div style={{
            background: 'rgba(251,191,36,0.1)',
            borderLeft: '3px solid var(--color-warning)',
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'start',
            gap: '8px'
          }}>
            <span style={{ fontSize: '16px' }}>📡</span>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: '2px' }}>
                Keep WiFi connected
              </div>
              <div style={{ color: 'var(--color-text-muted)' }}>
                If interrupted, download will fail and need to restart. Model only caches after 100% completion.
              </div>
            </div>
          </div>
        </>
      )}

      {state.status === 'loading' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            className="animate-spin"
            style={{
              width: '20px',
              height: '20px',
              border: '2px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%'
            }}
          />
          <div>
            <div>Loading model into memory...</div>
            {state.isCached && (
              <div style={{
                fontSize: '12px',
                color: 'var(--color-accent)',
                marginTop: '4px'
              }}>
                ✓ Using cached model · No download needed
              </div>
            )}
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '8px' }}>
            ⚠️ {state.error?.includes('fetch') || state.error?.includes('network') || state.error?.includes('Failed to fetch') 
              ? 'Network error during download' 
              : 'Download failed'}
          </div>

          <div style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            margin: '8px 0'
          }}>
            {state.error}
          </div>

          {(state.error?.includes('fetch') || state.error?.includes('network') || state.error?.includes('Failed to fetch')) && (
            <div style={{
              background: 'rgba(248,113,113,0.1)',
              borderLeft: '3px solid var(--color-danger)',
              padding: '10px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              margin: '12px 0',
              lineHeight: 1.5,
              color: 'var(--color-text-muted)'
            }}>
              <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--color-danger)' }}>
                Internet connection required
              </div>
              Make sure you have a stable WiFi or data connection, then click Retry. 
              The model must download completely before it can work offline.
            </div>
          )}

          <button className="btn btn-secondary" onClick={downloadAndLoad}>
            🔄 Retry Download
          </button>
        </>
      )}
    </div>
  );
}