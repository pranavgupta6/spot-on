import useSkinHistory, { ScanHistoryEntry } from '../hooks/useSkinHistory';

export function HistoryTab() {
  const { history, deleteEntry, clearHistory } = useSkinHistory();

  const handleClearAll = () => {
    if (confirm('Delete all scan history?')) {
      clearHistory();
    }
  };

  const handleDelete = (id: string) => {
    deleteEntry(id);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case 'Mild': return 'badge-green';
      case 'Moderate': return 'badge-yellow';
      case 'Severe': return 'badge-red';
      default: return 'badge-green';
    }
  };

  const getConfidenceBadgeClass = (confidence: string) => {
    switch (confidence) {
      case 'High': return 'badge-green';
      case 'Medium': return 'badge-yellow';
      case 'Low': return 'badge-red';
      default: return 'badge-yellow';
    }
  };

  if (history.length === 0) {
    return (
      <div style={{
        padding: '40px 16px',
        textAlign: 'center'
      }}>
        <div style={{
          fontSize: '48px',
          marginBottom: '16px'
        }}>
          🕘
        </div>
        <div style={{
          fontSize: '18px',
          fontWeight: 600,
          marginBottom: '8px'
        }}>
          No scans yet
        </div>
        <div style={{
          color: 'var(--color-text-muted)',
          fontSize: '14px',
          marginTop: '8px',
          lineHeight: 1.5
        }}>
          Your scan history will appear here after you analyze your first skin condition.
        </div>
        <div style={{
          color: 'var(--color-primary)',
          fontSize: '14px',
          marginTop: '16px',
          cursor: 'pointer'
        }}>
          Start Scanning
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 16px 8px'
      }}>
        <div style={{ fontWeight: 600 }}>
          {history.length} scan{history.length !== 1 ? 's' : ''}
        </div>
        <button
          className="btn btn-danger"
          style={{
            fontSize: '12px',
            padding: '6px 12px'
          }}
          onClick={handleClearAll}
        >
          Clear All
        </button>
      </div>

      {/* History entries */}
      <div>
        {history.map((entry) => (
          <div
            key={entry.id}
            className="card animate-fadeIn"
            style={{
              margin: '0 16px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            {/* Top row - condition name, date, delete button */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start'
            }}>
              <div>
                <div style={{
                  fontWeight: 700,
                  fontSize: '16px'
                }}>
                  {entry.condition}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)'
                }}>
                  {formatDate(entry.timestamp)}
                </div>
              </div>

              <button
                onClick={() => handleDelete(entry.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-dim)',
                  fontSize: '18px',
                  cursor: 'pointer',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                ✕
              </button>
            </div>

            {/* Badges row */}
            <div style={{
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap'
            }}>
              {/* Severity badge */}
              <div className={`badge ${getSeverityBadgeClass(entry.severity)}`}>
                {entry.severity}
              </div>

              {/* Confidence badge */}
              <div className={`badge ${getConfidenceBadgeClass(entry.confidence)}`}>
                {entry.confidence} confidence
              </div>

              {/* Doctor recommendation badge */}
              {entry.seeDoctor ? (
                <div className="badge badge-red">⚠ See Doctor</div>
              ) : (
                <div className="badge badge-green">✓ Home care</div>
              )}
            </div>

            {/* Description */}
            {entry.description && (
              <div style={{
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                lineHeight: 1.5,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
                {entry.description}
              </div>
            )}

            {/* Thumbnail */}
            {entry.thumbnailDataUrl && (
              <img
                src={entry.thumbnailDataUrl}
                alt="Scan thumbnail"
                style={{
                  width: '100%',
                  maxHeight: '120px',
                  objectFit: 'cover',
                  borderRadius: 'var(--radius-sm)'
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default HistoryTab;