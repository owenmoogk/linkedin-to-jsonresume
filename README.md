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
- **JSON Resume version**: _Stable_ (`v1.0.0`, default), _Legacy_ (`v0.0.16`), or _Beta_ (currently the same as stable)

The extension reads data through LinkedIn's internal "Voyager" API (the same one linkedin.com uses), using your signed-in session. It exports basics (name, headline, About, location, email, phone, website), work, education, volunteering, certificates, awards, skills, projects, publications, languages, and recommendations.

### Known quirks

- Work locations use the text saved on each position, so some may be short ("Waterloo, ON") and others long ("Waterloo, Ontario, Canada"). LinkedIn's API doesn't return the full place names for positions.
- LinkedIn's API strips line breaks from the About section. The extension restores them from the rendered page when it can, and otherwise guesses at sentence boundaries.

## Installing

### From a release (Firefox)

Each [GitHub release](https://github.com/owenmoogk/linkedin-to-jsonresume/releases) has a Mozilla-signed `.xpi`. Open it in Firefox (or drag it into the window) to install it permanently.

### Build it yourself

Requires Node 22+ and [Yarn (classic)](https://classic.yarnpkg.com/).

```bash
yarn install
yarn build
```

This creates the unpacked extension in `dist/`. `yarn package` also zips it into `web-ext-artifacts/`.

### Firefox (140+)

1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…** and pick `dist/manifest.json` (or the zip)
3. Open a profile and click the toolbar button. If the buttons are greyed out, right-click the icon and choose _Always allow on www.linkedin.com_.

Temporary add-ons are removed when Firefox restarts. For a permanent install, use a release `.xpi`, or sign your own build (see [Releasing](#releasing)).

### Chrome / Chromium

1. Go to `chrome://extensions` and turn on **Developer mode**
2. Click **Load unpacked** and pick the `dist/` folder

## Development

TypeScript + Vite, linted with ESLint (`typescript-eslint` strict type-checked rules) and formatted with Prettier.

| Command                                      | What it does                                     |
| -------------------------------------------- | ------------------------------------------------ |
| `yarn build`                                 | Build the extension into `dist/`                 |
| `yarn package`                               | Build, then zip into `web-ext-artifacts/`        |
| `yarn lint`                                  | ESLint                                           |
| `yarn typecheck`                             | `tsc --noEmit`                                   |
| `yarn test`                                  | `lint` + `typecheck`                             |
| `yarn lint:ext`                              | Validate `dist/` with Mozilla's `web-ext lint`   |
| `yarn sign`                                  | Sign `dist/` with Mozilla (see below)            |
| `yarn ver:patch` / `ver:minor` / `ver:major` | Bump version, tag, and push (triggers a release) |

The extension version comes from `package.json` and is written into the built `manifest.json`.

### Releasing

`yarn ver:patch` (or `ver:minor` / `ver:major`) bumps the version in `package.json`, tags it, and pushes. For `v*` tags, CI then:

1. Builds and zips the extension, and creates a source archive (`git archive`)
2. Submits it to [addons.mozilla.org](https://addons.mozilla.org) as an **unlisted** (self-distributed) add-on, waits for Mozilla to sign it, and downloads the signed `.xpi`
3. Creates a GitHub release with the `.xpi` (Firefox) and `.zip` (Chrome)

This needs two GitHub Actions secrets, from [AMO → Manage API Keys](https://addons.mozilla.org/developers/addon/api/key/): `AMO_JWT_ISSUER` and `AMO_JWT_SECRET`. The first submission creates the add-on on AMO (using the `gecko.id` in `src/manifest.json`, which must not change), so there's no need to upload anything through the website.

AMO rejects a version number it has already seen, so every release needs a new version.

To sign locally instead: `WEB_EXT_API_KEY=<issuer> WEB_EXT_API_SECRET=<secret> yarn sign` after `yarn build`.

### Debugging

To get debug logging in the page console, add `?li2jr_debug=true` to the profile URL before running the extension.

### Layout

```
src/
  manifest.json        extension manifest (version is filled in at build time)
  popup/               toolbar popup (popup.html / popup.ts / popup.css)
  content/             exporter injected into the LinkedIn page
    index.ts           entry point; exposes window.liToJr
    voyager.ts         authenticated LinkedIn API client + endpoints
    linkedin.ts        LinkedIn entity types + EntityStore
    profileData.ts     fetches all profile sections
    resume.ts          maps LinkedIn data to JSON Resume (stable / legacy)
    vcard.ts, modal.ts, utils.ts
  schema/              JSON Resume schema types
public/                icons (copied as-is)
```

### How it works

- The popup injects `exporter.js` into the page's MAIN world with `scripting.executeScript`, so requests go out with the page's own LinkedIn session, then calls methods on `window.liToJr`.
- The exporter fetches:
  - `identity/dash/profiles?...FullProfileWithEntities`: most sections
  - `identity/dash/profilePositionGroups`: the full, paginated work history
  - `identity/dash/profiles?...ProfileContactInfo`: email, phone, websites
  - `identity/dash/recommendations`, and `profileSkills` / `profileVolunteerExperiences` when the profile response truncates them
- It then maps the results to JSON Resume. The legacy (v0.0.16) format is derived from the stable (v1.0.0) one.

LinkedIn retired the older `/identity/profiles/{id}/profileView`-style endpoints (they return HTTP 410), so only the "dash" endpoints are used.

You can also paste `dist/exporter.js` into the browser console on a profile page and run:

```js
await liToJr.showOutput(); // or: await liToJr.getResume('stable')
```

## Disclaimer

This tool is not affiliated with LinkedIn in any manner. It is intended for exporting your own profile data, and you are responsible for using it within LinkedIn's terms of service.

## Attribution

- Original project by [Joshua Tzucker](https://github.com/joshuatz/linkedin-to-jsonresume) (MIT)
- Extension icon: [iconfinder](https://www.iconfinder.com/icons/95928/arrow_down_download_profile_icon)
