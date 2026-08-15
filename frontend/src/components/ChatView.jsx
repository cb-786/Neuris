import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../api/neuris';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

const SUGGESTIONS = [
  'Tell me about my last meeting',
  'What do you know about Project Alpha?',
  'Who did I talk to this week?',
];

export default function ChatView() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    isSupported,
    setTranscript,
  } = useSpeechRecognition();

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // When speech recognition finishes, populate input
  useEffect(() => {
    if (transcript && !isListening) {
      setInputText(transcript);
      setTranscript('');
    }
  }, [isListening, transcript, setTranscript]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }]);
    setIsLoading(true);

    try {
      const data = await api.ingestText(trimmed);
      const aiResponse = data.ai_response || {};

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: aiResponse.response || 'I processed your message.',
          entities: aiResponse.entities || [],
          latency: data.latency_ms,
          cached: data.cached,
          conversationId: data.conversation_id,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${err.message}. Make sure the backend is running.`,
          isError: true,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <div className="chat-view">
      <header className="view-header">
        <div>
          <h1 className="view-title">Memory Chat</h1>
          <p className="view-subtitle">Talk to NEURIS — your personal memory intelligence</p>
        </div>
      </header>

      <div className="chat-messages">
        {messages.length === 0 && !isLoading ? (
          <div className="welcome-state">
            <div className="welcome-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 6v6l4 2"/>
              </svg>
            </div>
            <h2>What do you remember?</h2>
            <p>Start a conversation to build your memory graph. I&apos;ll remember people, events, topics, and connections for you.</p>
            <div className="suggestion-chips">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                <div className="message-avatar">
                  {msg.role === 'assistant' ? 'N' : 'U'}
                </div>
                <div>
                  <div className={`message-content ${msg.isError ? 'error' : ''}`}>
                    {msg.content}
                  </div>
                  {msg.entities && msg.entities.length > 0 && (
                    <div className="message-entities">
                      {msg.entities.map((e, j) => (
                        <span key={j} className="entity-tag">{e}</span>
                      ))}
                    </div>
                  )}
                  {msg.role === 'assistant' && !msg.isError && (
                    <div className="message-meta">
                      {msg.latency != null && <span>{msg.latency.toFixed(0)}ms</span>}
                      {msg.cached && <span>· cached</span>}
                      {msg.conversationId && (
                        <span className="message-conv-id">· {msg.conversationId}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="message assistant">
                <div className="message-avatar">N</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input"
            placeholder={isListening ? 'Listening... speak now' : 'Type a message or click the mic to speak...'}
            value={isListening ? transcript : inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isListening}
          />
          <div className="input-actions">
            {isSupported && (
              <button
                className={`icon-btn mic-btn ${isListening ? 'listening' : ''}`}
                onClick={handleMicClick}
                title={isListening ? 'Stop Listening' : 'Voice Input'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/>
                  <line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            )}
            <button
              className="icon-btn send-btn"
              onClick={() => sendMessage(inputText)}
              title="Send Message"
              disabled={isLoading || (!inputText.trim() && !isListening)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
        <span className="input-hint">Press Enter to send · Shift+Enter for new line</span>
      </div>
    </div>
  );
}
