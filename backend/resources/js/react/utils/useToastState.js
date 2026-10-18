import { useCallback, useRef, useState } from "react"
import { notify } from "./toasts"

// Retain form state while publishing each validation attempt, even if its text repeats.
export function useToastState(initialValue = "", type = "auto") {
  const [value, setValue] = useState(initialValue)
  const currentValue = useRef(value)
  const update = useCallback((next) => {
    const resolved = typeof next === "function" ? next(currentValue.current) : next
    currentValue.current = resolved
    setValue(resolved)
    notify(resolved, type)
  }, [type])
  return [value, update]
}
