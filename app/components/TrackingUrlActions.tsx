import { CopyButton } from './CopyButton';
import { QrButton } from './QrButton';
import { ShareButton } from './ShareButton';

/**
 * Copy/Share/QR-Trio fuer eine Tracking-URL. Vorher dreifach (Dashboard-
 * Liste, Detail-Seite, Create-Erfolgs-Card) inline wiederholt — eine
 * zentrale Stelle, falls ein vierter Kanal dazukommt.
 */
export function TrackingUrlActions({ value }: { value: string }) {
  return (
    <>
      <CopyButton value={value} />
      <ShareButton value={value} />
      <QrButton value={value} />
    </>
  );
}
