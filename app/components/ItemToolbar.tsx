import { deleteLinkFormAction } from '@/app/actions/links';
import { parseTags } from '@/lib/tags';
import { toLinkPreviewInput, type LinkPreviewInput } from '@/types/link';
import { ConfirmButton } from './ConfirmButton';
import { EditLinkButton } from './EditLinkButton';
import { PreviewOverrideButton } from './PreviewOverrideButton';

/**
 * Aktions-Cluster einer Link-Zeile im Dashboard: Bearbeiten / Vorschau /
 * Loeschen. Vorher als grosser Inline-Block (inkl. 9-Feld-
 * Objektliteral fuer PreviewOverrideButton) in dashboard/page.tsx.
 * Die Feature-J-Mobile-Tweaks (Icon-Only ab <sm) leben jetzt zentral
 * in den verwendeten Button-Komponenten.
 */
interface ItemToolbarProps {
  link: LinkPreviewInput & {
    originalUrl: string;
    slug: string | null;
    tags: string | null;
    expiresAt: string | null;
  };
}

export function ItemToolbar({ link }: ItemToolbarProps) {
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
      <EditLinkButton
        linkId={link.id}
        defaultUrl={link.originalUrl}
        defaultSlug={link.slug ?? null}
        defaultTags={parseTags(link.tags).join(', ')}
        hasExpiry={!!link.expiresAt}
      />
      <PreviewOverrideButton link={toLinkPreviewInput(link)} />
      <ConfirmButton
        formAction={deleteLinkFormAction}
        hiddenFields={{ id: link.id }}
        buttonAriaLabel="Link löschen"
        buttonVariant="toolbarDanger"
        buttonLabel={
          <span className="flex items-center gap-1">
            <TrashIcon />
            <span className="hidden sm:inline">Löschen</span>
          </span>
        }
        title="Link wirklich löschen?"
        message={
          <>
            Damit verschwinden Tracking-URL, Klick-Zähler und Klick-Verlauf
            unwiderruflich. Die ursprüngliche Original-URL bleibt natürlich
            existieren.
          </>
        }
        confirmLabel="Endgültig löschen"
        danger
      />
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 4 H13" />
      <path d="M6 4 V2.5 a1 1 0 0 1 1 -1 h2 a1 1 0 0 1 1 1 V4" />
      <path d="M4.5 4 L5 13 a1 1 0 0 0 1 1 h4 a1 1 0 0 0 1 -1 L11.5 4" />
    </svg>
  );
}
