========================================================================
           FACEBOOK ACCOUNT WARM UP CHROME EXTENSION
========================================================================

A premium Chrome Extension designed to simulate human-like behavior
on Facebook (scrolling & liking feed posts) to warm up new or dormant 
Facebook accounts safely.

------------------------------------------------------------------------
1. INSTALLATION INSTRUCTIONS
------------------------------------------------------------------------
To install this extension in Google Chrome, follow these simple steps:

1. Open Google Chrome.
2. Navigate to the Extensions page by typing: chrome://extensions/
   in the address bar and pressing Enter.
3. Enable "Developer mode" by toggling the switch in the top-right corner.
4. Click on the "Load unpacked" button in the top-left corner.
5. Browse and select the extension folder:
   `c:\Users\city\Desktop\Links\fb-account-warmup`
6. The extension is now successfully installed and will appear in your 
   toolbar (click the puzzle icon to pin it).

------------------------------------------------------------------------
2. HOW TO USE
------------------------------------------------------------------------
1. Log into the Facebook account you want to warm up.
2. Go to the main news feed page (https://www.facebook.com).
3. Click the "WarmUp Bot" extension icon in the toolbar.
4. Configure your preferred options:
   - Session Duration: Select between 15m, 30m, 45m, or 1 hour.
   - Scrolling Speed: Select Slow, Normal, or Fast.
   - Actions Allowed: Enable or disable "Auto Scroll" and "Auto Like" toggles.
5. Click the "Start Warm Up Session" button.
6. The status indicator will turn green ("Running") and the extension
   will begin human-like interaction.
7. You can watch the stats update (Scrolls, Likes, Active Time) and view
   the progress bar in real-time.
8. If you want to stop, click "Stop Warm Up Session" or close the page.

------------------------------------------------------------------------
3. SAFETY & HUMAN-LIKE BEHAVIOR FEATURES
------------------------------------------------------------------------
To protect your accounts from suspension, this extension includes:
- Random step sizes & delays when scrolling.
- "Reading Pauses" (simulating a human stopping to read a post for 
  6 to 14 seconds every 800-1600 pixels).
- Random liking probability (only likes ~35% of unliked visible posts).
- Intelligent state restoration: If the Facebook tab is refreshed or 
  navigated, the script automatically reads the active session data 
  from local storage and resumes from where it left off.
- Auto-stops precisely when the session duration completes.

------------------------------------------------------------------------
4. SUPPORTED PLATFORMS
------------------------------------------------------------------------
Works on:
- Google Chrome, Microsoft Edge, Brave, Opera, and other Chromium browsers.
- Only executes script execution on domains matching `*://*.facebook.com/*`.
========================================================================
