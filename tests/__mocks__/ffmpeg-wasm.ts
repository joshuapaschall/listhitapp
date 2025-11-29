export function createFFmpeg() {
  return {
    isLoaded: () => true,
    load: async () => {},
    FS: () => new Uint8Array(),
    run: async () => {},
  }
}

export async function fetchFile(file: any): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file
  if (file?.arrayBuffer) {
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }
  return new Uint8Array()
}
