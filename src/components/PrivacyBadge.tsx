import { useState } from 'react';

interface PrivacyBadgeProps {
  className?: string;
}

export function PrivacyBadge({ className = "" }: PrivacyBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px 12px',
          background: showTooltip ? 'rgba(52,211,153,0.18)' : 'rgba(52,211,153,0.1)',
          border: '1px solid rgba(52,211,153,0.25)',
          borderRadius: 'var(--radius-full)',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: '600',
          color: 'var(--color-accent)',
          transition: 'var(--transition)'
        }}
      >
        🔒 On-device
      </div>

      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: '0',
            width: '220px',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 12px',
            fontSize: '12px',
            color: 'var(--color-text-muted)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 200
          }}
        >
          All AI runs locally in your browser. Your photos and voice are never uploaded to any server.
        </div>
      )}
    </div>
  );
}