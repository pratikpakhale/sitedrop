import { ImageResponse } from 'next/og'
import { ROOT_DOMAIN } from '@/lib/config'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'site drop'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: 96,
          background: '#f9f7f4',
          color: '#24201a',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14 }}>
          <div style={{ fontSize: 104, fontWeight: 700, letterSpacing: -3 }}>site drop</div>
          <div style={{ width: 20, height: 20, marginBottom: 22, borderRadius: 5, background: '#006c50' }} />
        </div>
        <div style={{ marginTop: 20, fontSize: 38, color: '#615d56' }}>
          {`Drop a folder. Get a live site on ${ROOT_DOMAIN}.`}
        </div>
      </div>
    ),
    size,
  )
}
