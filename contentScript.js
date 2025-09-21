function getAbsoluteUrl(url) {
  try {
    return new URL(url, window.location.href).href;
  } catch (error) {
    return url;
  }
}

function collectPageImages() {
  const rawImages = Array.from(document.images || []);
  const uniqueSources = new Set();
  const images = [];

  rawImages.forEach((image) => {
    if (!image || !image.src) {
      return;
    }

    const absoluteSrc = getAbsoluteUrl(image.src);

    if (!absoluteSrc || uniqueSources.has(absoluteSrc)) {
      return;
    }

    uniqueSources.add(absoluteSrc);
    images.push({
      src: absoluteSrc,
      width: image.naturalWidth || image.width || 0,
      height: image.naturalHeight || image.height || 0
    });
  });

  const ogImage = document.querySelector("meta[property='og:image']");
  if (ogImage && ogImage.content) {
    const ogSrc = getAbsoluteUrl(ogImage.content);

    if (!uniqueSources.has(ogSrc)) {
      images.unshift({
        src: ogSrc,
        width: 0,
        height: 0
      });
      uniqueSources.add(ogSrc);
    }
  }

  return images;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'collectPageData') {
    const images = collectPageImages();

    sendResponse({
      title: document.title,
      url: window.location.href,
      images
    });
  }
});
