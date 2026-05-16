export class FFmpeg {
  loaded = true

  async load() {}

  async exec(_args: string[]) {}

  async writeFile(_name: string, _data: Uint8Array) {}

  async readFile(_name: string) {
    return new Uint8Array()
  }

  async deleteFile(_name: string) {}
}

export async function fetchFile(file: any): Promise<Uint8Array> {
  if (file instanceof Uint8Array) return file
  if (file?.arrayBuffer) {
    const buffer = await file.arrayBuffer()
    return new Uint8Array(buffer)
  }
  return new Uint8Array()
}
