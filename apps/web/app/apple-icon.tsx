import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

const ARROW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="104" height="104" fill="none" stroke="#f9f7f4" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M5 4h14"/></svg>`

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#006c50',
        }}
      >
        <img width={104} height={104} src={`data:image/svg+xml;base64,${btoa(ARROW)}`} alt="" />
      </div>
    ),
    size,
  )
}
