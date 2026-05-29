import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const render = vi.fn()
const createRoot = vi.fn(() => ({
  render,
}))
const AppMock = vi.fn(() => null)

vi.mock('react-dom/client', () => ({
  createRoot,
}))

vi.mock('../App.tsx', () => ({
  default: AppMock,
}))

describe('main bootstrap', () => {
  beforeEach(() => {
    vi.resetModules()
    createRoot.mockClear()
    render.mockClear()
    AppMock.mockClear()
    document.body.innerHTML = '<div id="root"></div>'
  })

  it('mounts the app into the root container inside strict mode', async () => {
    await import('../main.tsx')

    expect(createRoot).toHaveBeenCalledWith(document.getElementById('root'))
    expect(render).toHaveBeenCalledTimes(1)
    const element = render.mock.calls[0][0]
    expect(element.type).toBe(StrictMode)
    expect(element.props.children.type).toBe(AppMock)
  })
})
