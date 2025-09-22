const state = {
  coverImage: null,
  coverSourceType: null,
  images: [],
  activeTabId: null,
  activeWindowId: null
};

const elements = {};

function cacheElements() {
  elements.pageTitle = document.getElementById('page-title');
  elements.pageUrl = document.getElementById('page-url');
  elements.coverPlaceholder = document.getElementById('cover-placeholder');
  elements.coverPreview = document.getElementById('cover-preview');
  elements.coverUpload = document.getElementById('cover-upload');
  elements.coverScreenshot = document.getElementById('cover-screenshot');
  elements.imageSelection = document.getElementById('image-selection');
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

  if (coverImage && coverImage.src) {
    elements.coverPreview.src = coverImage.src;
    elements.coverPreview.hidden = false;
    elements.coverPlaceholder.hidden = true;
  } else {
    elements.coverPreview.hidden = true;
    elements.coverPlaceholder.hidden = false;
  }

  updateImageSelectionHighlight();
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
    return;
  }

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

function extractCategoriesFromResponse(rawResponse) {
  if (!rawResponse) {
    return null;
  }

  if (Array.isArray(rawResponse)) {
    return rawResponse;
  }

  if (Array.isArray(rawResponse.categoryList)) {
    return rawResponse.categoryList;
  }

  if (rawResponse.data) {
    if (Array.isArray(rawResponse.data)) {
      return rawResponse.data;
    }

    if (Array.isArray(rawResponse.data.categoryList)) {
      return rawResponse.data.categoryList;
    }

    if (Array.isArray(rawResponse.data.list)) {
      return rawResponse.data.list;
    }

    if (Array.isArray(rawResponse.data.items)) {
      return rawResponse.data.items;
    }
  }

  if (rawResponse.result) {
    if (Array.isArray(rawResponse.result)) {
      return rawResponse.result;
    }

    if (Array.isArray(rawResponse.result.list)) {
      return rawResponse.result.list;
    }
  }

  return null;
}

async function fetchCategories() {
  try {
    const response = await fetch('https://api.test.copus.io/plugin/plugin/author/article/categoryList');

    if (!response.ok) {
      throw new Error(`Failed to load categories (${response.status})`);
    }

    const data = await response.json();
    const categories = extractCategoriesFromResponse(data);

    if (!Array.isArray(categories)) {
      throw new Error('Unexpected category response format.');
    }

    populateCategorySelect(categories);
  } catch (error) {
    console.error('Category fetch failed', error);
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

  let optionsAdded = 0;

  categories.forEach((category) => {
    const categoryId =
      category.categoryId ||
      category.id ||
      category.value ||
      category.code ||
      '';

    const categoryName =
      category.categoryName ||
      category.name ||
      category.label ||
      category.title ||
      'Unnamed category';

    if (!categoryId || !categoryName) {
      return;
    }

    const option = document.createElement('option');
    option.value = categoryId;
    option.textContent = categoryName;
    elements.categorySelect.appendChild(option);
    optionsAdded += 1;
  });

  if (optionsAdded === 0) {
    setStatus('No categories available from Copus. Please try again later.', 'error');
  }
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
  // Placeholder for future API integration.
  await new Promise((resolve) => setTimeout(resolve, 300));
  console.info('Publishing payload prepared for Copus:', payload);
  return { success: true };
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

    if (result.success) {
      setStatus('The page has been queued for publishing to Copus.', 'success');
    } else {
      throw new Error(result.message || 'Publishing failed.');
    }
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
      setCoverImage(null, null);
      renderImageSelection([]);
      setStatus('No images detected on this page. Please upload or capture a cover image.', 'error');
    }
  } catch (error) {
    setCoverImage(null, null);
    renderImageSelection([]);
    setStatus(`Unable to inspect the page: ${error.message}`, 'error');
  }

  fetchCategories();

  elements.coverUpload.addEventListener('change', handleFileUpload);
  elements.coverScreenshot.addEventListener('click', handleScreenshotCapture);
  elements.publishButton.addEventListener('click', handlePublish);
}

document.addEventListener('DOMContentLoaded', initialize);
