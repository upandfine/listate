// Inline-SVG-Illustrationen für die Landing-Page. Bewusst monochrom in
// neutral-900 + neutral-200, damit sie zum Design passen und kein
// Bilder-Asset-Pipeline brauchen.

export function FeaturePreviewIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden="true"
      className="text-brand"
    >
      <rect
        x="6"
        y="10"
        width="52"
        height="40"
        rx="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      />
      <rect
        x="11"
        y="15"
        width="22"
        height="14"
        rx="2"
        fill="currentColor"
        opacity="0.15"
      />
      <line
        x1="11"
        y1="34"
        x2="42"
        y2="34"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="11"
        y1="40"
        x2="35"
        y2="40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
      <line
        x1="11"
        y1="45"
        x2="28"
        y2="45"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.3"
      />
    </svg>
  );
}

export function FeatureCountIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden="true"
      className="text-brand"
    >
      <line
        x1="10"
        y1="54"
        x2="54"
        y2="54"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="10"
        y1="54"
        x2="10"
        y2="10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <rect x="16" y="38" width="8" height="14" fill="currentColor" opacity="0.2" />
      <rect x="28" y="28" width="8" height="24" fill="currentColor" opacity="0.45" />
      <rect x="40" y="18" width="8" height="34" fill="currentColor" />
    </svg>
  );
}

export function FeaturePrivacyIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="48"
      height="48"
      aria-hidden="true"
      className="text-brand"
    >
      <path
        d="M32 8 L52 16 V32 C52 44 42 52 32 56 C22 52 12 44 12 32 V16 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 32 L30 38 L42 26"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Ein „Browser-Window"-Frame, in dem Kinder gerendert werden.
function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-neutral-200 bg-neutral-50 px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

export function StepPasteUrl() {
  return (
    <BrowserFrame>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          Original-URL
        </div>
        <div className="flex gap-1.5">
          <div className="flex flex-1 overflow-hidden rounded-md border border-neutral-300 bg-white">
            <span className="inline-flex select-none items-center bg-neutral-100 px-1.5 font-mono text-xs text-neutral-500">
              https://
            </span>
            <div className="flex-1 truncate px-2 py-1.5 font-mono text-xs text-neutral-700">
              www.upandfine.de/blog/<span className="animate-pulse">|</span>
            </div>
          </div>
          <div className="rounded-md bg-brand px-2.5 py-1.5 text-xs font-medium text-white">
            Erzeugen
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

export function StepShortLink() {
  return (
    <BrowserFrame>
      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-neutral-500">
          Tracking-Link
        </div>
        <div className="flex gap-1.5">
          <code className="flex-1 truncate rounded-md bg-neutral-100 px-2 py-1.5 text-xs">
            https://listate.de/t/aB3xK9
          </code>
          <div className="rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs">
            Kopieren
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}

export function StepShareInChat() {
  return (
    <BrowserFrame>
      <div className="space-y-2">
        <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-3 py-1.5 text-xs text-white">
          listate.de/t/aB3xK9
        </div>
        <div className="ml-auto max-w-[85%] overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <div className="flex h-12 items-center justify-center bg-gradient-to-br from-neutral-200 to-neutral-300 text-[10px] text-neutral-500">
            Vorschau-Bild
          </div>
          <div className="space-y-0.5 px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wide text-neutral-500">
              upandfine.de
            </div>
            <div className="text-[11px] font-medium text-neutral-900">
              IT-Leadership &amp; Architektur
            </div>
            <div className="text-[10px] text-neutral-600">
              Führungskräfte-Training und Webentwicklung …
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  );
}
