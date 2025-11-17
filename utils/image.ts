export async function resizeImage(file: File, maxSize: number): Promise<File> {
  if (file.size <= maxSize) return file
  const isImg = /(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name)
  if (!isImg) return file
  const img = await loadImage(file)
  const canvas = document.createElement("canvas")
  const ratio = Math.sqrt(maxSize / file.size)
  canvas.width = img.width * ratio
  canvas.height = img.height * ratio
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  let blob: Blob | null = await new Promise((res) =>
    canvas.toBlob(res, "image/jpeg", 0.8)
  )
  if (!blob) return file
  if (blob.size > maxSize) {
    const scale = Math.sqrt(maxSize / blob.size)
    canvas.width = canvas.width * scale
    canvas.height = canvas.height * scale
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.7))
    if (!blob) return file
  }
  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: "image/jpeg",
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Image load failed"))
    img.src = URL.createObjectURL(file)
  })
}
