const state = {
  coverImage: null,
  coverSourceType: null,
  images: [],
  activeTabId: null,
  activeWindowId: null,
  imageSelectionVisible: false
};

const elements = {};

function cacheElements() {
  elements.pageTitle = document.getElementById('page-title');
  elements.pageUrl = document.getElementById('page-url');
  elements.coverContainer = document.getElementById('cover-container');
  elements.coverEmpty = document.getElementById('cover-empty');
  elements.coverPreview = document.getElementById('cover-preview');
  elements.coverRemove = document.getElementById('cover-remove');
  elements.coverUpload = document.getElementById('cover-upload');
  elements.coverScreenshot = document.getElementById('cover-screenshot');
  elements.imageSelection = document.getElementById('image-selection');
  elements.imageSelectionToggle = document.getElementById('toggle-detected-images');
  elements.categorySelect = document.getElementById('category-select');
  elements.recommendationInput = document.getElementById('recommendation-input');
  elements.publishButton = document.getElementById('publish-button');
  elements.statusMessage = document.getElementById('status-message');
}

function setStatus(message, type = 'info') {
  elements.statusMessage.textContent = message;
  elements.statusMessage.classList.remove('status-message--error', 'status-message--success');

  if (type === 'error') {
    elements.statusMessage.classList.add('status-message--error');
  }

  if (type === 'success') {
    elements.statusMessage.classList.add('status-message--success');
  }
}

function setCoverImage(coverImage, sourceType) {
  state.coverImage = coverImage;
  state.coverSourceType = sourceType;

  const hasImage = Boolean(coverImage && coverImage.src);

  if (hasImage) {
    elements.coverPreview.src = coverImage.src;
    elements.coverPreview.hidden = false;
    elements.coverEmpty.hidden = true;
    elements.coverRemove.hidden = false;
  } else {
    elements.coverPreview.hidden = true;
    elements.coverEmpty.hidden = false;
    elements.coverRemove.hidden = true;
    if (elements.coverUpload) {
      elements.coverUpload.value = '';
    }
  }

  elements.coverContainer.classList.toggle('cover-container--empty', !hasImage);
  elements.coverContainer.classList.toggle('cover-container--has-image', hasImage);

  updateImageSelectionHighlight();
}

function clearCoverImage() {
  setCoverImage(null, null);
  setStatus('Cover image removed. Please choose, upload, or capture a new image.');
}

function updateImageSelectionHighlight() {
  const options = elements.imageSelection.querySelectorAll('.image-option');
  options.forEach((option) => {
    const imageSrc = option.dataset.src;
    if (state.coverImage && state.coverImage.src === imageSrc && state.coverSourceType === 'page') {
      option.classList.add('image-option--selected');
    } else {
      option.classList.remove('image-option--selected');
    }
  });
}

function determineMainImage(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return null;
  }

  const sorted = [...images].sort((a, b) => {
    const areaA = (a.width || 0) * (a.height || 0);
    const areaB = (b.width || 0) * (b.height || 0);
    return areaB - areaA;
  });

  return sorted[0] || null;
}

function renderImageSelection(images) {
  elements.imageSelection.innerHTML = '';

  if (!Array.isArray(images) || images.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.textContent = 'No images detected on this page.';
    emptyState.className = 'image-selection__empty';
    elements.imageSelection.appendChild(emptyState);
    elements.imageSelection.hidden = true;
    state.imageSelectionVisible = false;
    if (elements.imageSelectionToggle) {
      elements.imageSelectionToggle.disabled = false;
      elements.imageSelectionToggle.textContent = 'Show detected images (0)';
      elements.imageSelectionToggle.setAttribute('aria-expanded', 'false');
    }
    return;
  }

  if (elements.imageSelectionToggle) {
    const countLabel = `Show detected images (${images.length})`;
    elements.imageSelectionToggle.disabled = false;
    elements.imageSelectionToggle.textContent = state.imageSelectionVisible
      ? 'Hide detected images'
      : countLabel;
    elements.imageSelectionToggle.setAttribute(
      'aria-expanded',
      state.imageSelectionVisible ? 'true' : 'false'
    );
  }

  elements.imageSelection.hidden = !state.imageSelectionVisible;

  images.forEach((image) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'image-option';
    button.dataset.src = image.src;

    const thumbnail = document.createElement('img');
    thumbnail.src = image.src;
    thumbnail.alt = 'Available cover option';

    button.appendChild(thumbnail);

    button.addEventListener('click', () => {
      setCoverImage({ src: image.src }, 'page');
      setStatus('Cover image updated from the page images.');
    });

    elements.imageSelection.appendChild(button);
  });

  updateImageSelectionHighlight();
}

function toggleImageSelectionVisibility() {
  if (!elements.imageSelectionToggle) {
    return;
  }

  if (elements.imageSelectionToggle.disabled) {
    return;
  }

  state.imageSelectionVisible = !state.imageSelectionVisible;
  elements.imageSelection.hidden = !state.imageSelectionVisible;
  const collapsedLabel = `Show detected images (${state.images.length})`;
  elements.imageSelectionToggle.textContent = state.imageSelectionVisible
    ? 'Hide detected images'
    : collapsedLabel;
  elements.imageSelectionToggle.setAttribute(
    'aria-expanded',
    state.imageSelectionVisible ? 'true' : 'false'
  );
}

async function queryActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]);
    });
  });
}

async function fetchPageData(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: 'collectPageData' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      resolve(response);
    });
  });
}

async function fetchCategories() {
  try {
    const response = await fetch('https://api.test.copus.io/plugin/plugin/author/article/categoryList');

    if (!response.ok) {
      throw new Error(`Failed to load categories (${response.status})`);
    }

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Unexpected category response format.');
    }

    populateCategorySelect(data);
  } catch (error) {
    setStatus(`Unable to load categories: ${error.message}`, 'error');
  }
}

function populateCategorySelect(categories) {
  elements.categorySelect.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Select a category';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  elements.categorySelect.appendChild(placeholderOption);

  categories.forEach((category) => {
    const option = document.createElement('option');
    option.value = category.id || category.value || '';
    option.textContent = category.name || category.label || 'Unnamed category';
    elements.categorySelect.appendChild(option);
  });
}

function validateForm() {
  if (!state.coverImage || !state.coverImage.src) {
    setStatus('Please select, upload, or capture a cover image before publishing.', 'error');
    return false;
  }

  if (!elements.categorySelect.value) {
    setStatus('Please choose a category.', 'error');
    return false;
  }

  if (!elements.recommendationInput.value.trim()) {
    setStatus('Please provide a recommendation reason.', 'error');
    return false;
  }

  return true;
}

async function publishToCopus(payload) {
  const endpoint = 'https://api.test.copus.io/plugin/plugin/author/article/publish';

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
  } catch (networkError) {
    throw new Error(`Network error: ${networkError.message}`);
  }

  let responseBody = null;
  const rawBody = await response.text();
  if (rawBody) {
    try {
      responseBody = JSON.parse(rawBody);
    } catch (parseError) {
      throw new Error('Received invalid JSON from the Copus publish API.');
    }
  }

  if (!response.ok) {
    const errorMessage =
      (responseBody && (responseBody.error || responseBody.message)) ||
      `Publish request failed (${response.status})`;
    throw new Error(errorMessage);
  }

  if (responseBody && responseBody.success === false) {
    throw new Error(responseBody.message || responseBody.error || 'Publishing failed.');
  }

  const success = !responseBody || responseBody.success === true || responseBody.status === 'success';
  const message =
    (responseBody && (responseBody.message || responseBody.statusMessage)) ||
    'The page has been queued for publishing to Copus.';

  if (!success) {
    throw new Error('Publishing failed due to an unexpected response.');
  }

  return { success: true, message, data: responseBody };
}

async function handlePublish() {
  if (!validateForm()) {
    return;
  }

  const payload = {
    title: elements.pageTitle.textContent,
    url: elements.pageUrl.textContent,
    coverImage: state.coverImage.src,
    coverImageSource: state.coverSourceType,
    category: elements.categorySelect.value,
    recommendation: elements.recommendationInput.value.trim()
  };

  try {
    elements.publishButton.disabled = true;
    setStatus('Publishing to Copus...');

    const result = await publishToCopus(payload);
    const successMessage = result.message || 'The page has been queued for publishing to Copus.';
    setStatus(successMessage, 'success');
  } catch (error) {
    setStatus(`Unable to publish: ${error.message}`, 'error');
  } finally {
    elements.publishButton.disabled = false;
  }
}

function handleFileUpload(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setCoverImage({ src: reader.result }, 'upload');
    setStatus('Cover image updated from your upload.');
    event.target.value = '';
  };
  reader.onerror = () => {
    setStatus('Failed to read the selected file. Please try again.', 'error');
  };
  reader.readAsDataURL(file);
}

async function handleScreenshotCapture() {
  try {
    elements.coverScreenshot.disabled = true;
    setStatus('Capturing screenshot...');

    const tab = await queryActiveTab();

    if (!tab) {
      throw new Error('No active tab available for capture.');
    }

    const screenshot = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        { type: 'captureScreenshot', windowId: tab.windowId },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }

          if (!response || !response.success) {
            reject(new Error(response && response.error ? response.error : 'Screenshot failed.'));
            return;
          }

          resolve(response.dataUrl);
        }
      );
    });

    setCoverImage({ src: screenshot }, 'screenshot');
    setStatus('Cover image updated from the screenshot.');
  } catch (error) {
    setStatus(`Unable to capture screenshot: ${error.message}`, 'error');
  } finally {
    elements.coverScreenshot.disabled = false;
  }
}

async function initialize() {
  cacheElements();
  setStatus('Initializing...');

  const tab = await queryActiveTab();
  if (!tab) {
    setStatus('Unable to determine the active tab.', 'error');
    return;
  }

  state.activeTabId = tab.id;
  state.activeWindowId = tab.windowId;
  elements.pageTitle.textContent = tab.title || 'Untitled page';
  elements.pageUrl.textContent = tab.url || 'Unknown URL';

  try {
    const pageData = await fetchPageData(tab.id);

    if (pageData && Array.isArray(pageData.images)) {
      state.images = pageData.images;
      renderImageSelection(pageData.images);
      const mainImage = determineMainImage(pageData.images);
      if (mainImage && mainImage.src) {
        setCoverImage({ src: mainImage.src }, 'page');
        setStatus('A cover image was automatically selected.');
      } else {
        setCoverImage(null, null);
        setStatus('No main image detected. Please choose or upload a cover.', 'error');
      }
    } else {
      state.images = [];
      setCoverImage(null, null);
      renderImageSelection([]);
      setStatus('No images detected on this page. Please upload or capture a cover image.', 'error');
    }
  } catch (error) {
    state.images = [];
    setCoverImage(null, null);
    renderImageSelection([]);
    setStatus(`Unable to inspect the page: ${error.message}`, 'error');
  }

  fetchCategories();

  elements.coverUpload.addEventListener('change', handleFileUpload);
  elements.coverScreenshot.addEventListener('click', handleScreenshotCapture);
  elements.coverRemove.addEventListener('click', clearCoverImage);
  elements.imageSelectionToggle.addEventListener('click', toggleImageSelectionVisibility);
  elements.publishButton.addEventListener('click', handlePublish);
}

document.addEventListener('DOMContentLoaded', initialize);
