console.log('Popup script loaded');

const state = {
  coverImage: null,
  coverSourceType: null,
  images: [],
  activeTabId: null,
  activeWindowId: null,
  imageSelectionVisible: false,
  pageTitle: '',
  pageUrl: ''
};

const elements = {};

function cacheElements() {
  elements.coverContainer = document.getElementById('cover-container');
  elements.coverEmpty = document.getElementById('cover-empty');
  elements.coverPreview = document.getElementById('cover-preview');
  elements.coverRemove = document.getElementById('cover-remove');
  elements.coverUpload = document.getElementById('cover-upload');
  elements.coverScreenshot = document.getElementById('cover-screenshot');
  elements.imageSelectionToggle = document.getElementById('toggle-detected-images');
  elements.categorySelect = document.getElementById('category-select');
  elements.recommendationInput = document.getElementById('recommendation-input');
  elements.publishButton = document.getElementById('publish-button');
  elements.statusMessage = document.getElementById('status-message');
  elements.popup = document.querySelector('.popup');
  elements.imageSelectionView = document.getElementById('image-selection-view');
  elements.imageSelectionGrid = document.getElementById('image-selection-grid');
  elements.goBackButton = document.getElementById('go-back-button');

  console.log('Element cache results:');
  console.log('coverScreenshot:', elements.coverScreenshot);
  console.log('imageSelectionToggle:', elements.imageSelectionToggle);
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

  if (coverImage && coverImage.src) {
    elements.coverPreview.src = coverImage.src;
    elements.coverPreview.hidden = false;
    elements.coverEmpty.hidden = true;
    elements.coverRemove.hidden = false;
    elements.coverContainer.classList.add('cover-container--has-image');
  } else {
    elements.coverPreview.hidden = true;
    elements.coverEmpty.hidden = false;
    elements.coverRemove.hidden = true;
    elements.coverContainer.classList.remove('cover-container--has-image');
    if (elements.coverUpload) {
      elements.coverUpload.value = '';
    }
  }

  updateImageSelectionHighlight();
}

function clearCoverImage() {
  setCoverImage(null, null);
  setStatus('');
}

function updateImageSelectionHighlight() {
  // No longer needed since we removed the inline image selection
  // Images are now shown in a popup window
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

function updateDetectedImagesButton(images) {
  if (!elements.imageSelectionToggle) {
    return;
  }

  if (!Array.isArray(images) || images.length === 0) {
    elements.imageSelectionToggle.disabled = true;
    elements.imageSelectionToggle.textContent = 'No images detected';
    return;
  }

  elements.imageSelectionToggle.disabled = false;
  elements.imageSelectionToggle.textContent = 'Detected images (' + images.length + ')';
}

function goBackToMain() {
  console.log('goBackToMain called');
  elements.imageSelectionView.hidden = true;
  elements.popup.hidden = false;
}

function openImageSelectionView() {
  console.log('openImageSelectionView called');

  if (!elements.imageSelectionToggle || elements.imageSelectionToggle.disabled) {
    console.log('Button disabled or not found');
    return;
  }

  if (!Array.isArray(state.images) || state.images.length === 0) {
    setStatus('No images detected on this page.', 'error');
    console.log('No images found:', state.images);
    return;
  }

  console.log('Found images:', state.images.length);

  // Clear and populate the image grid
  elements.imageSelectionGrid.innerHTML = '';

  state.images.forEach(function(image) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'image-option';

    const img = document.createElement('img');
    img.src = image.src;
    img.alt = 'Detected image option';

    button.appendChild(img);

    button.addEventListener('click', function() {
      setCoverImage({ src: image.src }, 'page');
      setStatus('');
      goBackToMain();
    });

    elements.imageSelectionGrid.appendChild(button);
  });

  // Show image selection view
  elements.popup.hidden = true;
  elements.imageSelectionView.hidden = false;
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
      throw new Error('Failed to load categories (' + response.status + ')');
    }

    const responseData = await response.json();

    // Extract categories from the nested response structure
    const categories = responseData?.data?.data;

    if (!Array.isArray(categories)) {
      throw new Error('Unexpected category response format.');
    }

    populateCategorySelect(categories);
  } catch (error) {
    setStatus('Unable to load categories: ' + error.message, 'error');
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
    throw new Error('Network error: ' + networkError.message);
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
      'Publish request failed (' + response.status + ')';
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
    title: state.pageTitle,
    url: state.pageUrl,
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
    setStatus('Unable to publish: ' + error.message, 'error');
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
    setStatus('');
    event.target.value = '';
  };
  reader.onerror = () => {
    setStatus('Failed to read the selected file. Please try again.', 'error');
  };
  reader.readAsDataURL(file);
}

async function handleScreenshotCapture() {
  console.log('handleScreenshotCapture called');
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
    setStatus('');
  } catch (error) {
    setStatus('Unable to capture screenshot: ' + error.message, 'error');
  } finally {
    elements.coverScreenshot.disabled = false;
  }
}

async function initialize() {
  console.log('Initialize function called');
  cacheElements();

  const tab = await queryActiveTab();
  if (!tab) {
    setStatus('Unable to determine the active tab.', 'error');
    return;
  }

  state.activeTabId = tab.id;
  state.activeWindowId = tab.windowId;
  state.pageTitle = tab.title || 'Untitled page';
  state.pageUrl = tab.url || 'Unknown URL';

  try {
    const pageData = await fetchPageData(tab.id);

    if (pageData && Array.isArray(pageData.images)) {
      state.images = pageData.images;
      updateDetectedImagesButton(pageData.images);
      const mainImage = determineMainImage(pageData.images);
      if (mainImage && mainImage.src) {
        setCoverImage({ src: mainImage.src }, 'page');
        setStatus('');
      } else {
        setCoverImage(null, null);
        setStatus('');
      }
    } else {
      state.images = [];
      setCoverImage(null, null);
      updateDetectedImagesButton([]);
    }
  } catch (error) {
    state.images = [];
    setCoverImage(null, null);
    updateDetectedImagesButton([]);
  }

  fetchCategories();

  console.log('Adding event listeners...');
  console.log('coverScreenshot element:', elements.coverScreenshot);
  console.log('imageSelectionToggle element:', elements.imageSelectionToggle);

  elements.coverUpload.addEventListener('change', handleFileUpload);
  elements.coverScreenshot.addEventListener('click', handleScreenshotCapture);
  elements.coverRemove.addEventListener('click', clearCoverImage);
  elements.imageSelectionToggle.addEventListener('click', openImageSelectionView);
  elements.goBackButton.addEventListener('click', goBackToMain);
  elements.publishButton.addEventListener('click', handlePublish);

  console.log('Event listeners added');
}

console.log('Setting up DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOMContentLoaded fired, calling initialize');
  initialize();
});
