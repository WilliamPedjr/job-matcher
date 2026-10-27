export function movePhotoCrop({ width, height, zoom, horizontal, vertical, dx, dy, previewWidth }) {
  const size = Math.min(width, height) / zoom
  const scale = size / previewWidth
  const clamp = (value) => Math.max(0, Math.min(100, value))
  return {
    horizontal: width > size ? clamp(horizontal - dx * scale / (width - size) * 100) : horizontal,
    vertical: height > size ? clamp(vertical - dy * scale / (height - size) * 100) : vertical,
  }
}
