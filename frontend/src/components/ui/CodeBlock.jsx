import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { IconButton } from './Button';

/**
 * Read-only payload viewer. Kept for parity with the original tester, which
 * dumped the raw backend JSON - useful when debugging the pipeline.
 */
export function CodeBlock({ label = 'JSON', value, maxHeight }) {
  const [copied, setCopied] = useState(false);
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked (insecure context) - fail quietly */
    }
  };

  return (
    <div className="code">
      <div className="code__bar">
        <span className="code__label">{label}</span>
        <IconButton
          icon={copied ? Check : Copy}
          size="sm"
          label={copied ? 'Copied' : 'Copy to clipboard'}
          onClick={copy}
        />
      </div>
      <pre style={maxHeight ? { maxHeight } : undefined}>{text}</pre>
    </div>
  );
}
