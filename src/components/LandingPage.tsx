export function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-logo">
            <div className="logo-icon">🔬</div>
            <h1 className="logo-text">SpotOn</h1>
            <span className="beta-tag">BETA</span>
          </div>
          
          <h2 className="hero-headline">
            Your Private AI Skin Health Assistant
          </h2>
          
          <p className="hero-subheadline">
            Analyze skin conditions instantly with AI that runs 100% on your device. 
            No uploads, no accounts, completely private.
          </p>

          <div className="hero-privacy-badge">
            <span className="privacy-icon">🔒</span>
            <span>100% On-Device • Zero Data Collection</span>
          </div>

          <button className="btn btn-primary btn-large hero-cta" onClick={onGetStarted}>
            Get Started
            <span>→</span>
          </button>

          <p className="hero-disclaimer">
            Free • No Sign-Up Required • Works Offline
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h3 className="section-title">Powerful Features, Total Privacy</h3>
        
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔬</div>
            <h4 className="feature-title">Visual Skin Analysis</h4>
            <p className="feature-description">
              Capture or upload a photo and get instant AI-powered analysis of common skin conditions like acne, eczema, rashes, and moles.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h4 className="feature-title">AI Dermatology Chat</h4>
            <p className="feature-description">
              Ask questions about skin health, symptoms, and care recommendations. Get helpful answers powered by on-device AI.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🎙️</div>
            <h4 className="feature-title">Voice Symptom Checker</h4>
            <p className="feature-description">
              Speak your symptoms naturally. Our voice AI listens, understands, and responds with personalized guidance.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon">🕘</div>
            <h4 className="feature-title">Scan History</h4>
            <p className="feature-description">
              Track your skin health over time. All history stored locally on your device, never uploaded to any server.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section">
        <h3 className="section-title">How It Works</h3>
        
        <div className="steps-container">
          <div className="step-item">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4 className="step-title">Capture or Upload</h4>
              <p className="step-description">Take a photo of your skin concern or upload an existing image</p>
            </div>
          </div>

          <div className="step-divider"></div>

          <div className="step-item">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4 className="step-title">AI Analysis</h4>
              <p className="step-description">Advanced vision AI analyzes the image entirely on your device</p>
            </div>
          </div>

          <div className="step-divider"></div>

          <div className="step-item">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4 className="step-title">Get Insights</h4>
              <p className="step-description">Receive detailed analysis, severity assessment, and care recommendations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy Section */}
      <section className="privacy-section">
        <div className="privacy-content">
          <div className="privacy-icon-large">🔐</div>
          <h3 className="privacy-title">Your Privacy is Sacred</h3>
          <p className="privacy-description">
            SpotOn runs entirely in your browser using WebAssembly technology. Your photos and conversations 
            <strong> never leave your device</strong>. No servers, no cloud processing, no data collection.
          </p>
          <div className="privacy-features">
            <div className="privacy-feature-item">
              <span className="check-icon">✓</span>
              <span>No account required</span>
            </div>
            <div className="privacy-feature-item">
              <span className="check-icon">✓</span>
              <span>No data uploaded</span>
            </div>
            <div className="privacy-feature-item">
              <span className="check-icon">✓</span>
              <span>Works offline</span>
            </div>
            <div className="privacy-feature-item">
              <span className="check-icon">✓</span>
              <span>Open source technology</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <h3 className="cta-title">Ready to Get Started?</h3>
        <p className="cta-description">
          Experience the future of private, on-device AI health tools
        </p>
        <button className="btn btn-primary btn-large" onClick={onGetStarted}>
          Launch SpotOn
          <span>→</span>
        </button>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="disclaimer-box">
          <h5 className="disclaimer-title">Medical Disclaimer</h5>
          <p className="disclaimer-text">
            SpotOn is not a medical device and does not provide medical diagnoses. 
            Always consult a qualified dermatologist or healthcare provider for any skin concerns. 
            This tool is for informational purposes only.
          </p>
        </div>
        
        <div className="footer-meta">
          <p>SpotOn v0.1 Beta • Built with RunAnywhere Web SDK</p>
          <p>© 2026 SpotOn • All AI processing runs on-device</p>
        </div>
      </footer>
    </div>
  );
}
