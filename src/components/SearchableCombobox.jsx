import { useState, useRef, useEffect } from 'react'

/**
 * Combobox: input with dropdown icon. Click to open; type to filter options.
 */
export default function SearchableCombobox({
  label,
  hint,
  placeholder = 'Select...',
  options = [],
  value,
  displayText,
  onSelect,
  getOptionId,
  getOptionLabel,
  renderOption,
  required = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState(displayText || '')
  const inputRef = useRef(null)
  const wrapRef = useRef(null)

  const getId = getOptionId || ((o) => o?.id ?? o?.value ?? '')
  const getLabel = getOptionLabel || ((o) => (o?.label ?? o?.text ?? String(o)))

  const filtered = !filter.trim()
    ? options
    : options.filter((o) => getLabel(o).toLowerCase().includes(filter.toLowerCase().trim()))

  useEffect(() => {
    if (!open) setFilter(displayText || '')
  }, [open, displayText])

  useEffect(() => {
    if (!open) return
    const onBlur = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.relatedTarget)) return
      setTimeout(() => setOpen(false), 150)
    }
    const input = inputRef.current
    input?.addEventListener('blur', onBlur)
    return () => input?.removeEventListener('blur', onBlur)
  }, [open])

  const handleFieldClick = () => {
    if (!open) {
      setOpen(true)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const handleSelect = (opt) => {
    onSelect(getId(opt), getLabel(opt))
    setFilter(getLabel(opt))
    setOpen(false)
    inputRef.current?.blur()
  }

  const inputId = id ? `${id}-search` : undefined

  return (
    <div ref={wrapRef}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1.5">
          {label} {required && '*'}
        </label>
      )}
      {hint && <p className="text-xs text-slate-500 mb-1">{hint}</p>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={inputId}
          autoComplete="off"
          placeholder={placeholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={handleFieldClick}
          readOnly={!open}
          className="w-full pl-4 pr-9 py-2.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" aria-hidden>
          <span
            className={`material-symbols-outlined text-xl transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ fontSize: '20px' }}
          >
            arrow_drop_down
          </span>
        </span>
        {open && (
          <div
            className="absolute top-full left-0 right-0 mt-1 z-50 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto overflow-x-hidden"
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="px-4 py-2.5 text-sm text-slate-500">No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={getId(opt)}
                  type="button"
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-sky-50 border-b border-slate-100 last:border-0"
                  onClick={() => handleSelect(opt)}
                >
                  {renderOption ? renderOption(opt) : getLabel(opt)}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
