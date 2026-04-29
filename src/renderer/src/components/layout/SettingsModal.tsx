import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.settings.get('anthropic_api_key').then((key) => {
      if (key) setApiKey(key)
    })
    inputRef.current?.focus()
  }, [])

  async function handleSave() {
    const trimmed = apiKey.trim()
    if (!trimmed) return
    await window.api.settings.set('anthropic_api_key', trimmed)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 p-6"
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
              Anthropic API Key
            </label>
            <input
              ref={inputRef}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg outline-none focus:border-blue-400 dark:focus:border-blue-500 text-gray-900 dark:text-gray-100 placeholder-gray-400 font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
              Used for Claude AI chat and task research. Get one at{' '}
              <span
                className="text-blue-500 hover:underline cursor-pointer"
                onClick={() => window.api.shell.openExternal('https://console.anthropic.com/settings/keys')}
              >
                console.anthropic.com
              </span>
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!apiKey.trim()}
              className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-colors font-medium"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
