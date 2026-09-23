import { useState, useEffect } from 'react'
import './App.css'

function App() {
  // userの初期状態は null (ロード中)。 取得後に { loggedIn: boolean, username?: string } に変わる。
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [nameValue, setNameValue] = useState('')
  const [loading, setLoading] = useState(false)

  // 1. 初期アクセス時にセッション（名前）が登録されているか確認
  useEffect(() => {
    const checkUserSession = async () => {
      try {
        const response = await fetch('/api/user')
        if (response.ok) {
          const data = await response.json()
          setUser(data)
        } else {
          setUser({ loggedIn: false })
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setUser({ loggedIn: false })
      }
    }
    checkUserSession()
  }, [])

  // 2. 名前をサーバーに送信してセッションに登録する処理
  const handleNameSubmit = async (e) => {
    e.preventDefault()
    if (!nameValue.trim() || loading) return

    setLoading(true)
    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: nameValue }),
      })

      if (!response.ok) {
        throw new Error('Name registration failed')
      }

      const data = await response.json()
      if (data.success) {
        setUser({ loggedIn: true, username: data.username })
      }
    } catch (error) {
      console.error('Login error:', error)
      alert('名前の登録に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  // 3. メッセージを送信する処理
  const handleMessageSubmit = async (e) => {
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
      // 新しいメッセージをリストの先頭（上）に追加
      setMessages((prevMessages) => [data.reply, ...prevMessages])
      setInputValue('')
    } catch (error) {
      console.error('Error sending message:', error)
      alert('メッセージの送信に失敗しました。')
    } finally {
      setLoading(false)
    }
  }

  // ロード中（初期アクセス時のセッションチェック待ち）
  if (user === null) {
    return (
      <div className="app-container loading-container">
        <div className="loader">読み込み中...</div>
      </div>
    )
  }

  // ① 名前が登録されていない場合 ➔ 名前入力画面を表示
  if (!user.loggedIn) {
    return (
      <div className="app-container login-screen">
        <header className="app-header">
          <h1>GCP Sample Web App</h1>
        </header>
        <main className="login-container">
          <div className="login-card">
            <h2>ようこそ！</h2>
            <p>チャットを開始するために、あなたの名前を入力してください。</p>
            <form onSubmit={handleNameSubmit} className="login-form">
              <input
                type="text"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="名前を入力..."
                disabled={loading}
                maxLength={20}
                className="name-input"
                required
              />
              <button type="submit" disabled={loading || !nameValue.trim()} className="login-button">
                {loading ? '登録中...' : 'チャットを開始する'}
              </button>
            </form>
          </div>
        </main>
      </div>
    )
  }

  // ② 名前が登録されている場合 ➔ チャット画面を表示
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>GCP Sample Web App</h1>
        <div className="user-profile">
          ユーザー名: <span>{user.username}</span>
        </div>
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
        <form onSubmit={handleMessageSubmit} className="input-form">
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

