import test from "node:test"
import assert from "node:assert/strict"
import { movePhotoCrop } from "../../resources/js/react/utils/photoCrop.js"

const crop = { width: 1200, height: 800, zoom: 1, horizontal: 50, vertical: 50, previewWidth: 200, dx: 0, dy: 0 }

test("dragging moves the picture in the pointer direction", () => {
  assert.deepEqual(movePhotoCrop({ ...crop, dx: 25 }), { horizontal: 25, vertical: 50 })
  assert.deepEqual(movePhotoCrop({ ...crop, dx: -25 }), { horizontal: 75, vertical: 50 })
})

test("dragging stops at the image edges without exposing empty space", () => {
  assert.deepEqual(movePhotoCrop({ ...crop, dx: 1000, dy: -1000 }), { horizontal: 0, vertical: 50 })
  assert.deepEqual(movePhotoCrop({ ...crop, zoom: 2, dx: -1000, dy: 1000 }), { horizontal: 100, vertical: 0 })
})

test("zoom allows movement on both axes and scales movement to preview size", () => {
  const result = movePhotoCrop({ ...crop, zoom: 2, dx: 20, dy: 20 })
  assert.equal(result.horizontal, 45)
  assert.equal(result.vertical, 40)
  assert.deepEqual(movePhotoCrop({ ...crop, zoom: 2, dx: 40, dy: 40, previewWidth: 400 }), result)
})

test("a square image at minimum zoom remains centered when dragged", () => {
  assert.deepEqual(movePhotoCrop({ ...crop, width: 800, dx: 100, dy: 100 }), { horizontal: 50, vertical: 50 })
})
