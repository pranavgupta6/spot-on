import { useEffect } from 'react';
import useModelLoader from '../hooks/useModelLoader';
import { MODELS } from '../runanywhere';

interface ModelBannerProps {
  modelId: string;
  modelName: string;
  description: string;   // e.g. "Required for skin scanning"
  onReady: () => void;
}

export function ModelBanner({ modelId, modelName, description, onReady }: ModelBannerProps) {
  const { state, downloadAndLoad } = useModelLoader(modelId);

  // Find the model to get memory requirement
  const model = MODELS.find(m => m.id === modelId);
  const sizeInMB = model?.memoryRequirement ? Math.round(model.memoryRequirement / 1_000_000) : 0;

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

          {/* Download button */}
          <button className="btn btn-primary w-full" onClick={downloadAndLoad}>
            Download & Load Model
          </button>

          {/* Small note */}
          <div style={{
            fontSize: '12px',
            color: 'var(--color-text-dim)',
            textAlign: 'center',
            marginTop: '8px'
          }}>
            ⚡ Downloaded once · Cached in browser · Works offline after
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
            color: 'var(--color-text-muted)'
          }}>
            {state.progress}% — please keep this tab open
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
          <span>Loading model into memory...</span>
        </div>
      )}

      {state.status === 'error' && (
        <>
          <div style={{ color: 'var(--color-danger)', fontWeight: 600, marginBottom: '8px' }}>
            ⚠️ Download failed
          </div>

          <div style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            margin: '8px 0'
          }}>
            {state.error}
          </div>

          <button className="btn btn-secondary" onClick={downloadAndLoad}>
            Retry
          </button>
        </>
      )}
    </div>
  );
}