// content.js

let loopActive = false;
let sessionTimeoutId = null;
let totalScrolledPixels = 0;
let nextReadingPauseDistance = randomRange(1200, 2400);

// Helper function: delay execution
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function: get random number in range
function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Get all data from local storage
function getStorageData() {
  return new Promise((resolve) => {
    chrome.storage.local.get(null, (data) => {
      resolve(data);
    });
  });
}

// Update storage data
function setStorageData(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      resolve();
    });
  });
}

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'START') {
    startWarmUp();
    sendResponse({ status: 'session_started' });
  } else if (message.action === 'STOP') {
    stopWarmUp();
    sendResponse({ status: 'session_stopped' });
  }
  return true;
});

// Automatic check on file load (e.g. page refresh)
chrome.storage.local.get(['isRunning', 'endTime'], (data) => {
  if (data.isRunning && data.endTime && data.endTime > Date.now()) {
    console.log('[FB Warm Up] Active session detected. Resuming session...');
    startWarmUp();
  }
});

// Start the warm up processes
function startWarmUp() {
  if (loopActive) return;
  loopActive = true;
  console.log('[FB Warm Up] Warm up loop initialized.');

  // Run the core background interaction loop
  runInteractionLoop();

  // Setup exact safety stop timer
  chrome.storage.local.get(['endTime'], (data) => {
    if (data.endTime) {
      const remainingTime = data.endTime - Date.now();
      if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
      
      sessionTimeoutId = setTimeout(() => {
        console.log('[FB Warm Up] Session duration reached. Auto-stopping.');
        stopWarmUp();
      }, Math.max(0, remainingTime));
    }
  });
}

// Stop the warm up processes
function stopWarmUp() {
  loopActive = false;
  if (sessionTimeoutId) {
    clearTimeout(sessionTimeoutId);
    sessionTimeoutId = null;
  }
  chrome.storage.local.set({ isRunning: false });
  console.log('[FB Warm Up] Warm up loop stopped.');
}

// Main operational loop
async function runInteractionLoop() {
  while (loopActive) {
    const state = await getStorageData();

    // Check if session has expired or stopped
    if (!state.isRunning || Date.now() >= state.endTime) {
      stopWarmUp();
      break;
    }

    // 1. Perform Scrolling
    if (state.scrollEnabled) {
      await performHumanScroll(state.speed);
    } else {
      await delay(2000); // Wait if scroll is disabled
    }

    // 2. Perform Liking (if enabled)
    if (state.likeEnabled && loopActive) {
      await checkAndPerformLike();
    }

    // 3. Pause between cycles (human jitter delay)
    const cyclePause = randomRange(2000, 4000);
    await delay(cyclePause);
  }
}

// Simulate human-like scrolling
async function performHumanScroll(speed) {
  let stepMin, stepMax, delayMin, delayMax, totalDistance;

  // Configure speed coefficients
  switch (speed) {
    case 'slow':
      // 1.5x speed boost
      stepMin = 33;
      stepMax = 72;
      delayMin = 43;
      delayMax = 77;
      totalDistance = randomRange(480, 975);
      break;
    case 'fast':
      // 1.5x speed boost
      stepMin = 141;
      stepMax = 285;
      delayMin = 10;
      delayMax = 25;
      totalDistance = randomRange(1620, 2835);
      break;
    case 'normal':
    default:
      // 1.5x speed boost
      stepMin = 60;
      stepMax = 141;
      delayMin = 22;
      delayMax = 44;
      totalDistance = randomRange(900, 1695);
      break;
  }

  let scrolledThisCycle = 0;
  while (scrolledThisCycle < totalDistance && loopActive) {
    const step = randomRange(stepMin, stepMax);
    window.scrollBy({
      top: step,
      behavior: 'smooth'
    });

    scrolledThisCycle += step;
    totalScrolledPixels += step;

    // Trigger intermittent reading pauses (simulate human processing)
    if (totalScrolledPixels >= nextReadingPauseDistance) {
      const readPause = randomRange(3000, 8000);
      console.log(`[FB Warm Up] Simulating reading pause for ${readPause}ms...`);
      await delay(readPause);
      totalScrolledPixels = 0;
      nextReadingPauseDistance = randomRange(1200, 2400);
    }

    const wait = randomRange(delayMin, delayMax);
    await delay(wait);
  }

  // Finished a scroll burst. Update the scroll stats.
  if (loopActive) {
    const state = await getStorageData();
    const currentScrolls = (state.scrollCount || 0) + 1;
    await setStorageData({ scrollCount: currentScrolls });
  }
}

// Find all like buttons on the current page
function getLikeButtons() {
  const buttons = [];
  
  // 1. Selector matching typical facebook interactive elements labeled "Like"
  const selectors = [
    'div[role="button"][aria-label="Like"]',
    'div[role="button"][aria-label="Like post"]',
    'div[role="button"][aria-label="like"]',
    'button[aria-label="Like"]',
    'button[aria-label="like"]'
  ];
  
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => {
      if (!buttons.includes(el)) buttons.push(el);
    });
  });

  // 2. Text-based recovery matching for resilient localization or elements inside layout wrappers
  const spans = document.querySelectorAll('span, div');
  spans.forEach(el => {
    const text = el.textContent ? el.textContent.trim() : '';
    if (text === 'Like' || text === 'like') {
      const parent = el.closest('div[role="button"], button');
      if (parent && !buttons.includes(parent)) {
        buttons.push(parent);
      }
    }
  });

  return buttons;
}

// Check if a post is already liked
function isAlreadyLiked(button) {
  const label = button.getAttribute('aria-label') || '';
  const labelLower = label.toLowerCase();

  // If label indicates it's a removal action, it is already liked
  if (labelLower.includes('unlike') || 
      labelLower.includes('remove') || 
      labelLower.includes('quitar me gusta') || 
      labelLower.includes('undo')) {
    return true;
  }

  // Check text content inside
  const text = button.textContent || '';
  if (text.trim() === 'Unlike' || text.trim() === 'Liked') {
    return true;
  }

  // Color checking logic (check if button text color is active Facebook Blue)
  const style = window.getComputedStyle(button);
  const textColor = style.color || '';

  if (textColor.startsWith('rgb')) {
    const rgbValues = textColor.match(/\d+/g);
    if (rgbValues && rgbValues.length >= 3) {
      const r = parseInt(rgbValues[0]);
      const g = parseInt(rgbValues[1]);
      const b = parseInt(rgbValues[2]);
      // Active state blue is high blue component (usually > 200) and low red/green
      if (b > 200 && b > r + 45 && b > g + 45) {
        return true;
      }
    }
  }

  return false;
}

// Verify if button element is currently visible in viewport
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

// Scan the visible feed posts and perform a click action on each candidate
async function checkAndPerformLike() {
  const allLikes = getLikeButtons();
  
  // Filter for unliked elements that are visible on screen
  const candidateButtons = allLikes.filter(btn => isElementInViewport(btn) && !isAlreadyLiked(btn));

  if (candidateButtons.length === 0) return;

  // Like every visible unliked post sequentially
  for (const targetBtn of candidateButtons) {
    if (!loopActive) break;

    // Double-check visibility and status before interaction
    if (isElementInViewport(targetBtn) && !isAlreadyLiked(targetBtn)) {
      const preClickDelay = randomRange(600, 1200);
      await delay(preClickDelay);

      // Re-verify after potential scroll/layout changes
      if (loopActive && isElementInViewport(targetBtn) && !isAlreadyLiked(targetBtn)) {
        targetBtn.click();
        console.log('[FB Warm Up] Liked post successfully.');

        // Update storage stats
        const state = await getStorageData();
        const currentLikes = (state.likeCount || 0) + 1;
        await setStorageData({ likeCount: currentLikes });

        // Post-like stabilization delay
        await delay(randomRange(600, 1100));
      }
    }
  }
}
