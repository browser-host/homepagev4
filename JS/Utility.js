/* ============================================================
   UTILITY.JS — Shared helper functions
   Import this before page-specific scripts.
   ============================================================ */


// * * * * * * * * * * * * *
//          Debounce
// * * * * * * * * * * * * *

/**
 * Returns a debounced version of the given function.
 * @param {Function} callback
 * @param {number} wait - milliseconds
 */
const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => { callback(...args); }, wait);
  };
};


// * * * * * * * * * * * * *
//          Toast
// * * * * * * * * * * * * *

function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.show(msg, duration);
}


// * * * * * * * * * * * * *
//         Clipboard
// * * * * * * * * * * * * *

/**
 * Copies text to the clipboard, then runs an optional callback.
 * @param {string} text - Text to copy
 * @param {Function} [onSuccess] - Called after a successful copy
 * @param {Function} [onError] - Called if copy fails
 */
function copyToClipboard(text, onSuccess, onError) {
  navigator.clipboard.writeText(text).then(() => {
    if (typeof onSuccess === 'function') onSuccess();
  }).catch((err) => {
    console.error('Clipboard write failed:', err);
    if (typeof onError === 'function') onError(err);
  });
}

/**
 * Copies text and shows a toast message.
 * @param {string} text - Text to copy
 * @param {string} [toastMsg] - Toast message (defaults to generic confirmation)
 */
function copyToClipboardWithToast(text, toastMsg = 'COPIED TO CLIPBOARD') {
  copyToClipboard(text, () => showToast(toastMsg));
}


