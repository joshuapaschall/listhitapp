"use client"

export type WireframeVariant = "single" | "image-text" | "two-thirds-left" | "two-thirds-right" | "text-only" | "cta"

export default function WireframePreview({ variant }: { variant: WireframeVariant }) {
  const Hint = <div className="mx-auto mb-2 h-1.5 w-28 rounded bg-neutral-200" />

  const Logo = (
    <div className="mx-auto flex h-5 w-14 items-center justify-center rounded bg-slate-600">
      <span className="text-[7px] font-bold tracking-widest text-white">LOGO</span>
    </div>
  )

  const Headline = (
    <>
      <div className="mx-auto h-3 w-2/3 rounded bg-slate-500" />
      <div className="mx-auto h-1.5 w-1/3 rounded bg-neutral-200" />
    </>
  )

  const TextLine = ({ width }: { width: "w-full" | "w-5/6" | "w-4/6" }) => <div className={`h-2 ${width} rounded bg-neutral-200`} />

  const ImgBox = ({ h, className = "w-full" }: { h: string; className?: string }) => (
    <div className={`relative ${className} overflow-hidden rounded bg-neutral-200`} style={{ height: h }}>
      <div className="absolute left-[28%] top-[34%] h-2 w-2 rounded-full bg-neutral-300" />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/2"
        style={{ clipPath: "polygon(0 100%, 30% 45%, 55% 70%, 75% 50%, 100% 100%)", background: "#d4d4d4" }}
      />
    </div>
  )

  const Button = <div className="mx-auto h-6 w-24 rounded bg-slate-600" />
  const BigButton = <div className="mx-auto h-8 w-32 rounded bg-slate-600" />
  const SmallButton = <div className="h-5 w-20 rounded bg-slate-600" />

  const Footer = (
    <div className="mt-auto flex flex-col items-center gap-1.5 pt-2">
      <div className="h-px w-full bg-neutral-100" />
      <div className="flex gap-1">
        <div className="h-2 w-2 rounded-full bg-neutral-300" />
        <div className="h-2 w-2 rounded-full bg-neutral-300" />
        <div className="h-2 w-2 rounded-full bg-neutral-300" />
      </div>
      <div className="h-1.5 w-24 rounded bg-neutral-100" />
    </div>
  )

  return (
    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex h-full flex-col gap-2">
        {variant === "single" && (
          <>
            {Hint}
            {Logo}
            {Headline}
            <TextLine width="w-full" />
            <TextLine width="w-5/6" />
            <TextLine width="w-4/6" />
            {Button}
            {Footer}
          </>
        )}

        {variant === "image-text" && (
          <>
            {Hint}
            {Logo}
            <ImgBox h="34%" />
            {Headline}
            <TextLine width="w-full" />
            <TextLine width="w-5/6" />
            {Button}
            {Footer}
          </>
        )}

        {variant === "text-only" && (
          <>
            {Hint}
            {Logo}
            {Headline}
            <TextLine width="w-full" />
            <TextLine width="w-5/6" />
            <TextLine width="w-full" />
            <TextLine width="w-4/6" />
            {Footer}
          </>
        )}

        {variant === "cta" && (
          <>
            {Hint}
            {Logo}
            {Headline}
            <TextLine width="w-5/6" />
            {BigButton}
            {Footer}
          </>
        )}

        {variant === "two-thirds-right" && (
          <>
            {Hint}
            {Logo}
            <div className="flex gap-2">
              <ImgBox h="96px" className="w-1/3" />
              <div className="flex w-2/3 flex-col gap-2">
                <div className="h-3 w-2/3 rounded bg-slate-500" />
                <TextLine width="w-full" />
                <TextLine width="w-5/6" />
              </div>
            </div>
            {Button}
            {Footer}
          </>
        )}

        {variant === "two-thirds-left" && (
          <>
            {Hint}
            {Logo}
            <div className="flex gap-2">
              <div className="flex w-2/3 flex-col gap-2">
                <div className="h-3 w-2/3 rounded bg-slate-500" />
                <TextLine width="w-full" />
                <TextLine width="w-5/6" />
                {SmallButton}
              </div>
              <ImgBox h="96px" className="w-1/3" />
            </div>
            {Footer}
          </>
        )}
      </div>
    </div>
  )
}
