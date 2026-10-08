import { useEffect, useState } from 'preact/hooks';

interface ToastItem {
  id: number;
  text: string;
  action?: { label: string; run: () => void };
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(t: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

export function toast(text: string, action?: ToastItem['action'], ms = 3500) {
  const id = nextId++;
  items = [...items, { id, text, action }];
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, ms);
}

export function Toasts() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => void listeners.delete(setList);
  }, []);
  return (
    <div class="toasts" role="status" aria-live="polite">
      {list.map((t) => (
        <div key={t.id} class="toast">
          <span>{t.text}</span>
          {t.action && (
            <button
              class="btn ghost small"
              onClick={() => {
                t.action!.run();
                items = items.filter((x) => x.id !== t.id);
                emit();
              }}
            >
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
