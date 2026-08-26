const statusEl = document.getElementById("status");
const btn = document.getElementById("activate");

function setStatus(text, isError) {
  if (!statusEl) return;
  statusEl.textContent = text || "";
  statusEl.className = isError ? "status err" : "status";
}

btn.addEventListener("click", () => {
  btn.disabled = true;
  setStatus("Activating…");
  chrome.runtime.sendMessage({ type: "NTC_ACTIVATE_FROM_POPUP" }, (result) => {
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message || "Activation failed.", true);
      btn.disabled = false;
      return;
    }
    if (result && result.ok === false) {
      setStatus(result.error || "Can't run on this page.", true);
      btn.disabled = false;
      return;
    }
    window.close();
  });
});
