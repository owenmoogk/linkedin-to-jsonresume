/**
 * Popup script (Manifest V3, works in Firefox and Chrome).
 *
 * The exporter (`main.js`) is injected into the page's MAIN world so that it shares
 * the page's origin, cookies and globals (needed for authenticated LinkedIn requests
 * and for the in-page modal). All calls go through `chrome.scripting.executeScript`
 * with `func` + `args`, since MV3 no longer allows injecting code strings.
 */

/** @type {typeof chrome} */
// @ts-ignore
const ext = globalThis.browser || globalThis.chrome;

const STORAGE_KEYS = {
    schemaVersion: 'schemaVersion'
};
const SPEC_SELECT = /** @type {HTMLSelectElement} */ (document.getElementById('specSelect'));
/** @type {SchemaVersion[]} */
const SPEC_OPTIONS = ['legacy', 'stable', 'beta'];
/** @type {HTMLSelectElement} */
const LANG_SELECT = document.querySelector('.langSelect');
const STATUS = document.getElementById('status');

/** @type {number | null} */
let tabId = null;

/** @param {string} msg */
const setStatus = (msg) => {
    STATUS.textContent = msg;
};

/**
 * Run a function inside the page (MAIN world), with access to the exporter instance
 * Note: `fn` is serialized, so it cannot close over anything from this file - use args.
 * @template T
 * @param {(...args: any[]) => T} fn
 * @param {any[]} [args]
 * @returns {Promise<Awaited<T>>}
 */
const runInPage = async (fn, args = []) => {
    const results = await ext.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: fn,
        args
    });
    /** @type {any} */
    const first = results && results[0];
    if (first && first.error) {
        throw first.error;
    }
    return first ? first.result : undefined;
};

/**
 * Ensure exporter is loaded and an instance exists on the page
 */
const ensureInstance = async () => {
    // @ts-ignore
    const hasClass = await runInPage(() => typeof window.LinkedinToResumeJson === 'function');
    if (!hasClass) {
        await ext.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            files: ['main.js']
        });
    }
    await runInPage(() => {
        const isDebug = window.location.href.includes('li2jr_debug=true');
        // Re-create instance if profile changed (LinkedIn is an SPA)
        // @ts-ignore
        const existing = window.liToJrInstance;
        if (!existing || existing.profileId !== existing.getProfileId()) {
            // @ts-ignore
            window.liToJrInstance = new window.LinkedinToResumeJson(isDebug);
        }
    });
};

const getSelectedLang = () => LANG_SELECT.value;

/** @param {boolean} isEnabled */
const toggleEnabled = (isEnabled) => {
    document.querySelectorAll('.toggle').forEach((elem) => {
        elem.classList.remove(isEnabled ? 'disabled' : 'enabled');
        elem.classList.add(isEnabled ? 'enabled' : 'disabled');
    });
};

/** @param {string[]} langs */
const loadLangs = (langs) => {
    LANG_SELECT.innerHTML = '';
    langs.forEach((lang) => {
        const option = document.createElement('option');
        option.value = lang;
        option.innerText = lang;
        LANG_SELECT.appendChild(option);
    });
};

/** @param {SchemaVersion} version */
const setSpecVersion = (version) => {
    ext.storage.local.set({ [STORAGE_KEYS.schemaVersion]: version });
};

/** @returns {Promise<SchemaVersion>} */
const getSpecVersion = async () => {
    const fallbackVersion = /** @type {SchemaVersion} */ (SPEC_SELECT.value);
    try {
        const result = await ext.storage.local.get([STORAGE_KEYS.schemaVersion]);
        const stored = result[STORAGE_KEYS.schemaVersion] || '';
        return SPEC_OPTIONS.includes(stored) ? stored : fallbackVersion;
    } catch (err) {
        console.error(err);
        return fallbackVersion;
    }
};

/**
 * Wrap a button action with status + error reporting
 * @param {() => Promise<void>} action
 * @param {boolean} [closeAfter]
 */
const handleAction = (action, closeAfter = false) => async () => {
    setStatus('Working… (this can take a few seconds)');
    try {
        await ensureInstance();
        await action();
        setStatus('');
        if (closeAfter) {
            window.close();
        }
    } catch (err) {
        console.error(err);
        setStatus(`Error: ${err && err.message ? err.message : err}`);
    }
};

/**
 * =============================
 * =   Setup Event Listeners   =
 * =============================
 */

document.getElementById('liToJsonButton').addEventListener(
    'click',
    handleAction(async () => {
        const version = await getSpecVersion();
        await runInPage(
            async (lang, v) => {
                // @ts-ignore
                const inst = window.liToJrInstance;
                inst.preferLocale = lang || null;
                await inst.parseAndShowOutput(v);
            },
            [getSelectedLang(), version]
        );
    }, true)
);

document.getElementById('liToJsonDownloadButton').addEventListener(
    'click',
    handleAction(async () => {
        const version = await getSpecVersion();
        await runInPage(
            async (lang, v) => {
                // @ts-ignore
                const inst = window.liToJrInstance;
                inst.preferLocale = lang || null;
                await inst.parseAndDownload(v);
            },
            [getSelectedLang(), version]
        );
    })
);

document.getElementById('vcardExportButton').addEventListener(
    'click',
    handleAction(async () => {
        // @ts-ignore
        await runInPage(async () => window.liToJrInstance.generateVCard());
    })
);

LANG_SELECT.addEventListener('change', () => {
    const lang = getSelectedLang();
    runInPage(
        (l) => {
            // @ts-ignore
            window.liToJrInstance.preferLocale = l;
        },
        [lang]
    ).catch(console.error);
});

SPEC_SELECT.addEventListener('change', () => {
    setSpecVersion(/** @type {SchemaVersion} */ (SPEC_SELECT.value));
});

/**
 * =============================
 * =           Init            =
 * =============================
 */
document.getElementById('versionDisplay').innerText = ext.runtime.getManifest().version;

getSpecVersion().then((spec) => {
    SPEC_SELECT.value = spec;
});

(async () => {
    const [tab] = await ext.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https:\/\/www\.linkedin\.com\/in\//.test(tab.url)) {
        toggleEnabled(false);
        setStatus('Open a LinkedIn profile page (linkedin.com/in/…) to use this.');
        return;
    }
    tabId = tab.id;
    toggleEnabled(true);
    try {
        await ensureInstance();
        /** @type {{supported: string[], user: string}} */
        const { supported, user } = await runInPage(async () => {
            // @ts-ignore
            const inst = window.liToJrInstance;
            let supportedLocales = [];
            try {
                supportedLocales = await inst.getSupportedLocales();
            } catch (e) {
                console.warn('Could not get supported locales', e);
            }
            return { supported: supportedLocales, user: inst.getViewersLocalLang() };
        });
        const langs = supported.filter((l) => l !== user);
        langs.unshift(user);
        loadLangs(langs);
    } catch (err) {
        console.error(err);
        setStatus(`Error loading exporter: ${err && err.message ? err.message : err}`);
    }
})();
