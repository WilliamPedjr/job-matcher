import { useEffect, useMemo, useRef, useState } from "react"

function CustomDropdown({
  options = [],
  value = "",
  onChange,
  placeholder = "Select",
  className = "",
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)

  const selectedLabel = useMemo(() => {
    const found = options.find((opt) => String(opt.value) === String(value))
    return found ? found.label : placeholder
  }, [options, value, placeholder])

  useEffect(() => {
    if (!isOpen) return
    const onDocClick = (event) => {
      if (!rootRef.current) return
      if (!rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [isOpen])

  return (
    <div ref={rootRef} className={`custom-dropdown ${className}`.trim()}>
      <button
        type="button"
        className={`dropdown-trigger input ${isOpen ? "open" : ""}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
      >
        <span>{selectedLabel}</span>
        <span className="dropdown-caret">{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen && (
        <div className="dropdown-menu">
          {options.map((opt) => (
            <button
              key={`${opt.value}`}
              type="button"
              className={`dropdown-item ${String(opt.value) === String(value) ? "active" : ""}`}
              onClick={() => {
                onChange?.(opt.value)
                setIsOpen(false)
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomDropdown
