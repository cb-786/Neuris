import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Progressive disclosure for secondary detail (grounding context, raw JSON,
 * diarized transcript). Collapsed by default keeps the primary answer clean.
 */
export function Disclosure({ label, icon: Icon, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();

  return (
    <div className="disclosure">
      <button
        type="button"
        className="disclosure__trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight size={14} strokeWidth={2.2} className="disclosure__chev" aria-hidden="true" />
        {Icon && <Icon size={14} strokeWidth={2} aria-hidden="true" />}
        <span className="grow">{label}</span>
        {count != null && <span className="tab__count tnum">{count}</span>}
      </button>
      {open && (
        <div className="disclosure__panel" id={id}>
          {children}
        </div>
      )}
    </div>
  );
}
