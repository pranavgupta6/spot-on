import { useState, useEffect } from 'react';
import { initializeSDK } from './runanywhere';
import { PrivacyBadge } from './components/PrivacyBadge';
import { LandingPage } from './components/LandingPage';
import ScanTab from './components/ScanTab';
import ChatTab from './components/ChatTab';
import VoiceTab from './components/VoiceTab';
import HistoryTab from './components/HistoryTab';

type Tab = 'scan' | 'chat' | 'voice' | 'history';

export function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [sdkReady, setSdkReady] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('scan');
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    // Check if user has already visited
    const hasVisited = localStorage.getItem('spoton_has_visited');
    if (hasVisited) {
      setShowLanding(false);
    }

    // Check if disclaimer has been shown before
    const disclaimerSeen = localStorage.getItem('spoton_disclaimer_seen');
    if (!disclaimerSeen && hasVisited) {
      setShowDisclaimer(true);
    }

    // Initialize SDK in background if user has visited before
    if (hasVisited) {
      initializeSDK()
        .then(() => setSdkReady(true))
        .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
    }
  }, []);

  const handleGetStarted = () => {
    localStorage.setItem('spoton_has_visited', 'true');
    setShowLanding(false);
    setShowDisclaimer(true);
    
    // Start SDK initialization
    initializeSDK()
      .then(() => setSdkReady(true))
      .catch((err) => setSdkError(err instanceof Error ? err.message : String(err)));
  };

  const handleDisclaimerAccept = () => {
    localStorage.setItem('spoton_disclaimer_seen', 'true');
    setShowDisclaimer(false);
  };

  const handleLogoClick = () => {
    setShowLanding(true);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'scan':
        return <ScanTab />;
      case 'chat':
        return <ChatTab />;
      case 'voice':
        return <VoiceTab />;
      case 'history':
        return <HistoryTab />;
      default:
        return null;
    }
  };

  // Show landing page for first-time visitors
  if (showLanding) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  return (
    <div className="app">
      {/* Header — always visible */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '56px',
        backgroundColor: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        zIndex: 100,
      }}>
        {/* LEFT: Logo + Name + Beta badge */}
        <button 
          onClick={handleLogoClick}
          className="logo-button"
          aria-label="Return to landing page"
        >
          <div style={{
            width: '32px',
            height: '32px',
            background: 'linear-gradient(135deg, #4f8ef7, #34d399)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            flexShrink: 0,
          }}>🔬</div>
          <span style={{ fontWeight: 700, fontSize: '18px', color: 'var(--color-text)' }}>SpotOn</span>
          <span style={{
            background: 'rgba(79,142,247,0.15)',
            color: 'var(--color-primary)',
            fontSize: '10px',
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 'var(--radius-full)',
            letterSpacing: '0.5px',
          }}>BETA</span>
        </button>

        {/* RIGHT: Privacy badge */}
        <PrivacyBadge />
      </header>

      {/* Tab nav — always visible */}
      <nav className="tab-nav">
        <button
          className={`tab-button ${activeTab === 'scan' ? 'active' : ''}`}
          onClick={() => setActiveTab('scan')}
        >
          <span className="tab-button-icon">🔬</span>
          Scan
        </button>
        <button
          className={`tab-button ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <span className="tab-button-icon">💬</span>
          Chat
        </button>
        <button
          className={`tab-button ${activeTab === 'voice' ? 'active' : ''}`}
          onClick={() => setActiveTab('voice')}
        >
          <span className="tab-button-icon">🎙️</span>
          Voice
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="tab-button-icon">🕘</span>
          History
        </button>
      </nav>

      {/* Main content — conditionally shows spinner OR tab content */}
      <main className="main-content">
        {!sdkReady && !sdkError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
            <div className="animate-spin" style={{
              width: '40px',
              height: '40px',
              border: '3px solid var(--color-border)',
              borderTopColor: 'var(--color-primary)',
              borderRadius: '50%'
            }} />
            <h2>Loading SpotOn...</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>Initializing on-device AI engine</p>
          </div>
        ) : sdkError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
            <h2>Failed to initialize</h2>
            <p style={{ color: 'var(--color-danger)' }}>{sdkError}</p>
            <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
          </div>
        ) : (
          <div className="tab-panel">
            {renderTabContent()}
          </div>
        )}

        <footer className="app-footer">
          SpotOn v0.1 · Not a medical device · All AI runs on-device
        </footer>
      </main>

      {/* Disclaimer modal */}
      {showDisclaimer && (
        <div className="modal-overlay animate-fadeIn">
          <div className="modal-content animate-slideUp">
            <div className="modal-logo">🔬</div>
            <h2 className="modal-title">Before you begin</h2>
            <div className="modal-body">
              SpotOn is not a medical device and does not provide medical diagnoses. Always consult a qualified dermatologist or healthcare provider for any skin concerns. This tool is for informational purposes only.
            </div>
            <button
              className="btn btn-primary modal-button"
              onClick={handleDisclaimerAccept}
            >
              I Understand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}