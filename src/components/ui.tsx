import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' };

export function ActionButton({ variant = 'secondary', className = '', type = 'button', ...props }: ActionButtonProps) {
  const variantClass = { primary: 'primary-btn', secondary: 'secondary-btn', quiet: 'text-button', danger: 'danger-btn' }[variant];
  return <button {...props} type={type} className={[variantClass, className].filter(Boolean).join(' ')} />;
}

export function SectionTabs({ ariaLabel, className = '', children }: { ariaLabel: string; className?: string; children: ReactNode }) {
  return <nav className={['community-tabs', className].filter(Boolean).join(' ')} aria-label={ariaLabel}>{children}</nav>;
}

export function StatusMessage({ tone, children, className = '' }: { tone: 'error' | 'success' | 'info'; children: ReactNode; className?: string }) {
  return <p role={tone === 'error' ? 'alert' : 'status'} aria-live={tone === 'error' ? 'assertive' : 'polite'} className={['ui-status', 'ui-status--' + tone, className].filter(Boolean).join(' ')}>{children}</p>;
}

export function PageHeading({ eyebrow, title, description, className = '' }: { eyebrow?: string; title: ReactNode; description?: ReactNode; className?: string }) {
  return <header className={['ui-page-heading', className].filter(Boolean).join(' ')}>{eyebrow && <div className="section-kicker">{eyebrow}</div>}<h1 className="page-title">{title}</h1>{description && <p className="subcopy">{description}</p>}</header>;
}
