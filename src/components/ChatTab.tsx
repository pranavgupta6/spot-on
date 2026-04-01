import { useState, useRef, useEffect } from 'react';
import { TextGeneration } from '@runanywhere/web-llamacpp';
import { ModelBanner } from './ModelBanner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  id: string;
}

export function ChatTab() {
  const [modelReady, setModelReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const pendingUpdateRef = useRef<string>('');
  const rafIdRef = useRef<number | null>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Auto-resize height
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendMessage = async () => {
    if (inputValue.trim() === '' || isGenerating || !modelReady) return;

    const userMessage = inputValue.trim();
    const userMsg: Message = {
      role: 'user',
      content: userMessage,
      id: crypto.randomUUID()
    };

    // Add user message
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsGenerating(true);
    setError(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
    }

    // Add empty assistant message for streaming
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      id: crypto.randomUUID()
    };
    setMessages(prev => [...prev, assistantMsg]);

    try {
      const systemPrompt = `You are SpotOn's AI dermatology assistant. Help users understand skin conditions, symptoms, and when to seek medical care. Be clear, empathetic, and concise. Keep responses under 100 words. Never diagnose - always recommend consulting a dermatologist for anything concerning.`;

      // Only include last 4 messages (2 exchanges) to keep context window small
      const recentMessages = messages.slice(-4);
      const conversationHistory = recentMessages
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n');

      const fullPrompt = `${systemPrompt}\n\n${conversationHistory}\nUser: ${userMessage}\nAssistant:`;

      const { stream, cancel } = await TextGeneration.generateStream(fullPrompt, {
        maxTokens: 150,
        temperature: 0.7,
      });
      cancelRef.current = cancel;

      let accumulated = '';
      
      // Batch DOM updates for better performance
      const updateMessage = (text: string) => {
        pendingUpdateRef.current = text;
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            setMessages(prev => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...updated[updated.length - 1],
                content: pendingUpdateRef.current
              };
              return updated;
            });
            rafIdRef.current = null;
          });
        }
      };

      for await (const token of stream) {
        accumulated += token;
        updateMessage(accumulated);
      }

      // Final update to ensure we have the complete response
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: accumulated
        };
        return updated;
      });

      setIsGenerating(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate response';
      setError(errorMessage);
      setIsGenerating(false);

      // Remove empty assistant message on error
      setMessages(prev => prev.slice(0, -1));
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputValue(suggestion);
    // Auto-send after setting the suggestion
    setTimeout(() => sendMessage(), 0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelRef.current?.();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  if (!modelReady) {
    return (
      <div>
        <ModelBanner
          modelId="lfm2-350m-q4_k_m"
          modelName="LFM2 350M Chat Model"
          description="Required for AI dermatology chat. ~250MB, downloaded once."
          onReady={() => setModelReady(true)}
          autoLoad={true}
        />

        {/* Feature preview card */}
        <div className="card" style={{ margin: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '12px' }}>
            💬 AI Derma Chat
          </div>
          <div style={{
            color: 'var(--color-text-muted)',
            marginBottom: '16px',
            lineHeight: 1.6
          }}>
            Ask anything about skin conditions, symptoms, or skincare. Powered by on-device AI — completely private.
          </div>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px'
          }}>
            <div className="badge badge-green">🔒 Private</div>
            <div className="badge badge-blue">⚡ On-device</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: 0
    }}>
      {/* Messages area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.length === 0 ? (
          // Welcome state
          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>👋</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
              Hi! I'm your skin health assistant
            </div>
            <div style={{ fontSize: '14px', lineHeight: 1.5, marginBottom: '16px' }}>
              Ask me about acne, eczema, rashes, moles, or any skin concern.
              I'll help you understand what you might be dealing with.
            </div>

            {/* Suggestion chips */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              marginTop: '16px'
            }}>
              {[
                'What causes acne?',
                'Is my mole concerning?',
                'How do I treat dry skin?'
              ].map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
                  style={{
                    padding: '8px 14px',
                    background: 'var(--color-surface-2)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    color: 'var(--color-text-muted)',
                    transition: 'var(--transition)'
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Messages
          messages.map((message, index) => (
            <div
              key={message.id}
              className="animate-slideUp"
              style={{
                alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: message.role === 'user' ? '80%' : '85%',
                background: message.role === 'user'
                  ? 'var(--color-primary)'
                  : 'var(--color-surface-2)',
                color: message.role === 'user' ? 'white' : 'var(--color-text)',
                padding: '10px 14px',
                borderRadius: message.role === 'user'
                  ? '18px 18px 4px 18px'
                  : '18px 18px 18px 4px',
                fontSize: '14px',
                lineHeight: 1.5,
                border: message.role === 'assistant' ? '1px solid var(--color-border)' : 'none'
              }}
            >
              {message.content}
              {/* Blinking cursor for last assistant message while generating */}
              {message.role === 'assistant' &&
               index === messages.length - 1 &&
               isGenerating && (
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
            </div>
          ))
        )}

        {/* Typing indicator */}
        {isGenerating && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
          <div style={{
            alignSelf: 'flex-start',
            background: 'var(--color-surface-2)',
            border: '1px solid var(--color-border)',
            padding: '10px 14px',
            borderRadius: '18px',
            display: 'flex',
            gap: '4px',
            alignItems: 'center'
          }}>
            {[0, 150, 300].map((delay, i) => (
              <div
                key={i}
                className="animate-pulse"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--color-text-dim)',
                  animationDelay: `${delay}ms`
                }}
              />
            ))}
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="card" style={{ borderColor: 'var(--color-danger)', margin: 0 }}>
            <div style={{ color: 'var(--color-danger)', fontSize: '14px' }}>
              ⚠️ {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
        padding: '12px 16px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-end'
      }}>
        <textarea
          ref={textareaRef}
          className="input"
          style={{
            flex: 1,
            resize: 'none',
            minHeight: '44px',
            maxHeight: '120px',
            overflowY: 'auto'
          }}
          rows={1}
          placeholder="Ask about a skin condition..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
        />

        <button
          className="btn btn-primary"
          style={{
            width: '44px',
            height: '44px',
            padding: 0,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={sendMessage}
          disabled={isGenerating || inputValue.trim() === ''}
        >
          {isGenerating ? (
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
          ) : (
            '➤'
          )}
        </button>
      </div>
    </div>
  );
}

export default ChatTab;