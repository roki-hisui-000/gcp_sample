import { useState, useRef } from 'react'
import './App.css'

function App() {
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!inputValue.trim() || loading) return

    setLoading(true)
    try {
      const response = await fetch('/api/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: inputValue }),
      })

      if (!response.ok) {
        throw new Error('Server response was not ok')
      }

      const data = await response.json()
      // 新しいメッセージをリストの先頭（上）に追加する
      // （要件：上が最新のメッセージを表示して、下になるほど古いメッセージを表示する）
      setMessages((prevMessages) => [data.reply, ...prevMessages])
      setInputValue('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>GCP Sample Web App</h1>
      </header>

      <main className="message-container">
        {messages.length === 0 ? (
          <div className="no-messages">メッセージはありません。下のフォームから送信してください。</div>
        ) : (
          <div className="message-list">
            {messages.map((msg, index) => (
              <div key={index} className="message-item">
                {msg}
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="input-container">
        <form onSubmit={handleSubmit} className="input-form">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="メッセージを入力してください..."
            disabled={loading}
            className="message-input"
          />
          <button type="submit" disabled={loading || !inputValue.trim()} className="send-button">
            {loading ? '送信中...' : '送信'}
          </button>
        </form>
      </footer>
    </div>
  )
}

export default App
