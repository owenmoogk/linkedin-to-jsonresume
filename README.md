# LinkedIn Profile to JSON Resume

> A browser extension (Firefox and Chrome) that exports your open LinkedIn profile to a [JSON Resume](https://jsonresume.org/) file.

Forked from [joshuatz/linkedin-to-jsonresume](https://github.com/joshuatz/linkedin-to-jsonresume), updated to work with LinkedIn's current internal API (late 2026) and ported to Manifest V3 so it runs in Firefox.

## What it does

Open a LinkedIn profile (`https://www.linkedin.com/in/<someone>/`) while signed in, click the extension's toolbar button, and pick one of:

- **LinkedIn Profile to JSON**: shows the JSON Resume export in a modal on the page, ready to copy
- **💾**: downloads the export as `<Name>.resume.json`
- **📠**: downloads the profile as a vCard (`.vcf`)

The popup also lets you pick:

- **Export language**: for profiles that have multiple language versions
- **JSON Resume version**: *Stable* (`v1.0.0`, default), *Legacy* (`v0.0.16`), or *Beta* (currently the same as stable)

The extension reads data through LinkedIn's internal "Voyager" API (the same one linkedin.com uses), using your signed-in session. It exports basics (name, headline, About, location, email, phone, website), work, education, volunteering, certificates, awards, skills, projects, publications, languages, and recommendations.

### Known quirks

- Work locations use the text saved on each position, so some may be short ("Waterloo, ON") and others long ("Waterloo, Ontario, Canada"). LinkedIn's API doesn't return the full place names for positions.
- LinkedIn's API strips line breaks from the About section. The extension restores them from the rendered page when it can, and otherwise guesses at sentence boundaries.

## Installing (side-loading)

### Build

```bash
npm ci
npm run build
```

This creates the unpacked extension in `build-browserext/`. `npm run package` also zips it into `webstore-zips/`.

### Firefox (128+)

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and pick `build-browserext/manifest.json`
3. Open a profile and click the toolbar button. If the buttons are greyed out, right-click the icon and choose *Always allow on www.linkedin.com*.

Temporary add-ons are removed when Firefox restarts. To install permanently, sign the build with `npx web-ext sign --source-dir build-browserext` (needs a free addons.mozilla.org API key) and install the resulting `.xpi`.

### Chrome / Chromium

1. Go to `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and pick the `build-browserext/` folder

## Development

- `npm run build:dev`: unminified build with source maps
- `npm run type-check`: TypeScript check over the JSDoc-typed JS
- `npx web-ext lint --source-dir build-browserext`: validate the extension for Firefox

To get debug logging in the page console, add `?li2jr_debug=true` to the profile URL before running the extension.

### How it works

- `browser-ext/popup.js` injects `main.js` into the page's MAIN world with `scripting.executeScript`, so requests go out with the page's own LinkedIn session, then calls methods on `window.liToJrInstance`.
- `src/main.js` fetches:
  - `identity/dash/profiles?...FullProfileWithEntities`: most sections
  - `identity/dash/profilePositionGroups`: the full, paginated work history
  - `identity/dash/profiles?...ProfileContactInfo`: email, phone, websites
  - `identity/dash/profileSkills`, `identity/dash/recommendations`
- It then maps the results to JSON Resume (templates in `src/templates.js`, LinkedIn type mappings in `src/schema.js`).

LinkedIn retired the older `/identity/profiles/{id}/profileView`-style endpoints (they return HTTP 410), so only the "dash" endpoints are used.

You can also paste `build/main.js` into the browser console on a profile page and run:

```js
li2jr = new LinkedinToResumeJson(true);
li2jr.parseAndShowOutput();
```

## Disclaimer

This tool is not affiliated with LinkedIn in any manner. It is intended for exporting your own profile data, and you are responsible for using it within LinkedIn's terms of service.

## Attribution

- Original project by [Joshua Tzucker](https://github.com/joshuatz/linkedin-to-jsonresume) (MIT)
- Extension icon: [iconfinder](https://www.iconfinder.com/icons/95928/arrow_down_download_profile_icon)
