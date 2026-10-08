import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../i18n';
import { ChunkCollector, extractPayload } from '../share';
import { Sheet } from './Sheet';

/** Receive votes: scan the QR code (camera) or paste the link */
export function ReceiveSheet(props: { onClose: () => void; onPayload: (payload: string) => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const submit = () => {
    const p = extractPayload(text);
    if (!p) return setError(t('receive.invalid'));
    props.onPayload(p);
  };
  return (
    <Sheet title={t('receive.title')} onClose={props.onClose}>
      <Scanner onPayload={props.onPayload} />
      <p class="muted small">{t('receive.paste')}</p>
      <textarea class="code" rows={3} value={text} placeholder="https://…#v=…" onInput={(e) => (setText(e.currentTarget.value), setError(''))} />
      {error && <p class="error small">{error}</p>}
      <button class="btn primary" onClick={submit} disabled={!text.trim()}>
        {t('receive.import')}
      </button>
    </Sheet>
  );
}

type BarcodeDetectorLike = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

function Scanner(props: { onPayload: (payload: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'idle' | 'running' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);
  const stopRef = useRef<() => void>(() => {});
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      stopRef.current();
    },
    [],
  );

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error');
      setMessage(
        location.protocol === 'https:' || location.hostname === 'localhost' ? t('scan.noCamera') : t('scan.needHttps'),
      );
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    } catch {
      setStatus('error');
      setMessage(t('scan.denied'));
      return;
    }
    const v = video.current;
    if (!mounted.current || !v) {
      // Sheet closed while the permission prompt was open
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    v.srcObject = stream;
    await v.play().catch(() => {});
    setStatus('running');

    const collector = new ChunkCollector();
    const Detector = (window as unknown as { BarcodeDetector?: new (o: object) => BarcodeDetectorLike }).BarcodeDetector;
    const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
    const jsQR = (await import('jsqr')).default;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    let stopped = false;
    let timer = 0;
    const stop = () => {
      stopped = true;
      clearTimeout(timer);
      stream.getTracks().forEach((t) => t.stop());
    };
    stopRef.current = stop;

    const read = async (): Promise<string | null> => {
      if (!v.videoWidth) return null;
      if (detector) {
        try {
          const codes = await detector.detect(v);
          return codes[0]?.rawValue ?? null;
        } catch {
          /* fall back to jsQR */
        }
      }
      const scale = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      canvas.width = Math.round(v.videoWidth * scale);
      canvas.height = Math.round(v.videoHeight * scale);
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    };

    const tick = async () => {
      if (stopped) return;
      const text = await read();
      if (text) {
        const payload = collector.add(text);
        if (collector.total > 1) setProgress([collector.received, collector.total]);
        if (payload) {
          stop();
          setStatus('idle');
          props.onPayload(payload);
          return;
        }
      }
      timer = window.setTimeout(tick, 120);
    };
    tick();
  };

  return (
    <div class="scanner">
      <video ref={video} playsInline muted hidden={status !== 'running'} />
      {status === 'running' ? (
        <>
          {progress ? (
            <div class="progress" aria-label={t('scan.progress', { received: progress[0], total: progress[1] })}>
              <span style={{ width: `${(progress[0] / progress[1]) * 100}%` }} />
              <em>
                {progress[0]} / {progress[1]}
              </em>
            </div>
          ) : (
            <p class="small muted center">{t('scan.aim')}</p>
          )}
          <button
            class="btn"
            onClick={() => {
              stopRef.current();
              setStatus('idle');
              setProgress(null);
            }}
          >
            {t('scan.stop')}
          </button>
        </>
      ) : (
        <button class="btn primary big" onClick={start}>
          {t('scan.start')}
        </button>
      )}
      {status === 'error' && <p class="error small">{message}</p>}
    </div>
  );
}
