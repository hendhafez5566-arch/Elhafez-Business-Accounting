import {
  createContext,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useContext,
} from 'react';
import {
  Button as CanonicalButton,
  Input as CanonicalInput,
  Select as CanonicalSelect,
  Textarea as CanonicalTextarea,
  type ButtonVariant,
} from './primitives.js';

export type RoutePresentationMode = 'canonical' | 'route-owned';

const RoutePresentationContext = createContext<RoutePresentationMode>('canonical');

export function RoutePresentationBoundary({
  mode,
  children,
}: {
  readonly mode: RoutePresentationMode;
  readonly children: ReactNode;
}) {
  return <RoutePresentationContext.Provider value={mode}>{children}</RoutePresentationContext.Provider>;
}

type RouteButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  readonly loading?: boolean;
  readonly variant?: ButtonVariant;
};

export function Button({
  children,
  loading = false,
  disabled,
  className = '',
  variant = 'primary',
  ...props
}: RouteButtonProps) {
  const mode = useContext(RoutePresentationContext);
  if (mode === 'canonical') {
    return (
      <CanonicalButton
        className={className}
        disabled={disabled}
        loading={loading}
        variant={variant}
        {...props}
      >
        {children}
      </CanonicalButton>
    );
  }

  return (
    <button className={className} disabled={disabled || loading} aria-busy={loading} {...props}>
      {loading ? 'جارٍ الحفظ…' : children}
    </button>
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  const mode = useContext(RoutePresentationContext);
  return mode === 'canonical'
    ? <CanonicalInput className={className} {...props} />
    : <input className={className} {...props} />;
}

export function Select({
  children,
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const mode = useContext(RoutePresentationContext);
  return mode === 'canonical'
    ? <CanonicalSelect className={className} {...props}>{children}</CanonicalSelect>
    : <select className={className} {...props}>{children}</select>;
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const mode = useContext(RoutePresentationContext);
  return mode === 'canonical'
    ? <CanonicalTextarea className={className} {...props} />
    : <textarea className={className} {...props} />;
}
