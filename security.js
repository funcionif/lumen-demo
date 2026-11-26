// ============================================================
// security.js (v2.2.3) - NUCLEO INTEGRAL DE SEGURIDAD LUMEN
// Cifrado AES-256-GCM + PBKDF2 (210.000 iteraciones), Boveda RAM,
// Escudo Anti-XSS compatible con CSP estricto, Rate-Limit,
// Sanitizacion Anti-Prototype-Pollution y Cortafuegos Local-First.
// ============================================================
(function () {
    'use strict';

    // --- 1. ESCAPADO Y SANITIZACION DE DATOS ---
    const HTML_ESCAPE_MAP = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
        '`': '&#96;'
    };

    const escapeHtml = (val) => {
        if (val === null || val === undefined) return '';
        return String(val).replace(/[&<>"'`]/g, (ch) => HTML_ESCAPE_MAP[ch]);
    };

    const escapeAttr = (val) => escapeHtml(val).replace(/[\r\n]/g, ' ');

    // Previene Path Traversal, nombres reservados de Windows y caracteres de control en descargas
    const sanitizeFileName = (rawName, fallback = 'archivo_lumen.txt') => {
        const cleaned = String(rawName || '')
            .replace(/[\x00-\x1f\x80-\x9f]/g, '')
            .replace(/\.\.+/g, '_')
            .replace(/[\/\\:*?"<>|]/g, '_')
            .replace(/^\.+/, '')
            .trim()
            .slice(0, 90)
            .replace(/[. ]+$/, '');
        if (!cleaned || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(cleaned)) {
            return fallback;
        }
        return cleaned;
    };

    // Previene inyeccion CRLF y escapes truncados en propiedades iCalendar (.ics)
    const sanitizeIcsField = (rawText, maxLen = 250) => {
        return String(rawText || '')
            .replace(/[\r\n]+/g, ' - ')
            .replace(/[\x00-\x1f]/g, '')
            .replace(/([,;\\])/g, '\\$1')
            .trim()
            .slice(0, maxLen)
            .replace(/\\+$/, '');
    };

    // Previene CSV Formula Injection (=, +, -, @, |, tab, CR) en hojas de calculo
    const sanitizeCsvCell = (rawVal) => {
        const str = String(rawVal ?? '').replace(/[\r\n]+/g, ' ').trim();
        if (/^[=+\-@|\t]/.test(str) && !/^-[\d.,]+$/.test(str)) {
            return "'" + str;
        }
        return str;
    };

    // Comparacion en tiempo constante para evitar oraculos de temporizacion
    const timingSafeEqual = (a, b) => {
        const strA = String(a || '');
        const strB = String(b || '');
        const len = Math.max(strA.length, strB.length);
        let diff = strA.length ^ strB.length;
        for (let i = 0; i < len; i++) {
            diff |= (strA.charCodeAt(i) || 0) ^ (strB.charCodeAt(i) || 0);
        }
        return diff === 0;
    };

    globalThis.escapeHtml = escapeHtml;
    globalThis.escapeAttr = escapeAttr;
    globalThis.sanitizeFileName = sanitizeFileName;
    globalThis.sanitizeIcsField = sanitizeIcsField;
    globalThis.sanitizeCsvCell = sanitizeCsvCell;

    // --- 2. ESCUDO REACTIVO DEL DOM Y CONVERSOR CSP-SAFE (SIN EVAL NI LISTENERS SUELTOS) ---
    const BLOCKED_TAGS = new Set(['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET', 'BASE', 'META', 'LINK', 'FOREIGNOBJECT', 'ANIMATE', 'SET']);
    const ALLOWED_CMD_NAMES = new Set([
        'showHealthTip',
        'openSavingsSection',
        'openBentoMonthPicker',
        'openAccountDetail',
        'deleteAccount',
        'openMonthlyBudgetConfig',
        'openSubcatMonthsConfig',
        'deleteCategory',
        'deleteSubcategory',
        'removePlannerExtra',
        'processSubscriptionPayment',
        'toggleSubscriptionPause',
        'editSubscription',
        'openPocketHistoryModal',
        'openEditPocket',
        'deletePocket',
        'openPocketAction',
        'openAssetDetail',
        'filterByTxTag',
        'restoreTxFromTrash',
        'permanentlyDeleteTx',
        'removeSplitItem',
        'openEditModal'
    ]);

    const SAFE_ONCLICK_REGEX = /^(?:if\s*\([^)]+\)\s*)?((?:event\.stopPropagation\(\);\s*)?)((?:forceCloseAllModals\(\);\s*)?)(?:window\.)?([a-zA-Z0-9_]+)\s*\(([^;{}()]*)\)\s*;?\s*$/;

    const parsePrimitiveArgs = (rawArgsStr) => {
        const trimmed = String(rawArgsStr || '').trim();
        if (!trimmed) return [];
        const args = [];
        let i = 0;
        while (i < trimmed.length) {
            while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
            if (i >= trimmed.length) break;

            const ch = trimmed[i];
            if (ch === "'" || ch === '"') {
                const quote = ch;
                i++;
                let val = '';
                while (i < trimmed.length && trimmed[i] !== quote) {
                    if (trimmed[i] === '\\' && i + 1 < trimmed.length) {
                        i++;
                        val += trimmed[i];
                    } else {
                        val += trimmed[i];
                    }
                    i++;
                }
                if (trimmed[i] !== quote) return null;
                i++;
                args.push(val);
            } else {
                let token = '';
                while (i < trimmed.length && trimmed[i] !== ',') {
                    token += trimmed[i];
                    i++;
                }
                const cleanTok = token.trim();
                if (cleanTok === 'this') args.push('__LUMEN_SELF__');
                else if (cleanTok === 'true') args.push(true);
                else if (cleanTok === 'false') args.push(false);
                else if (cleanTok === 'null') args.push(null);
                else if (/^-?\d+(?:\.\d+)?$/.test(cleanTok)) args.push(Number(cleanTok));
                else return null;
            }

            while (i < trimmed.length && /\s/.test(trimmed[i])) i++;
            if (i < trimmed.length) {
                if (trimmed[i] !== ',') return null;
                i++;
            }
        }
        return args;
    };

    const upgradeSafeInlineOnclick = (node, rawVal) => {
        const match = SAFE_ONCLICK_REGEX.exec(String(rawVal || '').trim());
        if (!match) return false;
        const stopProp = Boolean(match[1]);
        const closeModals = Boolean(match[2]);
        const fnName = match[3];
        if (!ALLOWED_CMD_NAMES.has(fnName)) return false;
        const parsedArgs = parsePrimitiveArgs(match[4]);
        if (parsedArgs === null) return false;

        node.setAttribute('data-lumen-cmd', fnName);
        node.setAttribute('data-lumen-args', JSON.stringify(parsedArgs));
        if (stopProp) node.setAttribute('data-lumen-stop', '1');
        if (closeModals) node.setAttribute('data-lumen-close', '1');
        return true;
    };

    // Invocado exclusivamente desde el enrutador global unico de app.js
    const dispatchSafeCommand = (cmdEl, event) => {
        if (!cmdEl) return false;
        const fnName = cmdEl.getAttribute('data-lumen-cmd');
        if (!fnName || !ALLOWED_CMD_NAMES.has(fnName)) return false;

        if (cmdEl.getAttribute('data-lumen-stop') === '1' && event?.stopPropagation) {
            event.stopPropagation();
        }
        if (cmdEl.getAttribute('data-lumen-close') === '1' && typeof globalThis.forceCloseAllModals === 'function') {
            globalThis.forceCloseAllModals();
        }

        let args = [];
        try {
            const raw = JSON.parse(cmdEl.getAttribute('data-lumen-args') || '[]');
            if (Array.isArray(raw)) {
                args = raw.map((item) => (item === '__LUMEN_SELF__' ? cmdEl : item));
            }
        } catch {
            return false;
        }

        const targetFn = globalThis[fnName];
        if (typeof targetFn === 'function') {
            targetFn.apply(null, args);
            return true;
        }
        return false;
    };

    const ALLOWED_LOCAL_SCRIPTS = new Set([
        'security.js',
        'core.js',
        'info.js',
        'app.js',
        'modules.js',
        'assistant.js'
    ]);

    const isTrustedLocalScript = (node) => {
        const rawSrc = node.getAttribute && node.getAttribute('src');
        if (!rawSrc) return false;
        try {
            const parsed = new URL(rawSrc, globalThis.location?.href || 'https://localhost/');
            if (
                parsed.origin !== globalThis.location?.origin &&
                parsed.origin !== 'https://localhost' &&
                parsed.origin !== 'capacitor://localhost'
            ) {
                return false;
            }
            const fileName = (parsed.pathname.split('/').pop() || '').toLowerCase();
            return ALLOWED_LOCAL_SCRIPTS.has(fileName);
        } catch {
            return false;
        }
    };

    const scrubNode = (node) => {
        if (!node || node.nodeType !== 1) return;
        const tag = node.tagName ? node.tagName.toUpperCase() : '';
        if (BLOCKED_TAGS.has(tag)) {
            if ((tag === 'META' || tag === 'LINK') && node.parentElement === document.head) return;
            if (tag === 'SCRIPT' && isTrustedLocalScript(node)) return;
            node.remove();
            return;
        }
        if (node.attributes) {
            const attrs = Array.from(node.attributes);
            for (const attr of attrs) {
                const name = attr.name.toLowerCase();
                const val = String(attr.value || '').trim();
                if (name.startsWith('on')) {
                    if (name === 'onclick') {
                        upgradeSafeInlineOnclick(node, val);
                    }
                    node.removeAttribute(attr.name);
                } else if (['href', 'src', 'xlink:href', 'action', 'formaction'].includes(name)) {
                    const compactVal = val.replace(/[\s\x00-\x1f]+/g, '');
                    const isUnsafeProtocol = /^(?:javascript:|vbscript:|data:(?:text\/html|image\/svg\+xml|application\/xhtml\+xml))/i.test(compactVal)
                        || ((name === 'action' || name === 'formaction') && /^data:/i.test(compactVal));
                    if (isUnsafeProtocol) {
                        node.removeAttribute(attr.name);
                    }
                }
            }
        }
        const children = node.children ? Array.from(node.children) : [];
        for (let i = 0; i < children.length; i++) {
            scrubNode(children[i]);
        }
    };

    const installDomShield = () => {
        if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
        const root = document.documentElement;
        if (!root) return;

        if (document.body) scrubNode(document.body);

        const obs = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.type === 'childList') {
                    m.addedNodes.forEach((n) => {
                        if (n && n.parentElement !== document.head) scrubNode(n);
                    });
                } else if (m.type === 'attributes' && m.target && m.target.parentElement !== document.head) {
                    scrubNode(m.target);
                }
            }
        });
        obs.observe(root, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['onclick', 'onerror', 'onload', 'ontoggle', 'onfocus', 'onmouseover', 'href', 'xlink:href', 'src', 'action', 'formaction']
        });
    };

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body) scrubNode(document.body);
            }, { once: true });
        }
        installDomShield();
    }

    // --- 3. CORTAFUEGOS DE RED SALIENTE (SOLO LECTURA A APIS PUBLICAS TRM) ---
    const ALLOWED_EXTERNAL_HOSTS = new Set([
        'www.datos.gov.co',
        'open.er-api.com',
        'api.frankfurter.app'
    ]);

    const isLocalAppOrigin = (originStr) => {
        return (
            originStr === globalThis.location?.origin ||
            originStr === 'https://localhost' ||
            originStr === 'capacitor://localhost'
        );
    };

    const resolveFetchRawUrl = (input) => {
        if (typeof input === 'string') return input;
        if (typeof URL !== 'undefined' && input instanceof URL) return input.href;
        if (input && typeof input === 'object' && typeof input.url === 'string') return input.url;
        return String(input ?? '');
    };

    const origFetch = globalThis.fetch ? globalThis.fetch.bind(globalThis) : null;
    if (origFetch) {
        globalThis.fetch = async function (input, init = {}) {
            const rawUrl = resolveFetchRawUrl(input);
            if (!rawUrl) {
                throw new Error('Solicitud de red vacia bloqueada.');
            }
            if (rawUrl.startsWith('blob:') || rawUrl.startsWith('data:')) {
                return origFetch(input, init);
            }
            const parsed = new URL(rawUrl, globalThis.location?.origin || 'https://localhost');
            if (isLocalAppOrigin(parsed.origin)) {
                return origFetch(input, init);
            }
            const method = String(init?.method || (typeof input === 'object' && input?.method) || 'GET').toUpperCase();
            if (
                parsed.protocol !== 'https:' ||
                method !== 'GET' ||
                !ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname) ||
                parsed.search.length > 120 ||
                init?.body ||
                (typeof Request !== 'undefined' && input instanceof Request && input.body)
            ) {
                throw new Error(`Conexion externa bloqueada por politica Local-First: ${parsed.hostname}`);
            }
            return origFetch(parsed.toString(), {
                method: 'GET',
                credentials: 'omit',
                referrerPolicy: 'no-referrer',
                cache: 'no-store',
                mode: 'cors'
            });
        };
    }

    if (typeof XMLHttpRequest !== 'undefined') {
        const origXhrOpen = XMLHttpRequest.prototype.open;
        const origXhrSend = XMLHttpRequest.prototype.send;
        const origXhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;

        XMLHttpRequest.prototype.open = function (method, url, ...rest) {
            this._lumenExternalReadOnly = false;
            const rawUrl = typeof URL !== 'undefined' && url instanceof URL ? url.href : String(url ?? '');
            if (!rawUrl.startsWith('blob:') && !rawUrl.startsWith('data:')) {
                const parsed = new URL(rawUrl, globalThis.location?.origin || 'https://localhost');
                const upperMethod = String(method || 'GET').toUpperCase();
                if (!isLocalAppOrigin(parsed.origin)) {
                    if (
                        parsed.protocol !== 'https:' ||
                        upperMethod !== 'GET' ||
                        !ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname) ||
                        parsed.search.length > 120
                    ) {
                        throw new Error(`XHR externo bloqueado por politica Local-First: ${parsed.hostname}`);
                    }
                    this._lumenExternalReadOnly = true;
                    this.withCredentials = false;
                }
            }
            return origXhrOpen.call(this, method, rawUrl, ...rest);
        };

        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
            if (this._lumenExternalReadOnly) {
                const h = String(header || '').toLowerCase();
                if (h !== 'accept') {
                    throw new Error('Cabecera personalizada bloqueada en consulta externa de solo lectura.');
                }
            }
            return origXhrSetHeader.call(this, header, value);
        };

        XMLHttpRequest.prototype.send = function (body) {
            if (this._lumenExternalReadOnly) {
                this.withCredentials = false;
                if (body !== undefined && body !== null && body !== '') {
                    throw new Error('Envio de cuerpo bloqueado en consulta externa de solo lectura.');
                }
                return origXhrSend.call(this, null);
            }
            return origXhrSend.call(this, body);
        };
    }

    if (typeof WebSocket !== 'undefined') {
        const OrigWebSocket = WebSocket;
        globalThis.WebSocket = function (url, protocols) {
            const parsed = new URL(String(url || ''), globalThis.location?.href || 'https://localhost');
            const currentHost = globalThis.location?.hostname || '';
            const isLocalDevSocket = (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') && parsed.hostname === currentHost;
            if (!isLocalDevSocket) {
                throw new Error(`WebSocket externo bloqueado por politica Local-First: ${parsed.hostname}`);
            }
            return protocols !== undefined ? new OrigWebSocket(url, protocols) : new OrigWebSocket(url);
        };
        globalThis.WebSocket.prototype = OrigWebSocket.prototype;
    }

    if (typeof EventSource !== 'undefined') {
        globalThis.EventSource = function () {
            throw new Error('EventSource bloqueado por politica Local-First.');
        };
    }

    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon = () => false;
    }

    // --- 4. VALIDADOR Y SANITIZADOR DE RESPALDOS JSON (ANTI-PROTOTYPE POLLUTION) ---
    const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

    const deepCleanObject = (input, depth = 0) => {
        if (depth > 10) return null;
        if (input === null || input === undefined) return input;
        if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
        if (typeof input === 'boolean') return input;
        if (typeof input === 'string') return input.slice(0, 4000);
        if (Array.isArray(input)) {
            return input.slice(0, 50000).map((item) => deepCleanObject(item, depth + 1));
        }
        if (typeof input === 'object') {
            const clean = Object.create(null);
            for (const key of Object.keys(input)) {
                if (FORBIDDEN_KEYS.has(key)) continue;
                clean[key.slice(0, 120)] = deepCleanObject(input[key], depth + 1);
            }
            return Object.assign({}, clean);
        }
        return null;
    };

    const sanitizeFinancePayload = (rawJsonStringOrObj) => {
        let parsed = rawJsonStringOrObj;
        if (typeof rawJsonStringOrObj === 'string') {
            if (rawJsonStringOrObj.length > 15 * 1024 * 1024) {
                throw new Error('El archivo excede el limite maximo seguro (15 MB).');
            }
            parsed = JSON.parse(rawJsonStringOrObj);
        }
        const cleaned = deepCleanObject(parsed);
        if (!cleaned || typeof cleaned !== 'object' || Array.isArray(cleaned)) {
            throw new Error('Estructura de datos financieros invalida.');
        }
        ['transactions', 'customAccounts', 'pockets', 'subscriptions', 'fixedAssets', 'templates', 'dismissedAlerts', 'plannerExtras'].forEach((arrKey) => {
            if (cleaned[arrKey] !== undefined && !Array.isArray(cleaned[arrKey])) {
                cleaned[arrKey] = [];
            }
        });
        if (cleaned.categoryBudgets !== undefined && (!cleaned.categoryBudgets || typeof cleaned.categoryBudgets !== 'object' || Array.isArray(cleaned.categoryBudgets))) {
            cleaned.categoryBudgets = {};
        }
        return cleaned;
    };

    // --- 5. CONTROL DE INTENTOS FALLIDOS (BLOQUEO TEMPORAL PROGRESIVO + ANTI-PARALELISMO) ---
    const rawStorage = globalThis.localStorage;
    const rawGet = Storage.prototype.getItem.bind(rawStorage);
    const rawSet = Storage.prototype.setItem.bind(rawStorage);
    const rawRemove = Storage.prototype.removeItem.bind(rawStorage);

    const LOCKOUT_KEY = 'lumen_auth_guard_v1';
    const MAX_FREE_ATTEMPTS = 4;
    const monoNow = () => (typeof performance !== 'undefined' && typeof performance.now === 'function')
        ? performance.now()
        : Date.now();

    const memGuard = { fails: 0, monoUntil: 0 };
    let authAttemptChain = Promise.resolve();

    const runSerializedAuth = (taskFn) => {
        const next = authAttemptChain.then(taskFn, taskFn);
        authAttemptChain = next.then(() => {}, () => {});
        return next;
    };

    const getGuardState = () => {
        try {
            const disk = JSON.parse(rawGet(LOCKOUT_KEY) || '{"fails":0,"until":0}');
            return {
                fails: Math.max(Number(disk?.fails) || 0, memGuard.fails),
                until: Number(disk?.until) || 0
            };
        } catch {
            return { fails: memGuard.fails, until: 0 };
        }
    };

    const MAX_LOCKOUT_CAP_MS = Math.pow(2, 6) * 15000 + 5000;

    const checkAuthLockout = () => {
        const st = getGuardState();
        const now = Date.now();
        const diskRemMs = Math.min(MAX_LOCKOUT_CAP_MS, Math.max(0, st.until - now));
        const memRemMs = Math.min(MAX_LOCKOUT_CAP_MS, Math.max(0, memGuard.monoUntil - monoNow()));
        const effectiveRemMs = Math.max(diskRemMs, memRemMs);
        if (effectiveRemMs > 0) {
            return { locked: true, remainingSec: Math.ceil(effectiveRemMs / 1000), fails: st.fails };
        }
        return { locked: false, remainingSec: 0, fails: st.fails };
    };

    const recordAuthFailure = () => {
        const st = getGuardState();
        st.fails = (st.fails || 0) + 1;
        memGuard.fails = st.fails;
        if (st.fails > MAX_FREE_ATTEMPTS) {
            const penaltyExponent = Math.min(6, st.fails - MAX_FREE_ATTEMPTS);
            const waitMs = Math.pow(2, penaltyExponent) * 15000; // 30s, 60s, 120s, 240s...
            st.until = Date.now() + waitMs;
            memGuard.monoUntil = monoNow() + waitMs;
        }
        try { rawSet(LOCKOUT_KEY, JSON.stringify(st)); } catch {}
        return checkAuthLockout();
    };

    const resetAuthLockout = () => {
        memGuard.fails = 0;
        memGuard.monoUntil = 0;
        try { rawRemove(LOCKOUT_KEY); } catch {}
    };

    // --- 6. MOTOR CRIPTOGRAFICO (PBKDF2-SHA256 210.000 ITERACIONES + AES-256-GCM) ---
    const PBKDF2_ITERATIONS = 210000;
    const VAULT_STORAGE_KEY = 'lumen_vault_v1';
    const BIO_IDB_NAME = 'LumenBioKeyStore';
    const BIO_STORE_NAME = 'hw_keys';
    const ARCHIVE_IDB_NAME = 'MisFinanzasDB';
    const ARCHIVE_STORE_NAME = 'archived_transactions';

    const SENSITIVE_KEYS = new Set([
        'myFinances',
        'myFinancesSalary',
        'myFinancesTaxParams',
        'lumen_cdts_v1',
        'lumenPayrollQuincenaAlert'
    ]);

    const toB64 = (buf) => {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    };

    const fromB64 = (b64) => {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    };

    const randomBytes = (len) => {
        if (!globalThis.crypto?.getRandomValues) {
            throw new Error('Entorno inseguro: generador criptografico no disponible.');
        }
        const out = new Uint8Array(len);
        globalThis.crypto.getRandomValues(out);
        return out;
    };

    const deriveKekFromSecret = async (secret, saltBytes, iterations = PBKDF2_ITERATIONS) => {
        if (!globalThis.crypto?.subtle) {
            throw new Error('Web Crypto API requiere contexto seguro (HTTPS o localhost).');
        }
        const enc = new TextEncoder().encode(String(secret));
        const baseKey = await globalThis.crypto.subtle.importKey('raw', enc, 'PBKDF2', false, ['deriveKey']);
        return globalThis.crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltBytes, iterations, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    };

    const aesGcmEncryptBytes = async (aesKey, plainBytes) => {
        const iv = randomBytes(12);
        const ct = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainBytes);
        return { iv: toB64(iv), ct: toB64(ct) };
    };

    const aesGcmDecryptBytes = async (aesKey, payload) => {
        const iv = fromB64(payload.iv);
        const ct = fromB64(payload.ct);
        const pt = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
        return new Uint8Array(pt);
    };

    // Almacen de CryptoKey no-exportable en IndexedDB para desbloqueo biometrico PWA
    const openBioKeyDB = () => new Promise((resolve, reject) => {
        const req = indexedDB.open(BIO_IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(BIO_STORE_NAME)) db.createObjectStore(BIO_STORE_NAME);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const saveNonExtractableBioKey = async (cryptoKey) => {
        const db = await openBioKeyDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(BIO_STORE_NAME, 'readwrite');
            tx.objectStore(BIO_STORE_NAME).put(cryptoKey, 'bio_kek');
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
        });
    };

    const loadNonExtractableBioKey = async () => {
        const db = await openBioKeyDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(BIO_STORE_NAME, 'readonly');
            const req = tx.objectStore(BIO_STORE_NAME).get('bio_kek');
            req.onsuccess = () => { db.close(); resolve(req.result || null); };
            req.onerror = () => { db.close(); reject(req.error); };
        });
    };

    const clearBioKeyStore = async () => {
        try {
            if (globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor?.Plugins?.NativeBiometric?.deleteCredentials) {
                await globalThis.Capacitor.Plugins.NativeBiometric.deleteCredentials({
                    server: 'lumen.funcionif.local'
                }).catch(() => {});
            }
        } catch {}
        return new Promise((resolve) => {
            try {
                const req = indexedDB.deleteDatabase(BIO_IDB_NAME);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
            } catch {
                resolve();
            }
        });
    };

    // Hash heredado v2.2.2 SOLO para migrar de forma transparente a usuarios actuales
    const legacyHashV1 = (str) => {
        let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
        for (let i = 0, ch; i < str.length; i++) {
            ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
    };

    // --- 7. BOVEDA TRANSPARENTE EN MEMORIA (LUMEN VAULT) ---
    let activeDekCryptoKey = null;
    let activeRawDekBytes = null;
    const memoryStore = new Map();
    let persistQueue = Promise.resolve();
    let vaultEpoch = 0;
    let flushScheduled = false;

    const hasWebCryptoSubtle = () => Boolean(globalThis.crypto && globalThis.crypto.subtle && typeof globalThis.crypto.subtle.importKey === 'function');

    const getStoredAuth = () => {
        try { return JSON.parse(rawGet('myFinancesAuth') || 'null'); } catch { return null; }
    };

    // Autorrepara perfiles que hayan quedado con pinEnabled=true sin boveda ni hash por fallo previo en HTTP
    const repairBrokenAuthIfNeeded = () => {
        const a = getStoredAuth();
        if (a && a.pinEnabled && !rawGet(VAULT_STORAGE_KEY) && !a.pinHash) {
            a.pinEnabled = false;
            a.vaultVersion = 0;
            a.pinLength = null;
            a.secretMode = null;
            try { rawSet('myFinancesAuth', JSON.stringify(a)); } catch {}
            resetAuthLockout();
        }
    };
    repairBrokenAuthIfNeeded();

    const isPinConfigured = () => {
        const a = getStoredAuth();
        return !!(a && a.pinEnabled && (rawGet(VAULT_STORAGE_KEY) || a.pinHash));
    };

    const isEncryptedVaultActive = () => isPinConfigured() && Boolean(rawGet(VAULT_STORAGE_KEY));

    let vaultUnlocked = !isPinConfigured();

    // Testigo interno de ceremonia WebAuthn para impedir bypass de consola en idb_hw_key
    let webAuthnHookInstalled = false;
    let verifiedBioTokenUntil = 0;

    const normalizeB64Url = (s) => String(s || '').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const installWebAuthnWitness = () => {
        try {
            const proto = (typeof CredentialsContainer !== 'undefined' && CredentialsContainer.prototype?.get)
                ? CredentialsContainer.prototype
                : globalThis.navigator?.credentials;
            if (!proto || typeof proto.get !== 'function') return;
            const origGet = proto.get;
            proto.get = async function (options) {
                const cred = await origGet.call(this, options);
                if (cred && options?.publicKey) {
                    const expectedId = getStoredAuth()?.biometricCredId;
                    if (expectedId && cred.rawId) {
                        const gotId = normalizeB64Url(toB64(cred.rawId));
                        if (timingSafeEqual(gotId, normalizeB64Url(expectedId))) {
                            verifiedBioTokenUntil = monoNow() + 10000;
                        }
                    }
                }
                return cred;
            };
            webAuthnHookInstalled = true;
        } catch {
            webAuthnHookInstalled = false;
        }
    };
    installWebAuthnWitness();

    const notifyStorageQuotaError = () => {
        console.warn('Lumen: Limite de almacenamiento local alcanzado.');
        if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
            globalThis.dispatchEvent(new CustomEvent('lumen:storage-quota-error'));
        }
        if (typeof globalThis.showBackupToast === 'function') {
            globalThis.showBackupToast('Memoria local llena. Exporta un respaldo y ejecuta Cierre de Ano.', true);
        }
    };

    // Interceptor transparente sobre localStorage para las 5 llaves sensibles
    Storage.prototype.getItem = function (key) {
        if (this === rawStorage && SENSITIVE_KEYS.has(key) && isPinConfigured()) {
            if (!vaultUnlocked) return null;
            if (isEncryptedVaultActive()) {
                return memoryStore.has(key) ? memoryStore.get(key) : null;
            }
        }
        return rawGet(key);
    };

    Storage.prototype.setItem = function (key, value) {
        if (this === rawStorage && SENSITIVE_KEYS.has(key) && isPinConfigured()) {
            if (!vaultUnlocked) return;
            if (isEncryptedVaultActive()) {
                memoryStore.set(key, String(value));
                scheduleEncryptedPersist();
                return;
            }
        }
        try {
            rawSet(key, value);
        } catch (err) {
            if (err?.name === 'QuotaExceededError' || err?.code === 22) {
                notifyStorageQuotaError();
            }
            throw err;
        }
    };

    Storage.prototype.removeItem = function (key) {
        if (this === rawStorage && SENSITIVE_KEYS.has(key) && isPinConfigured()) {
            if (!vaultUnlocked) return;
            if (isEncryptedVaultActive()) {
                memoryStore.delete(key);
                scheduleEncryptedPersist();
                return;
            }
        }
        rawRemove(key);
    };

    let lastSelfVaultSerialized = null;

    const writeVaultToDisk = (serialized) => {
        lastSelfVaultSerialized = serialized;
        rawSet(VAULT_STORAGE_KEY, serialized);
    };

    const commitSnapshotToQueue = () => {
        flushScheduled = false;
        if (!vaultUnlocked || !activeDekCryptoKey) return;
        const capturedEpoch = vaultEpoch;
        const capturedDek = activeDekCryptoKey;
        const snapshotObj = {};
        memoryStore.forEach((v, k) => { snapshotObj[k] = v; });

        persistQueue = persistQueue.then(async () => {
            if (capturedEpoch !== vaultEpoch || !capturedDek) return;
            const rawVaultStr = rawGet(VAULT_STORAGE_KEY);
            if (!rawVaultStr) return;
            const currentVault = JSON.parse(rawVaultStr);
            const encoded = new TextEncoder().encode(JSON.stringify(snapshotObj));
            const encryptedData = await aesGcmEncryptBytes(capturedDek, encoded);
            if (capturedEpoch !== vaultEpoch) return;
            currentVault.version = 2;
            currentVault.data = encryptedData;
            currentVault.updatedAt = Date.now();
            try {
                writeVaultToDisk(JSON.stringify(currentVault));
            } catch (err) {
                if (err?.name === 'QuotaExceededError' || err?.code === 22) {
                    notifyStorageQuotaError();
                }
            }
        }).catch(() => {});
    };

    const flushVault = async () => {
        if (flushScheduled) {
            commitSnapshotToQueue();
        }
        await persistQueue.catch(() => {});
    };

    const scheduleEncryptedPersist = () => {
        if (!vaultUnlocked || !activeDekCryptoKey || flushScheduled) return;
        flushScheduled = true;
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(commitSnapshotToQueue);
        } else {
            Promise.resolve().then(commitSnapshotToQueue);
        }
    };

    const importDekBytes = async (dekBytes) => {
        if (!hasWebCryptoSubtle()) {
            throw new Error('Web Crypto API requiere HTTPS, localhost o app instalada.');
        }
        activeRawDekBytes = new Uint8Array(dekBytes);
        activeDekCryptoKey = await globalThis.crypto.subtle.importKey(
            'raw',
            activeRawDekBytes,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    };

    // Cifrado individual de transacciones en MisFinanzasDB (Cierre de ano)
    const encryptRecordForArchive = async (txObj) => {
        if (!txObj || txObj._encrypted || !activeDekCryptoKey) return txObj;
        const plain = new TextEncoder().encode(JSON.stringify(txObj));
        const enc = await aesGcmEncryptBytes(activeDekCryptoKey, plain);
        return { id: txObj.id, _encrypted: true, iv: enc.iv, ct: enc.ct };
    };

    const decryptRecordFromArchive = async (record) => {
        if (!record || !record._encrypted) return record;
        if (!activeDekCryptoKey) throw new Error('Boveda bloqueada.');
        const pt = await aesGcmDecryptBytes(activeDekCryptoKey, record);
        return JSON.parse(new TextDecoder().decode(pt));
    };

    const openArchiveDBInternal = () => new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { resolve(null); return; }
        const req = indexedDB.open(ARCHIVE_IDB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(ARCHIVE_STORE_NAME)) {
                db.createObjectStore(ARCHIVE_STORE_NAME, { keyPath: 'id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });

    const readAllArchiveRecordsInternal = async () => {
        const db = await openArchiveDBInternal().catch(() => null);
        if (!db) return [];
        return new Promise((resolve) => {
            const tx = db.transaction(ARCHIVE_STORE_NAME, 'readonly');
            const req = tx.objectStore(ARCHIVE_STORE_NAME).getAll();
            req.onsuccess = () => { db.close(); resolve(req.result || []); };
            req.onerror = () => { db.close(); resolve([]); };
        });
    };

    const writeAllArchiveRecordsInternal = async (records) => {
        if (!records || records.length === 0) return;
        const db = await openArchiveDBInternal().catch(() => null);
        if (!db) return;
        return new Promise((resolve) => {
            const tx = db.transaction(ARCHIVE_STORE_NAME, 'readwrite');
            const store = tx.objectStore(ARCHIVE_STORE_NAME);
            records.forEach((r) => store.put(r));
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); resolve(false); };
        });
    };

    // Asegura que registros historicos previos en MisFinanzasDB queden cifrados al activar boveda
    const migrateArchiveToEncrypted = async () => {
        if (!activeDekCryptoKey) return;
        const all = await readAllArchiveRecordsInternal();
        const plainOnes = all.filter((r) => r && !r._encrypted);
        if (plainOnes.length === 0) return;
        const encryptedOnes = await Promise.all(
            plainOnes.map((r) => encryptRecordForArchive(r).catch(() => null))
        );
        await writeAllArchiveRecordsInternal(encryptedOnes.filter(Boolean));
    };

    // Asegura que MisFinanzasDB vuelva a texto plano limpio registro por registro antes de destruir la llave
    const migrateArchiveToPlaintext = async () => {
        if (!activeDekCryptoKey) return;
        const all = await readAllArchiveRecordsInternal();
        const encOnes = all.filter((r) => r && r._encrypted);
        if (encOnes.length === 0) return;
        const decryptedOnes = await Promise.all(
            encOnes.map((r) => decryptRecordFromArchive(r).catch(() => null))
        );
        await writeAllArchiveRecordsInternal(decryptedOnes.filter(Boolean));
    };

    const enableVaultEncryption = async (pin, normalizedRecoveryCode) => {
        if (isPinConfigured() && !vaultUnlocked) {
            throw new Error('Debes desbloquear la boveda actual antes de modificar la seguridad.');
        }
        if (flushScheduled) {
            commitSnapshotToQueue();
        }
        flushScheduled = false;
        vaultEpoch++;
        await persistQueue.catch(() => {});

        const pinStrFallback = String(pin);
        if (!hasWebCryptoSubtle()) {
            vaultUnlocked = true;
            return {
                mode: 'http_fallback',
                pinHash: legacyHashV1(pinStrFallback),
                recoveryLegacyHash: legacyHashV1(String(normalizedRecoveryCode || ''))
            };
        }

        const snapshotObj = {};
        SENSITIVE_KEYS.forEach((k) => {
            const val = (vaultUnlocked && memoryStore.has(k)) ? memoryStore.get(k) : rawGet(k);
            if (val !== null && val !== undefined) snapshotObj[k] = val;
        });

        const dekBytes = activeRawDekBytes ? new Uint8Array(activeRawDekBytes) : randomBytes(32);
        await importDekBytes(dekBytes);

        const pinStr = String(pin);
        const secretMode = /^\d+$/.test(pinStr) ? 'pin' : 'passphrase';
        const pinSalt = randomBytes(16);
        const recSalt = randomBytes(16);
        const pinKek = await deriveKekFromSecret(pinStr, pinSalt, PBKDF2_ITERATIONS);
        const recKek = await deriveKekFromSecret(normalizedRecoveryCode, recSalt, PBKDF2_ITERATIONS);

        const wrappedPin = await aesGcmEncryptBytes(pinKek, dekBytes);
        const wrappedRec = await aesGcmEncryptBytes(recKek, dekBytes);
        const encryptedData = await aesGcmEncryptBytes(
            activeDekCryptoKey,
            new TextEncoder().encode(JSON.stringify(snapshotObj))
        );

        let existingVault = {};
        try { existingVault = JSON.parse(rawGet(VAULT_STORAGE_KEY) || '{}') || {}; } catch { existingVault = {}; }

        const vaultRecord = {
            version: 2,
            pinWrap: { salt: toB64(pinSalt), iterations: PBKDF2_ITERATIONS, ...wrappedPin },
            recWrap: { salt: toB64(recSalt), iterations: PBKDF2_ITERATIONS, ...wrappedRec },
            bioWrap: existingVault.bioWrap || null,
            pinLength: pinStr.length,
            secretMode,
            data: encryptedData,
            updatedAt: Date.now()
        };

        const serializedVault = JSON.stringify(vaultRecord);
        try {
            writeVaultToDisk(serializedVault);
            SENSITIVE_KEYS.forEach((k) => rawRemove(k));
        } catch (err) {
            if (err?.name === 'QuotaExceededError' || err?.code === 22) {
                SENSITIVE_KEYS.forEach((k) => rawRemove(k));
                try {
                    writeVaultToDisk(serializedVault);
                } catch (retryErr) {
                    Object.entries(snapshotObj).forEach(([k, v]) => { try { rawSet(k, v); } catch {} });
                    notifyStorageQuotaError();
                    throw retryErr;
                }
            } else {
                throw err;
            }
        }

        memoryStore.clear();
        Object.entries(snapshotObj).forEach(([k, v]) => memoryStore.set(k, v));
        vaultUnlocked = true;

        await migrateArchiveToEncrypted().catch(() => {});
    };

    const bindBiometricWrapper = async () => {
        if (!activeRawDekBytes) return false;
        const vault = JSON.parse(rawGet(VAULT_STORAGE_KEY) || 'null');
        if (!vault) return false;

        if (globalThis.Capacitor?.isNativePlatform?.() && globalThis.Capacitor?.Plugins?.NativeBiometric?.setCredentials) {
            const bioSecret = toB64(randomBytes(32));
            const bioSalt = randomBytes(16);
            await globalThis.Capacitor.Plugins.NativeBiometric.setCredentials({
                username: 'lumen_vault_user',
                password: bioSecret,
                server: 'lumen.funcionif.local'
            });
            const bioKek = await deriveKekFromSecret(bioSecret, bioSalt, PBKDF2_ITERATIONS);
            const wrapped = await aesGcmEncryptBytes(bioKek, activeRawDekBytes);
            vault.bioWrap = { mode: 'capacitor_keystore', salt: toB64(bioSalt), iterations: PBKDF2_ITERATIONS, ...wrapped };
            writeVaultToDisk(JSON.stringify(vault));
            return true;
        }

        const hwKey = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
        await saveNonExtractableBioKey(hwKey);
        const wrapped = await aesGcmEncryptBytes(hwKey, activeRawDekBytes);
        vault.bioWrap = { mode: 'idb_hw_key', ...wrapped };
        writeVaultToDisk(JSON.stringify(vault));
        return true;
    };

    const unbindBiometricWrapper = async () => {
        if (isPinConfigured() && !vaultUnlocked) {
            throw new Error('Debes desbloquear la boveda antes de desvincular la biometria.');
        }
        const vault = JSON.parse(rawGet(VAULT_STORAGE_KEY) || 'null');
        if (vault && vault.bioWrap) {
            vault.bioWrap = null;
            writeVaultToDisk(JSON.stringify(vault));
        }
        verifiedBioTokenUntil = 0;
        await clearBioKeyStore();
    };

    const hydrateRuntimeState = () => {
        try {
            const loadedFin = rawStorage.getItem('myFinances') || rawGet('myFinances');
            if (loadedFin) {
                const safeData = sanitizeFinancePayload(loadedFin);
                if (typeof financeData !== 'undefined' && financeData) {
                    Object.keys(financeData).forEach((k) => delete financeData[k]);
                    Object.assign(financeData, safeData);
                }
            }
            if (typeof renderAccountSelects === 'function') renderAccountSelects();
            if (typeof renderCategoryOptions === 'function') renderCategoryOptions('expense');
            if (typeof syncUserUI === 'function') syncUserUI();
            if (typeof updateDashboard === 'function') updateDashboard();
            if (typeof window.renderPayrollQuincenaBanner === 'function') window.renderPayrollQuincenaBanner();
        } catch (err) {
            console.error('Error hidratando estado tras desbloqueo:', err);
        }
    };

    const unlockVaultWithDek = async (dekBytes, vaultObj, shouldHydrate = true) => {
        await importDekBytes(dekBytes);
        memoryStore.clear();
        if (vaultObj && vaultObj.data) {
            const plainBytes = await aesGcmDecryptBytes(activeDekCryptoKey, vaultObj.data);
            const parsed = JSON.parse(new TextDecoder().decode(plainBytes));
            Object.entries(parsed).forEach(([k, v]) => {
                if (SENSITIVE_KEYS.has(k) && typeof v === 'string') {
                    memoryStore.set(k, v);
                }
            });
        }
        vaultUnlocked = true;
        resetAuthLockout();
        if (shouldHydrate) hydrateRuntimeState();
    };

    const syncDisabledAuthRecord = () => {
        const stored = getStoredAuth();
        if (stored) {
            stored.pinEnabled = false;
            delete stored.pinHash;
            delete stored.recoveryHash;
            stored.vaultVersion = 0;
            stored.pinLength = null;
            stored.secretMode = null;
            stored.biometricEnabled = false;
            stored.biometricCredId = null;
            try { rawSet('myFinancesAuth', JSON.stringify(stored)); } catch {}
        }
        if (typeof authData !== 'undefined' && authData) {
            authData.pinEnabled = false;
            delete authData.pinHash;
            delete authData.recoveryHash;
            authData.vaultVersion = 0;
            authData.pinLength = null;
            authData.secretMode = null;
            authData.biometricEnabled = false;
            authData.biometricCredId = null;
        }
    };

    const unlockWithPin = (pin) => runSerializedAuth(async () => {
        const lock = checkAuthLockout();
        if (lock.locked) return { ok: false, locked: true, remainingSec: lock.remainingSec };

        const storedAuth = getStoredAuth();
        if (!storedAuth || !storedAuth.pinEnabled) return { ok: true };

        const vaultStr = rawGet(VAULT_STORAGE_KEY);
        if (vaultStr) {
            try {
                const vault = JSON.parse(vaultStr);
                const salt = fromB64(vault.pinWrap.salt);
                const kek = await deriveKekFromSecret(pin, salt, vault.pinWrap.iterations || PBKDF2_ITERATIONS);
                const dekBytes = await aesGcmDecryptBytes(kek, vault.pinWrap);
                await unlockVaultWithDek(dekBytes, vault);
                return { ok: true, migratedRecoveryCode: null };
            } catch {
                const failState = recordAuthFailure();
                return { ok: false, locked: failState.locked, remainingSec: failState.remainingSec };
            }
        }

        // Desbloqueo en HTTP local sin WebCrypto o migracion automatica a AES-256-GCM al abrir en HTTPS
        if (storedAuth.pinHash && timingSafeEqual(legacyHashV1(String(pin)), storedAuth.pinHash)) {
            if (!hasWebCryptoSubtle()) {
                vaultUnlocked = true;
                resetAuthLockout();
                hydrateRuntimeState();
                return { ok: true, migratedRecoveryCode: null };
            }
            const newRecCode = typeof generateRecoveryCode === 'function' ? generateRecoveryCode() : null;
            if (!newRecCode) return { ok: false };
            vaultUnlocked = true;
            try {
                await enableVaultEncryption(pin, newRecCode);
            } catch (migErr) {
                vaultUnlocked = false;
                throw migErr;
            }
            delete storedAuth.pinHash;
            delete storedAuth.recoveryHash;
            delete storedAuth.recoveryLegacyHash;
            storedAuth.vaultVersion = 2;
            storedAuth.pinLength = String(pin).length;
            storedAuth.secretMode = /^\d+$/.test(String(pin)) ? 'pin' : 'passphrase';
            rawSet('myFinancesAuth', JSON.stringify(storedAuth));
            if (typeof authData !== 'undefined' && authData) {
                delete authData.pinHash;
                delete authData.recoveryHash;
                delete authData.recoveryLegacyHash;
                Object.assign(authData, storedAuth);
            }
            resetAuthLockout();
            hydrateRuntimeState();
            return { ok: true, migratedRecoveryCode: newRecCode };
        }

        const failState = recordAuthFailure();
        return { ok: false, locked: failState.locked, remainingSec: failState.remainingSec };
    });

    const disableVaultEncryption = async () => {
        if (!rawGet(VAULT_STORAGE_KEY) && memoryStore.size === 0) {
            await clearBioKeyStore();
            return;
        }
        if (!vaultUnlocked) throw new Error('Debes desbloquear la boveda antes de desactivar el PIN.');

        flushScheduled = false;
        vaultEpoch++;
        await persistQueue.catch(() => {});
        await migrateArchiveToPlaintext().catch(() => {});

        const vaultBackupStr = rawGet(VAULT_STORAGE_KEY);
        const entries = Array.from(memoryStore.entries());
        try {
            entries.forEach(([key, val]) => rawSet(key, val));
            rawRemove(VAULT_STORAGE_KEY);
        } catch (err) {
            if ((err?.name === 'QuotaExceededError' || err?.code === 22) && vaultBackupStr) {
                rawRemove(VAULT_STORAGE_KEY);
                try {
                    entries.forEach(([key, val]) => rawSet(key, val));
                } catch (retryErr) {
                    try { rawSet(VAULT_STORAGE_KEY, vaultBackupStr); } catch {}
                    notifyStorageQuotaError();
                    throw retryErr;
                }
            } else {
                throw err;
            }
        }

        memoryStore.clear();
        if (activeRawDekBytes) activeRawDekBytes.fill(0);
        activeRawDekBytes = null;
        activeDekCryptoKey = null;
        verifiedBioTokenUntil = 0;
        await clearBioKeyStore();
    };

    const unlockWithRecoveryCode = (normalizedCode) => runSerializedAuth(async () => {
        const lock = checkAuthLockout();
        if (lock.locked) return { ok: false, locked: true, remainingSec: lock.remainingSec };

        const vaultStr = rawGet(VAULT_STORAGE_KEY);
        if (vaultStr) {
            try {
                const vault = JSON.parse(vaultStr);
                const salt = fromB64(vault.recWrap.salt);
                const kek = await deriveKekFromSecret(normalizedCode, salt, vault.recWrap.iterations || PBKDF2_ITERATIONS);
                const dekBytes = await aesGcmDecryptBytes(kek, vault.recWrap);
                await unlockVaultWithDek(dekBytes, vault, false);
                await disableVaultEncryption();
                syncDisabledAuthRecord();
                hydrateRuntimeState();
                return { ok: true };
            } catch {
                const failState = recordAuthFailure();
                return { ok: false, locked: failState.locked, remainingSec: failState.remainingSec };
            }
        }

        const storedAuth = getStoredAuth();
        if (storedAuth?.recoveryLegacyHash && timingSafeEqual(legacyHashV1(normalizedCode), storedAuth.recoveryLegacyHash)) {
            vaultUnlocked = true;
            syncDisabledAuthRecord();
            await clearBioKeyStore();
            resetAuthLockout();
            hydrateRuntimeState();
            return { ok: true };
        }
        if (storedAuth?.recoveryHash && hasWebCryptoSubtle() && typeof sha256Hex === 'function') {
            const hashed = await sha256Hex(normalizedCode);
            if (timingSafeEqual(hashed, storedAuth.recoveryHash)) {
                vaultUnlocked = true;
                syncDisabledAuthRecord();
                await clearBioKeyStore();
                resetAuthLockout();
                hydrateRuntimeState();
                return { ok: true };
            }
        }

        const failState = recordAuthFailure();
        return { ok: false, locked: failState.locked, remainingSec: failState.remainingSec };
    });

    const unlockWithBiometricWrap = () => runSerializedAuth(async () => {
        const lock = checkAuthLockout();
        if (lock.locked) return { ok: false, locked: true, remainingSec: lock.remainingSec };

        const vault = JSON.parse(rawGet(VAULT_STORAGE_KEY) || 'null');
        if (!vault || !vault.bioWrap) return { ok: false };
        try {
            if (vault.bioWrap.mode === 'capacitor_keystore') {
                const creds = await globalThis.Capacitor.Plugins.NativeBiometric.getCredentials({
                    server: 'lumen.funcionif.local'
                });
                const kek = await deriveKekFromSecret(
                    creds.password,
                    fromB64(vault.bioWrap.salt),
                    vault.bioWrap.iterations || PBKDF2_ITERATIONS
                );
                const dekBytes = await aesGcmDecryptBytes(kek, vault.bioWrap);
                await unlockVaultWithDek(dekBytes, vault);
                return { ok: true };
            }
            if (vault.bioWrap.mode === 'idb_hw_key') {
                if (webAuthnHookInstalled) {
                    const hasValidCeremony = verifiedBioTokenUntil > monoNow();
                    verifiedBioTokenUntil = 0;
                    if (!hasValidCeremony) return { ok: false };
                }
                const hwKey = await loadNonExtractableBioKey();
                if (!hwKey) return { ok: false };
                const dekBytes = await aesGcmDecryptBytes(hwKey, vault.bioWrap);
                await unlockVaultWithDek(dekBytes, vault);
                return { ok: true };
            }
        } catch {
            return { ok: false };
        }
        return { ok: false };
    });

    const lockVaultSession = () => {
        if (!isPinConfigured()) return;
        if (flushScheduled) {
            commitSnapshotToQueue();
        }
        verifiedBioTokenUntil = 0;
        vaultUnlocked = false;
        memoryStore.clear();
        if (activeRawDekBytes) activeRawDekBytes.fill(0);
        activeRawDekBytes = null;
        activeDekCryptoKey = null;

        if (typeof financeData !== 'undefined' && financeData) {
            financeData.transactions = [];
            financeData.pockets = [];
            financeData.subscriptions = [];
            financeData.fixedAssets = [];
            financeData.templates = [];
            financeData.plannerExtras = [];
            financeData.categoryBudgets = {};
            financeData.tripMode = { active: false };
            financeData.customAccounts = [{ id: 'Efectivo', name: 'Efectivo', category: 'asset', isDefault: false, showWhenZero: false }];
        }

        if (typeof document !== 'undefined') {
            [
                'transaction-list',
                'balance-sheet-list',
                'detail-account-history',
                'accounts-summary-list',
                'pockets-list-container',
                'cdt-list-container',
                'payroll-quincena-inapp-banner',
                'print-report-container'
            ].forEach((id) => {
                const el = document.getElementById(id);
                if (el) el.innerHTML = '';
            });
            ['login-pin', 'recovery-code-input', 'profile-current-pin', 'profile-new-pin', 'profile-confirm-pin'].forEach((id) => {
                const inp = document.getElementById(id);
                if (inp) inp.value = '';
            });
        }
    };

    const lockNow = () => {
        if (!isPinConfigured()) return;
        lockVaultSession();
        if (typeof globalThis.forceCloseAllModals === 'function') {
            globalThis.forceCloseAllModals();
        }
        if (typeof document !== 'undefined') {
            document.body?.classList.add('app-locked');
            const authOverlay = document.getElementById('auth-overlay');
            if (authOverlay) authOverlay.classList.remove('hidden');
            document.getElementById('welcome-view')?.classList.add('hidden');
            document.getElementById('recovery-view')?.classList.add('hidden');
            document.getElementById('login-view')?.classList.remove('hidden');
            document.getElementById('login-error')?.classList.add('hidden');
        }
    };

    // --- 8. EXPORTACION E IMPORTACION DE RESPALDOS CIFRADOS (.lumen) Y RETROCOMPATIBILIDAD (.json) ---
    const safeParseOrFallback = (rawStr, fallbackVal) => {
        if (!rawStr) return fallbackVal;
        try { return JSON.parse(rawStr); } catch { return fallbackVal; }
    };

    const assertSafeLocalStoragePayloadSize = (financesObj) => {
        const serializedLen = JSON.stringify(financesObj || {}).length;
        if (serializedLen > 4.9 * 1024 * 1024) {
            throw new Error('El respaldo principal supera la capacidad segura de almacenamiento local (~4.9 MB).');
        }
    };

    const exportEncryptedBackup = async (password) => {
        if (!password || String(password).length < 6) {
            throw new Error('La contrasena del respaldo debe tener al menos 6 caracteres.');
        }
        if (isPinConfigured() && !vaultUnlocked) {
            throw new Error('Debes desbloquear la aplicacion antes de exportar un respaldo.');
        }

        const salt = randomBytes(16);
        const key = await deriveKekFromSecret(password, salt, PBKDF2_ITERATIONS);

        const rawArchived = await readAllArchiveRecordsInternal();
        const plainArchived = await Promise.all(
            rawArchived.map((r) => decryptRecordFromArchive(r).catch(() => null))
        );

        const bundle = {
            exportDate: new Date().toISOString(),
            app: 'Lumen',
            version: '2.2.3',
            finances: safeParseOrFallback(rawStorage.getItem('myFinances'), {}),
            salary: safeParseOrFallback(rawStorage.getItem('myFinancesSalary'), null),
            taxParams: safeParseOrFallback(rawStorage.getItem('myFinancesTaxParams'), null),
            cdts: safeParseOrFallback(rawStorage.getItem('lumen_cdts_v1'), []),
            archivedTransactions: plainArchived.filter(Boolean),
            theme: rawGet('myFinancesTheme') || 'lumen',
            colorMode: rawGet('myFinancesColorMode') || 'auto',
            widgetOrder: safeParseOrFallback(rawGet('myFinancesWidgetOrder'), null)
        };

        const plainBytes = new TextEncoder().encode(JSON.stringify(bundle));
        const enc = await aesGcmEncryptBytes(key, plainBytes);
        return JSON.stringify({
            lumenEncryptedBackup: true,
            version: '2.2.3',
            kdf: 'PBKDF2-SHA256',
            iterations: PBKDF2_ITERATIONS,
            salt: toB64(salt),
            iv: enc.iv,
            ct: enc.ct
        });
    };

    const importEncryptedBackup = async (rawFileText, password = '') => {
        if (isPinConfigured() && !vaultUnlocked) {
            throw new Error('Debes desbloquear la aplicacion antes de importar un respaldo.');
        }
        if (typeof rawFileText !== 'string' || rawFileText.length > 20 * 1024 * 1024) {
            throw new Error('El archivo excede el tamano maximo permitido (20 MB).');
        }
        const envelope = JSON.parse(rawFileText);
        if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) {
            throw new Error('Formato de archivo invalido.');
        }

        // Retrocompatibilidad segura para respaldos .json antiguos (sanitizados contra Prototype Pollution)
        if (!envelope.lumenEncryptedBackup) {
            const cleanedLegacy = deepCleanObject(envelope);
            const finObj = (cleanedLegacy?.finances && typeof cleanedLegacy.finances === 'object')
                ? cleanedLegacy.finances
                : ((cleanedLegacy?.myFinances && typeof cleanedLegacy.myFinances === 'object') ? cleanedLegacy.myFinances : cleanedLegacy);
            const hasRecognizedKeys = Boolean(
                finObj && (
                    Array.isArray(finObj.transactions) ||
                    Array.isArray(finObj.customAccounts) ||
                    (finObj.categories && typeof finObj.categories === 'object') ||
                    Array.isArray(finObj.pockets) ||
                    Array.isArray(finObj.subscriptions) ||
                    Array.isArray(finObj.fixedAssets)
                )
            );
            if (!hasRecognizedKeys) {
                throw new Error('El archivo JSON seleccionado no corresponde a un respaldo valido de Lumen.');
            }
            const safeFinances = sanitizeFinancePayload(finObj || {});
            if (!Array.isArray(safeFinances.transactions)) safeFinances.transactions = [];
            if (!Array.isArray(safeFinances.customAccounts)) {
                safeFinances.customAccounts = [{ id: 'Efectivo', name: 'Efectivo', category: 'asset', isDefault: false, showWhenZero: false }];
            }
            assertSafeLocalStoragePayloadSize(safeFinances);
            return {
                encrypted: false,
                bundle: {
                    finances: safeFinances,
                    salary: cleanedLegacy?.salary ? deepCleanObject(cleanedLegacy.salary) : null,
                    taxParams: cleanedLegacy?.taxParams ? deepCleanObject(cleanedLegacy.taxParams) : null,
                    cdts: Array.isArray(cleanedLegacy?.cdts || cleanedLegacy?.lumen_cdts_v1)
                        ? deepCleanObject(cleanedLegacy.cdts || cleanedLegacy.lumen_cdts_v1)
                        : null,
                    archivedTransactions: Array.isArray(cleanedLegacy?.archivedTransactions)
                        ? deepCleanObject(cleanedLegacy.archivedTransactions)
                        : null,
                    theme: typeof cleanedLegacy?.theme === 'string' ? cleanedLegacy.theme.slice(0, 40) : null,
                    colorMode: typeof cleanedLegacy?.colorMode === 'string' ? cleanedLegacy.colorMode.slice(0, 20) : null,
                    widgetOrder: Array.isArray(cleanedLegacy?.widgetOrder) ? deepCleanObject(cleanedLegacy.widgetOrder) : null
                }
            };
        }

        if (!password) {
            const needPassErr = new Error('PASSWORD_REQUIRED');
            needPassErr.code = 'PASSWORD_REQUIRED';
            throw needPassErr;
        }

        let decoded;
        try {
            const salt = fromB64(envelope.salt);
            const iters = Math.min(600000, Math.max(100000, Number(envelope.iterations) || PBKDF2_ITERATIONS));
            const key = await deriveKekFromSecret(password, salt, iters);
            const plainBytes = await aesGcmDecryptBytes(key, envelope);
            decoded = JSON.parse(new TextDecoder().decode(plainBytes));
        } catch {
            throw new Error('Contrasena incorrecta o respaldo cifrado corrupto.');
        }

        const cleaned = deepCleanObject(decoded);
        const safeFinances = sanitizeFinancePayload(cleaned?.finances || cleaned?.myFinances || {});
        assertSafeLocalStoragePayloadSize(safeFinances);
        return {
            encrypted: true,
            bundle: {
                finances: safeFinances,
                salary: cleaned?.salary !== undefined ? cleaned.salary : (cleaned?.myFinancesSalary || null),
                taxParams: cleaned?.taxParams !== undefined ? cleaned.taxParams : (cleaned?.myFinancesTaxParams || null),
                cdts: Array.isArray(cleaned?.cdts || cleaned?.lumen_cdts_v1)
                    ? (cleaned.cdts || cleaned.lumen_cdts_v1)
                    : [],
                archivedTransactions: Array.isArray(cleaned?.archivedTransactions)
                    ? cleaned.archivedTransactions
                    : [],
                theme: typeof cleaned?.theme === 'string' ? cleaned.theme.slice(0, 40) : null,
                colorMode: typeof cleaned?.colorMode === 'string' ? cleaned.colorMode.slice(0, 20) : null,
                widgetOrder: Array.isArray(cleaned?.widgetOrder) ? cleaned.widgetOrder : null
            }
        };
    };

    // --- 9. BORRADO NUCLEAR 100% TOTAL ---
    const wipeAllStorageAndDBs = async () => {
        flushScheduled = false;
        vaultEpoch++;
        verifiedBioTokenUntil = 0;
        vaultUnlocked = false;
        memoryStore.clear();
        if (activeRawDekBytes) activeRawDekBytes.fill(0);
        activeRawDekBytes = null;
        activeDekCryptoKey = null;

        try { rawStorage.clear(); } catch {}
        try { sessionStorage.clear(); } catch {}

        await clearBioKeyStore();

        await new Promise((resolve) => {
            try {
                const req = indexedDB.deleteDatabase(ARCHIVE_IDB_NAME);
                req.onsuccess = req.onerror = req.onblocked = () => resolve();
            } catch {
                resolve();
            }
        });
    };

    // --- 10. CORTINA INSTANTANEA, GRACIA DE IMPORTACION Y ARRANQUE FAIL-CLOSED ---
    const AUTO_LOCK_DELAY_MS = 30000;
    const FILE_PICKER_GRACE_MS = 180000;
    let bgHiddenAt = 0;
    let bgLockTimer = null;
    let filePickerGraceUntil = 0;

    if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
            const target = e.target;
            if (target && target.tagName === 'INPUT' && String(target.type).toLowerCase() === 'file') {
                filePickerGraceUntil = monoNow() + FILE_PICKER_GRACE_MS;
            }
        }, true);

        const clearFilePickerGrace = () => {
            setTimeout(() => { filePickerGraceUntil = 0; }, 1500);
        };
        document.addEventListener('change', (e) => {
            if (e.target && e.target.tagName === 'INPUT' && String(e.target.type).toLowerCase() === 'file') {
                clearFilePickerGrace();
            }
        }, true);

        globalThis.addEventListener?.('pagehide', () => {
            if (flushScheduled) commitSnapshotToQueue();
        });

        globalThis.addEventListener?.('storage', (e) => {
            if (
                e &&
                e.key === VAULT_STORAGE_KEY &&
                e.newValue &&
                e.newValue !== lastSelfVaultSerialized &&
                isPinConfigured() &&
                vaultUnlocked
            ) {
                flushScheduled = false;
                vaultEpoch++;
                lockNow();
            }
        });

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                if (flushScheduled) commitSnapshotToQueue();
                document.body?.classList.add('app-bg-shield');
                if (isPinConfigured() && vaultUnlocked) {
                    const effectiveDelay = filePickerGraceUntil > monoNow()
                        ? Math.max(AUTO_LOCK_DELAY_MS, Math.ceil(filePickerGraceUntil - monoNow()))
                        : AUTO_LOCK_DELAY_MS;
                    bgHiddenAt = monoNow();
                    clearTimeout(bgLockTimer);
                    bgLockTimer = setTimeout(() => {
                        bgHiddenAt = 0;
                        filePickerGraceUntil = 0;
                        lockNow();
                    }, effectiveDelay);
                }
            } else {
                clearTimeout(bgLockTimer);
                bgLockTimer = null;
                const effectiveDelay = filePickerGraceUntil > monoNow() ? FILE_PICKER_GRACE_MS : AUTO_LOCK_DELAY_MS;
                if (bgHiddenAt > 0 && isPinConfigured() && (monoNow() - bgHiddenAt >= effectiveDelay)) {
                    bgHiddenAt = 0;
                    filePickerGraceUntil = 0;
                    lockNow();
                }
                bgHiddenAt = 0;
                clearFilePickerGrace();
                document.body?.classList.remove('app-bg-shield');
            }
        });

        const enforceInitialBootLock = () => {
            if (!document.body) return;
            const storedAuth = getStoredAuth();
            const mustLock = !storedAuth || (Boolean(storedAuth.pinEnabled) && !vaultUnlocked);
            if (mustLock) {
                document.body.classList.add('app-locked');
                const authOverlay = document.getElementById('auth-overlay');
                if (authOverlay) authOverlay.classList.remove('hidden');
            }
        };

        const markAppReady = () => {
            if (!document.body) return;
            enforceInitialBootLock();
            document.body.classList.add('lumen-ready');
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => requestAnimationFrame(markAppReady), { once: true });
        } else {
            requestAnimationFrame(markAppReady);
        }
        setTimeout(markAppReady, 800);
    }

    const lumenSecurityApi = Object.freeze({
        escapeHtml,
        escapeAttr,
        sanitizeFileName,
        sanitizeIcsField,
        sanitizeCsvCell,
        deepCleanObject,
        sanitizeFinancePayload,
        dispatchSafeCommand,
        checkAuthLockout,
        recordAuthFailure,
        resetAuthLockout,
        isPinConfigured,
        isVaultLocked: () => isPinConfigured() && !vaultUnlocked,
        getConfiguredPinLength: () => {
            try {
                const v = JSON.parse(rawGet(VAULT_STORAGE_KEY) || 'null');
                return v?.pinLength || getStoredAuth()?.pinLength || null;
            } catch {
                return null;
            }
        },
        getConfiguredSecretMode: () => {
            try {
                const v = JSON.parse(rawGet(VAULT_STORAGE_KEY) || 'null');
                return v?.secretMode || getStoredAuth()?.secretMode || 'pin';
            } catch {
                return 'pin';
            }
        },
        enableVaultEncryption,
        bindBiometricWrapper,
        unbindBiometricWrapper,
        clearBioKeyStore,
        unlockWithPin,
        unlockWithRecoveryCode,
        unlockWithBiometricWrap,
        disableVaultEncryption,
        flushVault,
        lockVaultSession,
        lockNow,
        encryptRecordForArchive,
        decryptRecordFromArchive,
        exportEncryptedBackup,
        importEncryptedBackup,
        wipeAllStorageAndDBs
    });

    try {
        Object.defineProperty(globalThis, 'LumenSecurity', {
            value: lumenSecurityApi,
            writable: false,
            configurable: false,
            enumerable: true
        });
    } catch {
        globalThis.LumenSecurity = lumenSecurityApi;
    }
})();