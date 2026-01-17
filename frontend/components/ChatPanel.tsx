'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  text: string;
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      text: input.trim(),
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Chat</h3>
      </div>

      <div style={styles.messages}>
        {messages.length === 0 ? (
          <p style={styles.empty}>No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} style={styles.message}>
              <p style={styles.messageText}>{msg.text}</p>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          style={styles.input}
        />
        <button onClick={handleSend} style={styles.sendButton}>
          Send
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: '400px',
    background: '#141414',
    borderRadius: '8px',
    border: '1px solid #262626',
    overflow: 'hidden',
  },
  header: {
    padding: '1rem',
    borderBottom: '1px solid #262626',
  },
  title: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fafafa',
  },
  messages: {
    flex: 1,
    overflowY: 'auto',
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  empty: {
    color: '#a1a1a1',
    fontSize: '0.875rem',
    textAlign: 'center',
    marginTop: '2rem',
  },
  message: {
    background: '#262626',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    maxWidth: '80%',
  },
  messageText: {
    margin: 0,
    fontSize: '0.875rem',
    color: '#fafafa',
    lineHeight: 1.5,
  },
  inputArea: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem',
    borderTop: '1px solid #262626',
  },
  input: {
    flex: 1,
    padding: '0.75rem 1rem',
    background: '#0a0a0a',
    border: '1px solid #262626',
    borderRadius: '6px',
    color: '#fafafa',
    fontSize: '0.875rem',
    outline: 'none',
  },
  sendButton: {
    padding: '0.75rem 1.5rem',
    background: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
};
