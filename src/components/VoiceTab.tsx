import { useState, useCallback, useRef, useEffect } from 'react'
import { VoicePipeline, ModelManager, ModelCategory, AudioCapture, AudioPlayback, SpeechActivity, PipelineState } from '@runanywhere/web'
import { TTS } from '@runanywhere/web-onnx'
import { ModelBanner } from './ModelBanner'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

// The 4 voice model IDs matching our registry
const VOICE_MODEL_IDS = {
  vad: 'silero-vad-v5',
  stt: 'sherpa-onnx-whisper-tiny.en',
  llm: 'lfm2-350m-q4_k_m',  // Upgraded to LFM2 350M for better quality (same as Chat tab)
  tts: 'vits-piper-en_US-lessac-medium',
}

export default function VoiceTab() {
  const [vadReady, setVadReady] = useState(false);
  const [sttReady, setSttReady] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [ttsReady, setTtsReady] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialResponse, setPartialResponse] = useState('');
  const [processingSeconds, setProcessingSeconds] = useState(0);

  const micRef = useRef<AudioCapture | null>(null);
  const audioPlaybackRef = useRef<AudioPlayback | null>(null);
  const voicePipelineRef = useRef<VoicePipeline | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Refs to track if we've triggered auto-load for each model
  const vadAutoLoadTriggered = useRef(false);
  const sttAutoLoadTriggered = useRef(false);
  const llmAutoLoadTriggered = useRef(false);
  const ttsAutoLoadTriggered = useRef(false);

  const allModelsReady = vadReady && sttReady && llmReady && ttsReady;
  
  // Manage processing timer based on voiceState
  useEffect(() => {
    if (voiceState === 'thinking' || voiceState === 'processing-stt') {
      // Start timer
      setProcessingSeconds(0);
      timerRef.current = setInterval(() => {
        setProcessingSeconds(prev => prev + 1);
      }, 1000);
    } else {
      // Stop timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [voiceState]);

  const startSession = useCallback(async () => {
    try {
      setError(null);
      setIsSessionActive(true);
      setVoiceState('listening');
      setTranscript('');
      setResponse('');
      setPartialResponse('');

      console.log('[VoiceTab] Starting voice session...');

      // CRITICAL: Ensure all 4 voice models are loaded before starting VoicePipeline
      // Check each category and load the correct model if missing
      const requiredModels = [
        { category: ModelCategory.Audio, id: VOICE_MODEL_IDS.vad, name: 'VAD' },
        { category: ModelCategory.SpeechRecognition, id: VOICE_MODEL_IDS.stt, name: 'STT' },
        { category: ModelCategory.Language, id: VOICE_MODEL_IDS.llm, name: 'LLM' },
        { category: ModelCategory.SpeechSynthesis, id: VOICE_MODEL_IDS.tts, name: 'TTS' },
      ];

      console.log('[VoiceTab] Checking voice models...');
      
      for (const { category, id, name } of requiredModels) {
        const loaded = ModelManager.getLoadedModel(category);
        
        if (!loaded || loaded.id !== id) {
          console.log(`[VoiceTab] ${name} model needs loading: ${loaded ? `wrong model (${loaded.id})` : 'not loaded'}`);
          console.log(`[VoiceTab] Loading ${name} model: ${id}`);
          
          try {
            await ModelManager.loadModel(id, { coexist: true });
            console.log(`[VoiceTab] ✅ ${name} model loaded: ${id}`);
          } catch (err) {
            throw new Error(`Failed to load ${name} model (${id}): ${err instanceof Error ? err.message : String(err)}`);
          }
        } else {
          console.log(`[VoiceTab] ✅ ${name} model already loaded: ${loaded.id}`);
        }
      }

      console.log('[VoiceTab] All 4 voice models verified and loaded');

      // Create audio capture for microphone
      const mic = new AudioCapture({
        sampleRate: 16000, // Standard for STT
        chunkSize: 1600    // 100ms chunks
      });
      micRef.current = mic;

      // Initialize VoicePipeline
      const pipeline = new VoicePipeline();
      voicePipelineRef.current = pipeline;

      // Configure audio playback
      const audioPlayback = new AudioPlayback({
        sampleRate: 22050, // Standard for TTS
        volume: 1.0
      });
      audioPlaybackRef.current = audioPlayback;

      // Start listening for audio and collect for 5 seconds
      await mic.start();
      console.log('[VoiceTab] Microphone started, recording for 5 seconds...');

      // Wait for 5 seconds to collect audio, then process
      setTimeout(async () => {
        try {
          // Get all collected audio and stop capture
          const audioData = mic.getAudioBuffer();
          mic.stop();

          console.log(`[VoiceTab] Audio captured: ${audioData.length} samples (${(audioData.length / 16000).toFixed(1)}s)`);

          if (audioData.length === 0) {
            throw new Error('No audio captured. Please speak into the microphone.');
          }

          // Process through VoicePipeline
          const systemPrompt = 'You are a skin health assistant. Answer in exactly 1-2 short sentences. Be direct.';

          console.log('[VoiceTab] Starting VoicePipeline.processTurn()...');

          await pipeline.processTurn(audioData, {
            maxTokens: 60,        // Shorter = faster response
            temperature: 0.7,
            ttsSpeed: 1.1,        // Slightly faster speech
            systemPrompt
          }, {
            onStateChange: (state) => {
              switch (state) {
                case PipelineState.ProcessingSTT:
                  setVoiceState('processing-stt');
                  break;
                case PipelineState.GeneratingResponse:
                  setVoiceState('thinking');
                  break;
                case PipelineState.PlayingTTS:
                  setVoiceState('playing-tts');
                  break;
                default:
                  break;
              }
            },
            onTranscription: (text, _result) => {
              setTranscript(text);
            },
            onResponseToken: (token, accumulated) => {
              setPartialResponse(accumulated);
            },
            onResponseComplete: (text, _result) => {
              setResponse(text);
              setPartialResponse('');
            },
            onSynthesisComplete: (audioSamples, sampleRate, _result) => {
              // Play the synthesized audio
              audioPlayback.play(audioSamples, sampleRate).then(() => {
                setVoiceState('idle');
              });
            },
            onError: (error, stage) => {
              throw new Error(`Voice pipeline error at ${stage}: ${error.message}`);
            }
          });

        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Voice processing failed';
          setError(errorMessage);
          setVoiceState('idle');
        }
      }, 5000); // Record for 5 seconds

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start voice session';
      setError(errorMessage);
      setIsSessionActive(false);
      setVoiceState('idle');
    }
  }, []);

  const stopSession = useCallback(() => {
    if (micRef.current) {
      micRef.current.stop();
      micRef.current = null;
    }
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.stop();
      audioPlaybackRef.current = null;
    }
    if (voicePipelineRef.current) {
      voicePipelineRef.current.cancel();
      voicePipelineRef.current = null;
    }
    setIsSessionActive(false);
    setVoiceState('idle');
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  // Sequential model loading UI - Load VAD first (smallest)
  if (!vadReady) {
    return (
      <div>
        <ModelBanner
          modelId="silero-vad-v5"
          modelName="Silero VAD (1/4)"
          description="Voice activity detection. Detects when you start/stop speaking (~5MB)."
          onReady={() => {
            console.log('[VoiceTab] VAD model ready');
            setVadReady(true);
          }}
        />

        {/* Feature preview card */}
        <div className="card" style={{ margin: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '12px' }}>
            🎙️ Voice Symptom Checker
          </div>
          <div style={{
            color: 'var(--color-text-muted)',
            marginBottom: '16px',
            lineHeight: 1.6
          }}>
            Describe your skin symptoms out loud. SpotOn listens, understands, and responds — all on your device.
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div className="badge badge-blue">🎤 Voice Input</div>
            <div className="badge badge-green">🔒 Private</div>
            <div className="badge badge-blue">🔊 Spoken Response</div>
          </div>
        </div>
      </div>
    );
  }

  if (vadReady && !sttReady) {
    return (
      <div>
        <div style={{
          margin: '16px',
          padding: '12px',
          background: 'rgba(52,211,153,0.1)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--color-accent)',
          fontSize: '14px',
          color: 'var(--color-text)',
          marginBottom: '12px'
        }}>
          ✓ Step 1 complete — Voice activity detection ready
        </div>
        <ModelBanner
          modelId="sherpa-onnx-whisper-tiny.en"
          modelName="Whisper Tiny STT (2/4)"
          description="Speech recognition. Converts your voice to text (~75MB)."
          onReady={() => {
            // STT is auto-initialized by ModelManager for archive models
            console.log('[VoiceTab] STT model ready (auto-initialized)');
            setSttReady(true);
          }}
        />

        <div style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: '14px',
          color: 'var(--color-text-muted)'
        }}>
          Step 2 of 4 — Loading speech recognition...
        </div>
      </div>
    );
  }

  if (vadReady && sttReady && !llmReady) {
    return (
      <div>
        <div style={{
          margin: '16px',
          padding: '12px',
          background: 'rgba(52,211,153,0.1)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--color-accent)',
          fontSize: '14px',
          color: 'var(--color-text)',
          marginBottom: '12px'
        }}>
          ✓ Steps 1 & 2 complete — VAD and speech recognition ready
        </div>
        <ModelBanner
          modelId="lfm2-350m-q4_k_m"
          modelName="LFM2 350M AI (3/4)"
          description="High-quality AI brain for natural voice responses (~250MB)."
          onReady={() => setLlmReady(true)}
        />
        <div style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: '14px',
          color: 'var(--color-text-muted)'
        }}>
          Step 3 of 4 — Loading AI brain...
        </div>
      </div>
    );
  }

  if (vadReady && sttReady && llmReady && !ttsReady) {
    return (
      <div>
        <div style={{
          margin: '16px',
          padding: '12px',
          background: 'rgba(52,211,153,0.1)',
          borderRadius: 'var(--radius-md)',
          borderLeft: '3px solid var(--color-accent)',
          fontSize: '14px',
          color: 'var(--color-text)',
          marginBottom: '12px'
        }}>
          ✓ Steps 1-3 complete — VAD, speech recognition, and AI ready
        </div>
        <ModelBanner
          modelId="vits-piper-en_US-lessac-medium"
          modelName="Piper TTS (4/4)"
          description="Text-to-speech model. Speaks the AI response aloud."
          onReady={async () => {
            try {
              console.log('[VoiceTab] TTS model extracted, now loading voice...');
              
              // Wait a bit for model files to settle in OPFS
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // For archive-based TTS models, we need to explicitly call loadVoice() after extraction
              // The SDK extracts to /models/{modelId}/ in OPFS
              await TTS.loadVoice({
                voiceId: 'spoton-tts',  // Use a unique ID to avoid conflicts
                modelPath: '/models/vits-piper-en_US-lessac-medium/en_US-lessac-medium.onnx',
                tokensPath: '/models/vits-piper-en_US-lessac-medium/tokens.txt',
                dataDir: '/models/vits-piper-en_US-lessac-medium/espeak-ng-data',
              });
              
              console.log('[VoiceTab] ✅ TTS voice loaded successfully, sample rate:', TTS.sampleRate);
              setTtsReady(true);
            } catch (err) {
              console.error('[VoiceTab] ❌ Failed to load TTS voice:', err);
              // Try to continue anyway - maybe it was already loaded
              setTtsReady(true);
            }
          }}
        />
        <div style={{
          textAlign: 'center',
          padding: '16px',
          fontSize: '14px',
          color: 'var(--color-text-muted)'
        }}>
          Step 4 of 4 — Loading voice synthesizer...
        </div>
      </div>
    );
  }

  // All models ready - show voice interface
  return (
    <div>
      {/* Main voice interface card */}
      <div className="card" style={{
        margin: '16px',
        textAlign: 'center',
        padding: '28px'
      }}>
        {/* Title */}
        <div style={{
          fontSize: '18px',
          fontWeight: 700,
          marginBottom: '8px'
        }}>
          Voice Symptom Checker
        </div>

        {/* Subtitle */}
        <div style={{
          color: 'var(--color-text-muted)',
          fontSize: '14px',
          marginBottom: '24px'
        }}>
          Describe your skin concern out loud
        </div>

        {/* Big circular mic button */}
        <button
          onClick={isSessionActive ? stopSession : startSession}
          disabled={voiceState === 'processing-stt' || voiceState === 'thinking'}
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            margin: '0 auto 16px',
            cursor: (voiceState === 'processing-stt' || voiceState === 'thinking') ? 'not-allowed' : 'pointer',
            border: 'none',
            fontSize: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 300ms ease',
            // Dynamic styles based on state
            ...(voiceState === 'listening' ? {
              background: 'rgba(79,142,247,0.15)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--color-primary)',
              boxShadow: '0 0 0 12px rgba(79,142,247,0.08), 0 0 0 24px rgba(79,142,247,0.04)'
            } : voiceState === 'playing-tts' ? {
              background: 'rgba(52,211,153,0.15)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--color-accent)'
            } : (voiceState === 'processing-stt' || voiceState === 'thinking') ? {
              background: 'var(--color-surface-2)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--color-border)',
              opacity: 0.7
            } : {
              background: 'var(--color-surface-2)',
              borderWidth: '2px',
              borderStyle: 'solid',
              borderColor: 'var(--color-border)'
            })
          }}
        >
          {voiceState === 'listening' && (
            <span style={{ animation: 'pulse 1.5s ease infinite' }}>🎙️</span>
          )}
          {voiceState === 'playing-tts' && '🔊'}
          {(voiceState === 'processing-stt' || voiceState === 'thinking') && (
            <div
              className="animate-spin"
              style={{
                width: '32px',
                height: '32px',
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%'
              }}
            />
          )}
          {voiceState === 'idle' && '🎙️'}
        </button>

        {/* Status text */}
        <div style={{
          fontSize: '14px',
          color: 'var(--color-text-muted)',
          minHeight: '24px',
          marginBottom: '20px'
        }}>
          {voiceState === 'idle' && !isSessionActive && 'Tap the mic to start'}
          {voiceState === 'idle' && isSessionActive && 'Waiting for speech...'}
          {voiceState === 'listening' && '🎤 Listening — speak now'}
          {voiceState === 'processing-stt' && '⏳ Processing speech...'}
          {voiceState === 'thinking' && '💭 Thinking...'}
          {voiceState === 'playing-tts' && '🔊 Speaking...'}
        </div>

        {/* Session button */}
        {!isSessionActive ? (
          <button
            className="btn btn-primary"
            onClick={startSession}
            disabled={voiceState === 'processing-stt' || voiceState === 'thinking'}
          >
            🎙️ Start Voice Session
          </button>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={stopSession}
          >
            ⏹ End Session
          </button>
        )}

        {/* Demo notice */}
        <div style={{
          marginTop: '20px',
          padding: '12px',
          background: 'rgba(79,142,247,0.1)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          color: 'var(--color-text-muted)'
        }}>
          🎙️ Real Voice Pipeline: Record 5 seconds of audio, then get AI analysis and spoken response.
        </div>
      </div>

      {/* Transcript card */}
      {transcript && (
        <div className="card animate-slideUp" style={{ margin: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-text-dim)',
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            YOU SAID
          </div>
          <p style={{
            fontSize: '15px',
            lineHeight: 1.6,
            margin: 0
          }}>
            {transcript}
          </p>
        </div>
      )}

      {/* Response card - show partial response during generation */}
      {(response || partialResponse) && (
        <div className="card animate-slideUp" style={{
          margin: '16px',
          borderLeft: '3px solid var(--color-primary)'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--color-primary)',
            letterSpacing: '1px',
            marginBottom: '6px'
          }}>
            SPOTON SAYS
            {partialResponse && !response && (
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                (generating...)
              </span>
            )}
          </div>
          <p style={{
            fontSize: '15px',
            lineHeight: 1.6,
            margin: 0
          }}>
            {response || partialResponse}
            {partialResponse && !response && (
              <span style={{
                display: 'inline-block',
                width: '2px',
                height: '14px',
                background: 'var(--color-primary)',
                marginLeft: '2px',
                animation: 'pulse 1s ease infinite',
                verticalAlign: 'middle'
              }} />
            )}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="card" style={{
          margin: '16px',
          borderColor: 'var(--color-danger)'
        }}>
          <p style={{
            color: 'var(--color-danger)',
            margin: '0 0 8px 0'
          }}>
            ⚠️ {error}
          </p>
          <button
            className="btn btn-secondary"
            style={{ marginTop: '8px' }}
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}