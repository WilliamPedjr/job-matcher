import React, { useEffect, useRef, useState } from "react"
import { movePhotoCrop } from "../utils/photoCrop"

export default function ProfilePhotoEditor({ source, onSave, onClose, saving, error }) {
  const dialogRef = useRef(null)
  const canvasRef = useRef(null)
  const dragRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [image, setImage] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [horizontal, setHorizontal] = useState(50)
  const [vertical, setVertical] = useState(50)
  const [editorError, setEditorError] = useState("")
  const [exporting, setExporting] = useState(false)
  const busy = saving || exporting

  useEffect(() => {
    const previousFocus = document.activeElement
    dialogRef.current.showModal()
    return () => previousFocus?.focus()
  }, [])

  useEffect(() => {
    let active = true
    const url = source instanceof File ? URL.createObjectURL(source) : source
    const picture = new Image()
    picture.onload = () => { if (active) setImage(picture) }
    picture.onerror = () => { if (active) setEditorError("Unable to open this picture. Try uploading another one.") }
    picture.src = url
    return () => {
      active = false
      if (source instanceof File) URL.revokeObjectURL(url)
    }
  }, [source])

  useEffect(() => {
    if (!image || !canvasRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    const size = Math.min(image.naturalWidth, image.naturalHeight) / zoom
    const x = (image.naturalWidth - size) * horizontal / 100
    const y = (image.naturalHeight - size) * vertical / 100
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, x, y, size, size, 0, 0, canvas.width, canvas.height)
  }, [image, zoom, horizontal, vertical])

  const moveCrop = (dx, dy, start = { horizontal, vertical }) => {
    if (!image || busy) return
    const position = movePhotoCrop({
      width: image.naturalWidth, height: image.naturalHeight, zoom,
      horizontal: start.horizontal, vertical: start.vertical, dx, dy,
      previewWidth: canvasRef.current.getBoundingClientRect().width,
    })
    setHorizontal(position.horizontal)
    setVertical(position.vertical)
  }

  const startDrag = (event) => {
    if (!image || busy || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, horizontal, vertical }
    setDragging(true)
  }

  const stopDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const save = async () => {
    if (!image || busy) return
    setExporting(true)
    setEditorError("")
    try {
      const blob = await new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png"))
      if (!blob) throw new Error("Unable to prepare this picture. Please try again.")
      await onSave(new File([blob], "profile-photo.png", { type: "image/png" }))
    } catch (exception) {
      setEditorError(exception.message || "Unable to save this picture.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <dialog ref={dialogRef} className="modal-card profile-photo-editor" aria-labelledby="photo-editor-heading"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}>
      <h3 id="photo-editor-heading">Adjust photo</h3>
      <p className="profile-photo-hint">Please use a clear, professional photo of yourself.</p>
      <canvas ref={canvasRef} width={512} height={512}
        className={`profile-photo-preview${dragging ? " is-dragging" : ""}`} tabIndex={busy || !image ? -1 : 0}
        role="group" aria-label="Profile picture crop preview. Drag or use arrow keys to reposition."
        aria-describedby="photo-drag-hint" aria-disabled={busy || !image}
        onPointerDown={startDrag}
        onPointerMove={(event) => {
          const start = dragRef.current
          if (start?.pointerId === event.pointerId) moveCrop(event.clientX - start.x, event.clientY - start.y, start)
        }}
        onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}
        onKeyDown={(event) => {
          const steps = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }
          if (steps[event.key]) { event.preventDefault(); moveCrop(...steps[event.key]) }
        }} />
      <p id="photo-drag-hint" className="profile-photo-hint">Drag the picture to reposition.</p>
      {!image && !editorError && <p role="status">Loading picture...</p>}
      <fieldset disabled={busy || !image} className="profile-photo-controls">
        <label>Zoom<input aria-label="Photo zoom" type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
      </fieldset>
      {(editorError || error) && <p className="js-profile-photo-error" role="alert">{editorError || error}</p>}
      <div className="modal-actions">
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={() => { setZoom(1); setHorizontal(50); setVertical(50) }}>Reset</button>
        <button className="btn btn-secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button>
        <button className="btn primary" type="button" disabled={busy || !image} onClick={save}>{busy ? "Saving..." : "Save photo"}</button>
      </div>
    </dialog>
  )
}
