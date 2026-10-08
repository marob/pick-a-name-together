import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useDataset } from '../app';
import { t } from '../i18n';
import { useStore } from '../store';
import { chunkPayload, encodeVotes, shareUrl, SINGLE_QR_MAX } from '../share';
import { Sheet } from './Sheet';
import { toast } from './Toast';

const FRAME_MS = 700;

export function ShareSheet(props: { onClose: () => void }) {
  const ds = useDataset();
  const myName = useStore((s) => s.myName);
  const votes = useStore((s) => s.votes);
  const payload = useMemo(() => encodeVotes(ds, myName, votes), [ds, myName, votes]);
  const url = shareUrl(payload);
  const single = url.length <= SINGLE_QR_MAX;
  const frames = useMemo(() => (single ? [url] : chunkPayload(payload)), [payload, single]);
  const count = Object.keys(votes).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast(t('share.copied'));
    } catch {
      toast(t('share.copyFailed'));
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: t('share.shareTitle'), text: t('share.shareText', { name: myName || t('common.partner'), count }), url });
    } catch {
      // share cancelled
    }
  };

  return (
    <Sheet title={t('share.title')} onClose={props.onClose}>
      <p>
        {t('share.votes', { count })} {single ? t('share.scanSingle') : t('share.scanMulti')}
      </p>
      <AnimatedQr frames={frames} />
      {!single && (
        <p class="small muted center">{t('share.multiHint', { count: frames.length })}</p>
      )}
      <p class="muted small">{t('share.linkHint')}</p>
      <div class="row-buttons">
        {'share' in navigator && (
          <button class="btn primary" onClick={share}>
            {t('share.send')}
          </button>
        )}
        <button class="btn" onClick={copy}>
          {t('share.copy')}
        </button>
      </div>
      <details>
        <summary class="small muted">{t('share.showLink')}</summary>
        <textarea class="code" readOnly value={url} rows={4} onFocus={(e) => e.currentTarget.select()} />
      </details>
    </Sheet>
  );
}

function AnimatedQr(props: { frames: string[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (props.frames.length < 2) return;
    const timer = setInterval(() => setI((x) => (x + 1) % props.frames.length), FRAME_MS);
    return () => clearInterval(timer);
  }, [props.frames]);
  useEffect(() => {
    if (!canvas.current) return;
    const text = props.frames[i % props.frames.length];
    QRCode.toCanvas(canvas.current, text, { errorCorrectionLevel: 'L', margin: 2, width: 320, color: { dark: '#1c1917', light: '#ffffff' } }).catch(
      () => toast(t('share.qrTooBig')),
    );
  }, [i, props.frames]);
  return (
    <div class="qr">
      <canvas ref={canvas} aria-label={t('share.qrAria')} />
      {props.frames.length > 1 && (
        <div class="qr-dots" aria-hidden="true">
          {props.frames.map((_, j) => (
            <span key={j} class={j === i ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
