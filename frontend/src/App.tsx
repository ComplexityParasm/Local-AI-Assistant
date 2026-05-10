import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import './App.css';

const API_URL = 'http://localhost:4000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: number;
  title: string;
  messages?: Message[];
  created_at?: string;
  updated_at?: string;
}

function App() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [authError, setAuthError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentChat?.messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const handleAuth = async () => {
    setAuthError('');
    try {
      const endpoint = isLogin ? '/api/login' : '/api/register';
      const payload = isLogin 
        ? { username, password }
        : { username, password, email: `${username}@example.com}` };
      
      const response = await axios.post(`${API_URL}${endpoint}`, payload);
      const { access_token } = response.data;
      localStorage.setItem('token', access_token);
      setToken(access_token);
      await loadChats();
    } catch (error: any) {
      console.error('Auth error:', error);
      setAuthError(error.response?.data?.detail || 'Authentication failed');
    }
  };

  const loadChats = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/chats`);
      setChats(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Error loading chats:', error);
      setChats([]);
    }
  };

  const createChat = async () => {
    try {
      const response = await axios.post(`${API_URL}/api/chats`, {
        title: `Chat ${chats.length + 1}`
      });
      const newChat = { ...response.data, messages: [] };
      setChats([newChat, ...chats]);
      setCurrentChat(newChat);
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  const loadChatMessages = async (chatId: number) => {
    try {
      const response = await axios.get(`${API_URL}/api/chats/${chatId}`);
      setCurrentChat({
        ...response.data,
        messages: response.data.messages || []
      });
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const deleteChat = async (chatId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this chat?')) {  // ✅ заменили confirm на window.confirm
      try {
        await axios.delete(`${API_URL}/api/chats/${chatId}`);
        setChats(chats.filter(c => c.id !== chatId));
        if (currentChat?.id === chatId) {
          setCurrentChat(null);
        }
      } catch (error) {
        console.error('Error deleting chat:', error);
      }
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const sendMessage = async () => {
    if (!input.trim() || !currentChat || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    const updatedMessages = [...(currentChat.messages || []), { role: 'user' as const, content: userMessage }];
    setCurrentChat({ ...currentChat, messages: updatedMessages });

    try {
      const response = await fetch(`${API_URL}/api/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          chat_id: currentChat.id,
          content: userMessage
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantResponse = '';

      setCurrentChat(prev => prev ? {
        ...prev,
        messages: [...(prev.messages || []), { role: 'assistant', content: '' }]
      } : null);

      if (reader) {
        // ✅ исправляем предупреждение: выносим обработку в отдельную функцию
        const processChunk = (chunkText: string) => {
          const lines = chunkText.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data !== '[DONE]' && data.trim()) {
                assistantResponse += data;
                setCurrentChat(prev => {
                  if (!prev) return prev;
                  const newMessages = [...(prev.messages || [])];
                  if (newMessages[newMessages.length - 1]?.role === 'assistant') {
                    newMessages[newMessages.length - 1].content = assistantResponse;
                  }
                  return { ...prev, messages: newMessages };
                });
              }
            }
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          processChunk(chunk);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setIsLoading(false);
      await loadChats();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const MarkdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeId = Math.random().toString(36);
      
      return !inline && match ? (
        <div className="code-block">
          <div className="code-header">
            <span className="code-language">{match[1]}</span>
            <button 
              className="copy-button"
              onClick={() => copyToClipboard(codeString, codeId)}
            >
              {copiedId === codeId ? '✓' : '📋'}
              {copiedId === codeId ? ' Copied!' : ' Copy'}
            </button>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={match[1]}
            PreTag="div"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    a({ node, children, href, ...props }: any) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
          {children}
        </a>
      );
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <span className="auth-icon">🤖</span>
            <h1>AI Assistant</h1>
            <p>Local LLM Chat Interface</p>
          </div>
          <div className="auth-form">
            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            {authError && <div className="auth-error">{authError}</div>}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
            />
            <button onClick={handleAuth} className="auth-button">
              {isLogin ? 'Login' : 'Register'}
            </button>
            <button onClick={() => setIsLogin(!isLogin)} className="switch-button">
              {isLogin ? 'Create new account' : 'Back to login'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="sidebar">
        <button onClick={createChat} className="new-chat-btn">
          <span>➕</span> New Chat
        </button>
        
        <div className="chats-list">
          {chats.length === 0 ? (
            <div className="no-chats">No chats yet</div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${currentChat?.id === chat.id ? 'active' : ''}`}
                onClick={() => loadChatMessages(chat.id)}
              >
                <span className="chat-icon">💬</span>
                <span className="chat-title">{chat.title}</span>
                <button 
                  className="delete-chat-btn"
                  onClick={(e) => deleteChat(chat.id, e)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
        
        <div className="sidebar-footer">
          <div className="user-info">
            <span>👤</span>
            <span>{username}</span>
          </div>
          <button onClick={() => {
            localStorage.removeItem('token');
            setToken(null);
            setChats([]);
            setCurrentChat(null);
          }} className="logout-btn">
            🚪 Logout
          </button>
        </div>
      </div>

      <div className="chat-container">
        {currentChat ? (
          <>
            <div className="chat-header">
              <div className="chat-header-content">
                <h2>{currentChat.title}</h2>
                <p className="chat-status">Powered by Qwen LLM</p>
              </div>
            </div>

            <div className="messages-container">
              {currentChat.messages && currentChat.messages.length > 0 ? (
                currentChat.messages.map((msg, idx) => (
                  <div key={idx} className={`message-wrapper ${msg.role}`}>
                    <div className="message-avatar">
                      {msg.role === 'user' ? '👤' : '🤖'}
                    </div>
                    <div className="message-content">
                      <div className="message-role">
                        {msg.role === 'user' ? 'You' : 'Assistant'}
                      </div>
                      <div className="message-text">
                        {msg.role === 'assistant' ? (
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={MarkdownComponents}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="welcome-message">
                  <span style={{ fontSize: 48 }}>🤖</span>
                  <h3>Welcome to AI Assistant</h3>
                  <p>Start a conversation with your local LLM</p>
                </div>
              )}
              {isLoading && (
                <div className="message-wrapper assistant">
                  <div className="message-avatar">🤖</div>
                  <div className="message-content">
                    <div className="message-role">Assistant</div>
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="input-container">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Send a message... (Shift + Enter for new line)"
                disabled={isLoading}
                rows={1}
              />
              <button 
                onClick={sendMessage} 
                disabled={isLoading || !input.trim()}
                className="send-button"
              >
                📤
              </button>
            </div>
          </>
        ) : (
          <div className="empty-state">
            <span style={{ fontSize: 64 }}>💬</span>
            <h3>No chat selected</h3>
            <p>Create a new chat or select an existing one</p>
            <button onClick={createChat} className="create-chat-btn">
              <span>➕</span> New Chat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;