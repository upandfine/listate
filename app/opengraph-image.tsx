import { ImageResponse } from 'next/og';

export const alt = 'Listate – Tracking-Links mit Open-Graph-Vorschau';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const BRAND = '#1d284d';
const ACCENT = '#9b0a00';
const BG = '#fafafa';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: BG,
          display: 'flex',
          flexDirection: 'column',
          padding: '80px 96px',
          justifyContent: 'space-between',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {/* Top: Brand-Tile + Wortmarke */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div
            style={{
              width: 112,
              height: 112,
              background: ACCENT,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="80" height="80" viewBox="0 0 100 100">
              <rect x="14" y="26" width="46" height="10" rx="3" fill="#fff" />
              <rect x="14" y="45" width="46" height="10" rx="3" fill="#fff" />
              <rect x="14" y="64" width="30" height="10" rx="3" fill="#fff" />
              <path
                d="M 64 32 L 74 32 L 90 50 L 74 68 L 64 68 L 80 50 Z"
                fill="#fff"
              />
            </svg>
          </div>
          <div
            style={{
              fontSize: 90,
              fontWeight: 700,
              letterSpacing: -3,
              color: BRAND,
              lineHeight: 1,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <span>l</span>
            {/* i mit rotem Punkt */}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  background: ACCENT,
                  marginBottom: -2,
                }}
              />
              <span style={{ marginTop: -10 }}>i</span>
            </span>
            <span>state</span>
          </div>
        </div>

        {/* Mid: Tagline */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 600,
            lineHeight: 1.15,
            color: BRAND,
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
              maxWidth: 820,
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
              color: ACCENT,
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
