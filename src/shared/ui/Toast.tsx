import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

const TOAST_DURATION_MS = 5000;

export interface ToastOptions {
  message: string;
  /** Optional action such as "Undo"; the toast closes when it is pressed. */
  action?: { label: string; run: () => void };
}

interface ToastApi {
  show: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    clearTimeout(timer.current);
    setToast(options);
    timer.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const api = useMemo(() => ({ show }), [show]);
  const action = toast?.action;

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className="toast">
            <Icon name="check" />
            <span>{toast.message}</span>
            {action && (
              <button
                type="button"
                className="act"
                onClick={() => {
                  action.run();
                  dismiss();
                }}
              >
                {action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}
