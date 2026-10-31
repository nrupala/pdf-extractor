# Browser extension (MV3)
Load unpacked: chrome://extensions -> Developer mode -> Load unpacked -> this folder.
It sends the chosen PDF to your local pdfx API at http://127.0.0.1:8765 - start it with `pdfx-api` or the desktop app first. Nothing is sent anywhere else. The extension never fetches remote content itself: for the "Use current tab PDF URL" button it sends the tab's URL to the local API, which downloads and validates that PDF on your own machine (it refuses any URL that resolves to a non-public address).
