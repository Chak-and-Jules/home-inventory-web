import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resizeImage } from './imageUtils'

describe('resizeImage', () => {
  // Store original globals
  const originalFileReader = global.FileReader
  const originalImage = global.Image
  const originalDocumentCreateElement = document.createElement.bind(document)

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore globals after each test
    global.FileReader = originalFileReader
    global.Image = originalImage
    document.createElement = originalDocumentCreateElement
  })

  it('resizes image maintaining aspect ratio when width > height', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const mockImage = {
      width: 800,
      height: 400,
      src: '',
      onload: null as any,
      onerror: null as any,
    }
    global.Image = class {
      width = mockImage.width
      height = mockImage.height
      get src() { return mockImage.src }
      set src(val) { mockImage.src = val }
      get onload() { return mockImage.onload }
      set onload(fn) { mockImage.onload = fn }
      get onerror() { return mockImage.onerror }
      set onerror(fn) { mockImage.onerror = fn }
    } as any

    const mockContext = {
      drawImage: vi.fn(),
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback) => callback(new Blob(['fake image data']))),
    }
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return mockCanvas as any
      return originalDocumentCreateElement(tag)
    })

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    // Trigger FileReader onload
    mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,fake' } })

    // Trigger Image onload
    mockImage.onload()

    const blob = await promise

    expect(blob).toBeInstanceOf(Blob)
    expect(mockCanvas.width).toBe(400)
    expect(mockCanvas.height).toBe(200) // 800x400 scaled down to max 400 width -> 400x200
    expect(mockContext.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 400, 200)
  })

  it('resizes image maintaining aspect ratio when height > width', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const mockImage = {
      width: 400,
      height: 800,
      src: '',
      onload: null as any,
      onerror: null as any,
    }
    global.Image = class {
      width = mockImage.width
      height = mockImage.height
      get src() { return mockImage.src }
      set src(val) { mockImage.src = val }
      get onload() { return mockImage.onload }
      set onload(fn) { mockImage.onload = fn }
      get onerror() { return mockImage.onerror }
      set onerror(fn) { mockImage.onerror = fn }
    } as any

    const mockContext = {
      drawImage: vi.fn(),
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback) => callback(new Blob(['fake image data']))),
    }
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return mockCanvas as any
      return originalDocumentCreateElement(tag)
    })

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,fake' } })
    mockImage.onload()

    const blob = await promise

    expect(blob).toBeInstanceOf(Blob)
    expect(mockCanvas.width).toBe(200) // 400x800 scaled down to max 400 height -> 200x400
    expect(mockCanvas.height).toBe(400)
    expect(mockContext.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 200, 400)
  })

  it('rejects when FileReader fails', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    mockFileReader.onerror()

    await expect(promise).rejects.toThrow('Failed to read file')
  })

  it('rejects when Image fails to load', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const mockImage = {
      src: '',
      onload: null as any,
      onerror: null as any,
    }
    global.Image = class {
      get src() { return mockImage.src }
      set src(val) { mockImage.src = val }
      get onload() { return mockImage.onload }
      set onload(fn) { mockImage.onload = fn }
      get onerror() { return mockImage.onerror }
      set onerror(fn) { mockImage.onerror = fn }
    } as any

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,fake' } })
    mockImage.onerror()

    await expect(promise).rejects.toThrow('Failed to load image')
  })

  it('rejects when getting canvas context fails', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const mockImage = {
      width: 100,
      height: 100,
      src: '',
      onload: null as any,
      onerror: null as any,
    }
    global.Image = class {
      width = mockImage.width
      height = mockImage.height
      get src() { return mockImage.src }
      set src(val) { mockImage.src = val }
      get onload() { return mockImage.onload }
      set onload(fn) { mockImage.onload = fn }
      get onerror() { return mockImage.onerror }
      set onerror(fn) { mockImage.onerror = fn }
    } as any

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => null), // Returns null context
      toBlob: vi.fn(),
    }
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return mockCanvas as any
      return originalDocumentCreateElement(tag)
    })

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,fake' } })
    mockImage.onload()

    await expect(promise).rejects.toThrow('Failed to get canvas context')
  })

  it('rejects when canvas toBlob fails', async () => {
    const mockFileReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      onerror: null as any,
    }
    global.FileReader = class {
      readAsDataURL = mockFileReader.readAsDataURL
      get onload() { return mockFileReader.onload }
      set onload(fn) { mockFileReader.onload = fn }
      get onerror() { return mockFileReader.onerror }
      set onerror(fn) { mockFileReader.onerror = fn }
    } as any

    const mockImage = {
      width: 100,
      height: 100,
      src: '',
      onload: null as any,
      onerror: null as any,
    }
    global.Image = class {
      width = mockImage.width
      height = mockImage.height
      get src() { return mockImage.src }
      set src(val) { mockImage.src = val }
      get onload() { return mockImage.onload }
      set onload(fn) { mockImage.onload = fn }
      get onerror() { return mockImage.onerror }
      set onerror(fn) { mockImage.onerror = fn }
    } as any

    const mockContext = {
      drawImage: vi.fn(),
    }
    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockContext),
      toBlob: vi.fn((callback) => callback(null)), // Returns null blob
    }
    document.createElement = vi.fn((tag) => {
      if (tag === 'canvas') return mockCanvas as any
      return originalDocumentCreateElement(tag)
    })

    const file = new File(['fake data'], 'test.jpg', { type: 'image/jpeg' })
    const promise = resizeImage(file, 400, 400)

    mockFileReader.onload({ target: { result: 'data:image/jpeg;base64,fake' } })
    mockImage.onload()

    await expect(promise).rejects.toThrow('Failed to convert canvas to blob')
  })
})
