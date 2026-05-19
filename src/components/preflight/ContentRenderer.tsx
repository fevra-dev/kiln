'use client';

import { FC } from 'react';

interface ContentRendererProps {
  contentType: string;
  contentUrl: string;
  contentLength: number;
  inscriptionId: string;
}

// Reserved for future client-side fetch-and-truncate implementation.
// @ts-expect-error intentionally unused — hook for fetch-and-truncate text preview
const MAX_TEXT_PREVIEW_BYTES = 4 * 1024;

/**
 * Renders inscription content by content-type.
 * - image/*: <img>
 * - text/* and application/json: sandboxed <iframe>
 * - text/html: sandboxed <iframe> with external-link escape hatch
 * - video/audio: native <video>/<audio> controls
 * - other: download link with file metadata
 */
export const ContentRenderer: FC<ContentRendererProps> = ({
  contentType,
  contentUrl,
  contentLength,
  inscriptionId,
}) => {
  const externalUrl = `https://ordinals.com/inscription/${inscriptionId}`;

  if (contentType.startsWith('image/')) {
    return (
      <img
        src={contentUrl}
        alt={`Inscription ${inscriptionId}`}
        style={{ maxWidth: 256, maxHeight: 256, objectFit: 'contain', display: 'block' }}
      />
    );
  }

  if (contentType === 'text/html') {
    return (
      <div>
        <iframe
          src={contentUrl}
          sandbox=""
          style={{ width: '100%', height: 256, border: '1px solid currentColor' }}
          title={`Inscription ${inscriptionId}`}
        />
        <div style={{ fontSize: 12, marginTop: 4, opacity: 0.7 }}>
          HTML inscription — preview disabled for safety.{' '}
          <a href={externalUrl} target="_blank" rel="noopener noreferrer">
            Open externally →
          </a>
        </div>
      </div>
    );
  }

  if (contentType.startsWith('text/') || contentType === 'application/json') {
    return <TextPreview contentUrl={contentUrl} />;
  }

  if (contentType.startsWith('video/')) {
    return (
      <video controls preload="metadata" style={{ maxWidth: 256, maxHeight: 256 }}>
        <source src={contentUrl} type={contentType} />
      </video>
    );
  }

  if (contentType.startsWith('audio/')) {
    return <audio controls preload="metadata" src={contentUrl} />;
  }

  return (
    <div style={{ fontSize: 12, opacity: 0.8 }}>
      <div>{contentType}</div>
      <div>{contentLength.toLocaleString()} bytes</div>
      <a href={contentUrl} target="_blank" rel="noopener noreferrer" download>
        Download →
      </a>
    </div>
  );
};

const TextPreview: FC<{ contentUrl: string }> = ({ contentUrl }) => {
  // Reuse the same sandboxed iframe approach for text/JSON content. The
  // browser renders text/plain inline; we just need to keep any embedded
  // active content sandboxed.
  return (
    <iframe
      src={contentUrl}
      sandbox=""
      style={{ width: '100%', height: 256, border: '1px solid currentColor', background: 'transparent' }}
      title="inscription text preview"
    />
  );
};
