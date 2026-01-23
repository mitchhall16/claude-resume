# Resume AutoFill Extension

Auto-fill job applications with your profile data. Works on Workday, Greenhouse, Lever, Taleo, and more.

## Installation

### Chrome / Edge / Brave

1. Open your browser and go to:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`

2. Enable **Developer mode** (toggle in top-right)

3. Click **Load unpacked**

4. Select this `extension` folder

5. The extension icon should appear in your toolbar

### Safari (Mac only)

Safari requires converting the extension using Xcode:

1. Install Xcode from the Mac App Store

2. Open Terminal and run:
   ```bash
   xcrun safari-web-extension-converter /path/to/extension --project-location /path/to/output
   ```

3. Open the generated Xcode project

4. Build and run (Cmd+R)

5. Enable the extension in Safari > Preferences > Extensions

## Usage

1. Click the extension icon and go to **My Profile** tab

2. Fill in your basic info (name, email, phone, etc.)

3. Click **Save Profile**

4. Navigate to a job application page (Workday, Greenhouse, etc.)

5. Either:
   - Click the floating **AutoFill** button on the page, OR
   - Click the extension icon and click **Auto-Fill This Page**

## Supported Sites

- Workday (*.myworkdayjobs.com, *.workday.com)
- Greenhouse (*.greenhouse.io)
- Lever (*.lever.co)
- Taleo (*.taleo.net)
- iCIMS (*.icims.com)
- SmartRecruiters (*.smartrecruiters.com)
- Jobvite (*.jobvite.com)
- Breezy HR (*.breezy.hr)
- Ashby (*.ashbyhq.com)

## Icons

Replace the placeholder icons in the `icons/` folder:
- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

You can generate these from any image at https://www.icoconvert.com/ or similar.
