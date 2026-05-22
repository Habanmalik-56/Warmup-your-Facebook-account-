// content.js

let loopActive = false;
let sessionTimeoutId = null;
let totalScrolledPixels = 0;
let nextReadingPauseDistance = randomRange(3600, 7200);

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
      // If scroll is disabled but like is enabled, perform checking
      if (state.likeEnabled) {
        await checkAndLikeVisiblePost();
      }
      await delay(1000); // Wait if scroll is disabled
    }

    // 2. Perform a final check of likes after the scroll burst
    if (state.likeEnabled && loopActive) {
      await checkAndLikeVisiblePost();
    }

    // 3. Pause between cycles (extremely short cycle pause for turbo mode)
    const cyclePause = randomRange(300, 800);
    await delay(cyclePause);
  }
}

// Simulate human-like scrolling
async function performHumanScroll(speed) {
  let stepMin, stepMax, delayMin, delayMax, totalDistance;

  // Configure speed coefficients (3x Turbo Boosted)
  switch (speed) {
    case 'slow':
      stepMin = 150;
      stepMax = 300;
      delayMin = 10;
      delayMax = 20;
      totalDistance = randomRange(2000, 3500);
      break;
    case 'fast':
      stepMin = 600;
      stepMax = 1200;
      delayMin = 1;
      delayMax = 3;
      totalDistance = randomRange(8000, 15000);
      break;
    case 'normal':
    default:
      stepMin = 300;
      stepMax = 600;
      delayMin = 5;
      delayMax = 10;
      totalDistance = randomRange(4000, 8000);
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

    // Check and perform likes DURING scrolling!
    const state = await getStorageData();
    if (state.likeEnabled && loopActive) {
      await checkAndLikeVisiblePost();
    }

    // Trigger intermittent reading pauses (simulate human processing but much shorter)
    if (totalScrolledPixels >= nextReadingPauseDistance) {
      const readPause = randomRange(800, 2000);
      console.log(`[FB Warm Up] Simulating reading pause for ${readPause}ms...`);
      await delay(readPause);
      totalScrolledPixels = 0;
      nextReadingPauseDistance = randomRange(3600, 7200);
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

// Verify if button element is currently visible in viewport (relaxed bounds)
function isElementInViewport(el) {
  const rect = el.getBoundingClientRect();
  const windowHeight = (window.innerHeight || document.documentElement.clientHeight);
  return (
    rect.top >= -100 &&
    rect.bottom <= windowHeight + 150
  );
}

// Scan the visible feed posts and click ALL unliked candidate buttons
async function checkAndLikeVisiblePost() {
  const allLikes = getLikeButtons();
  
  // Filter for unliked elements that are visible on screen
  const candidateButtons = allLikes.filter(btn => isElementInViewport(btn) && !isAlreadyLiked(btn));

  if (candidateButtons.length === 0) return false;

  let likedAny = false;
  // Like every visible unliked post sequentially
  for (const targetBtn of candidateButtons) {
    if (!loopActive) break;

    // Double-check visibility and status before interaction
    if (isElementInViewport(targetBtn) && !isAlreadyLiked(targetBtn)) {
      // Very fast click action
      targetBtn.click();
      console.log('[FB Warm Up] Liked post successfully.');
      likedAny = true;

      // Update storage stats
      const state = await getStorageData();
      const currentLikes = (state.likeCount || 0) + 1;
      await setStorageData({ likeCount: currentLikes });

      // Tiny delay between multiple clicks to ensure registration
      await delay(randomRange(150, 300));
    }
  }
  return likedAny;
}
