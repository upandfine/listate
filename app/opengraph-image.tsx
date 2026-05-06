import { ImageResponse } from 'next/og';

export const alt = 'Listate – Tracking-Links mit Open-Graph-Vorschau';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#fafafa',
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 96px',
          justifyContent: 'space-between',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top: Logo + Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              background: '#0a0a0a',
              borderRadius: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="64" height="64" viewBox="0 0 32 32">
              <path
                d="M9 16 H22 M17 11 L22 16 L17 21"
                stroke="#ffffff"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: -2,
              color: '#0a0a0a',
            }}
          >
            Listate
          </div>
        </div>

        {/* Mid: Tagline */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 600,
            lineHeight: 1.15,
            color: '#171717',
            maxWidth: 980,
            letterSpacing: -1,
          }}
        >
          Tracking-Links mit echter Vorschau in WhatsApp, Slack &amp; Co.
        </div>

        {/* Bottom: Sub + URL */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 32,
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: '#525252',
              maxWidth: 800,
              lineHeight: 1.3,
            }}
          >
            URL einfügen, kurzer Link entsteht. Klicks werden gezählt, Empfänger
            sehen die Original-Vorschau.
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: '#0a0a0a',
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            listate.de
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
