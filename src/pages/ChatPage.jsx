import { useState, useEffect, useRef } from 'react'
import { sendChat } from '../api/chat'

const STORAGE_KEY = 'farmhouse-ai-chat'

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML.replace(/\n/g, '<br>')
}

export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch (_) {}
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const saveToSession = (msgs) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs))
    } catch (_) {}
  }

  const resetChat = () => {
    setMessages([])
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch (_) {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMsg = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    saveToSession(newMessages)

    try {
      const data = await sendChat(newMessages)
      const content = data.content || ''
      const assistantMsg = { role: 'assistant', content }
      const updated = [...newMessages, assistantMsg]
      setMessages(updated)
      saveToSession(updated)
    } catch (err) {
      const errorMsg = { role: 'error', content: err.message || 'Failed to connect.' }
      const updated = [...newMessages, errorMsg]
      setMessages(updated)
      saveToSession(newMessages)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto w-full px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl">smart_toy</span>
              AI Assistant
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Ask anything about your logistics data
            </p>
          </div>
          <button
            type="button"
            onClick={resetChat}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            title="Start a new conversation"
          >
            <span className="material-symbols-outlined text-lg">restart_alt</span>
            Reset chat
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-6 py-6">
        <div className="flex-1 overflow-y-auto pb-4">
          {messages.length === 0 && !loading && (
            <div className="py-12 px-4 text-center text-slate-500">
              <p className="my-2">Ask questions about your logistics data in plain language.</p>
              <p className="text-sm opacity-80">
                e.g. &quot;How many shipments are pending?&quot; or &quot;What tables exist?&quot;
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex gap-3 mb-4 p-3 rounded-lg ${
                m.role === 'user'
                  ? 'bg-sky-50 border border-slate-200'
                  : m.role === 'error'
                    ? 'bg-red-50 border border-red-200'
                    : 'bg-white border border-slate-200 shadow-sm'
              }`}
            >
              <span
                className={`flex-shrink-0 text-xs font-semibold ${
                  m.role === 'user'
                    ? 'text-sky-600'
                    : m.role === 'error'
                      ? 'text-red-600'
                      : 'text-emerald-600'
                }`}
              >
                {m.role === 'user' ? 'You' : m.role === 'error' ? 'Error' : 'AI'}
              </span>
              <div
                className="flex-1 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: escapeHtml(m.content || ''),
                }}
              />
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 mb-4 p-3 rounded-lg bg-white border border-slate-200 shadow-sm">
              <span className="flex-shrink-0 text-xs font-semibold text-emerald-600">
                AI
              </span>
              <div className="flex-1 whitespace-pre-wrap text-slate-500">
                Thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="pt-2">
          <div className="relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask..."
              rows={1}
              disabled={loading}
              className="w-full pr-10 pl-3 py-2.5 text-sm border border-slate-200 rounded-md bg-white text-slate-800 resize-none min-h-[40px] max-h-[100px] focus:outline-none focus:border-slate-300 placeholder:text-slate-400 disabled:opacity-60"
            />
            <div className="absolute right-2 inset-y-0 flex items-center pointer-events-none -mt-1">
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-0.5 text-slate-400 hover:text-sky-500 disabled:opacity-40 disabled:hover:text-slate-400 disabled:cursor-not-allowed transition-colors pointer-events-auto"
              >
              {loading ? (
                <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-lg">arrow_upward</span>
              )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
