# Copus Browser Extension

Copus is a browser extension that helps authors save the current webpage to the Copus platform with all required publishing metadata.

## Features

- Automatically inspects the current page to collect title, URL, and images.
- Suggests a cover image while allowing manual upload, screenshot capture, or choosing any detected page image.
- Loads article categories from the Copus API and requires users to pick one before publishing.
- Collects a sharing recommendation to accompany the saved page.
- Validates every required field before allowing publication.

## Development

1. Load the extension in your Chromium-based browser via **chrome://extensions** in developer mode.
2. Use the **Load unpacked** button and select this repository directory.
3. Open any webpage and launch the Copus extension popup from the toolbar to test the workflow.

The publish action currently logs the prepared payload and can be replaced with the official Copus API integration when it becomes available.
