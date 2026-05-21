// popup.js

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const welcomeScreen = document.getElementById('welcome-screen');
  const continueBtn = document.getElementById('continue-btn');
  const announcementContent = document.getElementById('announcement-content');

  const urlAlert = document.getElementById('url-alert');
  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');
  const statScrolls = document.getElementById('stat-scrolls');
  const statLikes = document.getElementById('stat-likes');
  const statTime = document.getElementById('stat-time');
  const remainingText = document.getElementById('remaining-text');
  const progressBarFill = document.getElementById('progress-bar-fill');
  
  const timeButtons = document.querySelectorAll('.time-btn');
  const speedButtons = document.querySelectorAll('.speed-btn');
  const toggleScroll = document.getElementById('toggle-scroll');
  const toggleLike = document.getElementById('toggle-like');
  const mainBtn = document.getElementById('main-btn');

  let currentTabId = null;

  // Handle CONTINUE button click to hide the overlay
  continueBtn.addEventListener('click', () => {
    welcomeScreen.style.display = 'none';
  });

  // Dynamic Announcement Fetching (Remote -> Local Package -> Fallback)
  async function loadAnnouncement() {
    const remoteUrl = 'https://fb-account-warmup.vercel.app/announcement.json'; // Admin can change this to their deployed domain
    const defaultText = "💡 Pro Tip: If a customer sends a message on your listing, first mark the item as Sold and then reply to the customer. This can help reduce the risk of account suspension caused by message activity. 😎";

    // 1. Try Remote Fetch
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5 second timeout
      const res = await fetch(remoteUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.announcement) {
          announcementContent.textContent = data.announcement;
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch remote announcement, checking local packaging...", e);
    }

    // 2. Try Local Bundle Fetch
    try {
      const localRes = await fetch(chrome.runtime.getURL('announcement.json'));
      if (localRes.ok) {
        const data = await localRes.json();
        if (data && data.announcement) {
          announcementContent.textContent = data.announcement;
          return;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch local packaged announcement...", e);
    }

    // 3. Hardcoded Fallback
    announcementContent.textContent = defaultText;
  }

  // Fetch and display announcement
  loadAnnouncement();

  // Check if active tab is facebook.com
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      currentTabId = activeTab.id;
      if (activeTab.url && (activeTab.url.includes('facebook.com') || activeTab.url.includes('fb.com'))) {
        urlAlert.style.display = 'none';
        mainBtn.disabled = false;
        mainBtn.style.opacity = '1';
        mainBtn.style.cursor = 'pointer';
      } else {
        urlAlert.style.display = 'block';
        mainBtn.disabled = true;
        mainBtn.style.opacity = '0.5';
        mainBtn.style.cursor = 'not-allowed';
      }
    }
  });

  // Load and apply initial state from chrome.storage.local
  chrome.storage.local.get([
    'duration', 'speed', 'scrollEnabled', 'likeEnabled', 
    'isRunning', 'startTime', 'endTime', 'scrollCount', 'likeCount'
  ], (data) => {
    // Default values if not set
    const duration = data.duration || 15;
    const speed = data.speed || 'normal';
    const scrollEnabled = data.scrollEnabled !== undefined ? data.scrollEnabled : true;
    const likeEnabled = data.likeEnabled !== undefined ? data.likeEnabled : true;
    const isRunning = data.isRunning || false;

    // Apply active class to loaded duration button
    timeButtons.forEach(btn => {
      if (parseInt(btn.getAttribute('data-duration')) === duration) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Apply active class to loaded speed button
    speedButtons.forEach(btn => {
      if (btn.getAttribute('data-speed') === speed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Set switches
    toggleScroll.checked = scrollEnabled;
    toggleLike.checked = likeEnabled;

    updateUI(data);
  });

  // Event Listeners for Duration buttons
  timeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Don't allow config changes while running
      chrome.storage.local.get(['isRunning'], (data) => {
        if (data.isRunning) return;

        timeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const duration = parseInt(btn.getAttribute('data-duration'));
        chrome.storage.local.set({ duration });
        remainingText.textContent = `${duration} min left`;
      });
    });
  });

  // Event Listeners for Speed buttons
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Don't allow config changes while running
      chrome.storage.local.get(['isRunning'], (data) => {
        if (data.isRunning) return;

        speedButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const speed = btn.getAttribute('data-speed');
        chrome.storage.local.set({ speed });
      });
    });
  });

  // Event Listeners for Toggles
  toggleScroll.addEventListener('change', () => {
    chrome.storage.local.get(['isRunning'], (data) => {
      if (data.isRunning) {
        // Revert switch if running
        toggleScroll.checked = !toggleScroll.checked;
        return;
      }
      chrome.storage.local.set({ scrollEnabled: toggleScroll.checked });
    });
  });

  toggleLike.addEventListener('change', () => {
    chrome.storage.local.get(['isRunning'], (data) => {
      if (data.isRunning) {
        // Revert switch if running
        toggleLike.checked = !toggleLike.checked;
        return;
      }
      chrome.storage.local.set({ likeEnabled: toggleLike.checked });
    });
  });

  // Start / Stop Click Handler
  mainBtn.addEventListener('click', () => {
    chrome.storage.local.get([
      'isRunning', 'duration', 'speed', 'scrollEnabled', 'likeEnabled'
    ], (data) => {
      if (data.isRunning) {
        stopSession();
      } else {
        startSession(data);
      }
    });
  });

  // Start the session
  function startSession(config) {
    const durationMins = config.duration || 15;
    const speed = config.speed || 'normal';
    const scrollEnabled = config.scrollEnabled !== undefined ? config.scrollEnabled : true;
    const likeEnabled = config.likeEnabled !== undefined ? config.likeEnabled : true;

    if (!scrollEnabled && !likeEnabled) {
      alert('Please enable at least one action (Scroll or Like) to start!');
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + (durationMins * 60 * 1000);

    const sessionState = {
      isRunning: true,
      startTime: startTime,
      endTime: endTime,
      scrollCount: 0,
      likeCount: 0,
      duration: durationMins,
      speed: speed,
      scrollEnabled: scrollEnabled,
      likeEnabled: likeEnabled
    };

    chrome.storage.local.set(sessionState, () => {
      updateUI(sessionState);
      
      // Notify content script in the active Facebook tab
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'START' }, (response) => {
          // If content script is not loaded yet or tab has disconnected
          if (chrome.runtime.lastError) {
            console.warn('Content script not ready or tab not active yet. State stored, will resume upon page refresh.');
          }
        });
      }
    });
  }

  // Stop the session
  function stopSession() {
    chrome.storage.local.set({ isRunning: false }, () => {
      chrome.storage.local.get(null, (data) => {
        updateUI(data);
      });

      // Notify content script in the active Facebook tab
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { action: 'STOP' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Error stopping content script: Tab might be inactive or closed.');
          }
        });
      }
    });
  }

  // Update UI components based on stored state
  function updateUI(data) {
    const isRunning = data.isRunning || false;
    const scrolls = data.scrollCount || 0;
    const likes = data.likeCount || 0;
    const startTime = data.startTime || 0;
    const endTime = data.endTime || 0;
    const duration = data.duration || 15;

    // Update stats counters
    statScrolls.textContent = scrolls;
    statLikes.textContent = likes;

    if (isRunning) {
      // Running UI
      statusDot.classList.add('active');
      statusText.textContent = 'Running';
      mainBtn.classList.add('running');
      mainBtn.innerHTML = '<span>⏹</span> Stop Warm Up Session';

      // Disable inputs while running
      toggleScroll.disabled = true;
      toggleLike.disabled = true;
      timeButtons.forEach(btn => btn.disabled = true);
      speedButtons.forEach(btn => btn.disabled = true);

      // Time & Progress calculations
      const now = Date.now();
      const totalSessionMs = endTime - startTime;
      const remainingMs = Math.max(0, endTime - now);
      const elapsedMs = Math.max(0, now - startTime);

      // Convert elapsed time to string (e.g. 5m 23s)
      const elapsedMin = Math.floor(elapsedMs / 60000);
      const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
      statTime.textContent = `${elapsedMin}m ${elapsedSec}s`;

      // Progress bar fill percentage
      const progressPercent = totalSessionMs > 0 ? Math.min(100, (elapsedMs / totalSessionMs) * 100) : 0;
      progressBarFill.style.width = `${progressPercent}%`;

      // Remaining text
      const remainingMin = Math.ceil(remainingMs / 60000);
      if (remainingMin > 1) {
        remainingText.textContent = `${remainingMin} min left`;
      } else {
        const remainingSec = Math.ceil(remainingMs / 1000);
        remainingText.textContent = `${remainingSec} sec left`;
      }

      // Check auto stop
      if (now >= endTime) {
        stopSession();
      }
    } else {
      // Stopped UI
      statusDot.classList.remove('active');
      statusText.textContent = 'Stopped';
      mainBtn.classList.remove('running');
      mainBtn.innerHTML = '<span>▶</span> Start Warm Up Session';

      // Enable inputs
      toggleScroll.disabled = false;
      toggleLike.disabled = false;
      timeButtons.forEach(btn => btn.disabled = false);
      speedButtons.forEach(btn => btn.disabled = false);

      // Static Stats Display
      if (startTime > 0 && endTime > 0) {
        const elapsedMs = Math.min(endTime - startTime, Date.now() - startTime);
        const elapsedMin = Math.floor(elapsedMs / 60000);
        const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);
        statTime.textContent = `${elapsedMin}m ${elapsedSec}s`;
      } else {
        statTime.textContent = '0m';
      }

      progressBarFill.style.width = '0%';
      remainingText.textContent = `${duration} min left`;
    }
  }

  // Periodic polling interval to update stats in real-time when popup is open
  const uiInterval = setInterval(() => {
    chrome.storage.local.get(null, (data) => {
      updateUI(data);
    });
  }, 1000);

  // Clean up interval when popup closes
  window.addEventListener('unload', () => {
    clearInterval(uiInterval);
  });
});
