import { useEffect, useRef, useState, useCallback } from 'react';
import { VLMWorkerBridge } from '@runanywhere/web-llamacpp';
import { VideoCapture } from '@runanywhere/web';
import { ModelBanner } from './ModelBanner';
import ScanReport, { ScanResult } from './ScanReport';
import useSkinHistory from '../hooks/useSkinHistory';

export function ScanTab() {
  const [modelReady, setModelReady] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [thumbnailDataUrl, setThumbnailDataUrl] = useState<string | null>(null);
  const [savedToHistory, setSavedToHistory] = useState(false);

  const cameraRef = useRef<VideoCapture | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const { addEntry } = useSkinHistory();

  const startCamera = useCallback(async () => {
    try {
      const camera = new VideoCapture({ facingMode: 'environment' });
      cameraRef.current = camera;

      await camera.start();

      // Wait for video readiness
      await new Promise<void>((resolve) => {
        const video = cameraRef.current!.videoElement;
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          resolve();
          return;
        }
        video.addEventListener('loadedmetadata', () => resolve(), { once: true });
      });

      // Append camera video element to container
      const videoElement = camera.videoElement;
      videoElement.style.width = '100%';
      videoElement.style.height = '100%';
      videoElement.style.objectFit = 'cover';
      videoContainerRef.current?.appendChild(videoElement);

      setCameraActive(true);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start camera';
      setError(errorMessage);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();

      // Remove video element from DOM if it exists
      if (videoContainerRef.current && cameraRef.current.videoElement) {
        try {
          videoContainerRef.current.removeChild(cameraRef.current.videoElement);
        } catch {
          // Element might already be removed, ignore error
        }
      }

      cameraRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const performScan = useCallback(async () => {
    if (!cameraRef.current || !VLMWorkerBridge.shared.isModelLoaded) {
      return;
    }

    setIsScanning(true);
    setError(null);

    try {
      // Capture frame
      const frame = cameraRef.current.captureFrame(256);

      if (!frame || frame.width === 0 || frame.height === 0) {
        setError("Camera not ready. Please wait a moment and try again.");
        setIsScanning(false);
        return;
      }

      // Generate thumbnail from captured frame
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      const ctx = canvas.getContext('2d')!;

      // Convert RGB (3 bytes/pixel) to RGBA (4 bytes/pixel) for ImageData
      const rgbPixels = frame.rgbPixels;
      const rgbaPixels = new Uint8ClampedArray(frame.width * frame.height * 4);
      for (let i = 0; i < frame.width * frame.height; i++) {
        rgbaPixels[i * 4 + 0] = rgbPixels[i * 3 + 0]; // R
        rgbaPixels[i * 4 + 1] = rgbPixels[i * 3 + 1]; // G
        rgbaPixels[i * 4 + 2] = rgbPixels[i * 3 + 2]; // B
        rgbaPixels[i * 4 + 3] = 255;                   // A (fully opaque)
      }

      const imageData = new ImageData(rgbaPixels, frame.width, frame.height);
      ctx.putImageData(imageData, 0, 0);
      const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setThumbnailDataUrl(thumbnailDataUrl);

      // Build VLM prompt (instruction-only approach, no placeholder examples)
      const prompt = `Analyze this skin photo carefully.
What skin condition or issue do you see?
Respond with a JSON object using these exact keys:
- condition: the name of what you observe (e.g. "Acne", "Dry Skin", "Eczema", "Normal Skin", "Rash", "Sunburn", etc.)
- confidence: how confident you are, must be exactly one of: High, Medium, Low
- severity: must be exactly one of: Mild, Moderate, Severe
- description: 1-2 sentences describing what you actually see in the image
- recommendations: array of 2-3 practical tips
- seeDoctor: true if the condition looks serious, false otherwise

Only output the JSON. No other text.`;

      // Call VLM
      const result = await VLMWorkerBridge.shared.process(
        frame.rgbPixels,
        frame.width,
        frame.height,
        prompt,
        { maxTokens: 400, temperature: 0.2 }
      );

      // CHANGE 1 - Add console log to see raw VLM output
      console.log('[SpotOn] Raw VLM response:', result.text);

      // CHANGE 3 - Robust JSON parsing with multiple strategies
      let parsed: ScanResult | null = null;

      try {
        const text = result.text.trim();
        console.log('[SpotOn] Parsing response:', text);

        // Strategy 1: try direct parse
        try {
          parsed = JSON.parse(text);
        } catch {
          // Strategy 2: extract JSON object using regex
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            try {
              parsed = JSON.parse(jsonMatch[0]);
            } catch {
              // Strategy 3: try to fix truncated JSON by finding last complete field
              // and closing the object
              const partial = jsonMatch[0];
              // Remove trailing incomplete parts after last comma or complete value
              const fixAttempts = [
                partial + '"}',           // maybe just missing closing quote+brace
                partial + '"}]',          // missing closing for array+object
                partial + '],"seeDoctor":false}',  // truncated at recommendations
                partial.replace(/,\s*"[^"]*"\s*:\s*[^,}\]]*$/, '') + '}',  // remove last incomplete field
              ];
              for (const attempt of fixAttempts) {
                try {
                  parsed = JSON.parse(attempt);
                  if (parsed) break;
                } catch {
                  continue;
                }
              }
            }
          }
        }

        // Strategy 4: if still no valid JSON, extract individual fields with regex
        if (!parsed) {
          const conditionMatch = text.match(/"condition"\s*:\s*"([^"]+)"/);
          const confidenceMatch = text.match(/"confidence"\s*:\s*"([^"]+)"/);
          const severityMatch = text.match(/"severity"\s*:\s*"([^"]+)"/);
          const descriptionMatch = text.match(/"description"\s*:\s*"([^"]+)"/);
          const seeDoctorMatch = text.match(/"seeDoctor"\s*:\s*(true|false)/);

          if (conditionMatch || descriptionMatch) {
            parsed = {
              condition: conditionMatch?.[1] ?? 'Skin Condition Detected',
              confidence: (confidenceMatch?.[1] as 'High'|'Medium'|'Low') ?? 'Low',
              severity: (severityMatch?.[1] as 'Mild'|'Moderate'|'Severe') ?? 'Mild',
              description: descriptionMatch?.[1] ??
                'The AI analyzed your skin but could not generate a complete report. Try scanning again.',
              recommendations: [
                'Try scanning again with better lighting',
                'Ensure the area of concern is clearly visible',
                'Consult a dermatologist for a professional assessment',
              ],
              seeDoctor: seeDoctorMatch?.[1] === 'true' || false,
            };
          }
        }
      } catch (parseError) {
        console.error('[SpotOn] All parsing strategies failed:', parseError);
      }

      // If ALL strategies failed, use a graceful fallback instead of showing error
      if (!parsed) {
        parsed = {
          condition: 'Analysis Incomplete',
          confidence: 'Low',
          severity: 'Mild',
          description: 'The AI could not fully analyze this image. This may be due to ' +
            'lighting conditions or the model needing more context. Please try again.',
          recommendations: [
            'Ensure good lighting on the skin area',
            'Hold the camera 15-20cm from the skin',
            'Try scanning again — results improve with clear images',
          ],
          seeDoctor: false,
        };
      }

      // Normalize confidence and severity values in case model returned wrong casing
      const validConfidence = ['High', 'Medium', 'Low'];
      const validSeverity = ['Mild', 'Moderate', 'Severe'];

      if (!validConfidence.includes(parsed.confidence)) {
        parsed.confidence = 'Medium';
      }
      if (!validSeverity.includes(parsed.severity)) {
        parsed.severity = 'Mild';
      }
      if (!Array.isArray(parsed.recommendations) || parsed.recommendations.length === 0) {
        parsed.recommendations = [
          'Consult a dermatologist for professional assessment',
          'Monitor the area for any changes',
          'Keep the area clean and moisturized',
        ];
      }

      setScanResult(parsed);
      setIsScanning(false);
      setSavedToHistory(false);

      // Stop camera after successful scan
      stopCamera();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Scan failed';

      if (errorMessage.includes('memory access out of bounds') || errorMessage.includes('RuntimeError')) {
        setError("GPU memory issue. Please try again in a moment.");
      } else {
        setError(errorMessage);
      }

      setIsScanning(false);
    }
  }, [stopCamera]);

  const handleSaveToHistory = useCallback(() => {
    if (!scanResult) return;

    addEntry({
      condition: scanResult.condition,
      confidence: scanResult.confidence,
      severity: scanResult.severity,
      seeDoctor: scanResult.seeDoctor,
      description: scanResult.description,
      recommendations: scanResult.recommendations,
      thumbnailDataUrl: thumbnailDataUrl ?? undefined,
    });

    setSavedToHistory(true);
  }, [scanResult, thumbnailDataUrl, addEntry]);

  const handleScanAgain = useCallback(() => {
    setScanResult(null);
    setThumbnailDataUrl(null);
    setError(null);
    setSavedToHistory(false);
    startCamera();
  }, [startCamera]);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Render based on state priority
  if (!modelReady) {
    return (
      <div>
        <ModelBanner
          modelId="lfm2-vl-450m-q4_0"
          modelName="LFM2-VL Vision Model"
          description="Required for AI skin scanning. Downloaded once and cached."
          onReady={() => setModelReady(true)}
        />

        {/* Feature preview card */}
        <div className="card" style={{ margin: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '12px' }}>
            🔬 AI Skin Scanner
          </div>
          <div style={{
            color: 'var(--color-text-muted)',
            marginBottom: '16px',
            lineHeight: 1.6
          }}>
            Point your camera at any skin area — SpotOn analyzes it on-device using a Vision AI model.
            No photos are ever uploaded.
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div className="badge badge-green">🔒 100% Private</div>
            <div className="badge badge-blue">⚡ On-device AI</div>
            <div className="badge badge-blue">📷 Live Camera</div>
          </div>
        </div>
      </div>
    );
  }

  if (modelReady && scanResult !== null) {
    return (
      <ScanReport
        result={scanResult}
        thumbnailDataUrl={thumbnailDataUrl ?? undefined}
        savedToHistory={savedToHistory}
        onSaveToHistory={handleSaveToHistory}
        onScanAgain={handleScanAgain}
      />
    );
  }

  // Camera UI
  return (
    <div style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Camera preview area */}
      <div style={{
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        background: 'var(--color-surface-2)',
        aspectRatio: '4/3'
      }}>
        <div ref={videoContainerRef} style={{ width: '100%', height: '100%' }} />

        {/* Camera inactive overlay */}
        {!cameraActive && (
          <div style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <div style={{ fontSize: '48px' }}>📷</div>
            <div style={{ color: 'var(--color-text-muted)' }}>
              Camera will appear here
            </div>
          </div>
        )}

        {/* Scanning overlay */}
        {isScanning && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            borderRadius: 'var(--radius-md)'
          }}>
            <div
              className="animate-spin"
              style={{
                width: '36px',
                height: '36px',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: 'white',
                borderRadius: '50%'
              }}
            />
            <div style={{ color: 'white', fontWeight: 600 }}>
              Analyzing skin...
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255,255,255,0.7)'
            }}>
              Running on-device AI · Private
            </div>
          </div>
        )}
      </div>

      {/* Control buttons */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {!cameraActive ? (
          <button
            className="btn btn-primary w-full"
            onClick={startCamera}
          >
            📷 Start Camera
          </button>
        ) : !isScanning ? (
          <>
            <button
              className="btn btn-primary"
              style={{ flex: 2 }}
              onClick={performScan}
            >
              🔬 Scan Skin
            </button>
            <button
              className="btn btn-secondary"
              style={{ flex: 1 }}
              onClick={stopCamera}
            >
              ⏹ Stop
            </button>
          </>
        ) : (
          <button
            className="btn btn-primary w-full"
            disabled
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
              <div
                className="animate-spin"
                style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%'
                }}
              />
              Analyzing...
            </div>
          </button>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--color-danger)' }}>
          <div style={{ color: 'var(--color-danger)', marginBottom: '12px' }}>
            ⚠️ {error}
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setError(null)}
          >
            Try Again
          </button>
        </div>
      )}

      {/* Tips card */}
      <div className="card">
        <div style={{
          fontSize: '14px',
          fontWeight: 600,
          marginBottom: '10px'
        }}>
          💡 Tips for best results
        </div>
        <ul style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.8,
          listStyle: 'none',
          margin: 0,
          padding: 0
        }}>
          <li>• Hold camera 15–20cm from skin</li>
          <li>• Ensure good lighting</li>
          <li>• Keep camera steady while scanning</li>
          <li>• Focus on the area of concern</li>
        </ul>
      </div>
    </div>
  );
}

export default ScanTab;