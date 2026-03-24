export interface ScanResult {
  condition: string;
  confidence: 'High' | 'Medium' | 'Low';
  description: string;
  severity: 'Mild' | 'Moderate' | 'Severe';
  recommendations: string[];
  seeDoctor: boolean;
}

interface ScanReportProps {
  result: ScanResult;
  thumbnailDataUrl?: string;
  savedToHistory?: boolean;
  onSaveToHistory: () => void;
  onScanAgain: () => void;
}

export function ScanReport({ result, thumbnailDataUrl, savedToHistory, onSaveToHistory, onScanAgain }: ScanReportProps) {
  // Confidence badge class mapping
  const confidenceBadgeClass = {
    High: 'badge-green',
    Medium: 'badge-yellow',
    Low: 'badge-red'
  };

  // Severity badge class mapping
  const severityBadgeClass = {
    Mild: 'badge-green',
    Moderate: 'badge-yellow',
    Severe: 'badge-red'
  };

  return (
    <div className="card animate-slideUp" style={{ margin: '16px' }}>
      {/* Section 1 — Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{ fontSize: '18px', fontWeight: 700 }}>
          {result.condition}
        </div>
        <div className={`badge ${confidenceBadgeClass[result.confidence]}`}>
          ● {result.confidence} confidence
        </div>
      </div>

      {/* Divider */}
      <hr className="divider" />

      {/* Section 2 — Severity + Doctor row */}
      <div style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        marginBottom: '16px'
      }}>
        <div className={`badge ${severityBadgeClass[result.severity]}`}>
          {result.severity}
        </div>
        {result.seeDoctor ? (
          <div className="badge badge-red">⚠ See a Doctor</div>
        ) : (
          <div className="badge badge-green">✓ Monitor at Home</div>
        )}
      </div>

      {/* Section 3 — Description */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px'
        }}>
          About this condition
        </div>
        <div style={{
          fontSize: '14px',
          color: 'var(--color-text)',
          lineHeight: 1.6
        }}>
          {result.description}
        </div>
      </div>

      {/* Section 4 — Recommendations */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          marginBottom: '6px'
        }}>
          Recommendations
        </div>
        <ul style={{
          listStyle: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          margin: 0,
          padding: 0
        }}>
          {result.recommendations.map((rec, index) => (
            <li key={index} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}>
              <span style={{
                color: 'var(--color-accent)',
                fontWeight: 700,
                flexShrink: 0
              }}>
                ✓
              </span>
              <span style={{ fontSize: '14px' }}>
                {rec}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Section 5 — Thumbnail (only if provided) */}
      {thumbnailDataUrl && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px'
          }}>
            Captured Image
          </div>
          <img
            src={thumbnailDataUrl}
            alt="Captured skin area"
            style={{
              width: '100%',
              borderRadius: 'var(--radius-sm)',
              maxHeight: '200px',
              objectFit: 'cover'
            }}
          />
        </div>
      )}

      {/* Section 6 — Action buttons */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '16px'
      }}>
        <button
          className="btn btn-secondary"
          style={{ flex: 1 }}
          onClick={onSaveToHistory}
          disabled={savedToHistory}
        >
          {savedToHistory ? '✓ Saved!' : '💾 Save to History'}
        </button>
        <button
          className="btn btn-primary"
          style={{ flex: 1 }}
          onClick={onScanAgain}
        >
          🔄 Scan Again
        </button>
      </div>

      {/* Bottom disclaimer */}
      <div style={{
        fontSize: '11px',
        color: 'var(--color-text-dim)',
        textAlign: 'center',
        marginTop: '12px'
      }}>
        SpotOn is not a medical device. Always consult a dermatologist for diagnosis.
      </div>
    </div>
  );
}

export default ScanReport;