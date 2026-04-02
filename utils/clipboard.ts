function fallbackCopyText(text: string) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.top = '0';
  textArea.style.left = '-9999px';
  textArea.style.opacity = '0';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    return document.execCommand('copy');
  } finally {
    document.body.removeChild(textArea);
  }
}

export async function copyText(text: string) {
  if (!text) {
    throw new Error('No text provided');
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers that expose the API but still reject the call.
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available');
  }

  const didCopy = fallbackCopyText(text);
  if (!didCopy) {
    throw new Error('Fallback copy failed');
  }
}
