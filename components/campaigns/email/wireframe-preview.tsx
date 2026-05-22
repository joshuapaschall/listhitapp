"use client"

export type WireframeVariant =
  | "single"
  | "image-text"
  | "two-thirds-left"
  | "two-thirds-right"
  | "text-only"
  | "cta"

export default function WireframePreview({ variant }: { variant: WireframeVariant }) {
  const Logo = <div className="mx-auto h-4 w-12 rounded bg-neutral-300" />
  const TitleLine = <div className="mx-auto h-2.5 w-2/3 rounded bg-neutral-400" />
  const TextLine = ({ width = "w-full" }: { width?: string }) => <div className={`h-2 ${width} rounded bg-neutral-200`} />
  const Button = <div className="mx-auto h-6 w-24 rounded bg-neutral-800" />
  const SmallButton = <div className="h-5 w-20 rounded bg-neutral-700" />
  const BigButton = <div className="mx-auto h-8 w-32 rounded bg-neutral-800" />

  const ImgBox = ({ height, className = "w-full" }: { height: string; className?: string }) => (
    <div className={`${className} rounded bg-neutral-200`} style={{ height }} />
  )

  return (
    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-white p-4">
      <div className="flex h-full flex-col gap-2">
        {variant === "single" && (
          <>
            {Logo}
            {TitleLine}
            <TextLine />
            <TextLine width="w-5/6" />
            <TextLine width="w-4/6" />
            <div className="mt-auto">{Button}</div>
          </>
        )}

        {variant === "image-text" && (
          <>
            {Logo}
            <ImgBox height="40%" />
            {TitleLine}
            <TextLine />
            <TextLine width="w-5/6" />
            <div className="mt-auto">{Button}</div>
          </>
        )}

        {variant === "text-only" && (
          <>
            {Logo}
            {TitleLine}
            <TextLine />
            <TextLine width="w-5/6" />
            <TextLine />
            <TextLine width="w-4/6" />
          </>
        )}

        {variant === "cta" && (
          <>
            {Logo}
            {TitleLine}
            <TextLine width="w-5/6" />
            <div className="pt-2">{BigButton}</div>
            <div className="flex-1" />
          </>
        )}

        {variant === "two-thirds-right" && (
          <>
            {Logo}
            <div className="mt-1 flex gap-2">
              <ImgBox height="110px" className="w-1/3" />
              <div className="flex w-2/3 flex-col gap-2">
                {TitleLine}
                <TextLine />
                <TextLine width="w-5/6" />
              </div>
            </div>
            <div className="mt-auto">{Button}</div>
          </>
        )}

        {variant === "two-thirds-left" && (
          <>
            {Logo}
            <div className="mt-1 flex gap-2">
              <div className="flex w-2/3 flex-col gap-2">
                {TitleLine}
                <TextLine />
                <TextLine width="w-5/6" />
                <div className="pt-1">{SmallButton}</div>
              </div>
              <ImgBox height="110px" className="w-1/3" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
