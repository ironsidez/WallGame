import { useState, useEffect, useRef } from 'react'
import { useGameStore, emitChatMessage } from '../stores'

interface ChatMessage {
  id: string
  username: string
  message: string
  timestamp: number
  type?: 'user' | 'system' | 'game'
}

export function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { socket } = useGameStore()

  useEffect(() => {
    if (!socket) return

    socket.on('chat-message', (data: ChatMessage) => {
      setMessages(prev => [...prev, data])
    })

    socket.on('game-event', (data: { message: string; type: 'system' | 'game' }) => {
      const systemMessage: ChatMessage = {
        id: Date.now().toString(),
        username: 'System',
        message: data.message,
        timestamp: Date.now(),
        type: data.type
      }
      setMessages(prev => [...prev, systemMessage])
    })

    // Add welcome message
    const welcomeMessage: ChatMessage = {
      id: 'welcome',
      username: 'System',
      message: 'Welcome to the battlefield! Chat with other players here.',
      timestamp: Date.now(),
      type: 'system'
    }
    setMessages([welcomeMessage])

    return () => {
      socket.off('chat-message')
      socket.off('game-event')
    }
  }, [socket])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!inputMessage.trim()) return

    emitChatMessage(inputMessage.trim())
    setInputMessage('')
  }

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const getMessageClass = (type?: string) => {
    switch (type) {
      case 'system':
        return 'message-system'
      case 'game':
        return 'message-game'
      default:
        return 'message-user'
    }
  }

  return (
    <div className={`chat-panel ${isMinimized ? 'minimized' : ''}`}>
      <div className="chat-header">
        <h4>💬 Chat</h4>
        <button 
          className="minimize-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand chat' : 'Minimize chat'}
        >
          {isMinimized ? '⬆' : '⬇'}
        </button>
      </div>

      {!isMinimized && (
        <>
          <div className="chat-messages">
            {messages.map((message) => (
              <div key={message.id} className={`chat-message ${getMessageClass(message.type)}`}>
                <div className="message-header">
                  <span className="message-username">{message.username}</span>
                  <span className="message-time">{formatTime(message.timestamp)}</span>
                </div>
                <div className="message-content">{message.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="chat-input">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type a message..."
              maxLength={200}
              disabled={!socket}
            />
            <button 
              type="submit" 
              disabled={!inputMessage.trim() || !socket}
              title="Send message"
            >
              📤
            </button>
          </form>

          <div className="chat-tips">
            <small>💡 Be respectful and have fun!</small>
          </div>
        </>
      )}
    </div>
  )
}
