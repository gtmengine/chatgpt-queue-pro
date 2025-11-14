# 📸 Extension Icons

You need to create 3 PNG icon files for the Chrome extension. The extension won't load without these.

## Required Files

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extensions page)
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## How to Create

### Option 1: Use Online Generator
1. Go to: https://favicon.io/favicon-generator/
2. Enter "🚀" or "📋" as text
3. Choose colors (blue/green theme)
4. Download all sizes
5. Rename files to match above

### Option 2: Simple Colored Squares
Use any image editor or online tool:
- 16x16: Blue square with white "Q"
- 48x48: Same design, larger
- 128x128: Same design, largest

### Option 3: Copy from Another Extension
1. Find a Chrome extension with similar icons
2. Extract the icon files
3. Rename and resize as needed

## Test Loading

Once you have the icon files:
1. Put them in the `chatgpt-queue-extension/` folder
2. Go to `chrome://extensions/`
3. Reload the extension
4. You should see the icon in the toolbar

## Default Icon Appearance

The extension icon should show in Chrome's toolbar when you're on ChatGPT. It will be a small icon (16x16) that you can click to open the popup.
