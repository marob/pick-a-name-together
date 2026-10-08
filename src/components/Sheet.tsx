import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';
import { t } from '../i18n';

/** Modal: bottom sheet on phones, centred dialog on large screens */
export function Sheet(props: { title: string; onClose: () => void; children: ComponentChildren; footer?: ComponentChildren }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, []);
  return (
    <div class="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && props.onClose()}>
      <section class="sheet" role="dialog" aria-modal="true" aria-label={props.title}>
        <header class="sheet-head">
          <h2>{props.title}</h2>
          <button class="btn ghost icon" onClick={props.onClose} aria-label={t('common.close')}>
            ✕
          </button>
        </header>
        <div class="sheet-body">{props.children}</div>
        {props.footer && <footer class="sheet-foot">{props.footer}</footer>}
      </section>
    </div>
  );
}
