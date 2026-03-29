import { useState, useCallback, useRef, useEffect } from 'react'
import { VoicePipeline, ModelManager, AudioCapture, AudioPlayback, SpeechActivity } from '@runanywhere/web'
import { VAD } from '@runanywhere/web-onnx'
import { ModelBanner } from './ModelBanner'

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking'

// The 4 voice model IDs matching our registry
const VOICE_MODEL_IDS = {
  vad: 'silero-vad-v5',
  stt: 'sherpa-onnx-whisper-tiny.en',
  llm: 'lfm2-350m-q4_k_m',
  tts: 'vits-piper-en_US-lessac-medium',
}

export default function VoiceTab() {
  // Track which models are ready (downloaded + loaded)
  const [vadReady, setVadReady] = useState(false)
  const [sttReady, setSttReady] = useState(false)
  const [llmReady, setLlmReady] = useState(false)
  const [ttsReady, setTtsReady] = useState(false)

  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [isSessionActive, setIsSessionActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const micRef = useRef<AudioCapture | null>(null)
  const pipelineRef = useRef<VoicePipeline | null>(null)
  const vadUnsubRef = useRef<(() => void) | null>(null)

  const allModelsReady = vadReady && sttReady && llmReady && ttsReady

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micRef.current?.stop()
      vadUnsubRef.current?.()
    }
  }, [])

  const startListening = useCallback(async () => {
    try {
      setError(null)
      setTranscript('')
      setResponse('')
      setIsSessionActive(true)
      setVoiceState('listening')

      if (!pipelineRef.current) {
        pipelineRef.current = new VoicePipeline()
      }

      const mic = new AudioCapture({ sampleRate: 16000 })
      micRef.current = mic

      VAD.reset()

      vadUnsubRef.current = VAD.onSpeechActivity(async (activity: any) => {
        if (activity === SpeechActivity.Ended) {
          const segment = VAD.popSpeechSegment()
          if (!segment || segment.samples.length < 1600) return

          mic.stop()
          vadUnsubRef.current?.()
          setVoiceState('processing')
          setAudioLevel(0)

          try {
            await pipelineRef.current!.processTurn(
              segment.samples,
              {
                maxTokens: 80,
                temperature: 0.7,
                systemPrompt:
                  'You are SpotOn\'s voice skin health assistant. ' +
                  'The user is describing their skin symptoms verbally. ' +
                  'Give a helpful, concise response in 2-3 sentences max. ' +
                  'Always recommend seeing a doctor for anything concerning.',
              },
              {
                onTranscription: (text: string) => setTranscript(text),
                onResponseToken: (_: string, accumulated: string) => setResponse(accumulated),
                onResponseComplete: (text: string) => setResponse(text),
                onSynthesisComplete: async (audio: Float32Array, sampleRate: number) => {
                  setVoiceState('speaking')
                  const player = new AudioPlayback({ sampleRate })
                  await player.play(audio, sampleRate)
                  player.dispose()
                },
                onStateChange: (state: string) => console.log('[SpotOn Voice] state:', state),
                onError: (err: Error) => {
                  setError(err.message)
                  setVoiceState('idle')
                  setIsSessionActive(false)
                },
              }
            )
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
          }

          setVoiceState('idle')
          setIsSessionActive(false)
        }
      })

      await mic.start(
        (chunk: Float32Array) => { VAD.processSamples(chunk) },
        (level: number) => { setAudioLevel(level) }
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setVoiceState('idle')
      setIsSessionActive(false)
    }
  }, [])

  const stopListening = useCallback(() => {
    micRef.current?.stop()
    vadUnsubRef.current?.()
    micRef.current = null
    vadUnsubRef.current = null
    setVoiceState('idle')
    setIsSessionActive(false)
    setAudioLevel(0)
  }, [])

  // --- RENDER ---

  // Sequential model loading: VAD first, then STT, then LLM, then TTS
  if (!vadReady) {
    return (
      <div>
        <ModelBanner
          modelId={VOICE_MODEL_IDS.vad}
          modelName="Silero VAD (1/4)"
          description="Voice activity detection. Detects when you start and stop speaking."
          onReady={() => setVadReady(true)}
        />
        <div className="card animate-fadeIn" style={{ margin: '0 16px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: 8 }}>🎙️ Voice Symptom Checker</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 12 }}>
            Describe your skin concern out loud. SpotOn listens, understands,
            and responds — all on your device. Requires 4 small models (~425MB total).
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
            <span className="badge badge-blue">🎤 Voice Input</span>
            <span className="badge badge-green">🔒 Private</span>
            <span className="badge badge-blue">🔊 Spoken Response</span>
          </div>
        </div>
      </div>
    )
  }

  if (!sttReady) {
    return (
      <div>
        <div className="card" style={{ margin: 16, textAlign: 'center' as const }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Step 2 of 4 — Loading speech recognition
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <span className="badge badge-green">✓ VAD Ready</span>
            <span className="badge badge-yellow">⏳ STT Loading</span>
            <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>○ LLM</span>
            <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>○ TTS</span>
          </div>
        </div>
        <ModelBanner
          modelId={VOICE_MODEL_IDS.stt}
          modelName="Whisper STT (2/4)"
          description="Speech recognition. Converts your voice to text (~105MB)."
          onReady={() => setSttReady(true)}
        />
      </div>
    )
  }

  if (!llmReady) {
    return (
      <div>
        <div className="card" style={{ margin: 16, textAlign: 'center' as const }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Step 3 of 4 — Loading AI brain
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <span className="badge badge-green">✓ VAD</span>
            <span className="badge badge-green">✓ STT</span>
            <span className="badge badge-yellow">⏳ LLM Loading</span>
            <span className="badge" style={{ background: 'var(--color-surface-2)', color: 'var(--color-text-dim)' }}>○ TTS</span>
          </div>
        </div>
        <ModelBanner
          modelId={VOICE_MODEL_IDS.llm}
          modelName="LFM2 350M AI (3/4)"
          description="Language model. Understands your symptoms and generates responses (~250MB)."
          onReady={() => setLlmReady(true)}
        />
      </div>
    )
  }

  if (!ttsReady) {
    return (
      <div>
        <div className="card" style={{ margin: 16, textAlign: 'center' as const }}>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Step 4 of 4 — Loading voice synthesis
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <span className="badge badge-green">✓ VAD</span>
            <span className="badge badge-green">✓ STT</span>
            <span className="badge badge-green">✓ LLM</span>
            <span className="badge badge-yellow">⏳ TTS Loading</span>
          </div>
        </div>
        <ModelBanner
          modelId={VOICE_MODEL_IDS.tts}
          modelName="Piper TTS (4/4)"
          description="Text-to-speech. Speaks the AI response aloud (~65MB)."
          onReady={() => setTtsReady(true)}
        />
      </div>
    )
  }

  // All models ready — show voice UI
  const micButtonStyle = {
    width: 96,
    height: 96,
    borderRadius: '50%' as const,
    margin: '0 auto 16px',
    cursor: voiceState === 'processing' || voiceState === 'speaking'
      ? 'not-allowed' as const
      : 'pointer' as const,
    border: 'none',
    fontSize: 40,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 300ms ease',
    transform: `scale(${1 + audioLevel * 0.2})`,
    ...(voiceState === 'listening'
      ? {
          background: 'rgba(79,142,247,0.15)',
          boxShadow: '0 0 0 12px rgba(79,142,247,0.08), 0 0 0 24px rgba(79,142,247,0.04)',
          outline: '2px solid var(--color-primary)',
        }
      : voiceState === 'speaking'
      ? {
          background: 'rgba(52,211,153,0.15)',
          outline: '2px solid var(--color-accent)',
        }
      : {
          background: 'var(--color-surface-2)',
          outline: '2px solid var(--color-border)',
        }),
  }

  const statusText = {
    idle: isSessionActive ? 'Session ended' : 'Tap the mic to start',
    listening: '🎤 Listening — speak now',
    processing: '💭 Thinking...',
    speaking: '🔊 Speaking...',
  }[voiceState]

  return (
    <div style={{ paddingBottom: 16 }}>
      <div className="card" style={{ margin: 16, textAlign: 'center' as const, padding: 28 }}>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Voice Symptom Checker</h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 24 }}>
          Describe your skin concern out loud
        </p>

        {/* Mic button */}
        <div style={micButtonStyle}>
          {voiceState === 'processing'
            ? <div className="animate-spin" style={{
                width: 36, height: 36,
                border: '3px solid var(--color-border)',
                borderTopColor: 'var(--color-primary)',
                borderRadius: '50%',
              }} />
            : voiceState === 'speaking' ? '🔊'
            : '🎙️'}
        </div>

        {/* Status */}
        <p style={{ fontSize: 14, color: 'var(--color-text-muted)', minHeight: 24, marginBottom: 20 }}>
          {statusText}
        </p>

        {/* Buttons */}
        {!isSessionActive
          ? <button className="btn btn-primary" onClick={startListening}>
              🎙️ Start Voice Session
            </button>
          : voiceState === 'listening'
          ? <button className="btn btn-secondary" onClick={stopListening}>
              ⏹ Stop Listening
            </button>
          : <button className="btn btn-secondary" disabled>
              Processing...
            </button>
        }
      </div>

      {/* Transcript */}
      {transcript ? (
        <div className="card animate-slideUp" style={{ margin: '0 16px 12px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-dim)', letterSpacing: 1, marginBottom: 6 }}>
            YOU SAID
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{transcript}</p>
        </div>
      ) : null}

      {/* Response */}
      {response ? (
        <div className="card animate-slideUp" style={{
          margin: '0 16px 12px',
          borderLeft: '3px solid var(--color-primary)',
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', letterSpacing: 1, marginBottom: 6 }}>
            SPOTON SAYS
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.6 }}>{response}</p>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="card" style={{ margin: '0 16px', borderColor: 'var(--color-danger)' }}>
          <p style={{ color: 'var(--color-danger)' }}>⚠️ {error}</p>
          <button className="btn btn-secondary" style={{ marginTop: 8 }}
            onClick={() => setError(null)}>Dismiss</button>
        </div>
      ) : null}
    </div>
  )
}
