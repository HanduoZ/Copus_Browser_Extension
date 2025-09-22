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
  elements.coverContainer = document.getElementById('cover-container');
  elements.pageTitle = document.getElementById('page-title');
  elements.pageUrl = document.getElementById('page-url');
  elements.coverPlaceholder = document.getElementById('cover-placeholder');
  elements.coverPreview = document.getElementById('cover-preview');
  elements.coverUpload = document.getElementById('cover-upload');
  elements.coverScreenshot = document.getElementById('cover-screenshot');
  elements.coverControls = document.getElementById('cover-controls');
  elements.coverDetectedToggle = document.getElementById('cover-detected-toggle');
  elements.coverRemoveButton = document.getElementById('cover-remove');
  elements.imageSelection = document.getElementById('image-selection');
  elements.categorySelect = document.getElementById('category-select');
  elements.recommendationInput = document.getElementById('recommendation-input');
  elements.publishButton = document.getElementById('publish-button');
  elements.statusMessage = document.getElementById('status-message');

  if (elements.coverDetectedToggle) {
    elements.coverDetectedToggle.disabled = true;
    elements.coverDetectedToggle.setAttribute('aria-disabled', 'true');
    elements.coverDetectedToggle.setAttribute('aria-expanded', 'false');
  }

  setImageSelectionVisibility(false);
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
    elements.coverRemoveButton.hidden = false;
    elements.coverContainer.classList.add('cover-container--filled');
  } else {
    elements.coverPreview.hidden = true;
    elements.coverPlaceholder.hidden = false;
    elements.coverRemoveButton.hidden = true;
    elements.coverContainer.classList.remove('cover-container--filled');
    if (elements.coverControls) {
      elements.coverControls.hidden = false;
    }
    if (elements.coverUpload) {
      elements.coverUpload.value = '';
    }
  }

  updateImageSelectionHighlight();
}

function setImageSelectionVisibility(visible) {
  state.imageSelectionVisible = visible;

  if (!elements.imageSelection) {
    return;
  }

  if (visible) {
    elements.imageSelection.hidden = false;
    elements.imageSelection.classList.remove('image-selection--hidden');
  } else {
    elements.imageSelection.hidden = true;
    elements.imageSelection.classList.add('image-selection--hidden');
  }

  if (elements.coverDetectedToggle) {
    elements.coverDetectedToggle.textContent = visible ? 'Hide detected images' : 'Choose from detected images';
    elements.coverDetectedToggle.setAttribute('aria-expanded', String(visible));
  }
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
    if (elements.coverDetectedToggle) {
      elements.coverDetectedToggle.disabled = true;
      elements.coverDetectedToggle.textContent = 'No detected images found';
      elements.coverDetectedToggle.setAttribute('aria-disabled', 'true');
    }
    setImageSelectionVisibility(false);
    return;
  }

  if (elements.coverDetectedToggle) {
    elements.coverDetectedToggle.disabled = false;
    elements.coverDetectedToggle.removeAttribute('aria-disabled');
    elements.coverDetectedToggle.textContent = 'Choose from detected images';
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
      setImageSelectionVisibility(false);
    });

    elements.imageSelection.appendChild(button);
  });

  updateImageSelectionHighlight();
  setImageSelectionVisibility(state.imageSelectionVisible && images.length > 0);
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

function valueHasCategoryIdentity(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const idCandidate =
    value.categoryId ??
    value.categoryID ??
    value.id ??
    value.value ??
    value.code ??
    value.categoryCode ??
    value.category_id ??
    value.category_code;

  const nameCandidate =
    value.categoryName ??
    value.category_name ??
    value.name ??
    value.label ??
    value.title ??
    value.categoryTitle ??
    value.category_title;

  const hasId = idCandidate !== undefined && idCandidate !== null && String(idCandidate).trim() !== '';
  const hasName = nameCandidate !== undefined && nameCandidate !== null && String(nameCandidate).trim() !== '';

  return hasId && hasName;
}

function extractCategoriesFromResponse(rawResponse) {
  const visited = new Set();

  function dig(node) {
    if (node === null || node === undefined) {
      return null;
    }

    if (Array.isArray(node)) {
      const candidates = node.filter((item) => valueHasCategoryIdentity(item));
      if (candidates.length > 0) {
        return candidates;
      }

      for (const item of node) {
        const result = dig(item);
        if (Array.isArray(result) && result.length > 0) {
          return result;
        }
      }

      return null;
    }

    if (typeof node === 'object') {
      if (visited.has(node)) {
        return null;
      }

      visited.add(node);

      for (const key of Object.keys(node)) {
        const result = dig(node[key]);
        if (Array.isArray(result) && result.length > 0) {
          return result;
        }
      }
    }

    return null;
  }

  return dig(rawResponse);
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
    const categoryIdCandidate =
      category.categoryId ??
      category.categoryID ??
      category.id ??
      category.value ??
      category.code ??
      category.categoryCode ??
      category.category_id ??
      category.category_code ??
      '';

    const categoryNameCandidate =
      category.categoryName ??
      category.category_name ??
      category.name ??
      category.label ??
      category.title ??
      category.categoryTitle ??
      category.category_title ??
      '';

    const categoryId = String(categoryIdCandidate).trim();
    const categoryName = String(categoryNameCandidate).trim();

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
    if (elements.coverUpload) {
      elements.coverUpload.value = '';
    }
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

function handleCoverRemoval() {
  setCoverImage(null, null);
  setStatus('Cover image removed. Please choose or upload a new cover.', 'error');
}

function handleDetectedToggle() {
  if (!state.images || state.images.length === 0) {
    return;
  }

  setImageSelectionVisibility(!state.imageSelectionVisible);
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
  elements.coverRemoveButton.addEventListener('click', handleCoverRemoval);
  elements.coverDetectedToggle.addEventListener('click', handleDetectedToggle);
  elements.publishButton.addEventListener('click', handlePublish);
}

document.addEventListener('DOMContentLoaded', initialize);
