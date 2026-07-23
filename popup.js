document.getElementById("activate").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "NTC_ACTIVATE_FROM_POPUP" }, () => {
    window.close();
  });
});
