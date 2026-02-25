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

/**
 * Shows a toast notification.
 * Expects a <div id="toast" class="toast"> element in the DOM.
 * @param {string} msg - Message to display
 * @param {number} [duration=2200] - How long to show in ms
 */
function showToast(msg, duration = 2200) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), duration);
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


// * * * * * * * * * * * * *
//          Modal
// * * * * * * * * * * * * *

/**
 * Opens a modal by removing the 'd-none' class.
 * @param {string|HTMLElement} modal - Element ID string or DOM element
 */
function openModal(modal) {
  const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
  if (el) el.classList.remove('d-none');
}

/**
 * Closes a modal by adding the 'd-none' class.
 * @param {string|HTMLElement} modal - Element ID string or DOM element
 */
function closeModal(modal) {
  const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
  if (el) el.classList.add('d-none');
}