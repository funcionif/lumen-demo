// ==========================================
// INICIO DE ARCHIVO: core.js (v2.2.3)
// EL CEREBRO: LOGICA PURA, MATEMATICAS Y BASE DE DATOS
// Arquitectura Estricta: Cero interaccion con el DOM (HTML).
// ==========================================

// --- 1. ESTADO GLOBAL DE LA APLICACIÓN ---
let currentDate = new Date();
let viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
let currentBalances = {};
let lastAccountViewOrigin = 'home';
let selectedCalendarDay = null;
let activeHistoryFilter = 'all';
let currentBudgetType = 'expense';
let currentAssetType = 'active';
let annualViewYear = currentDate.getFullYear();
let annualViewTab = 'summary';
let activeAmortizationSchedule = [];
let hasUnsavedChanges = false;
let widgetOrder = [];
let projectionMode = 'plan';

// Función para normalizar nombres de categorías (ignorar mayúsculas y tildes)
const normalizeCategoryName = (name) => {
    if (!name) return '';
    return name.toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
};

// --- 1B. CATÁLOGO DE ICONOGRAFÍA VECTORIAL PLANA (SVG) ---
const ICONS = {
    'wallet': '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    'bank': '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
    'card': '<rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>',
    'piggy': '<path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1c0 1.1.9 2 2 2h1"/><circle cx="16" cy="11" r="1"/>',
    'diamond': '<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>',
    'coins': '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
    'receipt': '<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
    'transfer': '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
    'arrow-up-right': '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
    'arrow-down-left': '<line x1="17" y1="7" x2="7" y2="17"/><polyline points="17 17 7 17 7 7"/>',
    'plus': '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    'check': '<polyline points="20 6 9 17 4 12"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    'home': '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    'chart': '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    'trending-up': '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    'target': '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    'repeat': '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    'briefcase': '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>',
    'scale': '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    'heart-pulse': '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
    'sliders': '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
    'help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'info': '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>',
    'bug': '<rect x="8" y="6" width="8" height="14" rx="4"/><path d="m19 7-3 2"/><path d="m5 7 3 2"/><path d="m19 19-3-2"/><path d="m5 19 3-2"/><path d="M20 13h-4"/><path d="M4 13h4"/><path d="m10 4 1 2"/><path d="m14 4-1 2"/>',
    'share': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>',
    'search': '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    'edit': '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
    'trash': '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'archive': '<polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/>',
    'eye': '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    'alert': '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    'printer': '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    'utensils': '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    'car': '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    'shopping-bag': '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    'film': '<rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/>',
    'stethoscope': '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
    'layers': '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
    'laptop': '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/>',
    'award': '<circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>',
    'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'pin': '<line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
    'bell': '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
    'palette': '<circle cx="13.5" cy="6.5" r=".5"/><circle cx="17.5" cy="10.5" r=".5"/><circle cx="8.5" cy="7.5" r=".5"/><circle cx="6.5" cy="12.5" r=".5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'calculator': '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/>'
};

const renderIcon = (name, size = 18, extraClass = '') => {
    const body = ICONS[name] || ICONS['layers'];
    const safeSize = Math.max(8, Math.min(128, Number(size) || 18));
    const safeExtra = String(extraClass || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    const cls = safeExtra ? `ui-icon ${safeExtra}` : 'ui-icon';
    return `<svg class="${cls}" width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
};

const stripLeadingEmoji = (str) => {
    if (!str) return '';
    const cleaned = String(str).replace(/^[\s\uFE0F\u200D\p{Extended_Pictographic}]+/gu, '').trim();
    return cleaned || String(str).trim();
};

const inferCategoryIcon = (name, type = 'expense') => {
    const clean = stripLeadingEmoji(name).toLowerCase();
    if (/aliment|comida|mercado|restaurante|café/.test(clean)) return 'utensils';
    if (/vivienda|arriendo|servicio|hogar|agua|luz|internet/.test(clean)) return 'home';
    if (/transporte|gasolina|moto|carro|uber|pasaje/.test(clean)) return 'car';
    if (/compra|ropa|hogar|tienda/.test(clean)) return 'shopping-bag';
    if (/entretenimiento|cine|ocio|juego|suscrip/.test(clean)) return 'film';
    if (/salud|médic|medic|farmacia|gym/.test(clean)) return 'stethoscope';
    if (/cuota|interés|interes|tarjeta|crédito|credito|deuda/.test(clean)) return 'card';
    if (/salario|nómina|nomina|sueldo/.test(clean)) return 'briefcase';
    if (/prima|bono|regalo/.test(clean)) return 'award';
    if (/cesant|ahorro/.test(clean)) return 'piggy';
    if (/honorario|venta|freelance|tecnolog/.test(clean)) return 'laptop';
    if (/rendimiento|inversi/.test(clean)) return 'trending-up';
    return type === 'income' ? 'trending-up' : 'layers';
};

const inferCategoryFromName = (text, type = 'expense') => {
    const clean = stripLeadingEmoji(text).toLowerCase();
    
    // Reglas Regex para Gastos
    if (type === 'expense') {
        if (/d1|ara|olimpica|jumbo|exito|carulla|makro|mercado|tienda|fruver/i.test(clean)) return 'Alimentación';
        if (/crepes|mcdonalds|burger|kfc|pizza|restaurante|cafe|starbucks|juan valdez|tostao/i.test(clean)) return 'Alimentación';
        if (/uber|didi|cabify|picap|taxi|gasolina|peaje|soat|parqueadero|metro|transmilenio/i.test(clean)) return 'Transporte';
        if (/netflix|spotify|hbo|disney|prime|amazon|cine|juego|xbox|playstation|steam/i.test(clean)) return 'Entretenimiento';
        if (/arriendo|agua|luz|gas|internet|claro|tigo|movistar|administracion/i.test(clean)) return 'Vivienda y Servicios';
        if (/farmatodo|cruz verde|drogueria|medico|eps|gym|smartfit|bodytech/i.test(clean)) return 'Salud';
        if (/zara|hm|ropa|zapatos|falabella|miniso/i.test(clean)) return 'Compras';
        if (/banco|cuota|interes|manejo|seguro vida/i.test(clean)) return 'Cuotas / Intereses';
    }
    
    // Reglas Regex para Ingresos
    if (type === 'income') {
        if (/nomina|salario|quincena|pago|sueldo/i.test(clean)) return 'Salario / Nómina';
        if (/rendimiento|interes|inversion/i.test(clean)) return 'Rendimientos';
        if (/prima/i.test(clean)) return 'Prima de Servicios';
    }
    
    return null;
};

// --- 2. SISTEMA DE SEGURIDAD, BIOMETRIA (WEBAUTHN) Y BOVEDA AES-256-GCM ---
const hashSecret = (str) => {
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

const sha256Hex = async (str) => {
    const clean = String(str || '');
    if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') {
        throw new Error('Contexto criptografico seguro requerido.');
    }
    const buf = new TextEncoder().encode(clean);
    const digest = await globalThis.crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const generateRecoveryCode = () => {
    const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    if (!globalThis.crypto?.getRandomValues) {
        throw new Error('Generador aleatorio seguro no disponible.');
    }
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const chars = Array.from(bytes).map(b => alphabet[b % alphabet.length]).join('');
    return `IF-${chars.slice(0, 4)}-${chars.slice(4, 6)}`;
};

const normalizeRecoveryInput = (code) => {
    const raw = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (raw.startsWith('IF') && raw.length === 8) {
        return `IF-${raw.slice(2, 6)}-${raw.slice(6, 8)}`;
    }
    if (raw.length === 6) {
        return `IF-${raw.slice(0, 4)}-${raw.slice(4, 6)}`;
    }
    return String(code || '').trim().toUpperCase();
};

const bufferToBase64Url = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64UrlToBuffer = (base64url) => {
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (base64.length % 4)) % 4;
    const padded = base64 + '='.repeat(padLen);
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
};

let authData = null;
try {
    authData = JSON.parse(localStorage.getItem('myFinancesAuth') || 'null');
} catch {
    authData = null;
}
if (authData) {
    let migrated = false;
    if (authData.pinEnabled === undefined) { authData.pinEnabled = !!authData.pinHash; migrated = true; }
    if (authData.biometricEnabled === undefined) { authData.biometricEnabled = false; migrated = true; }
    if (migrated) localStorage.setItem('myFinancesAuth', JSON.stringify(authData));
}

const verifyPin = async (pin) => {
    if (!globalThis.LumenSecurity?.unlockWithPin) {
        return { ok: false, locked: false, remainingSec: 0 };
    }
    return await globalThis.LumenSecurity.unlockWithPin(String(pin || ''));
};

const verifyRecoveryCode = async (inputCode) => {
    if (!authData) return { ok: false, locked: false, remainingSec: 0 };
    const normalized = normalizeRecoveryInput(inputCode);
    if (!normalized || !globalThis.LumenSecurity?.unlockWithRecoveryCode) {
        return { ok: false, locked: false, remainingSec: 0 };
    }
    return await globalThis.LumenSecurity.unlockWithRecoveryCode(normalized);
};

const isBiometricHardwareAvailable = async () => {
    try {
        if (globalThis.Capacitor?.isNativePlatform?.()) {
            const nativeBio = globalThis.Capacitor?.Plugins?.NativeBiometric;
            if (!nativeBio || typeof nativeBio.isAvailable !== 'function') return false;
            const res = await Promise.race([
                nativeBio.isAvailable(),
                new Promise((resolve) => setTimeout(() => resolve({ isAvailable: false }), 1200))
            ]);
            return !!res?.isAvailable;
        }
        if (!globalThis.PublicKeyCredential || typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
            return false;
        }
        return await Promise.race([
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
            new Promise((resolve) => setTimeout(() => resolve(false), 1200))
        ]);
    } catch {
        return false;
    }
};

const registerBiometricCredential = async (userName = 'Usuario') => {
    const available = await isBiometricHardwareAvailable();
    if (!available) return { ok: false, reason: 'unavailable' };

    if (globalThis.Capacitor?.isNativePlatform?.()) {
        try {
            const nativeBio = globalThis.Capacitor?.Plugins?.NativeBiometric;
            await nativeBio.verifyIdentity({
                reason: 'Confirma tu huella o rostro para activar el desbloqueo biometrico',
                title: 'Activar Biometria',
                subtitle: 'Lumen • Funcion IF',
                negativeButtonText: 'Cancelar'
            });
            const credId = 'capacitor_native_biometric';
            await globalThis.LumenSecurity?.bindBiometricWrapper?.();
            if (authData) {
                authData.biometricEnabled = true;
                authData.biometricCredId = credId;
                localStorage.setItem('myFinancesAuth', JSON.stringify(authData));
            }
            return { ok: true, credId };
        } catch {
            return { ok: false, reason: 'cancelled' };
        }
    }

    try {
        const challenge = new Uint8Array(32);
        const userId = new Uint8Array(16);
        globalThis.crypto.getRandomValues(challenge);
        globalThis.crypto.getRandomValues(userId);

        const credential = await globalThis.navigator.credentials.create({
            publicKey: {
                challenge,
                rp: { name: 'Lumen • Funcion IF' },
                user: {
                    id: userId,
                    name: `${String(userName).trim() || 'usuario'}@misfinanzas.local`,
                    displayName: String(userName).trim() || 'Usuario'
                },
                pubKeyCredParams: [
                    { type: 'public-key', alg: -7 },
                    { type: 'public-key', alg: -257 }
                ],
                authenticatorSelection: {
                    authenticatorAttachment: 'platform',
                    userVerification: 'required',
                    residentKey: 'preferred'
                },
                timeout: 60000,
                attestation: 'none'
            }
        });

        if (!credential || !credential.rawId) return { ok: false, reason: 'cancelled' };

        const credId = bufferToBase64Url(credential.rawId);
        await globalThis.LumenSecurity?.bindBiometricWrapper?.();
        if (authData) {
            authData.biometricEnabled = true;
            authData.biometricCredId = credId;
            localStorage.setItem('myFinancesAuth', JSON.stringify(authData));
        }
        return { ok: true, credId };
    } catch (err) {
        return { ok: false, reason: err?.name || 'error' };
    }
};

const verifyBiometricCredential = async () => {
    if (!authData || !authData.biometricEnabled || !authData.biometricCredId) {
        return { ok: false, reason: 'not_configured' };
    }
    const lock = globalThis.LumenSecurity?.checkAuthLockout?.();
    if (lock?.locked) {
        return { ok: false, locked: true, remainingSec: lock.remainingSec, reason: 'lockout' };
    }

    if (globalThis.Capacitor?.isNativePlatform?.()) {
        try {
            const nativeBio = globalThis.Capacitor?.Plugins?.NativeBiometric;
            if (!nativeBio || typeof nativeBio.verifyIdentity !== 'function') {
                return { ok: false, reason: 'unavailable' };
            }
            await nativeBio.verifyIdentity({
                reason: 'Desbloquea tu boveda financiera',
                title: 'Lumen • Funcion IF',
                subtitle: 'Autenticacion biometrica',
                negativeButtonText: 'Usar PIN'
            });
            const unwrapRes = await globalThis.LumenSecurity?.unlockWithBiometricWrap?.();
            if (!unwrapRes?.ok) return { ok: false, reason: 'vault_needs_pin' };
            return { ok: true };
        } catch {
            return { ok: false, reason: 'cancelled' };
        }
    }

    try {
        const challenge = new Uint8Array(32);
        globalThis.crypto.getRandomValues(challenge);

        const assertion = await globalThis.navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: [{
                    id: base64UrlToBuffer(authData.biometricCredId),
                    type: 'public-key',
                    transports: ['internal']
                }],
                userVerification: 'required',
                timeout: 60000
            }
        });

        if (!assertion) return { ok: false, reason: 'cancelled' };
        const unwrapRes = await globalThis.LumenSecurity?.unlockWithBiometricWrap?.();
        if (!unwrapRes?.ok) return { ok: false, reason: 'vault_needs_pin' };
        return { ok: true };
    } catch (err) {
        return { ok: false, reason: err?.name || 'cancelled' };
    }
};

const registerUser = async (name, pin, usePin, biometricCredId = null) => {
    let recoveryCode = null;
    const cleanName = String(name || '').trim().slice(0, 80);

    if (usePin) {
        recoveryCode = generateRecoveryCode();
    }

    let encRes = null;
    if (usePin && globalThis.LumenSecurity?.enableVaultEncryption) {
        encRes = await globalThis.LumenSecurity.enableVaultEncryption(String(pin), recoveryCode);
    }

    const isHttpFallback = encRes?.mode === 'http_fallback';
    authData = {
        name: cleanName,
        pinEnabled: !!usePin,
        vaultVersion: usePin ? (isHttpFallback ? 1 : 2) : 0,
        pinLength: usePin ? String(pin).length : null,
        secretMode: usePin ? (/^\d+$/.test(String(pin)) ? 'pin' : 'passphrase') : null,
        biometricEnabled: !!(usePin && biometricCredId && !isHttpFallback),
        biometricCredId: (usePin && !isHttpFallback) ? biometricCredId : null,
        ...(isHttpFallback ? { pinHash: encRes.pinHash, recoveryLegacyHash: encRes.recoveryLegacyHash } : {})
    };
    localStorage.setItem('myFinancesAuth', JSON.stringify(authData));

    if (usePin && biometricCredId && !isHttpFallback && globalThis.LumenSecurity?.bindBiometricWrapper) {
        await globalThis.LumenSecurity.bindBiometricWrapper();
    }

    return { authData, recoveryCode };
};

const disableSecurityLock = async () => {
    if (!authData) return;
    if (globalThis.LumenSecurity?.isVaultLocked?.()) {
        throw new Error('Debes desbloquear la boveda antes de desactivar el bloqueo.');
    }
    if (globalThis.LumenSecurity?.disableVaultEncryption) {
        await globalThis.LumenSecurity.disableVaultEncryption();
    }
    authData.pinEnabled = false;
    delete authData.pinHash;
    delete authData.recoveryHash;
    delete authData.recoveryLegacyHash;
    authData.vaultVersion = 0;
    authData.pinLength = null;
    authData.secretMode = null;
    authData.biometricEnabled = false;
    authData.biometricCredId = null;
    localStorage.setItem('myFinancesAuth', JSON.stringify(authData));
};

const safeJsonParse = (rawStr, fallback = null) => {
    if (!rawStr || typeof rawStr !== 'string') return fallback;
    try { return JSON.parse(rawStr); } catch { return fallback; }
};

const wipeAllLocalFinanceData = async () => {
    if (globalThis.LumenSecurity?.wipeAllStorageAndDBs) {
        await globalThis.LumenSecurity.wipeAllStorageAndDBs();
        authData = null;
        return;
    }
    localStorage.clear();
    sessionStorage.clear();
    authData = null;
};

// --- 3. BASE DE DATOS LOCAL Y MIGRACION DE ESTRUCTURAS ---
const loadInitialFinanceData = () => {
    try {
        const raw = localStorage.getItem('myFinances');
        if (!raw) return null;
        return globalThis.LumenSecurity?.sanitizeFinancePayload
            ? globalThis.LumenSecurity.sanitizeFinancePayload(raw)
            : JSON.parse(raw);
    } catch {
        return null;
    }
};

let financeData = loadInitialFinanceData() || {
    transactions: [],
    customAccounts: [],
    monthlyBudget: 0,
    fixedAssets: [],
    pockets: [],
    subscriptions: [],
    hideZeroAccounts: false,
    preferences: { disableAnimations: false }
};

if (!financeData.preferences) financeData.preferences = {};
if (financeData.preferences.disableAnimations === undefined) financeData.preferences.disableAnimations = false;
if (financeData.preferences.decimals === undefined) financeData.preferences.decimals = 2;
if (financeData.preferences.showCurrencySymbol === undefined) financeData.preferences.showCurrencySymbol = true;
if (financeData.preferences.negativeFormat === undefined) financeData.preferences.negativeFormat = 'minus';
if (financeData.preferences.rememberAccount === undefined) financeData.preferences.rememberAccount = true;
if (financeData.preferences.rememberCategory === undefined) financeData.preferences.rememberCategory = true;
if (financeData.preferences.showProjections === undefined) financeData.preferences.showProjections = true;
if (financeData.preferences.monthStartDay === undefined) financeData.preferences.monthStartDay = 1;
if (!financeData.tripMode) financeData.tripMode = { active: false, name: '', tag: '', budget: 0, isolateBudget: true };
if (!financeData.exchangeRates) financeData.exchangeRates = { USD: 4150, EUR: 4420 };

if (!financeData.fixedAssets) financeData.fixedAssets = [];
if (!financeData.pockets) financeData.pockets = [];
if (!financeData.subscriptions) financeData.subscriptions = [];
if (!Array.isArray(financeData.templates)) financeData.templates = [];
if (!financeData.lastBackupDate) financeData.lastBackupDate = new Date().getTime();
if (!Array.isArray(financeData.dismissedAlerts)) financeData.dismissedAlerts = [];

const dismissSmartAlert = (alertId) => {
    if (!alertId) return;
    if (!Array.isArray(financeData.dismissedAlerts)) financeData.dismissedAlerts = [];
    if (!financeData.dismissedAlerts.includes(alertId)) {
        financeData.dismissedAlerts.push(alertId);
        if (financeData.dismissedAlerts.length > 60) {
            financeData.dismissedAlerts = financeData.dismissedAlerts.slice(-60);
        }
        localStorage.setItem('myFinances', JSON.stringify(financeData));
    }
};
if (!financeData.customAccounts || financeData.customAccounts.length === 0) {
    financeData.customAccounts = [
        { id: 'Efectivo', name: 'Efectivo', category: 'asset', isDefault: false, showWhenZero: false }
    ];
}
if (financeData.monthlyBudget === undefined) financeData.monthlyBudget = 0;
if (financeData.hideZeroAccounts === undefined) financeData.hideZeroAccounts = false;

if (
    !financeData.categories ||
    (financeData.categories.expense && financeData.categories.expense.length === 0 && financeData.categories.income && financeData.categories.income.length === 0) ||
    (financeData.categories.expense.length > 0 && typeof financeData.categories.expense[0] === 'string')
) {
    financeData.categories = {
        expense: [
            { name: 'Alimentación', icon: 'utensils', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Vivienda y Servicios', icon: 'home', archived: false, isFixed: true, rollover: 'none', subcategories: [] },
            { name: 'Transporte', icon: 'car', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Compras', icon: 'shopping-bag', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Entretenimiento', icon: 'film', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Salud', icon: 'stethoscope', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Cuotas / Intereses', icon: 'card', archived: false, isFixed: true, rollover: 'none', subcategories: [] },
            { name: 'Otros Gastos', icon: 'layers', archived: false, isFixed: false, rollover: 'none', subcategories: [] }
        ],
        income: [
            { name: 'Salario / Nómina', icon: 'briefcase', archived: false, isFixed: true, rollover: 'none', subcategories: [] },
            { name: 'Prima de Servicios', icon: 'award', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Cesantías e Intereses', icon: 'piggy', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Honorarios / Ventas', icon: 'laptop', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Rendimientos', icon: 'trending-up', archived: false, isFixed: false, rollover: 'none', subcategories: [] },
            { name: 'Otros Ingresos', icon: 'layers', archived: false, isFixed: false, rollover: 'none', subcategories: [] }
        ]
    };
} else {
    ['expense', 'income'].forEach(cType => {
        if (!Array.isArray(financeData.categories[cType])) financeData.categories[cType] = [];
        financeData.categories[cType].forEach(cat => {
            if (!cat.icon) cat.icon = inferCategoryIcon(cat.name, cType);
            if (cat.isArchived === undefined) cat.isArchived = cat.archived !== undefined ? cat.archived : false;
            delete cat.archived;
            if (cat.isFixed === undefined) cat.isFixed = false;
            if (!cat.rollover) cat.rollover = 'none';
            if (Array.isArray(cat.subcategories)) {
                cat.subcategories = cat.subcategories.map(sub => {
                    const obj = (typeof sub === 'string') ? { name: sub, limit: 0 } : sub;
                    if (!obj.icon) obj.icon = inferCategoryIcon(obj.name, cType);
                    if (obj.isArchived === undefined) obj.isArchived = obj.archived !== undefined ? obj.archived : false;
                    delete obj.archived;
                    if (obj.isFixed === undefined) obj.isFixed = false;
                    if (!obj.frequency) obj.frequency = 'monthly';
                    if (obj.startMonth === undefined) obj.startMonth = 0;
                    if (!obj.rollover) obj.rollover = 'none';
                    return obj;
                });
            } else {
                cat.subcategories = [];
            }
        });
    });
}

if (!financeData.categoryBudgets) financeData.categoryBudgets = {};
if (!financeData.plannerExtras) financeData.plannerExtras = [];
if (!financeData.healthGoals) {
    financeData.healthGoals = { margin: 15, liquidity: 3, debt: 30, networth: 10 };
}

financeData.customAccounts.forEach(acc => {
    if (!acc.category) acc.category = 'asset';
    if (acc.category === 'liability') acc.category = 'debt';
    if (acc.isDefault === undefined) acc.isDefault = false;
    if (acc.showWhenZero === undefined) acc.showWhenZero = false;
});

financeData.fixedAssets.forEach(fa => {
    if (fa.showInBalance === undefined) fa.showInBalance = true;
});

financeData.subscriptions.forEach(sub => {
    if (sub.reserveInBudget === undefined) sub.reserveInBudget = false;
    if (sub.category && sub.category.includes('::')) {
        const parts = sub.category.split('::');
        sub.category = parts[0] || '';
        if (!sub.subcategory) sub.subcategory = parts[1] || 'General';
    }
    if (!sub.subcategory) sub.subcategory = 'General';
    if (!sub.prorateMode) sub.prorateMode = 'monthly';
    if (!sub.currency) sub.currency = 'COP';
    if (sub.lastPaidMonthId === undefined) sub.lastPaidMonthId = '';
});

if (!globalThis.LumenSecurity?.isVaultLocked?.()) {
    localStorage.setItem('myFinances', JSON.stringify(financeData));
}

// --- MOTOR PURO DE RECURRENTES <-> PRESUPUESTO (DOBLE VIA, CERO DOM) ---
const getRecurringAmountInCOP = (sub) => {
    if (!sub) return 0;
    const rawAmt = Math.max(0, round2(Number(sub.amount) || 0));
    const curr = String(sub.currency || 'COP').toUpperCase();
    if (curr === 'USD') {
        const rate = Number(financeData.exchangeRates?.USD) || 4150;
        return round2(rawAmt * rate);
    }
    if (curr === 'EUR') {
        const rate = Number(financeData.exchangeRates?.EUR) || 4420;
        return round2(rawAmt * rate);
    }
    return rawAmt;
};

const getRecurringMonthlyEquiv = (sub) => {
    if (!sub) return 0;
    const amtCop = getRecurringAmountInCOP(sub);
    const c = sub.cycle || 'monthly';
    if (c === 'annual') return round2(amtCop / 12);
    if (c === 'semiannual') return round2(amtCop / 6);
    if (c === 'quarterly') return round2(amtCop / 3);
    if (c === 'bimonthly') return round2(amtCop / 2);
    if (c === 'weekly') return round2((amtCop * 52) / 12);
    return amtCop;
};

const getRecurringCycleBudgetContribution = (sub, monthIndex = null) => {
    if (!sub || sub.status !== 'active') return 0;
    const amtCop = getRecurringAmountInCOP(sub);
    const c = sub.cycle || 'monthly';
    if (c === 'monthly') return amtCop;
    if (c === 'weekly') return round2(amtCop * 4);
    if (sub.prorateMode === 'billing_month') {
        if (monthIndex === null || !sub.nextBillingDate) return amtCop;
        const billingMonthIdx = Math.max(0, (parseInt(sub.nextBillingDate.split('-')[1], 10) || 1) - 1);
        return billingMonthIdx === monthIndex ? amtCop : 0;
    }
    return getRecurringMonthlyEquiv(sub);
};

const getRecurringLinkedToSubcat = (catName, subName = 'General', onlyActive = true) => {
    if (!catName) return [];
    const targetSub = subName || 'General';
    return (financeData.subscriptions || []).filter(s => {
        if (onlyActive && s.status !== 'active') return false;
        const sCat = String(s.category || '').split('::')[0];
        const sSub = s.subcategory || (String(s.category || '').includes('::') ? String(s.category).split('::')[1] : 'General');
        return sCat === catName && sSub === targetSub;
    });
};

const isRecurringPaidInMonth = (sub, monthId) => {
    if (!sub || !monthId) return false;
    if (sub.lastPaidMonthId === monthId) return true;
    const sCat = String(sub.category || '').split('::')[0];
    const sSub = sub.subcategory || (String(sub.category || '').includes('::') ? String(sub.category).split('::')[1] : 'General');
    return (financeData.transactions || []).some(t => {
        if (t.isDeleted || t.type !== 'expense' || !isTxClosed(t) || getTxMonthId(t) !== monthId) return false;
        if (t.linkedSubscriptionId && String(t.linkedSubscriptionId) === String(sub.id)) return true;
        if (sCat && sSub !== 'General' && t.category === sCat && t.subcategory === sSub) return true;
        return false;
    });
};

const isRecurringDueInMonth = (sub, monthId) => {
    if (!sub || sub.status !== 'active' || !monthId) return false;
    const nextDate = String(sub.nextBillingDate || '');
    if (!nextDate) return true;
    if (nextDate.startsWith(monthId)) return true;
    if (nextDate < `${monthId}-01`) return true;
    return false;
};

const revertRecurringNextDate = (sub) => {
    if (!sub || !sub.nextBillingDate) return;
    const [y, m, d] = sub.nextBillingDate.split('-').map(Number);
    const prevD = new Date(y, m - 1, d);
    if (sub.cycle === 'monthly') prevD.setMonth(prevD.getMonth() - 1);
    else if (sub.cycle === 'bimonthly') prevD.setMonth(prevD.getMonth() - 2);
    else if (sub.cycle === 'quarterly') prevD.setMonth(prevD.getMonth() - 3);
    else if (sub.cycle === 'semiannual') prevD.setMonth(prevD.getMonth() - 6);
    else if (sub.cycle === 'annual') prevD.setFullYear(prevD.getFullYear() - 1);
    else if (sub.cycle === 'weekly') prevD.setDate(prevD.getDate() - 7);
    sub.nextBillingDate = prevD.toLocaleDateString('en-CA');
    sub.lastPaidMonthId = '';
};

const syncRecurringToBudgetSubcat = (sub, { createSubcatIfMissing = false } = {}) => {
    if (!sub || !sub.category) return { synced: false, sharedCount: 0, totalRequired: 0 };
    const catName = String(sub.category).split('::')[0];
    const subName = sub.subcategory || 'General';
    const catObj = (financeData.categories?.expense || []).find(c => c.name === catName);
    if (!catObj) return { synced: false, sharedCount: 0, totalRequired: 0 };

    if (subName === 'General') return { synced: false, sharedCount: 0, totalRequired: 0 };

    if (!Array.isArray(catObj.subcategories)) catObj.subcategories = [];
    let subObj = catObj.subcategories.find(s => s.name === subName);
    if (!subObj) {
        if (!createSubcatIfMissing) return { synced: false, sharedCount: 0, totalRequired: 0 };
        subObj = {
            name: subName,
            icon: typeof inferCategoryIcon === 'function' ? inferCategoryIcon(subName, 'expense') : 'layers',
            limit: 0,
            isArchived: false,
            isFixed: true,
            frequency: 'monthly',
            startMonth: 0,
            rollover: 'none',
            isMonthly: false,
            months: []
        };
        catObj.subcategories.push(subObj);
    }

    const linkedActive = getRecurringLinkedToSubcat(catName, subName, true);
    const sharedCount = linkedActive.length;
    let totalMonthlyRequired = 0;
    const perMonthReq = new Array(12).fill(0);
    let usesBillingMonthMode = false;

    linkedActive.forEach(item => {
        const amtCop = getRecurringAmountInCOP(item);
        const c = item.cycle || 'monthly';
        if (c !== 'monthly' && c !== 'weekly' && item.prorateMode === 'billing_month' && item.nextBillingDate) {
            usesBillingMonthMode = true;
            const startM = Math.max(0, (parseInt(item.nextBillingDate.split('-')[1], 10) || 1) - 1);
            const step = c === 'bimonthly' ? 2 : (c === 'quarterly' ? 3 : (c === 'semiannual' ? 6 : 12));
            for (let m = 0; m < 12; m++) {
                if ((m - startM + 12) % step === 0) perMonthReq[m] = round2(perMonthReq[m] + amtCop);
            }
            totalMonthlyRequired = round2(totalMonthlyRequired + getRecurringMonthlyEquiv(item));
        } else {
            const eq = getRecurringCycleBudgetContribution(item, null);
            totalMonthlyRequired = round2(totalMonthlyRequired + eq);
            for (let m = 0; m < 12; m++) perMonthReq[m] = round2(perMonthReq[m] + eq);
        }
    });

    if (sub.reserveInBudget) {
        subObj.isFixed = true;
        if (usesBillingMonthMode) {
            subObj.isMonthly = true;
            subObj.months = perMonthReq;
            subObj.limit = Math.max(subObj.limit || 0, totalMonthlyRequired);
        } else {
            subObj.isMonthly = false;
            subObj.months = [];
            subObj.frequency = 'monthly';
            subObj.limit = totalMonthlyRequired;
        }
    }

    return {
        synced: !!sub.reserveInBudget,
        sharedCount,
        totalRequired: totalMonthlyRequired,
        subcatLimit: subObj.limit || 0
    };
};

const computeBudgetCommittedRecurring = (monthIndex, year) => {
    let fixedCommitted = 0;
    (financeData.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
        fixedCommitted = round2(fixedCommitted + getRecurringCycleBudgetContribution(sub, monthIndex));
    });
    return fixedCommitted;
};

// --- 4. MOTOR MATEMÁTICO, DECIMALES COLOMBIANOS Y CALCULADORA ---
const round2 = (num) => {
    const n = Number(num);
    if (!Number.isFinite(n)) return 0;
    return Math.round((n + Number.EPSILON) * 100) / 100;
};

const parseMoneyInput = (val) => {
    if (val === '' || val === null || val === undefined) return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? round2(val) : 0;

    let s = String(val).replace(/[$€\u00A0\s]/g, '').trim();
    if (/^\(.*\)$/.test(s)) {
        s = '-' + s.slice(1, -1).trim();
    }
    if (!s || s === '-') return 0;

    if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes(',')) {
        const commaCount = (s.match(/,/g) || []).length;
        if (commaCount > 1) {
            s = s.replace(/,/g, '');
        } else {
            s = s.replace(',', '.');
        }
    } else if (s.includes('.')) {
        const dotCount = (s.match(/\./g) || []).length;
        if (dotCount > 1) {
            s = s.replace(/\./g, '');
        } else {
            const parts = s.split('.');
            if (parts[1] && parts[1].length === 3 && parts[0] && parts[0] !== '0' && parts[0] !== '-0') {
                s = s.replace(/\./g, '');
            }
        }
    }

    const parsed = parseFloat(s);
    return Number.isFinite(parsed) ? round2(parsed) : 0;
};

const formatNumberInput = (val, maxDecimals = 2) => {
    if (val === '' || val === null || val === undefined) return '';

    if (typeof val === 'number') {
        if (isNaN(val)) return '';
        const clean = round2(val);
        const isNeg = clean < 0;
        const absStr = Math.abs(clean).toString();
        const [intPart, decPart] = absStr.split('.');
        const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        if (decPart && Number(decPart) > 0 && maxDecimals > 0) {
            return `${isNeg ? '-' : ''}${formattedInt},${decPart.slice(0, maxDecimals)}`;
        }
        return `${isNeg ? '-' : ''}${formattedInt}`;
    }

    let raw = String(val).replace(/[$€\s]/g, '');
    if (!raw) return '';

    const isNeg = raw.startsWith('-');
    raw = raw.replace(/-/g, '');

    let hasComma = raw.includes(',');
    const dotCount = (raw.match(/\./g) || []).length;

    if (!hasComma && dotCount === 1) {
        const parts = raw.split('.');
        if (parts[1] === '' || (parts[1].length <= maxDecimals && parts[1].length !== 3)) {
            raw = `${parts[0]},${parts[1]}`;
            hasComma = true;
        }
    }

    let intRaw = '';
    let decRaw = '';

    if (hasComma) {
        const commaIdx = raw.indexOf(',');
        intRaw = raw.slice(0, commaIdx).replace(/\D/g, '');
        decRaw = raw.slice(commaIdx + 1).replace(/\D/g, '').slice(0, maxDecimals);
    } else {
        intRaw = raw.replace(/\D/g, '');
    }

    if (intRaw.length > 1) {
        intRaw = intRaw.replace(/^0+/, '') || '0';
    }
    if (!intRaw && hasComma) {
        intRaw = '0';
    }

    const formattedInt = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const prefix = isNeg ? '-' : '';

    if (hasComma && maxDecimals > 0) {
        return `${prefix}${formattedInt},${decRaw}`;
    }
    return `${prefix}${formattedInt}`;
};

const formatMoney = (amount) => {
    if (localStorage.getItem('myFinancesPrivacyMode') === 'true') return amount < 0 ? '-****' : '****';
    const clean = round2(amount);
    const prefs = financeData.preferences || {};
    const decimals = prefs.decimals !== undefined ? prefs.decimals : 2;
    const showSymbol = prefs.showCurrencySymbol !== false;
    const isParentheses = prefs.negativeFormat === 'parentheses';

    let formatted = new Intl.NumberFormat('es-CO', {
        style: 'decimal',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(Math.abs(clean));

    if (showSymbol) formatted = `$\u00A0${formatted}`;
    
    if (clean < 0) return isParentheses ? `(${formatted})` : `-${formatted}`;
    return formatted;
};

const formatCompact = (amount) => {
    if (localStorage.getItem('myFinancesPrivacyMode') === 'true') return amount < 0 ? '-****' : '****';
    if (!financeData.useCompactNumbers) return formatMoney(amount);
    
    const prefs = financeData.preferences || {};
    const decimals = prefs.decimals !== undefined ? prefs.decimals : 2;
    const showSymbol = prefs.showCurrencySymbol !== false ? '$\u00A0' : '';
    const isParentheses = prefs.negativeFormat === 'parentheses';
    
    const abs = Math.abs(amount);
    let valStr = '';
    
    if (abs >= 1000000) valStr = `${(abs / 1000000).toFixed(decimals).replace('.', ',')}M`;
    else if (abs >= 1000) valStr = `${(abs / 1000).toFixed(decimals > 0 ? 1 : 0).replace('.', ',')}k`;
    else valStr = abs.toFixed(decimals).replace('.', ',');
    
    const formatted = `${showSymbol}${valStr}`;
    if (amount < 0) return isParentheses ? `(${formatted})` : `-${formatted}`;
    return formatted;
};

// Evaluador aritmético seguro sin eval()
const evaluateCalculatorExpression = (rawExpr) => {
    if (!rawExpr) return { valid: true, value: 0 };
    let clean = String(rawExpr)
        .replace(/\s+/g, '')
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.');

    clean = clean.replace(/[+\-*/.]+$/, '');
    if (!clean) return { valid: true, value: 0 };

    const tokens = [];
    let i = 0;
    while (i < clean.length) {
        const ch = clean[i];
        if ((ch >= '0' && ch <= '9') || ch === '.' || ((ch === '-' || ch === '+') && (i === 0 || ['+', '-', '*', '/'].includes(clean[i - 1])))) {
            let numStr = ch;
            i++;
            while (i < clean.length && ((clean[i] >= '0' && clean[i] <= '9') || clean[i] === '.')) {
                numStr += clean[i];
                i++;
            }
            let isPct = false;
            if (i < clean.length && clean[i] === '%') {
                isPct = true;
                i++;
            }
            if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(numStr)) return { valid: false, value: 0 };
            const parsed = parseFloat(numStr);
            if (!Number.isFinite(parsed)) return { valid: false, value: 0 };
            tokens.push({ type: 'num', value: parsed, isPct });
        } else if (['+', '-', '*', '/'].includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i++;
        } else {
            return { valid: false, value: 0 };
        }
    }

    if (tokens.length === 0) return { valid: true, value: 0 };

    const resolved = [];
    for (let t = 0; t < tokens.length; t++) {
        const tok = tokens[t];
        if (tok.type === 'num' && tok.isPct) {
            if (resolved.length >= 2 && resolved[resolved.length - 1].type === 'op' && resolved[resolved.length - 2].type === 'num') {
                const op = resolved[resolved.length - 1].value;
                const base = resolved[resolved.length - 2].value;
                if (op === '+' || op === '-') {
                    resolved.push({ type: 'num', value: (base * tok.value) / 100 });
                } else {
                    resolved.push({ type: 'num', value: tok.value / 100 });
                }
            } else {
                resolved.push({ type: 'num', value: tok.value / 100 });
            }
        } else {
            resolved.push(tok);
        }
    }

    if (resolved[0].type !== 'num' || resolved.length % 2 === 0) {
        return { valid: false, value: 0 };
    }

    const pass1 = [resolved[0]];
    for (let t = 1; t < resolved.length; t += 2) {
        const opTok = resolved[t];
        const nextNum = resolved[t + 1];
        if (!opTok || opTok.type !== 'op' || !nextNum || nextNum.type !== 'num') {
            return { valid: false, value: 0 };
        }

        if (opTok.value === '*') {
            pass1[pass1.length - 1] = { type: 'num', value: pass1[pass1.length - 1].value * nextNum.value };
        } else if (opTok.value === '/') {
            if (nextNum.value === 0) return { valid: false, value: 0 };
            pass1[pass1.length - 1] = { type: 'num', value: pass1[pass1.length - 1].value / nextNum.value };
        } else {
            pass1.push(opTok, nextNum);
        }
    }

    let acc = pass1[0].value;
    for (let t = 1; t < pass1.length; t += 2) {
        const opTok = pass1[t];
        const nextNum = pass1[t + 1];
        if (!opTok || !nextNum) break;
        if (opTok.value === '+') acc += nextNum.value;
        else if (opTok.value === '-') acc -= nextNum.value;
    }

    if (!isFinite(acc) || isNaN(acc)) return { valid: false, value: 0 };
    return { valid: true, value: round2(acc) };
};

// --- MOTOR DE ETIQUETAS (#TAGS) ---
const extractTransactionTags = (rawTagInput = '', descriptionText = '') => {
    const found = new Set();
    const sanitize = (token) => String(token || '')
        .replace(/^#+/, '')
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '')
        .toLowerCase()
        .trim();

    // 1. Procesar el campo dedicado de etiquetas (separadas por espacio o coma)
    String(rawTagInput || '').split(/[\s,]+/).forEach(part => {
        const clean = sanitize(part);
        if (clean.length >= 2) found.add(clean);
    });

    // 2. Detectar también #hashtags escritos directamente en la descripción
    const inlineMatches = String(descriptionText || '').match(/#([a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]{2,})/g);
    if (inlineMatches) {
        inlineMatches.forEach(m => {
            const clean = sanitize(m);
            if (clean.length >= 2) found.add(clean);
        });
    }

    return Array.from(found);
};

const getAllUsedTags = () => {
    const counts = {};
    financeData.transactions.forEach(t => {
        if (!t.isDeleted && Array.isArray(t.tags)) {
            t.tags.forEach(tag => {
                const clean = String(tag).toLowerCase().trim();
                if (clean) counts[clean] = (counts[clean] || 0) + 1;
            });
        }
    });
    return Object.entries(counts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
        .map(([tag, count]) => ({ tag, count }));
};

// --- 5. LÓGICA FINANCIERA, CUENTAS, BOLSILLOS Y PRESUPUESTOS ---
const getAccountObj = (id) => {
    const acc = financeData.customAccounts.find(a => String(a.id) === String(id));
    if (acc) return acc;
    const pocket = financeData.pockets.find(p => String(p.id) === String(id));
    if (pocket) return { ...pocket, category: 'pocket' };
    const archivedTx = (financeData.transactions || []).find(t => (String(t.account) === String(id) && t._accLabel) || (String(t.toAccount) === String(id) && t._toAccLabel));
    const fallbackName = archivedTx
        ? (String(archivedTx.account) === String(id) ? archivedTx._accLabel : archivedTx._toAccLabel)
        : id;
    return { id: id, name: fallbackName, category: 'asset' };
};

const isLiabilityCategory = (cat) => cat === 'credit_card' || cat === 'debt';
const isTxClosed = (t) => t.status !== 'pending';

const sortAlphabeticallyWithDefault = (arr) => {
    return [...arr].sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
};

const setDefaultAccount = (accountId, toggleIfAlreadyDefault = false) => {
    const target = financeData.customAccounts.find(a => a.id === accountId);
    if (!target) return null;

    const willBeDefault = toggleIfAlreadyDefault ? !target.isDefault : true;
    if (willBeDefault) {
        const existingDefault = financeData.customAccounts.find(a => a.isDefault && a.id !== accountId);
        if (existingDefault) return false;
    }

    target.isDefault = willBeDefault;
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    return willBeDefault;
};

const getDefaultAccountId = (onlyAssets = false) => {
    if (onlyAssets) {
        const defAsset = financeData.customAccounts.find(a => a.category === 'asset' && a.isDefault && !a.id.startsWith('CxC_'));
        if (defAsset) return defAsset.id;
        const firstAsset = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_')))[0];
        return firstAsset ? firstAsset.id : 'Efectivo';
    }
    const defAny = financeData.customAccounts.find(a => a.isDefault);
    if (defAny) return defAny.id;
    const firstAcc = sortAlphabeticallyWithDefault(financeData.customAccounts)[0];
    return firstAcc ? firstAcc.id : 'Efectivo';
};

const isPeriodMatching = (freq, startMonth, currentMonthIndex) => {
    if (currentMonthIndex < startMonth) return false;
    if (freq === 'monthly') return true;
    if (freq === 'bimonthly') return (currentMonthIndex - startMonth) % 2 === 0;
    if (freq === 'quarterly') return (currentMonthIndex - startMonth) % 3 === 0;
    if (freq === 'semiannual') return (currentMonthIndex - startMonth) % 6 === 0;
    if (freq === 'annual') return (currentMonthIndex - startMonth) % 12 === 0;
    return false;
};

const getMaxBudgetProjectionYear = () => currentDate.getFullYear() + 1;

const resolveCategoryYearBudget = (catName, year) => {
    const cfg = financeData.categoryBudgets?.[catName];
    if (!cfg) return null;
    const maxYear = getMaxBudgetProjectionYear();
    if (year > maxYear) return null;

    if (typeof cfg === 'object' && cfg.byYear && typeof cfg.byYear === 'object') {
        if (cfg.byYear[year] !== undefined) return cfg.byYear[year];
        const currYear = currentDate.getFullYear();
        if (year === maxYear && cfg.byYear[currYear] !== undefined) {
            return cfg.byYear[currYear];
        }
        return null;
    }
    return cfg;
};

const getCategoryBudgetStatus = (catObj, subObj = null, monthIndex = null, year = null) => {
    const mIdx = monthIndex !== null ? monthIndex : currentDate.getMonth();
    const y = year !== null ? year : (typeof viewDate !== 'undefined' && viewDate ? viewDate.getFullYear() : currentDate.getFullYear());
    const isBeyondHorizon = y > getMaxBudgetProjectionYear();
    const isIncomeCat = Array.isArray(financeData.categories?.income) && financeData.categories.income.includes(catObj);
    const activeSubcatNames = new Set(
        Array.isArray(catObj.subcategories) ? catObj.subcategories.filter(s => !s.isArchived).map(s => s.name) : []
    );

    const calcUnassignedReservedSubsForMonth = (targetMIdx) => {
        if (isIncomeCat || (subObj && subObj.name !== 'General')) return 0;
        let total = 0;
        (financeData.subscriptions || []).forEach(sub => {
            if (sub.status !== 'active' || !sub.reserveInBudget) return;
            const sCat = String(sub.category || '').split('::')[0];
            if (sCat !== catObj.name) return;
            const sSub = sub.subcategory || (String(sub.category || '').includes('::') ? String(sub.category).split('::')[1] : 'General');
            // Si ya esta sincronizada a una subcategoria activa, se contabiliza en el paso 3 sin duplicar
            if (sSub && sSub !== 'General' && activeSubcatNames.has(sSub)) return;
            total = round2(total + getRecurringCycleBudgetContribution(sub, targetMIdx));
        });
        return total;
    };

    // Sumar Suscripciones Reservadas no asignadas a subcategoría (solo dentro del horizonte de 1 año)
    const reservedSubs = isBeyondHorizon ? 0 : calcUnassignedReservedSubsForMonth(mIdx);

    // 1. Calcular Límite Base propio del mes actual (Categoría padre o Subcategoría individual)
    let ownBaseLimit = 0;
    if (!isBeyondHorizon) {
        if (subObj) {
            if (subObj.isMonthly && Array.isArray(subObj.months)) {
                ownBaseLimit = round2(subObj.months[mIdx] || 0);
            } else if (subObj.limit > 0 && isPeriodMatching(subObj.frequency || 'monthly', subObj.startMonth || 0, mIdx)) {
                ownBaseLimit = round2(subObj.limit);
            }
        } else {
            const cfg = resolveCategoryYearBudget(catObj.name, y);
            if (cfg) {
                if (typeof cfg === 'number') ownBaseLimit = round2(cfg);
                else if (cfg.isMonthly && Array.isArray(cfg.months)) ownBaseLimit = round2(cfg.months[mIdx] || 0);
                else ownBaseLimit = round2(cfg.general || 0);
            }
        }
    }

    ownBaseLimit = round2(ownBaseLimit + reservedSubs);

    // 2. Calcular Arrastre (Rollover) propio mes a mes dentro del año fiscal (Enero -> mIdx - 1)
    let ownRolloverAmt = 0;
    const rolloverMode = subObj ? (subObj.rollover || 'none') : (catObj.rollover || 'none');
    const hasSubcats = !subObj && activeSubcatNames.size > 0;
    const expectedTxType = isIncomeCat ? 'income' : 'expense';

    if (!isBeyondHorizon && rolloverMode !== 'none' && mIdx > 0) {
        let runningRollover = 0;
        
        for (let i = 0; i < mIdx; i++) {
            const tempMonthId = `${y}-${String(i + 1).padStart(2, '0')}`;
            
            // Tope base del mes i
            let mLimit = 0;
            if (subObj) {
                if (subObj.isMonthly && Array.isArray(subObj.months)) mLimit = round2(subObj.months[i] || 0);
                else if (subObj.limit > 0 && isPeriodMatching(subObj.frequency || 'monthly', subObj.startMonth || 0, i)) mLimit = round2(subObj.limit);
            } else {
                const cfg = resolveCategoryYearBudget(catObj.name, y);
                if (cfg) {
                    if (typeof cfg === 'number') mLimit = round2(cfg);
                    else if (cfg.isMonthly && Array.isArray(cfg.months)) mLimit = round2(cfg.months[i] || 0);
                    else mLimit = round2(cfg.general || 0);
                }
            }
            
            const mSubs = calcUnassignedReservedSubsForMonth(i);
            mLimit = round2(mLimit + mSubs);

            // Ejecución neta en el mes i (descontando reembolsos en gastos y excluyéndolos en ingresos)
            let mSpent = 0;
            let mRefundOffset = 0;
            financeData.transactions.forEach(t => {
                if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion') || t.isTripIsolated || getTxMonthId(t) !== tempMonthId || t.isAdjustment || !isTxClosed(t)) return;
                if (t.type === expectedTxType && t.category === catObj.name) {
                    if (expectedTxType === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) return;
                    const matchesScope = subObj
                        ? (t.subcategory === subObj.name)
                        : (!hasSubcats || !t.subcategory || t.subcategory === 'General');
                    if (matchesScope) {
                        mSpent = round2(mSpent + round2(t.amount));
                    }
                } else if (expectedTxType === 'expense' && t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name) {
                    const matchesRefScope = subObj
                        ? (t.refundSubcategory === subObj.name)
                        : (!hasSubcats || !t.refundSubcategory || t.refundSubcategory === 'General');
                    if (matchesRefScope) {
                        mRefundOffset = round2(mRefundOffset + round2(t.amount));
                    }
                }
            });
            mSpent = Math.max(0, round2(mSpent - mRefundOffset));

            const monthDiff = round2(mLimit + runningRollover - mSpent);

            if (rolloverMode === 'positive') {
                runningRollover = monthDiff > 0 ? monthDiff : 0;
            } else if (rolloverMode === 'both') {
                runningRollover = monthDiff;
            }
        }
        
        ownRolloverAmt = runningRollover;
    }

    const ownCurrentLimit = Math.max(0, round2(ownBaseLimit + ownRolloverAmt));

    // 3. Si es categoría padre con subcategorías, consolida su presupuesto propio + el de cada subcategoría
    if (!subObj && catObj.subcategories && catObj.subcategories.length > 0) {
        let totalBase = ownBaseLimit;
        let totalRollover = ownRolloverAmt;
        let totalCurrent = ownCurrentLimit;
        catObj.subcategories.forEach(sub => {
            if (!sub.isArchived) {
                const subSt = getCategoryBudgetStatus(catObj, sub, mIdx, y);
                totalBase = round2(totalBase + subSt.baseLimit);
                totalRollover = round2(totalRollover + subSt.rolloverAmt);
                totalCurrent = round2(totalCurrent + subSt.currentLimit);
            }
        });
        return {
            baseLimit: totalBase,
            reservedSubs,
            rolloverAmt: totalRollover,
            currentLimit: Math.max(0, totalCurrent),
            ownCurrentLimit
        };
    }

    return {
        baseLimit: ownBaseLimit,
        reservedSubs,
        rolloverAmt: ownRolloverAmt,
        currentLimit: ownCurrentLimit,
        ownCurrentLimit
    };
};

const getCategoryLimitForMonth = (catObj, monthIndex, year = null) => {
    return getCategoryBudgetStatus(catObj, null, monthIndex, year).currentLimit;
};

const getBudgetedAmountForSelection = (type, categoryName, subcategoryName, monthIndex, year = null) => {
    if (!type || type === 'transfer' || !categoryName) return 0;
    const catList = financeData.categories[type] || [];
    const catObj = catList.find(c => c.name === categoryName);
    if (!catObj) return 0;

    let subObj = null;
    if (subcategoryName && subcategoryName !== 'General' && Array.isArray(catObj.subcategories)) {
        subObj = catObj.subcategories.find(s => s.name === subcategoryName);
    }
    
    return getCategoryBudgetStatus(catObj, subObj, monthIndex, year).currentLimit;
};

const getRemainingBudgetForSelection = (type, categoryName, subcategoryName, monthId, excludeTxId = null) => {
    if (!type || type === 'transfer' || !categoryName || !monthId) {
        return { hasBudget: false, totalLimit: 0, baseLimit: 0, rolloverAmt: 0, spent: 0, remaining: 0 };
    }
    
    // ESTA LÍNEA AÍSLA EL PRESUPUESTO EN EL MODO VIAJE:
    if (type === 'expense' && financeData.tripMode && financeData.tripMode.active && financeData.tripMode.isolateBudget !== false) {
        return { hasBudget: false, totalLimit: 0, baseLimit: 0, rolloverAmt: 0, spent: 0, remaining: 0, isTripIsolated: true };
    }

    const [yStr, mStr] = monthId.split('-');
    const year = parseInt(yStr, 10);
    const monthIndex = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));

    const catList = financeData.categories[type] || [];
    const catObj = catList.find(c => c.name === categoryName);
    if (!catObj) {
        return { hasBudget: false, totalLimit: 0, baseLimit: 0, rolloverAmt: 0, spent: 0, remaining: 0 };
    }

    const hasSubcats = Array.isArray(catObj.subcategories) && catObj.subcategories.length > 0;
    let subObj = null;
    if (subcategoryName && subcategoryName !== 'General' && hasSubcats) {
        subObj = catObj.subcategories.find(s => s.name === subcategoryName);
    }

    const status = getCategoryBudgetStatus(catObj, subObj, monthIndex, year);
    const totalLimit = (!subObj && subcategoryName === 'General' && hasSubcats && status.ownCurrentLimit > 0)
        ? status.ownCurrentLimit
        : status.currentLimit;

    let spent = 0;
    let refundOffset = 0;
    financeData.transactions.forEach(t => {
        if (t.isDeleted || t.isTripIsolated || getTxMonthId(t) !== monthId || t.isAdjustment) return;
        if (excludeTxId && String(t.id) === String(excludeTxId)) return;

        if (t.type === type && t.category === categoryName) {
            if (type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) return;
            let matchesSub = true;
            if (subObj) {
                matchesSub = (t.subcategory === subObj.name);
            } else if (subcategoryName === 'General' && hasSubcats) {
                matchesSub = (!t.subcategory || t.subcategory === 'General');
            }
            if (matchesSub) {
                const val = t.status === 'pending' ? round2(t.budgetedAmount || t.amount) : round2(t.amount);
                spent = round2(spent + val);
            }
        } else if (type === 'expense' && t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === categoryName) {
            let matchesRefSub = true;
            if (subObj) {
                matchesRefSub = (t.refundSubcategory === subObj.name);
            } else if (subcategoryName === 'General' && hasSubcats) {
                matchesRefSub = (!t.refundSubcategory || t.refundSubcategory === 'General');
            }
            if (matchesRefSub) {
                const val = t.status === 'pending' ? round2(t.budgetedAmount || t.amount) : round2(t.amount);
                refundOffset = round2(refundOffset + val);
            }
        }
    });

    spent = Math.max(0, round2(spent - refundOffset));
    const remaining = Math.max(0, round2(totalLimit - spent));
    return {
        hasBudget: totalLimit > 0,
        totalLimit,
        baseLimit: status.baseLimit,
        rolloverAmt: status.rolloverAmt,
        spent,
        remaining
    };
};

const calculateBudgetVariance = (type, realAmount, budgetedAmount) => {
    const real = round2(realAmount || 0);
    const budget = round2(budgetedAmount || 0);
    if (budget <= 0 || type === 'transfer') {
        return { hasBudget: false, diff: 0, pct: 0, isFavorable: true };
    }

    const diff = round2(real - budget);
    const pct = round2(((real - budget) / budget) * 100);
    const isFavorable = type === 'income' ? (real >= budget) : (real <= budget);

    return { hasBudget: true, diff, pct, isFavorable };
};

const evaluateUnusualExpense = (categoryName, amountCop, excludeTxId = null) => {
    const amt = round2(amountCop || 0);
    if (!categoryName || amt < 20000) {
        return { isUnusual: false, avg: 0, ratio: 0, sampleCount: 0 };
    }

    const samples = (financeData.transactions || []).filter(t =>
        !t.isDeleted &&
        !t.isAdjustment &&
        !(t.isSharedTrip && t.paidBy === 'companion') &&
        t.type === 'expense' &&
        isTxClosed(t) &&
        t.category === categoryName &&
        (!excludeTxId || String(t.id) !== String(excludeTxId)) &&
        round2(t.amount) > 0
    );

    if (samples.length < 3) {
        return { isUnusual: false, avg: 0, ratio: 0, sampleCount: samples.length };
    }

    const total = samples.reduce((s, t) => round2(s + round2(t.amount)), 0);
    const avg = round2(total / samples.length);
    const ratio = avg > 0 ? round2(amt / avg) : 0;

    return {
        isUnusual: avg > 0 && ratio >= 2,
        avg,
        ratio,
        sampleCount: samples.length
    };
};

const isTxRefundAdjustment = (t) => {
    if (!t || t.isDeleted || t.isAdjustment || t.type !== 'income') return false;
    if (t.isRefund || t.refundCategory) return true;
    const subClean = normalizeCategoryName(stripLeadingEmoji(t.subcategory || ''));
    return /\b(reembolso|devolucion|cashback)\b/.test(subClean);
};

const findPossibleDuplicateTransaction = ({ type, accountId, amountCop, dateStr, excludeTxId = null }) => {
    const amt = round2(amountCop || 0);
    if (!type || type === 'transfer' || !accountId || amt <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''))) {
        return null;
    }

    const matches = (financeData.transactions || []).filter(t => {
        if (t.isDeleted || t.isAdjustment || !isTxClosed(t)) return false;
        if (excludeTxId && String(t.id) === String(excludeTxId)) return false;
        if (t.type !== type || String(t.account) !== String(accountId)) return false;
        if (Math.abs(round2(t.amount || 0) - amt) > 0.01) return false;
        const txDate = getTxEffectiveDateObj(t, new Date(`${dateStr}T12:00:00`)).toLocaleDateString('en-CA');
        return txDate === dateStr;
    });

    if (matches.length === 0) return null;
    const latest = matches[matches.length - 1];
    return {
        count: matches.length,
        txId: latest.id,
        description: stripLeadingEmoji(latest.description || latest.category || 'Movimiento'),
        date: latest.date || dateStr,
        amount: round2(latest.amount || 0)
    };
};

const parseBankNotificationText = (rawText) => {
    const clean = String(rawText || '').replace(/\s+/g, ' ').trim();
    if (!clean) return { amount: 0, merchant: '', currency: 'COP', accountHint: '', inferredType: 'expense', dateStr: '' };

    const parseBankNumber = (rawNum) => {
        const s = String(rawNum || '').trim();
        if (!s) return 0;
        // Formato US/Banco: 48,500.00 o 1,250,000.50 (coma miles, punto decimales)
        if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s)) {
            return round2(parseFloat(s.replace(/,/g, '')) || 0);
        }
        // Formato decimal con punto sin miles: 48500.50
        if (/^\d+\.\d{1,2}$/.test(s)) {
            return round2(parseFloat(s) || 0);
        }
        return parseMoneyInput(s);
    };

    const inferredType = /\b(recibiste|transferencia\s+recibida|abono|consignacion|consignación|ingreso|devolucion|devolución|reembolso)\b/i.test(clean)
        ? 'income'
        : 'expense';

    let currency = 'COP';
    let amount = 0;

    const fxMatch = clean.match(/\b(USD|US\$|EUR)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)\b/i);
    if (fxMatch) {
        currency = fxMatch[1].toUpperCase().startsWith('US') ? 'USD' : 'EUR';
        amount = parseBankNumber(fxMatch[2]);
    } else {
        const copCandidates = [];
        const regex = /(?:COP|\$)\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{1,2})?|[0-9]+(?:[.,][0-9]{1,2})?)/gi;
        let m;
        while ((m = regex.exec(clean)) !== null) {
            const val = parseBankNumber(m[1]);
            if (val > 0) copCandidates.push(val);
        }
        if (copCandidates.length > 0) {
            amount = copCandidates[0];
        } else {
            const fallbackNum = clean.match(/\b([0-9]{1,3}(?:[.,][0-9]{3})+(?:[.,][0-9]{1,2})?|[0-9]{4,}(?:[.,][0-9]{1,2})?)\b/);
            if (fallbackNum) amount = parseBankNumber(fallbackNum[1]);
        }
    }

    let dateStr = '';
    const dmyMatch = clean.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})\b/);
    const ymdMatch = clean.match(/\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
    if (ymdMatch) {
        const [, y, mo, da] = ymdMatch;
        if (Number(mo) >= 1 && Number(mo) <= 12 && Number(da) >= 1 && Number(da) <= 31) {
            dateStr = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
        }
    } else if (dmyMatch) {
        const [, da, mo, y] = dmyMatch;
        if (Number(mo) >= 1 && Number(mo) <= 12 && Number(da) >= 1 && Number(da) <= 31) {
            dateStr = `${y}-${String(mo).padStart(2, '0')}-${String(da).padStart(2, '0')}`;
        }
    }

    let merchant = '';
    const prepMatch = clean.match(/\b(?:en|a|hacia|por\s+compra\s+en|compra\s+en|pago\s+en|retiro\s+en)\s+([A-ZÁÉÍÓÚÑ0-9&.,\-\s]{2,42}?)(?=\s+(?:el\s+\d|por\s+\$|con\s+(?:tu|su|la|el|tarjeta|cuenta|nequi|bancolombia|daviplata|nu)|ref\.?|aprobacion|aprobación|\d{2}\/\d{2}|$))/i);
    if (prepMatch && prepMatch[1]) {
        merchant = prepMatch[1].replace(/[.,;:\s]+$/g, '').trim();
    }

    let accountHint = '';
    if (/\bnequi\b/i.test(clean)) accountHint = 'Nequi';
    else if (/\bdaviplata\b/i.test(clean)) accountHint = 'DaviPlata';
    else if (/\bbancolombia\b/i.test(clean)) accountHint = 'Bancolombia';
    else if (/\bnu\b/i.test(clean)) accountHint = 'Nu';
    else if (/\bdavivienda\b/i.test(clean)) accountHint = 'Davivienda';
    else if (/\bfalabella\b/i.test(clean)) accountHint = 'Falabella';
    else if (/\btarjeta\b|\btc\b|\bcr[eé]dito\b/i.test(clean)) accountHint = 'Tarjeta';

    return {
        amount: round2(amount || 0),
        merchant: merchant.slice(0, 80),
        currency,
        accountHint,
        inferredType,
        dateStr
    };
};

const computeUpcoming7DaysCommitments = (refDate = currentDate) => {
    const startDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
    const currMonthId = getMonthId(startDay);
    const snap = computeBalancesUpTo(currMonthId);
    const items = [];

    const calcDiffDays = (targetDate) => {
        const cleanTarget = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
        return Math.round((cleanTarget.getTime() - startDay.getTime()) / 86400000);
    };

    const fmtShortDate = (d) => `${d.getDate()} ${getShortMonthLabel(d).toLowerCase()}.`;

    // 1. Pagos recurrentes activos (-5 a +7 días)
    (financeData.subscriptions || []).filter(s => s.status === 'active' && s.nextBillingDate).forEach(sub => {
        if (sub.nextBillingDate.startsWith(currMonthId) && typeof isRecurringPaidInMonth === 'function' && isRecurringPaidInMonth(sub, currMonthId)) {
            return;
        }
        const [y, m, d] = sub.nextBillingDate.split('-').map(Number);
        if (!y || !m || !d) return;
        const dueDate = new Date(y, m - 1, d, 12, 0, 0);
        const diff = calcDiffDays(dueDate);
        if (diff >= -5 && diff <= 7) {
            const amt = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount || 0);
            if (amt > 0) {
                items.push({
                    uid: `sub_${sub.id}`,
                    kind: 'subscription',
                    refId: String(sub.id),
                    title: stripLeadingEmoji(sub.name || 'Recurrente'),
                    subtitle: `${fmtShortDate(dueDate)} • Recurrente`,
                    amount: amt,
                    diffDays: diff,
                    icon: 'repeat',
                    actionLabel: 'Pagar'
                });
            }
        }
    });

    // 2. Tarjetas de crédito con ciclo pendiente real en los próximos 7 días
    (financeData.customAccounts || []).filter(a => a.category === 'credit_card' && a.paymentDay).forEach(card => {
        const bal = round2(snap.bals[card.id] || 0);
        const nextDue = getNextUnpaidLiabilityCycle(card, bal, startDay, 3);
        if (!nextDue || nextDue.diffDays > 7) return;

        const cleanName = stripLeadingEmoji(card.name);
        const cardTitle = /^(tc\b|tarjeta\b)/i.test(cleanName) ? cleanName : `TC ${cleanName}`;
        const cutNote = nextDue.cutDateObj ? ` (corte ${nextDue.cutDateObj.getDate()} ${getShortMonthLabel(nextDue.cutDateObj).toLowerCase()}.)` : '';
        items.push({
            uid: `card_${card.id}`,
            kind: 'card',
            refId: String(card.id),
            title: cardTitle,
            subtitle: `${fmtShortDate(nextDue.dueDate)} • Pago mín.${cutNote}`,
            amount: nextDue.amount,
            diffDays: nextDue.diffDays,
            icon: 'card',
            actionLabel: 'Abonar'
        });
    });

    // 3. Préstamos fijos, cupos rotativos y créditos educativos (no libranza) con vencimiento pendiente
    (financeData.customAccounts || []).filter(a => a.category === 'debt' && !a.payrollDeduction && a.paymentDay).forEach(debt => {
        const bal = round2(snap.bals[debt.id] || 0);
        const nextDue = getNextUnpaidLiabilityCycle(debt, bal, startDay, 3);
        if (!nextDue || nextDue.diffDays > 7) return;

        items.push({
            uid: `debt_${debt.id}`,
            kind: 'debt',
            refId: String(debt.id),
            title: stripLeadingEmoji(debt.name),
            subtitle: `${fmtShortDate(nextDue.dueDate)} • ${debt.debtType === 'revolving' ? 'Cupo rotativo' : 'Cuota'}`,
            amount: nextDue.amount,
            diffDays: nextDue.diffDays,
            icon: 'scale',
            actionLabel: 'Abonar'
        });
    });

    // 4. Gastos programados (status === 'pending')
    (financeData.transactions || []).filter(t => !t.isDeleted && t.status === 'pending' && t.type === 'expense').forEach(tx => {
        const txDate = getTxEffectiveDateObj(tx, startDay);
        const diff = calcDiffDays(txDate);
        if (diff >= -5 && diff <= 7) {
            const amt = round2(tx.budgetedAmount || tx.amount || 0);
            if (amt > 0) {
                items.push({
                    uid: `pending_${tx.id}`,
                    kind: 'pending_tx',
                    refId: String(tx.id),
                    title: stripLeadingEmoji(tx.description || tx.category || 'Pago pendiente'),
                    subtitle: `${fmtShortDate(txDate)} • Programado`,
                    amount: amt,
                    diffDays: diff,
                    icon: 'clock',
                    actionLabel: 'Confirmar'
                });
            }
        }
    });

    items.sort((a, b) => a.diffDays - b.diffDays || b.amount - a.amount);
    const totalAmount = round2(items.reduce((s, it) => s + it.amount, 0));

    return { items, totalAmount, count: items.length };
};

const computeUnassignedPreviousSurplus = (refDate = currentDate) => {
    if (financeData.isDemoMode) return { available: false };

    const currMonthId = getMonthId(refDate);
    const [cy, cm] = currMonthId.split('-').map(Number);
    const prevDate = new Date(cy, cm - 2, 1);
    const prevMonthId = getMonthId(prevDate);
    const alertDismissId = `surplus_assign_${prevMonthId}`;

    if (Array.isArray(financeData.dismissedAlerts) && financeData.dismissedAlerts.includes(alertDismissId)) {
        return { available: false };
    }

    const prevFlow = getMonthlyFlow(prevMonthId, false);
    if (prevFlow.inc <= 0 || prevFlow.net <= 0) {
        return { available: false };
    }

    // Descontar excedentes de ese cierre que ya se hayan transferido este mes
    let alreadyAssigned = 0;
    (financeData.transactions || []).forEach(t => {
        if (!t.isDeleted && isTxClosed(t) && getTxMonthId(t) === currMonthId && t.type === 'transfer') {
            if (t.surplusSourceMonth === prevMonthId || /excedente|sobrante/i.test(t.description || '')) {
                alreadyAssigned = round2(alreadyAssigned + round2(t.amount || 0));
            }
        }
    });

    const rawSurplus = round2(prevFlow.net - alreadyAssigned);
    if (rawSurplus < 10000) return { available: false };

    const currSnap = computeBalancesUpTo(currMonthId);
    let liquidNow = 0;
    (financeData.customAccounts || []).forEach(a => {
        if (a.category === 'asset' && !a.id.startsWith('CxC_') && a.excludeFromLiquidity !== true) {
            liquidNow = round2(liquidNow + round2(currSnap.bals[a.id] || 0));
        }
    });
    if (liquidNow <= 0) return { available: false };

    const safeInfo = computeSafeToSpendToday(currMonthId, currSnap);
    const suggestedAmount = round2(Math.min(rawSurplus, safeInfo.safeToSpend > 0 ? safeInfo.safeToSpend : liquidNow));
    if (suggestedAmount < 5000) return { available: false };

    // Elegir bolsillo sugerido (el más cercano a su meta o el primero activo)
    let targetPocket = null;
    (financeData.pockets || []).forEach(p => {
        const m = computePocketMetrics(p);
        if (!targetPocket) targetPocket = { id: p.id, name: stripLeadingEmoji(p.name) };
        if (m.goal > 0 && m.remaining > 0) {
            const pct = m.balance / m.goal;
            if (!targetPocket.pct || pct > targetPocket.pct) {
                targetPocket = { id: p.id, name: stripLeadingEmoji(p.name), pct };
            }
        }
    });

    // Elegir deuda con mayor tasa efectiva anual si tiene saldos pendientes
    const activeDebts = (financeData.customAccounts || [])
        .filter(a => (a.category === 'credit_card' || a.category === 'debt') && round2(currSnap.bals[a.id] || 0) > 0)
        .map(a => {
            const rawR = parseFloat(a.category === 'debt' ? a.debtRate : a.rate) || 0;
            const rType = a.category === 'debt' ? a.debtRateType : a.rateType;
            const ea = rawR <= 0 ? 0 : (rType === 'monthly' ? (Math.pow(1 + rawR / 100, 12) - 1) * 100 : rawR);
            return { id: a.id, name: stripLeadingEmoji(a.name), bal: round2(currSnap.bals[a.id]), ea };
        })
        .sort((a, b) => b.ea - a.ea || b.bal - a.bal);

    const prevMonthLabel = prevDate.toLocaleDateString('es-CO', { month: 'long' });
    const prevMonthCap = prevMonthLabel.charAt(0).toUpperCase() + prevMonthLabel.slice(1);

    return {
        available: true,
        alertDismissId,
        prevMonthId,
        prevMonthCap,
        rawSurplus,
        suggestedAmount,
        targetPocket,
        topDebt: activeDebts[0] || null
    };
};

// O. Simulador Reducir Plazo vs. Reducir Cuota en Tarjetas y Cupos Rotativos
const simulateExtraPaymentCardOrRevolving = (accountId, extraAmount, refDate = currentDate) => {
    const acc = getAccountObj(accountId);
    if (!acc || (acc.category !== 'credit_card' && acc.debtType !== 'revolving')) {
        return { valid: false };
    }

    const snap = computeBalancesUpTo(getMonthId(refDate));
    const currentBal = Math.max(0, round2(snap.bals[acc.id] || 0));
    const extra = Math.max(0, round2(extraAmount || 0));
    if (currentBal <= 0) {
        return { valid: false, emptyBalance: true };
    }

    const rawItems = acc.category === 'credit_card'
        ? getPendingCardPurchases(acc.id, refDate)
        : getPendingRevolvingPurchases(acc.id);

    const tranches = rawItems.map(p => {
        const isZero = acc.category === 'credit_card'
            ? (!!p.zeroInterest || p.rate <= 0)
            : (p.tx?.zeroInterest ? true : (p.rate <= 0));
        const effRate = isZero ? 0 : (parseFloat(p.rate) || 0);
        const rType = p.rateType || 'monthly';
        const mRate = effRate <= 0 ? 0 : (rType === 'annual' ? (Math.pow(1 + effRate / 100, 1 / 12) - 1) : (effRate / 100));
        return {
            id: String(p.tx.id),
            principal: round2(p.remCapital),
            remInstallments: Math.max(1, parseInt(p.remainingInstallments, 10) || 1),
            rate: effRate,
            rateType: rType,
            mRate,
            currentQuota: round2(p.nextQuota)
        };
    });

    const sumTranchesCap = round2(tranches.reduce((s, t) => s + t.principal, 0));
    const unallocatedCap = Math.max(0, round2(currentBal - sumTranchesCap));

    if (unallocatedCap > 1) {
        const fallbackRate = acc.category === 'debt' ? (parseFloat(acc.debtRate) || 0) : (parseFloat(acc.rate) || 0);
        const fallbackType = acc.category === 'debt' ? (acc.debtRateType || 'annual') : (acc.rateType || 'monthly');
        const mRate = fallbackRate <= 0 ? 0 : (fallbackType === 'annual' ? (Math.pow(1 + fallbackRate / 100, 1 / 12) - 1) : (fallbackRate / 100));
        const fallbackTerm = Math.max(1, parseInt(acc.initialDebtTerm, 10) || (acc.debtTotalQuotes ? Math.max(1, acc.debtTotalQuotes - (acc.debtPaidQuotes || 0)) : 12));
        const customInitQ = round2(acc.initialDebtQuota || acc.debtMonthlyPayment || 0);
        const calcInitQ = calculateAmortization(unallocatedCap, fallbackTerm, fallbackRate, fallbackType).payment;
        tranches.push({
            id: '__base_revolving__',
            principal: unallocatedCap,
            remInstallments: fallbackTerm,
            rate: fallbackRate,
            rateType: fallbackType,
            mRate,
            currentQuota: customInitQ > 0 ? Math.min(round2(unallocatedCap * (1 + mRate)), customInitQ) : calcInitQ
        });
    }

    const simulatePortfolio = (itemsList, mode = 'current') => {
        let maxMonths = 0;
        let totalInterest = 0;
        let firstMonthQuota = 0;

        itemsList.forEach(tr => {
            if (tr.principal <= 0.01) return;

            if (mode === 'reduce_quota') {
                const amort = calculateAmortization(tr.principal, tr.remInstallments, tr.rate, tr.rateType);
                maxMonths = Math.max(maxMonths, tr.remInstallments);
                totalInterest = round2(totalInterest + amort.totalInterest);
                firstMonthQuota = round2(firstMonthQuota + amort.payment);
                return;
            }

            // Modo actual o reducir plazo (manteniendo la cuota mensual vigente de cada compra)
            let bal = tr.principal;
            let months = 0;
            let itemInt = 0;
            const targetQuota = Math.max(
                tr.currentQuota,
                calculateAmortization(tr.principal, tr.remInstallments, tr.rate, tr.rateType).payment
            );
            firstMonthQuota = round2(firstMonthQuota + Math.min(round2(bal * (1 + tr.mRate)), targetQuota));

            while (bal > 0.5 && months < 240) {
                months++;
                const intAmt = round2(bal * tr.mRate);
                itemInt = round2(itemInt + intAmt);
                let capPay = round2(targetQuota - intAmt);
                if (capPay <= 0) {
                    capPay = round2(bal / Math.max(1, tr.remInstallments));
                }
                bal = Math.max(0, round2(bal - Math.min(bal, capPay)));
            }
            maxMonths = Math.max(maxMonths, months);
            totalInterest = round2(totalInterest + itemInt);
        });

        return { months: maxMonths, totalInterest, monthlyQuota: firstMonthQuota };
    };

    const basePlan = simulatePortfolio(tranches, 'current');
    if (extra <= 0) {
        return {
            valid: true,
            currentBal,
            extra: 0,
            hasPromptInput: false,
            basePlan,
            hasInterestBearing: basePlan.totalInterest > 0
        };
    }

    const cappedExtra = Math.min(currentBal, extra);
    const isFullPayoff = cappedExtra >= round2(currentBal - 0.5);

    // Asignar el abono extraordinario priorizando las compras con mayor tasa mensual (Avalancha interna)
    const prioritized = tranches.map(t => ({ ...t })).sort((a, b) => b.mRate - a.mRate || b.principal - a.principal);
    let pool = cappedExtra;
    const preselectedTxIds = [];

    prioritized.forEach(tr => {
        if (pool <= 0) return;
        const applied = Math.min(tr.principal, pool);
        if (applied > 0 && tr.id !== '__base_revolving__') {
            preselectedTxIds.push(tr.id);
        }
        tr.principal = Math.max(0, round2(tr.principal - applied));
        pool = round2(pool - applied);
    });

    const termPlan = isFullPayoff
        ? { months: 0, totalInterest: 0, monthlyQuota: 0 }
        : simulatePortfolio(prioritized, 'reduce_term');
    const quotaPlan = isFullPayoff
        ? { months: 0, totalInterest: 0, monthlyQuota: 0 }
        : simulatePortfolio(prioritized, 'reduce_quota');

    return {
        valid: true,
        hasPromptInput: true,
        currentBal,
        extra: cappedExtra,
        newBalance: Math.max(0, round2(currentBal - cappedExtra)),
        isFullPayoff,
        hasInterestBearing: basePlan.totalInterest > 0,
        preselectedTxIds,
        basePlan,
        termPlan: {
            ...termPlan,
            monthsSaved: Math.max(0, basePlan.months - termPlan.months),
            interestSaved: Math.max(0, round2(basePlan.totalInterest - termPlan.totalInterest))
        },
        quotaPlan: {
            ...quotaPlan,
            quotaSavedMonthly: Math.max(0, round2(basePlan.monthlyQuota - quotaPlan.monthlyQuota)),
            interestSaved: Math.max(0, round2(basePlan.totalInterest - quotaPlan.totalInterest))
        }
    };
};

// P. Comparador Interanual de Nómina y Renta DIAN (Ej. 2026 vs. 2027)
const compareInterannualPayrollAndTax = ({
    baseYear,
    simYear,
    baseParams = null,
    simParams = null,
    salaryConfig = null,
    simBasicSalary = null,
    flowsYear = null
} = {}) => {
    const bYear = parseInt(baseYear, 10) || currentDate.getFullYear();
    const sYear = parseInt(simYear, 10) || (bYear + 1);
    const pBase = { ...getTaxParamsForYear(bYear), ...(baseParams || {}), year: bYear };
    const pSim = { ...getTaxParamsForYear(sYear), ...(simParams || {}), year: sYear };

    const rawSal = salaryConfig || safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    const hasSalary = !!(rawSal && Number(rawSal.basicSalary) > 0);
    const evalFlowYear = parseInt(flowsYear, 10) || bYear;

    let payrollComparison = null;
    let simSalCfg = null;

    if (hasSalary) {
        const baseBasic = round2(rawSal.basicSalary);
        const nextBasic = simBasicSalary !== null && simBasicSalary !== undefined && round2(simBasicSalary) > 0
            ? round2(simBasicSalary)
            : baseBasic;
        simSalCfg = { ...rawSal, basicSalary: nextBasic, lastRaise: null, raiseSchedule: null };
        const cleanBaseCfg = { ...rawSal, lastRaise: null, raiseSchedule: null };

        const mBase = calculateLaborMetrics(cleanBaseCfg, new Date(bYear, 5, 15), pBase);
        const mSim = calculateLaborMetrics(simSalCfg, new Date(sYear, 5, 15), pSim);

        payrollComparison = {
            baseBasic,
            simBasic: nextBasic,
            basicDiff: round2(nextBasic - baseBasic),
            baseTransport: mBase.effectiveTransport,
            simTransport: mSim.effectiveTransport,
            lostTransportAid: mBase.effectiveTransport > 0 && mSim.effectiveTransport === 0,
            gainedTransportAid: mBase.effectiveTransport === 0 && mSim.effectiveTransport > 0,
            baseSS: mBase.incrngo,
            simSS: mSim.incrngo,
            ssDiff: round2(mSim.incrngo - mBase.incrngo),
            crossedFsp: mBase.fsp === 0 && mSim.fsp > 0,
            freedFsp: mBase.fsp > 0 && mSim.fsp === 0,
            baseRet: mBase.ret,
            simRet: mSim.ret,
            retDiff: round2(mSim.ret - mBase.ret),
            baseNet: mBase.net,
            simNet: mSim.net,
            netDiff: round2(mSim.net - mBase.net),
            netDiffAnnual: round2((mSim.net - mBase.net) * 12)
        };
    }

    const rentaBase = checkRentaDeclaration(evalFlowYear, pBase, hasSalary ? { ...rawSal, lastRaise: null, raiseSchedule: null } : null);
    const rentaSim = checkRentaDeclaration(evalFlowYear, pSim, simSalCfg);

    return {
        baseYear: bYear,
        simYear: sYear,
        evalFlowYear,
        pBase,
        pSim,
        uvtDiff: round2(pSim.uvt - pBase.uvt),
        uvtPct: pBase.uvt > 0 ? round2(((pSim.uvt - pBase.uvt) / pBase.uvt) * 100) : 0,
        smmlvDiff: round2(pSim.smmlv - pBase.smmlv),
        smmlvPct: pBase.smmlv > 0 ? round2(((pSim.smmlv - pBase.smmlv) / pBase.smmlv) * 100) : 0,
        hasSalary,
        payroll: payrollComparison,
        renta: {
            patrimonioLimitBase: rentaBase.limits.patrimonio,
            patrimonioLimitSim: rentaSim.limits.patrimonio,
            flowLimitBase: rentaBase.limits.ingresos,
            flowLimitSim: rentaSim.limits.ingresos,
            mustDeclareBase: rentaBase.mustDeclare,
            mustDeclareSim: rentaSim.mustDeclare,
            impuestoBase: rentaBase.taxSimulation.impuestoEstimado,
            impuestoSim: rentaSim.taxSimulation.impuestoEstimado,
            retAnualBase: rentaBase.taxSimulation.retencionesEstimadas,
            retAnualSim: rentaSim.taxSimulation.retencionesEstimadas,
            saldoBase: rentaBase.taxSimulation.saldoAPagar,
            saldoSim: rentaSim.taxSimulation.saldoAPagar,
            saldoDiff: round2(rentaSim.taxSimulation.saldoAPagar - rentaBase.taxSimulation.saldoAPagar)
        }
    };
};

const adjustPocketBalance = (pocketId, delta) => {
    const pocket = financeData.pockets.find(p => String(p.id) === String(pocketId));
    if (!pocket) return;
    const cleanDelta = round2(delta);
    if (cleanDelta >= 0) {
        pocket.principal = round2((pocket.principal || 0) + cleanDelta);
    } else {
        const toDeduct = Math.abs(cleanDelta);
        if (toDeduct <= (pocket.yields || 0)) {
            pocket.yields = round2((pocket.yields || 0) - toDeduct);
        } else {
            const rem = round2(toDeduct - (pocket.yields || 0));
            pocket.yields = 0;
            pocket.principal = Math.max(0, round2((pocket.principal || 0) - rem));
        }
    }
};

// --- MOTOR DE GRAVAMEN A LOS MOVIMIENTOS FINANCIEROS (4x1000 / GMF) ---
const getGmfAccountInfo = (acc, customParams = null) => {
    const params = customParams || getTaxParams();
    const uvt = round2(params.uvt || 52374);

    if (!acc || acc.category !== 'asset' || acc.id === 'Efectivo' || String(acc.id).startsWith('CxC_') || acc.accountSubType === 'cash') {
        return { applies: false, subType: 'cash', isExempt: true, monthlyCapCop: 0, capUvt: 0, needsSetup: false, label: 'Efectivo (Sin 4x1000)' };
    }

    const subType = acc.accountSubType || 'unconfigured';
    const isMarked350 = !!acc.gmfExempt;

    if (subType === 'wallet') {
        const capUvt = isMarked350 ? 350 : 65;
        return {
            applies: true,
            subType: 'wallet',
            isExempt: true,
            capUvt,
            monthlyCapCop: round2(capUvt * uvt),
            needsSetup: false,
            label: isMarked350 ? 'Billetera / Ahorros Exenta (350 UVT)' : 'Billetera / Bajo Monto (65 UVT)'
        };
    }

    if (subType === 'checking') {
        return {
            applies: true,
            subType: 'checking',
            isExempt: false,
            capUvt: 0,
            monthlyCapCop: 0,
            needsSetup: false,
            label: 'Cuenta Corriente (Grava 4x1000)'
        };
    }

    // 'savings' o cuenta bancaria previa a la actualización ('unconfigured')
    const capUvt = isMarked350 ? 350 : 0;
    return {
        applies: true,
        subType: subType === 'unconfigured' ? 'savings' : subType,
        isExempt: isMarked350,
        capUvt,
        monthlyCapCop: round2(capUvt * uvt),
        needsSetup: !acc.accountSubType,
        label: isMarked350 ? 'Ahorros Exenta (350 UVT)' : 'Ahorros (Grava 4x1000)'
    };
};

const getMonthlyGmfUsedOutflows = (accountId, monthId, excludeTxId = null) => {
    let used = 0;
    (financeData.transactions || []).forEach(t => {
        if (t.isDeleted || t.isAdjustment || t.isGmfTax) return;
        if (t.isSharedTrip && t.paidBy === 'companion') return;
        if (excludeTxId && String(t.id) === String(excludeTxId)) return;
        if (getTxMonthId(t) !== monthId || !isTxClosed(t)) return;

        if (t.type === 'expense' && t.account === accountId) {
            used = round2(used + round2(t.amount));
        } else if (t.type === 'transfer' && t.account === accountId && !t.isSameBankTransfer) {
            used = round2(used + round2(t.amount));
        }
    });
    return used;
};

const calculateTransactionGmf = ({ accountId, amount, type, toAccountId = '', isSameBank = false, dateObj = new Date(), excludeTxId = null }) => {
    const cleanAmt = Math.max(0, round2(amount || 0));
    if (cleanAmt <= 0 || (type !== 'expense' && type !== 'transfer')) {
        return { applies: false, gmfAmount: 0, taxableAmount: 0, remainingCapAfter: 0, monthlyCapCop: 0, usedThisMonth: 0, isExempt: true, needsSetup: false };
    }

    if (type === 'transfer' && isSameBank) {
        return { applies: false, gmfAmount: 0, taxableAmount: 0, remainingCapAfter: 0, monthlyCapCop: 0, usedThisMonth: 0, isExempt: true, needsSetup: false, sameBankExempt: true };
    }

    const acc = getAccountObj(accountId);
    const info = getGmfAccountInfo(acc);
    if (!info.applies) {
        return { applies: false, gmfAmount: 0, taxableAmount: 0, remainingCapAfter: 0, monthlyCapCop: 0, usedThisMonth: 0, isExempt: true, needsSetup: false };
    }

    const mId = getMonthId(dateObj);
    const usedThisMonth = getMonthlyGmfUsedOutflows(accountId, mId, excludeTxId);
    const remainingCapBefore = Math.max(0, round2(info.monthlyCapCop - usedThisMonth));
    const taxableAmount = Math.max(0, round2(cleanAmt - remainingCapBefore));
    const gmfAmount = round2(taxableAmount * 0.004);
    const remainingCapAfter = Math.max(0, round2(remainingCapBefore - cleanAmt));

    return {
        applies: true,
        subType: info.subType,
        isExempt: info.isExempt,
        needsSetup: info.needsSetup,
        capUvt: info.capUvt,
        monthlyCapCop: info.monthlyCapCop,
        usedThisMonth,
        remainingCapBefore,
        remainingCapAfter,
        taxableAmount,
        gmfAmount
    };
};

const hasAnyGmfConfiguredAccount = () => {
    const bankAssets = (financeData.customAccounts || []).filter(
        a => a.category === 'asset' && a.id !== 'Efectivo' && !String(a.id).startsWith('CxC_') && a.accountSubType !== 'cash'
    );
    if (bankAssets.length === 0) return true;
    return bankAssets.some(a => !!a.gmfExempt || !!a.gmfReviewed);
};

const computeBalancesUpTo = (targetMonthId) => {
    const bals = {};
    financeData.customAccounts.forEach(acc => {
        bals[acc.id] = 0;
    });
    if (financeData.pockets) {
        financeData.pockets.forEach(p => {
            bals[p.id] = round2((p.principal || 0) + (p.yields || 0));
        });
    }

    financeData.transactions.forEach(t => {
        if (!t.isDeleted && getTxMonthId(t) <= targetMonthId && isTxClosed(t)) {
            // Si es un gasto compartido pagado por el acompañante, NO afecta mis saldos locales
            if (t.isSharedTrip && t.paidBy === 'companion') return;

            const accObj = getAccountObj(t.account);
            const toAccObj = t.toAccount ? getAccountObj(t.toAccount) : null;
            const amt = round2(t.amount);

            if (t.type === 'income') {
                if (accObj.category !== 'pocket') {
                    if (isLiabilityCategory(accObj.category)) {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] - amt);
                    } else {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] + amt);
                    }
                }
            } else if (t.type === 'expense') {
                if (accObj.category !== 'pocket') {
                    if (isLiabilityCategory(accObj.category)) {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] + amt);
                    } else {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] - amt);
                    }
                }
            } else if (t.type === 'transfer') {
                if (accObj.category !== 'pocket') {
                    if (isLiabilityCategory(accObj.category)) {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] + amt);
                    } else {
                        if (bals[t.account] !== undefined) bals[t.account] = round2(bals[t.account] - amt);
                    }
                }
                if (toAccObj && toAccObj.category !== 'pocket') {
                    if (isLiabilityCategory(toAccObj.category)) {
                        if (bals[t.toAccount] !== undefined) bals[t.toAccount] = round2(bals[t.toAccount] - amt);
                    } else {
                        if (bals[t.toAccount] !== undefined) bals[t.toAccount] = round2(bals[t.toAccount] + amt);
                    }
                }
            }
        }
    });

let assetsTotal = 0, cxcTotal = 0, cardsTotal = 0, debtsTotal = 0, fixedAssetsTotal = 0, visibleFixedAssetsTotal = 0, pocketsTotal = 0;

    financeData.customAccounts.forEach(acc => {
        const b = round2(bals[acc.id] || 0);
        if (acc.category === 'credit_card') {
            cardsTotal = round2(cardsTotal + b);
        } else if (acc.category === 'debt') {
            debtsTotal = round2(debtsTotal + b);
        } else {
            if (acc.id.startsWith('CxC_')) {
                cxcTotal = round2(cxcTotal + b);
            } else {
                assetsTotal = round2(assetsTotal + b);
            }
        }
    });

    if (financeData.fixedAssets) {
        financeData.fixedAssets.forEach(fa => {
            if (fa.status === 'active') {
                fixedAssetsTotal = round2(fixedAssetsTotal + fa.currentValue);
                if (fa.showInBalance !== false) {
                    visibleFixedAssetsTotal = round2(visibleFixedAssetsTotal + fa.currentValue);
                }
            }
        });
    }

    let allPocketsTotal = 0;
    if (financeData.pockets) {
        financeData.pockets.forEach(p => {
            const pBal = round2(p.principal || 0) + round2(p.yields || 0);
            allPocketsTotal = round2(allPocketsTotal + pBal);
            if (!p.excludeFromBalance) {
                pocketsTotal = round2(pocketsTotal + pBal);
            }
        });
    }

    const liabilitiesTotal = round2(cardsTotal + debtsTotal);
const netWorth = round2(assetsTotal + cxcTotal + visibleFixedAssetsTotal + pocketsTotal - liabilitiesTotal);

    return {
        bals,
        assetsTotal,
        cxcTotal,
        cardsTotal,
        debtsTotal,
        liabilitiesTotal,
        fixedAssetsTotal,
        visibleFixedAssetsTotal,
        pocketsTotal,
        allPocketsTotal,
        netWorth
    };
};

// --- FASE 5A: HOJA DE BALANCE HISTÓRICA POR FECHA EXACTA (YYYY-MM-DD) ---
const toLocalIsoDateStr = (d = new Date()) => {
    const dt = (d instanceof Date && !Number.isNaN(d.getTime())) ? d : new Date();
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const computeBalancesUpToDate = (targetDateStr) => {
    const todayStr = toLocalIsoDateStr(new Date());
    const cleanDateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(targetDateStr || ''))
        ? String(targetDateStr)
        : todayStr;

    const bals = {};
    financeData.customAccounts.forEach(acc => { bals[acc.id] = 0; });

    const pocketBals = {};
    const unbornPockets = new Set();
    if (financeData.pockets) {
        financeData.pockets.forEach(p => {
            if (p.startDate && /^\d{4}-\d{2}-\d{2}$/.test(p.startDate) && p.startDate > cleanDateStr) {
                pocketBals[p.id] = 0;
                unbornPockets.add(String(p.id));
            } else {
                pocketBals[p.id] = round2((p.principal || 0) + (p.yields || 0));
            }
        });
    }

    financeData.transactions.forEach(t => {
        if (t.isDeleted || !isTxClosed(t)) return;
        if (t.isSharedTrip && t.paidBy === 'companion') return;

        const txDateStr = toLocalIsoDateStr(getTxEffectiveDateObj(t, currentDate));
        const accObj = getAccountObj(t.account);
        const toAccObj = t.toAccount ? getAccountObj(t.toAccount) : null;
        const amt = round2(t.amount);

        // 1. Cuentas de activos, tarjetas, deudas y CxC: acumular todo hasta <= targetDateStr
        if (txDateStr <= cleanDateStr) {
            if (t.type === 'income') {
                if (accObj.category !== 'pocket' && bals[t.account] !== undefined) {
                    bals[t.account] = isLiabilityCategory(accObj.category)
                        ? round2(bals[t.account] - amt)
                        : round2(bals[t.account] + amt);
                }
            } else if (t.type === 'expense') {
                if (accObj.category !== 'pocket' && bals[t.account] !== undefined) {
                    bals[t.account] = isLiabilityCategory(accObj.category)
                        ? round2(bals[t.account] + amt)
                        : round2(bals[t.account] - amt);
                }
            } else if (t.type === 'transfer') {
                if (accObj.category !== 'pocket' && bals[t.account] !== undefined) {
                    bals[t.account] = isLiabilityCategory(accObj.category)
                        ? round2(bals[t.account] + amt)
                        : round2(bals[t.account] - amt);
                }
                if (toAccObj && toAccObj.category !== 'pocket' && bals[t.toAccount] !== undefined) {
                    bals[t.toAccount] = isLiabilityCategory(toAccObj.category)
                        ? round2(bals[t.toAccount] - amt)
                        : round2(bals[t.toAccount] + amt);
                }
            }
        }

        // 2. Bolsillos: revertir movimientos posteriores a targetDateStr para reconstruir su saldo ese día
        if (txDateStr > cleanDateStr) {
            if (t.type === 'transfer') {
                if (accObj.category === 'pocket' && pocketBals[t.account] !== undefined && !unbornPockets.has(String(t.account))) {
                    pocketBals[t.account] = round2(pocketBals[t.account] + amt);
                }
                if (toAccObj && toAccObj.category === 'pocket' && pocketBals[t.toAccount] !== undefined && !unbornPockets.has(String(t.toAccount))) {
                    pocketBals[t.toAccount] = Math.max(0, round2(pocketBals[t.toAccount] - amt));
                }
            } else if (accObj.category === 'pocket' && pocketBals[t.account] !== undefined && !unbornPockets.has(String(t.account))) {
                if (t.type === 'income') pocketBals[t.account] = Math.max(0, round2(pocketBals[t.account] - amt));
                else if (t.type === 'expense') pocketBals[t.account] = round2(pocketBals[t.account] + amt);
            }
        }
    });

    Object.keys(pocketBals).forEach(pid => {
        bals[pid] = Math.max(0, round2(pocketBals[pid]));
    });

    let assetsTotal = 0, cxcTotal = 0, cardsTotal = 0, debtsTotal = 0;
    let fixedAssetsTotal = 0, visibleFixedAssetsTotal = 0, pocketsTotal = 0, allPocketsTotal = 0;

    financeData.customAccounts.forEach(acc => {
        const b = round2(bals[acc.id] || 0);
        if (acc.category === 'credit_card') cardsTotal = round2(cardsTotal + b);
        else if (acc.category === 'debt') debtsTotal = round2(debtsTotal + b);
        else if (acc.id.startsWith('CxC_')) cxcTotal = round2(cxcTotal + b);
        else assetsTotal = round2(assetsTotal + b);
    });

    if (financeData.fixedAssets) {
        financeData.fixedAssets.forEach(fa => {
            if (fa.status !== 'active') return;
            if (fa.purchaseDate && /^\d{4}-\d{2}-\d{2}$/.test(fa.purchaseDate) && fa.purchaseDate > cleanDateStr) return;
            fixedAssetsTotal = round2(fixedAssetsTotal + round2(fa.currentValue || 0));
            if (fa.showInBalance !== false) {
                visibleFixedAssetsTotal = round2(visibleFixedAssetsTotal + round2(fa.currentValue || 0));
            }
        });
    }

    if (financeData.pockets) {
        financeData.pockets.forEach(p => {
            const pBal = Math.max(0, round2(pocketBals[p.id] || 0));
            allPocketsTotal = round2(allPocketsTotal + pBal);
            if (!p.excludeFromBalance) pocketsTotal = round2(pocketsTotal + pBal);
        });
    }

    const liabilitiesTotal = round2(cardsTotal + debtsTotal);
    const netWorth = round2(assetsTotal + cxcTotal + visibleFixedAssetsTotal + pocketsTotal - liabilitiesTotal);

    return {
        dateStr: cleanDateStr,
        bals,
        assetsTotal,
        cxcTotal,
        cardsTotal,
        debtsTotal,
        liabilitiesTotal,
        fixedAssetsTotal,
        visibleFixedAssetsTotal,
        pocketsTotal,
        allPocketsTotal,
        netWorth
    };
};

// --- MOTOR DE CALENDARIO HÁBIL COLOMBIA (LEY EMILIANI + PASCUA, 100% OFFLINE) ---
const _colombianHolidaysCache = new Map();

const getColombianHolidaysSet = (rawYear) => {
    const year = parseInt(rawYear, 10) || new Date().getFullYear();
    if (_colombianHolidaysCache.has(year)) return _colombianHolidaysCache.get(year);

    const set = new Set();
    const fmtKey = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const addFixed = (mIdx, d) => set.add(fmtKey(new Date(year, mIdx, d)));
    const addEmiliani = (mIdx, d) => {
        const dt = new Date(year, mIdx, d);
        const shift = (8 - dt.getDay()) % 7;
        dt.setDate(dt.getDate() + shift);
        set.add(fmtKey(dt));
    };

    // 1. Festivos inamovibles
    addFixed(0, 1);   // Año Nuevo
    addFixed(4, 1);   // Día del Trabajo
    addFixed(6, 20);  // Independencia
    addFixed(7, 7);   // Batalla de Boyacá
    addFixed(11, 8);  // Inmaculada Concepción
    addFixed(11, 25); // Navidad

    // 2. Festivos Ley Emiliani (se trasladan al siguiente lunes si no caen lunes)
    addEmiliani(0, 6);   // Reyes Magos
    addEmiliani(2, 19);  // San José
    addEmiliani(5, 29);  // San Pedro y San Pablo
    addEmiliani(7, 15);  // Asunción de la Virgen
    addEmiliani(9, 12);  // Día de la Raza
    addEmiliani(10, 1);  // Todos los Santos
    addEmiliani(10, 11); // Independencia de Cartagena

    // 3. Festivos móviles respecto al Domingo de Pascua (Meeus/Jones/Butcher)
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easterMonth = Math.floor((h + l - 7 * m + 114) / 31) - 1;
    const easterDay = ((h + l - 7 * m + 114) % 31) + 1;

    const addEasterOffset = (offsetDays) => {
        const dt = new Date(year, easterMonth, easterDay + offsetDays);
        set.add(fmtKey(dt));
    };
    addEasterOffset(-3); // Jueves Santo
    addEasterOffset(-2); // Viernes Santo
    addEasterOffset(43); // Ascensión del Señor (lunes Emiliani)
    addEasterOffset(64); // Corpus Christi (lunes Emiliani)
    addEasterOffset(71); // Sagrado Corazón (lunes Emiliani)

    if (_colombianHolidaysCache.size > 20) _colombianHolidaysCache.clear();
    _colombianHolidaysCache.set(year, set);
    return set;
};

const isColombianBusinessDay = (year, monthIdx, day) => {
    const dt = new Date(year, monthIdx, day);
    const dow = dt.getDay();
    if (dow === 0 || dow === 6) return false;
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    return !getColombianHolidaysSet(dt.getFullYear()).has(key);
};

const getNthLastBusinessDayCol = (year, monthIdx, nthFromEnd = 1) => {
    const norm = new Date(year, monthIdx, 1);
    const y = norm.getFullYear();
    const m = norm.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const targetCount = Math.max(1, Math.min(10, parseInt(nthFromEnd, 10) || 1));
    let found = 0;

    for (let day = lastDay; day >= 1; day--) {
        if (isColombianBusinessDay(y, m, day)) {
            found++;
            if (found === targetCount) return day;
        }
    }
    return 1;
};

const getResolvedSalaryPayDays = (config = {}, year = currentDate.getFullYear(), monthIdx = currentDate.getMonth()) => {
    const norm = new Date(year, monthIdx, 1);
    const y = norm.getFullYear();
    const m = norm.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const clampDay = (d, fallback) => {
        const n = parseInt(d, 10);
        const safe = Number.isFinite(n) && n >= 1 ? Math.min(31, n) : fallback;
        return Math.min(safe, lastDay);
    };
    const isBiweekly = config?.frequency === 'biweekly';
    const mode = String(config?.payDay || '30');

    if (mode === 'custom') {
        if (isBiweekly) {
            let d1 = clampDay(config.customPayDay1, 15);
            let d2 = clampDay(config.customPayDay2, 30);
            if (d1 === d2) d2 = d1 < lastDay ? d1 + 1 : Math.max(1, d1 - 1);
            return d1 < d2 ? [d1, d2] : [d2, d1];
        }
        return [clampDay(config.customPayDay1, 30)];
    }
    if (mode === 'last') {
        return isBiweekly ? [Math.min(15, lastDay), lastDay] : [lastDay];
    }
    if (mode === 'penultimate') {
        const penDay = getNthLastBusinessDayCol(y, m, 2);
        return isBiweekly ? [Math.min(15, penDay), penDay] : [penDay];
    }
    if (mode === 'antepenultimate') {
        const anteDay = getNthLastBusinessDayCol(y, m, 3);
        return isBiweekly ? [Math.min(15, anteDay), anteDay] : [anteDay];
    }
    return isBiweekly ? [Math.min(15, lastDay), Math.min(30, lastDay)] : [Math.min(30, lastDay)];
};
globalThis.getResolvedSalaryPayDays = getResolvedSalaryPayDays;
globalThis.isColombianBusinessDay = isColombianBusinessDay;

// --- FASE 5B: MARGEN DIARIO DINÁMICO HASTA PRÓXIMA NÓMINA ---
const computeDailyMarginUntilNextPayday = (monthId, currSnap, refDate = currentDate) => {
    const base = computeSafeToSpendToday(monthId, currSnap);
    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const y = today.getFullYear();
    const m = today.getMonth();
    const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    const hasSalaryConfig = !!(salCfg && Number(salCfg.basicSalary) > 0);

    let targetDate = new Date(y, m + 1, 0);
    let targetLabel = 'fin de mes';

    if (hasSalaryConfig) {
        const candidates = [];
        for (let off = 0; off <= 2; off++) {
            const probe = new Date(y, m + off, 1);
            const py = probe.getFullYear();
            const pm = probe.getMonth();
            const daysInPm = new Date(py, pm + 1, 0).getDate();
            const pMonthId = `${py}-${String(pm + 1).padStart(2, '0')}`;
            const pStatus = typeof getPayrollMonthStatus === 'function' ? getPayrollMonthStatus(pMonthId, salCfg) : null;
            const resolvedDays = getResolvedSalaryPayDays(salCfg, py, pm);

            resolvedDays.forEach((dayNum, idx) => {
                const isSlotPaid = pStatus && pStatus.hasSalary
                    ? (pStatus.isBiweekly ? (idx === 0 ? pStatus.paid1Q : pStatus.paid2Q) : pStatus.paidMonthly)
                    : false;
                if (isSlotPaid) return;
                const dObj = new Date(py, pm, Math.min(dayNum, daysInPm));
                if (dObj >= new Date(y, m, 1)) candidates.push(dObj);
            });
            if (candidates.length > 0) break;
        }
        candidates.sort((a, b) => a - b);
        if (candidates.length > 0) {
            targetDate = candidates[0];
            targetLabel = `tu nómina (${targetDate.getDate()} ${getShortMonthLabel(targetDate).toLowerCase()}.)`;
        }
    }

    const rawDiffDays = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
    const isPaydayToday = hasSalaryConfig && rawDiffDays === 0;
    const isPaydayOverdue = hasSalaryConfig && rawDiffDays < 0;
    const targetShortDate = `${targetDate.getDate()} ${getShortMonthLabel(targetDate).toLowerCase()}.`;
    const daysUntil = Math.max(1, rawDiffDays);
    const dailyAllowance = base.safeToSpend > 0 ? round2(base.safeToSpend / daysUntil) : 0;

    return {
        ...base,
        hasSalaryConfig,
        isPaydayToday,
        isPaydayOverdue,
        targetShortDate,
        daysUntil,
        dailyAllowance,
        targetDateStr: targetDate.toLocaleDateString('en-CA'),
        targetLabel
    };
};

// --- FASE 5C: REBALANCEO DE PRESUPUESTO ("CUBRIR SOBREGIRO") ---
const getMonthlyBudgetRebalanceCandidates = (monthId) => {
    const [yStr, mStr] = String(monthId || getMonthId(viewDate)).split('-');
    const year = parseInt(yStr, 10) || currentDate.getFullYear();
    const mIdx = Math.max(0, Math.min(11, (parseInt(mStr, 10) || 1) - 1));

    const overBudgetCats = [];
    const donorCats = [];

    (financeData.categories?.expense || []).forEach(catObj => {
        if (catObj.isArchived) return;
        const limit = getCategoryLimitForMonth(catObj, mIdx, year);
        if (limit <= 0) return;

        let rawSpent = 0;
        let refOffset = 0;
        financeData.transactions.forEach(t => {
            if (t.isDeleted || t.isTripIsolated || (t.isSharedTrip && t.paidBy === 'companion') || t.isAdjustment || !isTxClosed(t)) return;
            if (getTxMonthId(t) !== monthId) return;
            if (t.type === 'expense' && t.category === catObj.name) {
                rawSpent = round2(rawSpent + round2(t.amount));
            } else if (t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name) {
                refOffset = round2(refOffset + round2(t.amount));
            }
        });

        const spent = Math.max(0, round2(rawSpent - refOffset));
        const diff = round2(spent - limit);
        const entry = {
            name: catObj.name,
            label: typeof cleanCatName === 'function' ? cleanCatName(catObj.name) : stripLeadingEmoji(catObj.name),
            limit,
            spent,
            overrun: Math.max(0, diff),
            surplus: Math.max(0, round2(limit - spent))
        };

        if (entry.overrun > 0.01) overBudgetCats.push(entry);
        else if (entry.surplus >= 1000) donorCats.push(entry);
    });

    overBudgetCats.sort((a, b) => b.overrun - a.overrun);
    donorCats.sort((a, b) => b.surplus - a.surplus);
    return { year, mIdx, monthId, overBudgetCats, donorCats };
};

const applyBudgetRebalanceForMonth = ({ fromCatName, toCatName, amount, year, monthIndex }) => {
    const amt = round2(amount || 0);
    if (!fromCatName || !toCatName || fromCatName === toCatName || amt <= 0) {
        return { success: false, reason: 'Datos inválidos para rebalancear.' };
    }

    const yr = parseInt(year, 10) || currentDate.getFullYear();
    const mIdx = Math.max(0, Math.min(11, parseInt(monthIndex, 10) || 0));

    const ensureMonthlyArrayForCat = (catName) => {
        if (!financeData.categoryBudgets) financeData.categoryBudgets = {};
        const catObj = (financeData.categories?.expense || []).find(c => c.name === catName);
        const existing = typeof resolveCategoryYearBudget === 'function'
            ? resolveCategoryYearBudget(catName, yr)
            : financeData.categoryBudgets[catName];

        let monthsArr = Array(12).fill(0);
        if (existing && typeof existing === 'object' && existing.isMonthly && Array.isArray(existing.months)) {
            monthsArr = existing.months.map(v => round2(v || 0));
        } else {
            const baseVal = typeof existing === 'number'
                ? round2(existing)
                : round2(existing?.general || (catObj ? getCategoryLimitForMonth(catObj, mIdx, yr) : 0));
            monthsArr = Array(12).fill(baseVal);
        }
        return { monthsArr, generalVal: monthsArr[mIdx] || 0 };
    };

    const saveCatMonthlyForYear = (catName, monthsArr, generalVal) => {
        const curEntry = financeData.categoryBudgets[catName];
        const nextYearObj = { isMonthly: true, general: round2(generalVal), months: monthsArr };
        if (curEntry && typeof curEntry === 'object' && curEntry.byYear) {
            curEntry.byYear[yr] = nextYearObj;
            if (yr === currentDate.getFullYear()) {
                curEntry.isMonthly = true;
                curEntry.months = [...monthsArr];
            }
        } else {
            const prevYearFallback = (typeof curEntry === 'number' || (curEntry && !curEntry.byYear)) ? curEntry : null;
            financeData.categoryBudgets[catName] = {
                isMonthly: true,
                general: round2(generalVal),
                months: [...monthsArr],
                byYear: {
                    ...(prevYearFallback ? { [currentDate.getFullYear()]: prevYearFallback } : {}),
                    [yr]: nextYearObj
                }
            };
        }
    };

    const fromData = ensureMonthlyArrayForCat(fromCatName);
    const toData = ensureMonthlyArrayForCat(toCatName);

    if (fromData.monthsArr[mIdx] < amt) {
        return { success: false, reason: 'La categoría origen no tiene suficiente cupo en este mes.' };
    }

    fromData.monthsArr[mIdx] = Math.max(0, round2(fromData.monthsArr[mIdx] - amt));
    toData.monthsArr[mIdx] = round2(toData.monthsArr[mIdx] + amt);

    saveCatMonthlyForYear(fromCatName, fromData.monthsArr, fromData.generalVal);
    saveCatMonthlyForYear(toCatName, toData.monthsArr, toData.generalVal);

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    return { success: true, amount: amt };
};

// --- FASE 5D: BUSCADOR DE AÑOS ARCHIVADOS EN SOLO LECTURA (INDEXEDDB) ---
const searchArchivedTransactions = async ({ query = '', year = 'all', type = 'all' } = {}) => {
    const allArchived = await getArchivedTransactions(null);
    const yearsSet = new Set();
    allArchived.forEach(t => {
        const yStr = String(getTxMonthId(t) || '').slice(0, 4);
        if (/^\d{4}$/.test(yStr)) yearsSet.add(yStr);
    });
    const yearsAvailable = Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));

    const q = String(query || '').trim().toLowerCase();
    const filtered = allArchived.filter(t => {
        if (year !== 'all' && !String(getTxMonthId(t) || '').startsWith(`${year}-`)) return false;
        if (type !== 'all' && t.type !== type) return false;
        if (!q) return true;

        const accName = stripLeadingEmoji(getAccountObj(t.account).name || '');
        const tagsStr = Array.isArray(t.tags) ? t.tags.map(tg => `#${tg}`).join(' ') : '';
        const haystack = `${t.description || ''} ${t.category || ''} ${t.subcategory || ''} ${accName} ${tagsStr} ${t.date || ''} ${t.amount || ''}`.toLowerCase();
        return haystack.includes(q);
    }).sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    let totalIn = 0;
    let totalOut = 0;
    filtered.forEach(t => {
        const amt = round2(t.amount || 0);
        if (t.type === 'income') totalIn = round2(totalIn + amt);
        else if (t.type === 'expense') totalOut = round2(totalOut + amt);
    });

    return {
        totalArchivedCount: allArchived.length,
        totalFound: filtered.length,
        totalIn,
        totalOut,
        yearsAvailable,
        items: filtered.slice(0, 120)
    };
};

// --- FASE 6A: SIMULADOR DE COMPRA DE CARTERA CON DEUDAS REALES ---
const getRefinanceEligibleDebts = (monthId = getMonthId(currentDate)) => {
    const snap = computeBalancesUpTo(monthId);
    return (financeData.customAccounts || [])
        .filter(a => (a.category === 'credit_card' || a.category === 'debt') && round2(snap.bals[a.id] || 0) > 0)
        .map(a => {
            const bal = round2(snap.bals[a.id] || 0);
            let mRateDec = 0;
            let currentQuota = 0;
            let estMonths = 12;
            let estFutureInterest = 0;

            if (a.category === 'credit_card') {
                const rawR = parseFloat(a.rate) || 0;
                mRateDec = rawR > 0
                    ? (a.rateType === 'annual' ? (Math.pow(1 + rawR / 100, 1 / 12) - 1) : (rawR / 100))
                    : 0;
                const est = calculateCardMinPaymentEstimate(a, bal);
                currentQuota = round2(est.totalMinPayment > 0 ? est.totalMinPayment : Math.max(round2(bal / 12), round2(bal * mRateDec * 1.25)));

                const pending = getPendingCardPurchases(a.id);
                if (pending.length > 0 && mRateDec <= 0) {
                    const maxP = Math.max(...pending.map(p => {
                        const r = parseFloat(p.rate) || 0;
                        return r > 0 ? (p.rateType === 'annual' ? (Math.pow(1 + r / 100, 1 / 12) - 1) : (r / 100)) : 0;
                    }));
                    if (maxP > 0) mRateDec = maxP;
                }

                // Simular costo futuro real bajo la cuota actual (sin contar cuota de manejo)
                const serviceQuota = Math.max(round2((est.deferredQuota || 0) + (est.initialQuotaApplied || 0)), round2(bal * mRateDec + bal / 36));
                let simBal = bal, m = 0, totInt = 0;
                while (simBal > 1 && m < 120) {
                    m++;
                    const intM = round2(simBal * mRateDec);
                    totInt = round2(totInt + intM);
                    const capPay = Math.max(round2(bal / 60), round2(serviceQuota - intM));
                    simBal = Math.max(0, round2(simBal - Math.min(simBal, capPay)));
                }
                estMonths = Math.max(1, m);
                estFutureInterest = totInt;
            } else {
                const rawR = parseFloat(a.debtRate) || 0;
                mRateDec = rawR > 0
                    ? (a.debtRateType === 'annual' ? (Math.pow(1 + rawR / 100, 1 / 12) - 1) : (rawR / 100))
                    : 0;
                const qInfo = getDebtMonthlyQuotaBreakdown(a, bal);
                currentQuota = round2(qInfo.totalQuota > 0 ? qInfo.totalQuota : (a.debtMonthlyPayment || round2(bal / Math.max(1, (a.debtTotalQuotes || 12) - (a.debtPaidQuotes || 0)))));

                if (a.debtType === 'revolving' && mRateDec <= 0 && qInfo.subPurchases.length > 0) {
                    const maxP = Math.max(...qInfo.subPurchases.map(p => {
                        const r = parseFloat(p.rate) || 0;
                        return r > 0 ? (p.rateType === 'annual' ? (Math.pow(1 + r / 100, 1 / 12) - 1) : (r / 100)) : 0;
                    }));
                    if (maxP > 0) mRateDec = maxP;
                }

                const remQuotes = a.debtType !== 'revolving'
                    ? Math.max(1, (parseInt(a.debtTotalQuotes, 10) || 12) - (parseInt(a.debtPaidQuotes, 10) || 0))
                    : 18;
                let simBal = bal, m = 0, totInt = 0;
                const safeQ = Math.max(currentQuota, round2(bal * mRateDec + bal / Math.max(1, remQuotes)));
                while (simBal > 1 && m < 240) {
                    m++;
                    const intM = round2(simBal * mRateDec);
                    totInt = round2(totInt + intM);
                    const capPay = Math.max(1, round2(safeQ - intM));
                    simBal = Math.max(0, round2(simBal - Math.min(simBal, capPay)));
                }
                estMonths = Math.max(1, m);
                estFutureInterest = totInt;
            }

            const eaRate = mRateDec > 0 ? round2((Math.pow(1 + mRateDec, 12) - 1) * 100) : 0;
            return {
                id: a.id,
                name: stripLeadingEmoji(a.name),
                category: a.category,
                debtType: a.debtType || (a.category === 'credit_card' ? 'credit_card' : 'fixed'),
                balance: bal,
                monthlyRatePct: round2(mRateDec * 100),
                eaRate,
                currentQuota,
                estMonths,
                estFutureInterest
            };
        })
        .sort((a, b) => b.eaRate - a.eaRate || b.balance - a.balance);
};

const simulatePortfolioBuyout = ({
    selectedIds = [],
    newRate = 0,
    newRateType = 'annual',
    newMonths = 24,
    monthlyInsurance = 0,
    originationFee = 0,
    monthId = getMonthId(currentDate)
} = {}) => {
    const allDebts = getRefinanceEligibleDebts(monthId);
    const idSet = new Set((selectedIds || []).map(String));
    const chosen = allDebts.filter(d => idSet.has(String(d.id)));

    if (chosen.length === 0) {
        return { valid: false, reason: 'Selecciona al menos una tarjeta o préstamo con saldo.' };
    }

    const totalBalance = round2(chosen.reduce((s, d) => s + d.balance, 0));
    const currentMonthlyQuota = round2(chosen.reduce((s, d) => s + d.currentQuota, 0));
    const currentTotalInterest = round2(chosen.reduce((s, d) => s + d.estFutureInterest, 0));
    const currentMaxMonths = Math.max(...chosen.map(d => d.estMonths), 1);
    const weightedCurrentEA = totalBalance > 0
        ? round2(chosen.reduce((s, d) => s + (d.eaRate * d.balance), 0) / totalBalance)
        : 0;

    const months = Math.max(1, Math.min(180, parseInt(newMonths, 10) || 24));
    const rateVal = Math.max(0, parseFloat(newRate) || 0);
    const insMonth = Math.max(0, round2(monthlyInsurance || 0));
    const feeUpfront = Math.max(0, round2(originationFee || 0));

    const newAmort = calculateAmortization(totalBalance, months, rateVal, newRateType);
    const newEA = rateVal > 0
        ? (newRateType === 'annual' ? round2(rateVal) : round2((Math.pow(1 + rateVal / 100, 12) - 1) * 100))
        : 0;

    const newBaseQuota = round2(newAmort.payment);
    const newMonthlyQuota = round2(newBaseQuota + insMonth);
    const newTotalInterest = round2(newAmort.totalInterest);
    const newTotalInsurance = round2(insMonth * months);
    const newExtraCosts = round2(newTotalInsurance + feeUpfront);
    const newTotalCost = round2(totalBalance + newTotalInterest + newExtraCosts);
    const currentTotalCost = round2(totalBalance + currentTotalInterest);

    const monthlyCashflowSavings = round2(currentMonthlyQuota - newMonthlyQuota);
    const totalCostSavings = round2(currentTotalCost - newTotalCost);

    let verdict = 'not_recommended';
    if (totalCostSavings > 0 && monthlyCashflowSavings >= 0) verdict = 'ideal';
    else if (totalCostSavings > 0) verdict = 'cheaper_higher_quota';
    else if (monthlyCashflowSavings > 0) verdict = 'cashflow_only';

    return {
        valid: true,
        selectedCount: chosen.length,
        chosen,
        totalBalance,
        weightedCurrentEA,
        newEA,
        newMonths: months,
        currentMaxMonths,
        currentMonthlyQuota,
        newBaseQuota,
        newMonthlyQuota,
        currentTotalInterest,
        newTotalInterest,
        newExtraCosts,
        currentTotalCost,
        newTotalCost,
        monthlyCashflowSavings,
        totalCostSavings,
        verdict
    };
};

// --- FASE 6B: AGENDA ANUAL EN ACTIVOS FIJOS (SOAT, TECNO, PREDIAL, VEHICULAR) ---
const computeAssetObligationMetrics = (ob, refDate = currentDate) => {
    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const amt = Math.max(0, round2(ob?.estimatedAmount || 0));
    const discPct = Math.max(0, Math.min(50, parseFloat(ob?.discountPct) || 0));
    const discAmount = discPct > 0 ? round2(amt * (1 - discPct / 100)) : amt;
    const discSaving = round2(amt - discAmount);

    const parseYmd = (str) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(str || ''))) return null;
        const [y, m, d] = String(str).split('-').map(Number);
        return new Date(y, m - 1, d);
    };

    const dueDt = parseYmd(ob?.dueDate);
    const discDt = parseYmd(ob?.discountDate);
    const dueYear = dueDt ? dueDt.getFullYear() : today.getFullYear();
    const isPaidForYear = Number(ob?.lastPaidYear) === dueYear;

    const daysToDue = dueDt ? Math.round((dueDt - today) / 86400000) : null;
    const daysToDiscount = (discDt && discPct > 0) ? Math.round((discDt - today) / 86400000) : null;
    const hasActiveDiscount = daysToDiscount !== null && daysToDiscount >= 0 && !isPaidForYear;

    const effectiveTargetDate = hasActiveDiscount ? discDt : dueDt;
    const effectiveTargetAmount = hasActiveDiscount ? discAmount : amt;
    const daysToTarget = effectiveTargetDate ? Math.max(0, Math.round((effectiveTargetDate - today) / 86400000)) : 365;
    const monthsLeft = Math.max(1, Math.ceil(daysToTarget / 30));
    const suggestedMonthlySave = isPaidForYear ? 0 : round2(effectiveTargetAmount / monthsLeft);

    let status = 'ok';
    if (isPaidForYear) status = 'paid';
    else if (daysToDue !== null && daysToDue < 0) status = 'overdue';
    else if ((daysToDue !== null && daysToDue <= 30) || (hasActiveDiscount && daysToDiscount <= 15)) status = 'urgent';
    else if (daysToDue !== null && daysToDue <= 60) status = 'soon';

    return {
        amt,
        discPct,
        discAmount,
        discSaving,
        dueYear,
        daysToDue,
        daysToDiscount,
        hasActiveDiscount,
        effectiveTargetAmount,
        monthsLeft,
        suggestedMonthlySave,
        isPaidForYear,
        status
    };
};

const getAllUpcomingAssetObligations = (daysWindow = 60, refDate = currentDate) => {
    const items = [];
    (financeData.fixedAssets || []).filter(a => a.status === 'active').forEach(asset => {
        (asset.annualObligations || []).forEach(ob => {
            const m = computeAssetObligationMetrics(ob, refDate);
            if (!m.isPaidForYear && m.daysToDue !== null && m.daysToDue <= daysWindow) {
                items.push({ assetId: asset.id, assetName: asset.name, obligation: ob, metrics: m });
            }
        });
    });
    return items.sort((a, b) => (a.metrics.daysToDue ?? 9999) - (b.metrics.daysToDue ?? 9999));
};

// --- FASE 6C: PAQUETE ANUAL PARA EL CONTADOR (RENTA DIAN COLOMBIA) ---
const buildAccountantTaxPackageData = async (targetYear) => {
    const year = parseInt(targetYear, 10) || currentDate.getFullYear();
    const params = typeof getTaxParamsForYear === 'function' ? getTaxParamsForYear(year) : getTaxParams();
    const snapDec31 = computeBalancesUpTo(`${year}-12`);
    const safeCatLabel = (raw) => (typeof cleanCatName === 'function' ? cleanCatName(raw) : stripLeadingEmoji(raw));

    // Combinar transacciones activas + archivadas en IndexedDB (si el año fue cerrado) sin duplicar IDs
    const seenIds = new Set();
    const yearTxs = [];
    const addIfMatchesYear = (t) => {
        if (!t || t.isDeleted || !isTxClosed(t) || t.isAdjustment) return;
        if (t.isSharedTrip && t.paidBy === 'companion') return;
        const mId = getTxMonthId(t);
        if (!String(mId || '').startsWith(`${year}-`)) return;
        const key = String(t.id);
        if (seenIds.has(key)) return;
        seenIds.add(key);
        yearTxs.push(t);
    };

    (financeData.transactions || []).forEach(addIfMatchesYear);
    let includedArchivedCount = 0;
    if (typeof getArchivedTransactions === 'function') {
        try {
            const archived = await getArchivedTransactions(year);
            archived.forEach(t => {
                const before = yearTxs.length;
                addIfMatchesYear(t);
                if (yearTxs.length > before) includedArchivedCount++;
            });
        } catch (_) {
            // Si la bóveda está bloqueada o IndexedDB vacía, continúa con transacciones activas
        }
    }

    const renta = checkRentaDeclaration(year, params, null, yearTxs);

    let gmfTotalPaid = 0;
    let refundsExcludedTotal = 0;
    let grossIncomeReal = 0;
    let grossExpenseReal = 0;
    const incomeByCat = {};
    const expenseByCat = {};
    const spendByCard = {};

    yearTxs.forEach(t => {
        const amt = round2(t.amount || 0);
        if (amt <= 0) return;
        const accObj = getAccountObj(t.account);

        if (t.type === 'income') {
            if (typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) {
                refundsExcludedTotal = round2(refundsExcludedTotal + amt);
            } else {
                grossIncomeReal = round2(grossIncomeReal + amt);
                const cKey = safeCatLabel(t.category || 'Otros Ingresos') || 'Otros Ingresos';
                incomeByCat[cKey] = round2((incomeByCat[cKey] || 0) + amt);
            }
        } else if (t.type === 'expense') {
            grossExpenseReal = round2(grossExpenseReal + amt);
            const cKey = safeCatLabel(t.category || 'Otros Gastos') || 'Otros Gastos';
            expenseByCat[cKey] = round2((expenseByCat[cKey] || 0) + amt);

            if (t.isGmfTax || /\b(4x1000|gmf)\b/i.test(`${t.category || ''} ${t.subcategory || ''} ${t.description || ''}`)) {
                gmfTotalPaid = round2(gmfTotalPaid + amt);
            }
            if (accObj?.category === 'credit_card') {
                const cardLabel = stripLeadingEmoji(accObj.name || t.account);
                spendByCard[cardLabel] = round2((spendByCard[cardLabel] || 0) + amt);
            }
        }
    });

    // Nómina y no salariales anuales (si está configurada)
    let laborSummary = null;
    const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    if (salCfg && Number(salCfg.basicSalary) > 0) {
        const mSample = calculateLaborMetrics(salCfg, new Date(year, 5, 15), params);
        let anualNoSalarial = 0;
        if (salCfg.hasNonSalary && Array.isArray(salCfg.nonSalaryItems)) {
            salCfg.nonSalaryItems.forEach(it => {
                const v = round2(it.amount || 0);
                if (v <= 0) return;
                anualNoSalarial = round2(anualNoSalarial + (it.month === 'all' ? round2(v * 12) : v));
            });
        }
        laborSummary = {
            basicSalary: round2(salCfg.basicSalary),
            monthlyNetEst: mSample.net,
            annualNonSalaryEst: anualNoSalarial,
            annualHealthPensionFspEst: round2(mSample.incrngo * 12),
            retencionesAnualesEst: renta.taxSimulation.retencionesEstimadas,
            baseGravableAnual: renta.taxSimulation.baseGravableAnual,
            impuestoCedulaGeneralEst: renta.taxSimulation.impuestoEstimado,
            saldoAPagarEst: renta.taxSimulation.saldoAPagar
        };
    }

    // CDTs activos desde localStorage
    const cdtsList = safeJsonParse(localStorage.getItem('lumen_cdts_v1'), []);
    const activeCdts = (Array.isArray(cdtsList) ? cdtsList : [])
        .filter(c => c.estado !== 'liquidado')
        .map(c => ({
            nombre: stripLeadingEmoji(c.nombre || c.entidad || 'CDT'),
            tipo: c.tipo || 'CDT',
            capital: round2(c.capital || 0),
            tasaEA: parseFloat(c.tasaEA) || 0,
            fechaApertura: c.fechaApertura || ''
        }));

    const balancesDec31 = (financeData.customAccounts || []).map(acc => ({
        nombre: stripLeadingEmoji(acc.name),
        tipo: acc.category === 'credit_card' ? 'Tarjeta de Crédito' : (acc.category === 'debt' ? 'Préstamo / Pasivo' : (acc.id.startsWith('CxC_') ? 'Cuenta por Cobrar' : 'Cuenta Bancaria / Liquidez')),
        saldo: round2(snapDec31.bals[acc.id] || 0)
    }));

    const pocketsDec31 = (financeData.pockets || []).map(p => ({
        nombre: stripLeadingEmoji(p.name),
        entidad: p.entity || '',
        capital: round2(p.principal || 0),
        rendimientos: round2(p.yields || 0),
        total: round2((p.principal || 0) + (p.yields || 0))
    }));

    const fixedAssetsDec31 = (financeData.fixedAssets || [])
        .filter(fa => fa.status === 'active')
        .map(fa => ({
            nombre: stripLeadingEmoji(fa.name),
            categoria: fa.category || 'Activo Fijo',
            valorCompra: round2(fa.purchaseValue || 0),
            valorActual: round2(fa.currentValue || 0)
        }));

    return {
        year,
        generatedAt: new Date().toLocaleString('es-CO'),
        params,
        renta,
        includedArchivedCount,
        txCount: yearTxs.length,
        grossIncomeReal,
        grossExpenseReal,
        refundsExcludedTotal,
        gmfTotalPaid,
        gmfDeductible50Est: round2(gmfTotalPaid * 0.5),
        laborSummary,
        spendByCard,
        incomeByCat,
        expenseByCat,
        balancesDec31,
        pocketsDec31,
        activeCdts,
        fixedAssetsDec31,
        snapDec31
    };
};

const formatAccountantPackageToCsv = (pkg) => {
    const cleanCell = (v) => {
        const sanitized = globalThis.LumenSecurity?.sanitizeCsvCell
            ? globalThis.LumenSecurity.sanitizeCsvCell(v)
            : String(v ?? '').replace(/[\r\n]+/g, ' ').trim();
        return `"${String(sanitized).replace(/"/g, '""')}"`;
    };
    const fmtNum = (n) => round2(n || 0).toFixed(2).replace('.', ',');
    const rows = [];
    const pushRow = (...cols) => rows.push(cols.map(cleanCell).join(';'));

    pushRow('PAQUETE INFORMATIVO PARA DECLARACIÓN DE RENTA (COLOMBIA)', `AÑO GRAVABLE ${pkg.year}`);
    pushRow('Generado por Lumen (Local-First)', pkg.generatedAt, `Movimientos analizados: ${pkg.txCount}`, pkg.includedArchivedCount > 0 ? `Incluye ${pkg.includedArchivedCount} archivados de IndexedDB` : 'Datos activos');
    pushRow('AVISO LEGAL / DESCARGO DE RESPONSABILIDAD', 'AVISO: Esta información es construida de acuerdo con lo registrado en la app. NO reemplaza la realidad económica del usuario ni la información exógena oficial con la que la DIAN u otras entidades validan tu obligación de declarar.');
    pushRow('');

    pushRow('1. PARÁMETROS Y TOPES DIAN (ART. 592 Y 594-3 E.T.)', 'VALOR REGISTRADO (COP)', 'TOPE LEGAL (COP)', 'ESTADO');
    pushRow(`UVT ${pkg.year}`, fmtNum(pkg.params.uvt), '-', '-');
    pushRow(`SMMLV ${pkg.year}`, fmtNum(pkg.params.smmlv), '-', '-');
    pushRow('Patrimonio Bruto a 31 Dic (4.500 UVT)', fmtNum(pkg.renta.current.patrimonio), fmtNum(pkg.renta.limits.patrimonio), pkg.renta.exceeds.patrimonio ? 'SUPERA TOPE' : 'Bajo tope');
    pushRow('Ingresos Brutos Anuales sin reembolsos (1.400 UVT)', fmtNum(pkg.renta.current.ingresos), fmtNum(pkg.renta.limits.ingresos), pkg.renta.exceeds.ingresos ? 'SUPERA TOPE' : 'Bajo tope');
    pushRow('Consumos con Tarjetas de Crédito (1.400 UVT)', fmtNum(pkg.renta.current.tarjetas), fmtNum(pkg.renta.limits.tarjetas), pkg.renta.exceeds.tarjetas ? 'SUPERA TOPE' : 'Bajo tope');
    pushRow('Compras y Consumos Totales (1.400 UVT)', fmtNum(pkg.renta.current.compras), fmtNum(pkg.renta.limits.compras), pkg.renta.exceeds.compras ? 'SUPERA TOPE' : 'Bajo tope');
    pushRow('Consignaciones Bancarias (1.400 UVT)', fmtNum(pkg.renta.current.consignaciones), fmtNum(pkg.renta.limits.consignaciones), pkg.renta.exceeds.consignaciones ? 'SUPERA TOPE' : 'Bajo tope');
    pushRow('');

    pushRow('2. IMPUESTOS, RETENCIONES Y 4x1000 (GMF)', 'VALOR (COP)', 'OBSERVACIÓN');
    pushRow('Total 4x1000 (GMF) registrado en el año', fmtNum(pkg.gmfTotalPaid), 'Validar contra certificado anual bancario');
    pushRow('50% GMF deducible estimado (Art. 115 E.T.)', fmtNum(pkg.gmfDeductible50Est), 'Sujeto a certificación bancaria oficial');
    pushRow('Reembolsos / Devoluciones excluidos de ingresos', fmtNum(pkg.refundsExcludedTotal), 'Descontados del gasto neto para no inflar ingresos');
    if (pkg.laborSummary) {
        pushRow('Salario Básico Mensual configurado', fmtNum(pkg.laborSummary.basicSalary), 'Perfil laboral');
        pushRow('Ingresos No Salariales anuales estimados', fmtNum(pkg.laborSummary.annualNonSalaryEst), 'Según configuración de nómina');
        pushRow('Aportes obligatorios Salud + Pensión + FSP (anual est.)', fmtNum(pkg.laborSummary.annualHealthPensionFspEst), 'INCRNGO');
        pushRow('Retenciones en la fuente practicadas (anual est.)', fmtNum(pkg.laborSummary.retencionesAnualesEst), 'Mensual + Primas');
        pushRow('Base Gravable Cédula General estimada', fmtNum(pkg.laborSummary.baseGravableAnual), 'Art. 241 E.T.');
        pushRow('Impuesto a Cargo Cédula General estimado', fmtNum(pkg.laborSummary.impuestoCedulaGeneralEst), 'Simulación orientativa');
        pushRow('Saldo a Pagar / (A Favor) estimado', fmtNum(pkg.laborSummary.saldoAPagarEst), 'Impuesto menos retenciones');
    }
    pushRow('');

    pushRow('3. SALDOS A 31 DE DICIEMBRE (PATRIMONIO Y DEUDAS)', 'TIPO', 'SALDO A 31 DIC (COP)');
    pkg.balancesDec31.forEach(b => pushRow(b.nombre, b.tipo, fmtNum(b.saldo)));
    pkg.pocketsDec31.forEach(p => pushRow(`Bolsillo: ${p.nombre}`, p.entidad || 'Ahorro / Bolsillo', fmtNum(p.total)));
    pkg.activeCdts.forEach(c => pushRow(`${c.tipo}: ${c.nombre}`, `Tasa ${c.tasaEA}% E.A.`, fmtNum(c.capital)));
    pkg.fixedAssetsDec31.forEach(fa => pushRow(`Activo Fijo: ${fa.nombre}`, fa.categoria, fmtNum(fa.valorActual)));
    pushRow('TOTAL PATRIMONIO NETO A 31 DIC', 'Activos - Pasivos', fmtNum(pkg.snapDec31.netWorth));
    pushRow('');

    pushRow('4. CONSUMOS ANUALES POR TARJETA DE CRÉDITO', 'TOTAL CONSUMIDO (COP)');
    const cardKeys = Object.keys(pkg.spendByCard);
    if (cardKeys.length === 0) pushRow('Sin consumos de tarjeta registrados', '0,00');
    else cardKeys.forEach(k => pushRow(k, fmtNum(pkg.spendByCard[k])));
    pushRow('');

    pushRow('5. RESUMEN ANUAL POR CATEGORÍA', 'TIPO', 'TOTAL ANUAL (COP)');
    Object.entries(pkg.incomeByCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => pushRow(k, 'INGRESO', fmtNum(v)));
    Object.entries(pkg.expenseByCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => pushRow(k, 'GASTO', fmtNum(v)));

    return '\uFEFF' + rows.join('\r\n');
};

const simulateFutureLiquidity = (startMonthId, targetMonthId, initialLiquidity) => {
    let projectedLiquidity = initialLiquidity;
    let [sy, sm] = startMonthId.split('-').map(Number);
    let [ty, tm] = targetMonthId.split('-').map(Number);
    
    let currentIterDate = new Date(sy, sm - 1, 1);
    const targetDate = new Date(ty, tm - 1, 1);
    
    // Avanzar un mes para empezar a proyectar
    currentIterDate.setMonth(currentIterDate.getMonth() + 1);
    
    let monthsDiff = 0;
    let totalProjectedInc = 0;
    let totalProjectedExp = 0;

    // Calcular el promedio histórico como respaldo (para categorías sin presupuesto)
    const regularTrans = financeData.transactions.filter(t => !t.isDeleted && !t.isTripIsolated && t.type === 'expense' && !t.isAdjustment && isTxClosed(t));
    const monthsCount = new Set(regularTrans.map(t => getTxMonthId(t))).size || 1;
    const avgExpense = round2(regularTrans.reduce((s, t) => s + round2(t.amount), 0) / monthsCount);

    while (currentIterDate <= targetDate) {
        monthsDiff++;
        const iterYear = currentIterDate.getFullYear();
        const iterMonthIdx = currentIterDate.getMonth();
        const iterMonthId = getMonthId(currentIterDate);
        
        // 1. Ingresos Proyectados (Presupuesto + Nómina Base)
        let monthInc = 0;
        let hasIncomeBudget = false;
        if (financeData.categories && financeData.categories.income) {
            financeData.categories.income.forEach(c => {
                const limit = getCategoryLimitForMonth(c, iterMonthIdx, iterYear);
                if (limit > 0) hasIncomeBudget = true;
                monthInc += limit;
            });
        }
        // Si no hay presupuesto de ingresos, usar el salario neto actual
        if (!hasIncomeBudget) {
            const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
            if (salCfg) {
                const metrics = calculateLaborMetrics(salCfg, currentIterDate);
                monthInc = metrics.net;
                // Sumar prima en Junio (5) y Diciembre (11)
                if (iterMonthIdx === 5) monthInc = round2(monthInc + (metrics.halfPrimaJunNeta || 0));
                if (iterMonthIdx === 11) monthInc = round2(monthInc + (metrics.halfPrimaDecNeta || 0));
            }
        }
        
        // 2. Egresos Proyectados (Presupuesto Híbrido + Deudas)
        let monthExp = 0;
        let hasExpenseBudget = false;
        if (financeData.categories && financeData.categories.expense) {
             financeData.categories.expense.forEach(c => {
                 const limit = getCategoryLimitForMonth(c, iterMonthIdx, iterYear);
                 if (limit > 0) hasExpenseBudget = true;
                 monthExp += limit;
             });
        }
        
        // Obtener deudas comprometidas proyectadas para ese mes en particular
        // Para simplificar la proyección a largo plazo, usamos la foto actual de las deudas
        const snap = computeBalancesUpTo(startMonthId); 
        const committedDebt = getCommittedMonthlyDebtQuotas(snap);
        
        let effectiveExp = monthExp;
        if (!hasExpenseBudget && avgExpense > 0) {
            effectiveExp = avgExpense;
        }
        
        // Sumar las deudas al gasto proyectado
        effectiveExp = round2(effectiveExp + committedDebt);

        projectedLiquidity = round2(projectedLiquidity + monthInc - effectiveExp);
        totalProjectedInc += monthInc;
        totalProjectedExp += effectiveExp;
        
        currentIterDate.setMonth(currentIterDate.getMonth() + 1);
    }
    
    const avgInc = monthsDiff > 0 ? round2(totalProjectedInc / monthsDiff) : 0;
    const avgExp = monthsDiff > 0 ? round2(totalProjectedExp / monthsDiff) : 0;

    return {
        projectedLiquidity,
        monthsDiff,
        avgInc,
        avgExp,
        avgNet: round2(avgInc - avgExp)
    };
};

const getMonthlyFlow = (targetMonthId, includePending = false) => {
    let inc = 0, exp = 0, refunds = 0;

    financeData.transactions.forEach(t => {
        if (!t.isDeleted && !(t.isSharedTrip && t.paidBy === 'companion') && !t.isTripIsolated && getTxMonthId(t) === targetMonthId && t.type !== 'transfer' && !t.isAdjustment) {
            if (includePending || isTxClosed(t)) {
                const val = t.status === 'pending' ? round2(t.budgetedAmount || t.amount) : round2(t.amount);
                if (t.type === 'income') {
                    if (typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) {
                        refunds = round2(refunds + val);
                    } else {
                        inc = round2(inc + val);
                    }
                } else if (t.type === 'expense') {
                    exp = round2(exp + val);
                }
            }
        }
    });

    exp = Math.max(0, round2(exp - refunds));
    return { inc, exp, net: round2(inc - exp) };
};

// --- 6. AMORTIZACIÓN, TARJETAS DIFERIDAS, BNPL, SALUD FINANCIERA Y ENDEUDAMIENTO ---
const calculateFianzaAmount = (baseAmount, fianzaVal, fianzaType = 'pct', includeIva = false) => {
    const base = Math.max(0, round2(baseAmount || 0));
    const val = Math.max(0, parseFloat(fianzaVal) || 0);
    if (base <= 0 || val <= 0) return 0;
    const rawFee = fianzaType === 'pct' ? round2(base * (val / 100)) : round2(val);
    return includeIva ? round2(rawFee * 1.19) : rawFee;
};
const calculateAmortization = (principal, periods, rate, rateType) => {
    let monthlyRate = rate / 100;
    if (rateType === 'annual') {
        monthlyRate = Math.pow(1 + monthlyRate, 1 / 12) - 1;
    }

    let basePayment = 0;
    if (monthlyRate > 0 && periods > 0) {
        basePayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, periods)) / (Math.pow(1 + monthlyRate, periods) - 1);
    } else if (periods > 0) {
        basePayment = principal / periods;
    }

    let schedule = [];
    let balance = principal;
    let totalInterest = 0;

    for (let i = 1; i <= periods; i++) {
        let interest = balance * monthlyRate;
        let periodPayment = basePayment;
        let principalPayment = periodPayment - interest;

        if (i === periods) {
            principalPayment = balance;
            periodPayment = principalPayment + interest;
        }

        balance = balance - principalPayment;
        if (balance < 0) balance = 0;

        totalInterest += interest;
        schedule.push({
            period: i,
            payment: round2(periodPayment),
            principal: round2(principalPayment),
            interest: round2(interest),
            balance: round2(balance)
        });
    }

    return {
        payment: round2(basePayment),
        schedule,
        monthlyRate,
        totalInterest: round2(totalInterest),
        totalWithInterest: round2(principal + totalInterest)
    };
};

const buildCycleWindowFromCutoff = (baseYear, baseMonth, cDay, pDay) => {
    const safeCut = Math.max(1, Math.min(31, parseInt(cDay, 10) || 15));
    const safePay = Math.max(1, Math.min(31, parseInt(pDay, 10) || 30));
    const payMonthOffset = safePay > safeCut ? 0 : 1;

    const cutProbe = new Date(baseYear, baseMonth, 1);
    const cutY = cutProbe.getFullYear(), cutM = cutProbe.getMonth();
    const daysInCutM = new Date(cutY, cutM + 1, 0).getDate();
    const cutDate = new Date(cutY, cutM, Math.min(safeCut, daysInCutM), 23, 59, 59, 999);

    const prevCutProbe = new Date(cutY, cutM - 1, 1);
    const prevCutDays = new Date(prevCutProbe.getFullYear(), prevCutProbe.getMonth() + 1, 0).getDate();
    const prevCutDate = new Date(prevCutProbe.getFullYear(), prevCutProbe.getMonth(), Math.min(safeCut, prevCutDays), 23, 59, 59, 999);

    const nextCutProbe = new Date(cutY, cutM + 1, 1);
    const nextCutDays = new Date(nextCutProbe.getFullYear(), nextCutProbe.getMonth() + 1, 0).getDate();
    const nextCutDate = new Date(nextCutProbe.getFullYear(), nextCutProbe.getMonth(), Math.min(safeCut, nextCutDays), 23, 59, 59, 999);

    const payProbe = new Date(cutY, cutM + payMonthOffset, 1);
    const payY = payProbe.getFullYear(), payM = payProbe.getMonth();
    const daysInPayM = new Date(payY, payM + 1, 0).getDate();
    const payDate = new Date(payY, payM, Math.min(safePay, daysInPayM), 23, 59, 59, 999);

    return {
        cDay: safeCut,
        pDay: safePay,
        payMonthOffset,
        purchaseStartMs: prevCutDate.getTime() + 1,
        purchaseEndMs: cutDate.getTime(),
        payWindowStartMs: cutDate.getTime() + 1,
        payWindowEndMs: nextCutDate.getTime(),
        cutDate,
        payDate,
        nextCutDate
    };
};

const getCardActivePayCycle = (card, refDate = currentDate) => {
    const hasCutoff = card?.category === 'credit_card' || (parseInt(card?.cutoffDay, 10) > 0);
    if (!hasCutoff) return null;
    const cDay = Math.max(1, Math.min(31, parseInt(card?.cutoffDay, 10) || 15));
    const pDay = Math.max(1, Math.min(31, parseInt(card?.paymentDay, 10) || 30));
    const refStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    const refEnd = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);

    for (let mOff = -2; mOff <= 2; mOff++) {
        const win = buildCycleWindowFromCutoff(refDate.getFullYear(), refDate.getMonth() + mOff, cDay, pDay);
        if (win.payDate >= refStart) {
            return {
                ...win,
                activeCutDate: win.cutDate,
                activePayDate: win.payDate,
                isBilledStatementOpen: win.cutDate <= refEnd
            };
        }
    }
    return null;
};

const getPaymentsInWindowForLiability = (acc, startMs, endMs) => {
    if (!acc) return { payments: [], ordinaryPaidTotal: 0, hasOrdinaryInstallmentTx: false, extraPaidTotal: 0 };
    const payments = [];
    let ordinaryPaidTotal = 0;
    let extraPaidTotal = 0;
    let hasOrdinaryInstallmentTx = false;

    (financeData.transactions || []).forEach(t => {
        if (t.isDeleted || !isTxClosed(t) || t.isAdjustment) return;
        const isTransferToAcc = t.type === 'transfer' && String(t.toAccount) === String(acc.id);
        const isDirectCredit = acc.category === 'credit_card' && t.type === 'income' && String(t.account) === String(acc.id);
        if (!isTransferToAcc && !isDirectCredit) return;

        const txMs = getTxEffectiveDateObj(t, currentDate).getTime();
        if (txMs < startMs || txMs > endMs) return;

        // Sumar cargos/intereses hijos vinculados (ej. Pagar Cuota en préstamos o cargos extra en transferencia)
        const linkedChildrenAmt = (financeData.transactions || [])
            .filter(ch => !ch.isDeleted && isTxClosed(ch) && String(ch.linkedToTransfer) === String(t.id) && String(ch.account) !== String(acc.id))
            .reduce((s, ch) => round2(s + round2(ch.amount || 0)), 0);

        const totalCashOut = round2(round2(t.amount || 0) + Math.max(round2(t.extraCharges || 0), linkedChildrenAmt));
        const isExtraMode = t.paymentMode === 'extraordinary';

        payments.push({
            kind: 'payment',
            tx: t,
            txId: t.id,
            title: stripLeadingEmoji(t.description || 'Abono registrado'),
            subtitle: t.date,
            amount: round2(t.amount || 0),
            totalPaid: totalCashOut,
            isExtraordinary: isExtraMode
        });

        if (isExtraMode) {
            extraPaidTotal = round2(extraPaidTotal + totalCashOut);
        } else {
            ordinaryPaidTotal = round2(ordinaryPaidTotal + totalCashOut);
            hasOrdinaryInstallmentTx = true;
        }
    });

    return { payments, ordinaryPaidTotal, hasOrdinaryInstallmentTx, extraPaidTotal };
};

const getCycleDueKey = (dueDateObj) => {
    if (!dueDateObj || Number.isNaN(dueDateObj.getTime())) return '';
    return `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}`;
};

const isLiabilityCycleMarkedSettled = (acc, dueDateObj) => {
    if (!acc || !Array.isArray(acc.settledCycles) || acc.settledCycles.length === 0) return false;
    const key = getCycleDueKey(dueDateObj);
    return key ? acc.settledCycles.includes(key) : false;
};

const toggleLiabilityCycleSettled = (accountId, dueDateObj, forceState = null) => {
    const acc = (financeData.customAccounts || []).find(a => String(a.id) === String(accountId));
    const key = getCycleDueKey(dueDateObj);
    if (!acc || !key) return false;
    if (!Array.isArray(acc.settledCycles)) acc.settledCycles = [];

    const exists = acc.settledCycles.includes(key);
    const shouldSettle = forceState !== null ? !!forceState : !exists;

    if (shouldSettle && !exists) {
        acc.settledCycles.push(key);
        if (acc.settledCycles.length > 36) acc.settledCycles = acc.settledCycles.slice(-36);
    } else if (!shouldSettle && exists) {
        acc.settledCycles = acc.settledCycles.filter(k => k !== key);
    }

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    return shouldSettle;
};
globalThis.getCycleDueKey = getCycleDueKey;
globalThis.isLiabilityCycleMarkedSettled = isLiabilityCycleMarkedSettled;
globalThis.toggleLiabilityCycleSettled = toggleLiabilityCycleSettled;

// Evaluador universal de estado de pago para una fecha de vencimiento específica (Tarjeta o Deuda)
const getLiabilityDueCycleState = (acc, currentBal, targetPayDate, refDate = currentDate) => {
    const bal = Math.max(0, round2(currentBal || 0));
    const pDay = parseInt(acc?.paymentDay, 10) || targetPayDate.getDate();
    const hasCutoff = acc?.category === 'credit_card' || (parseInt(acc?.cutoffDay, 10) > 0);

    let payWinStartMs, payWinEndMs, cutDateObj = null, isStatementCutClosed = true;
    if (hasCutoff) {
        const cDay = Math.max(1, Math.min(31, parseInt(acc.cutoffDay, 10) || 15));
        const cutMonthOffset = pDay <= cDay ? -1 : 0;
        const win = buildCycleWindowFromCutoff(targetPayDate.getFullYear(), targetPayDate.getMonth() + cutMonthOffset, cDay, pDay);
        payWinStartMs = win.payWindowStartMs;
        payWinEndMs = win.payWindowEndMs;
        cutDateObj = win.cutDate;
        const refEndMs = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999).getTime();
        isStatementCutClosed = cutDateObj.getTime() <= refEndMs;
    } else {
        // Sin día de corte explícito: ventana limpia [-20 días, +10 días] alrededor de la fecha de pago (nunca se solapa entre meses)
        payWinStartMs = new Date(targetPayDate.getFullYear(), targetPayDate.getMonth(), targetPayDate.getDate() - 20, 0, 0, 0, 0).getTime();
        payWinEndMs = new Date(targetPayDate.getFullYear(), targetPayDate.getMonth(), targetPayDate.getDate() + 10, 23, 59, 59, 999).getTime();
    }

    if (bal <= 0.01) {
        return { isPaid: true, remainingQuota: 0, baseQuota: 0, paidAmount: 0, cutDateObj, payWinStartMs, payWinEndMs };
    }

    // Si la fecha límite evaluada venció ANTES de que la cuenta fuera registrada en Lumen, no exigirla como atrasada
    let earliestMs = Infinity;
    const idTsMatch = String(acc?.id || '').match(/_(\d{12,14})$/);
    if (idTsMatch && Number(idTsMatch[1]) > 946684800000) earliestMs = Number(idTsMatch[1]);
    (financeData.transactions || []).forEach(t => {
        if (!t.isDeleted && (String(t.account) === String(acc.id) || String(t.toAccount) === String(acc.id))) {
            const ms = getTxEffectiveDateObj(t, currentDate).getTime();
            if (ms > 946684800000 && ms < earliestMs) earliestMs = ms;
        }
    });
    if (Number.isFinite(earliestMs)) {
        const firstDay = new Date(earliestMs);
        const firstDayStartMs = new Date(firstDay.getFullYear(), firstDay.getMonth(), firstDay.getDate(), 0, 0, 0, 0).getTime();
        const targetPayEndMs = new Date(targetPayDate.getFullYear(), targetPayDate.getMonth(), targetPayDate.getDate(), 23, 59, 59, 999).getTime();
        if (targetPayEndMs < firstDayStartMs) {
            return { isPaid: true, isBeforeCreation: true, remainingQuota: 0, baseQuota: 0, paidAmount: 0, cutDateObj, payWinStartMs, payWinEndMs };
        }
    }

    if (isLiabilityCycleMarkedSettled(acc, targetPayDate)) {
        return { isPaid: true, isPreAppSettled: true, remainingQuota: 0, baseQuota: 0, paidAmount: 0, cutDateObj, payWinStartMs, payWinEndMs };
    }

    const payInfo = getPaymentsInWindowForLiability(acc, payWinStartMs, payWinEndMs);

    if (acc.category === 'credit_card') {
        const est = calculateCardMinPaymentEstimate(acc, bal, cutDateObj || refDate);
        const baseQuota = round2(est.totalMinPayment || 0);
        if (!isStatementCutClosed) {
            return { isPaid: false, remainingQuota: baseQuota, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
        }
        if (payInfo.hasOrdinaryInstallmentTx) {
            // Verificar si aún quedan compras diferidas de este corte específico sin marcar cuota
            const unpaidBilledDeferred = getPendingCardPurchases(acc.id, cutDateObj || refDate)
                .filter(p => p.nextPayDate && p.nextPayDate.getFullYear() === targetPayDate.getFullYear() && p.nextPayDate.getMonth() === targetPayDate.getMonth());
            if (unpaidBilledDeferred.length === 0 || payInfo.ordinaryPaidTotal >= baseQuota * 0.85) {
                return { isPaid: true, remainingQuota: 0, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
            }
        }
        const rem = Math.max(0, round2(baseQuota - payInfo.ordinaryPaidTotal));
        return { isPaid: rem <= 0.01 && payInfo.ordinaryPaidTotal > 0, remainingQuota: rem, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
    }

    // Préstamos Fijos, Cupos Rotativos y Créditos Educativos
    const qInfo = getDebtMonthlyQuotaBreakdown(acc, bal);
    const baseQuota = round2(qInfo.totalQuota || 0);
    if (payInfo.hasOrdinaryInstallmentTx) {
        if (acc.debtType === 'revolving' && hasCutoff && isStatementCutClosed) {
            const unpaidRev = getPendingRevolvingPurchases(acc.id, null, cutDateObj || refDate)
                .filter(p => p.nextPayDate && p.nextPayDate.getFullYear() === targetPayDate.getFullYear() && p.nextPayDate.getMonth() === targetPayDate.getMonth());
            if (unpaidRev.length === 0 || payInfo.ordinaryPaidTotal >= baseQuota * 0.85) {
                return { isPaid: true, remainingQuota: 0, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
            }
        } else {
            return { isPaid: true, remainingQuota: 0, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
        }
    }

    const rem = Math.max(0, round2(baseQuota - payInfo.ordinaryPaidTotal));
    return { isPaid: rem <= 0.01 && payInfo.ordinaryPaidTotal > 0, remainingQuota: rem, baseQuota, paidAmount: payInfo.ordinaryPaidTotal, cutDateObj, payWinStartMs, payWinEndMs };
};

// Resuelve el próximo vencimiento real pendiente de una Tarjeta o Deuda a partir de hoy
const getNextUnpaidLiabilityCycle = (acc, currentBal, refDate = currentDate, graceOverdueDays = 5) => {
    const bal = Math.max(0, round2(currentBal || 0));
    const rawPayDay = parseInt(acc?.paymentDay, 10);
    if (bal <= 0.01 || !rawPayDay || rawPayDay < 1 || rawPayDay > 31) return null;

    const startDay = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    for (let mOff = -1; mOff <= 3; mOff++) {
        const probe = new Date(startDay.getFullYear(), startDay.getMonth() + mOff, 1);
        const py = probe.getFullYear(), pm = probe.getMonth();
        const daysInM = new Date(py, pm + 1, 0).getDate();
        const dueDate = new Date(py, pm, Math.min(rawPayDay, daysInM), 12, 0, 0, 0);
        const cleanDue = new Date(py, pm, Math.min(rawPayDay, daysInM), 0, 0, 0, 0);
        const diffDays = Math.round((cleanDue.getTime() - startDay.getTime()) / 86400000);

        if (diffDays < -graceOverdueDays) continue;
        const st = getLiabilityDueCycleState(acc, bal, dueDate, refDate);
        if (!st.isPaid && st.remainingQuota > 0) {
            return { dueDate, diffDays, amount: st.remainingQuota, baseQuota: st.baseQuota, cutDateObj: st.cutDateObj };
        }
    }
    return null;
};

const getTxEffectiveDateObj = (t, fallbackDate = currentDate) => {
    const rawTs = Number(t?.id);
    if (Number.isFinite(rawTs) && rawTs > 946684800000) return new Date(rawTs);
    if (t?.monthId && /^\d{4}-\d{2}$/.test(t.monthId)) {
        const [y, m] = t.monthId.split('-').map(Number);
        return new Date(y, m - 1, 1, 12, 0, 0);
    }
    return new Date(fallbackDate);
};

const getRollbackForTxFromTransfer = (targetTx, ignoreTransferTx) => {
    let rollbackPaid = 0, rollbackExtra = 0, restoredQuota = null;
    if (ignoreTransferTx && isTxClosed(ignoreTransferTx) && Array.isArray(ignoreTransferTx.allocatedItems)) {
        ignoreTransferTx.allocatedItems.forEach(al => {
            if (al.kind === 'cc_tx' && String(al.txId) === String(targetTx.id)) {
                if (al.mode === 'extraordinary') {
                    rollbackExtra = round2(rollbackExtra + (al.amountApplied || 0));
                    if (al.prevMonthlyQuota !== undefined) restoredQuota = al.prevMonthlyQuota;
                    if (targetTx.wasClosedByExtra) {
                        const currP = Math.max(0, parseInt(targetTx.paidInstallments, 10) || 0);
                        rollbackPaid += al.prevPaidInstallments !== undefined ? Math.max(0, currP - al.prevPaidInstallments) : 1;
                    }
                } else {
                    rollbackPaid += 1;
                }
            }
        });
    }
    return { rollbackPaid, rollbackExtra, restoredQuota };
};

const getPendingCardPurchases = (cardId, refDate = currentDate, ignoreTransferTx = null) => {
    const cardObj = getAccountObj(cardId);
    const cycleWin = getCardActivePayCycle(cardObj, refDate);
    const cDay = cycleWin ? cycleWin.cDay : 15;
    const pDay = cycleWin ? cycleWin.pDay : 30;
    const payMonthOffset = cycleWin ? cycleWin.payMonthOffset : 0;

    const isCardChargeTx = (t) =>
        t.type === 'expense' ||
        (t.type === 'transfer' && String(t.toAccount || '').startsWith('CxC_'));

    return financeData.transactions
        .filter(t => !t.isDeleted && t.account === cardId && isCardChargeTx(t) && !t.isAdjustment && isTxClosed(t))
        .map(t => {
            const { rollbackPaid, rollbackExtra, restoredQuota } = getRollbackForTxFromTransfer(t, ignoreTransferTx);
            const inst = Math.max(1, parseInt(t.installments, 10) || 1);
            const paid = Math.max(0, (parseInt(t.paidInstallments, 10) || 0) - rollbackPaid);
            const isZero = t.zeroInterest !== undefined ? !!t.zeroInterest : (inst === 1);
            const rate = isZero ? 0 : (parseFloat(t.rate) || 0);
            const rateType = t.rateType || 'monthly';
            const amort = calculateAmortization(round2(t.amount), inst, rate, rateType);
            const remSchedule = amort.schedule.slice(paid);
            const rawRemCapital = round2(remSchedule.reduce((s, r) => s + r.principal, 0));
            const effExtra = Math.max(0, round2((t.extraPrincipalPaid || 0) - rollbackExtra));
            const remCapital = Math.max(0, round2(rawRemCapital - effExtra));
            const nextInterest = remSchedule.length > 0 ? round2(remCapital * amort.monthlyRate) : 0;
            const customQ = restoredQuota !== null ? restoredQuota : (t.monthlyQuota > 0 ? round2(t.monthlyQuota) : 0);
            const baseSchedQ = remSchedule.length > 0 ? (customQ > 0 ? customQ : remSchedule[0].payment) : 0;
            const nextQuota = remSchedule.length > 0 ? Math.min(baseSchedQ, round2(remCapital + nextInterest)) : 0;

            const txDate = getTxEffectiveDateObj(t, refDate);
            const txY = txDate.getFullYear(), txM = txDate.getMonth();
            const daysInTxM = new Date(txY, txM + 1, 0).getDate();
            const firstCutOffset = txDate.getDate() <= Math.min(cDay, daysInTxM) ? 0 : 1;

            const firstCutProbe = new Date(txY, txM + firstCutOffset, 1);
            const fCutDays = new Date(firstCutProbe.getFullYear(), firstCutProbe.getMonth() + 1, 0).getDate();
            const firstCutEndMs = new Date(firstCutProbe.getFullYear(), firstCutProbe.getMonth(), Math.min(cDay, fCutDays), 23, 59, 59).getTime();

            const nextCutProbe = new Date(txY, txM + firstCutOffset + paid, 1);
            const nCutY = nextCutProbe.getFullYear(), nCutM = nextCutProbe.getMonth();
            const nCutDays = new Date(nCutY, nCutM + 1, 0).getDate();
            const nextCutDate = new Date(nCutY, nCutM, Math.min(cDay, nCutDays), 23, 59, 59);

            const nextPayProbe = new Date(nCutY, nCutM + payMonthOffset, 1);
            const nPayY = nextPayProbe.getFullYear(), nPayM = nextPayProbe.getMonth();
            const nPayDays = new Date(nPayY, nPayM + 1, 0).getDate();
            let nextCutFinal = nextCutDate;
            let nextPayFinal = new Date(nPayY, nPayM, Math.min(pDay, nPayDays), 23, 59, 59);
            let settleShift = 0;
            while (settleShift < 12 && isLiabilityCycleMarkedSettled(cardObj, nextPayFinal)) {
                settleShift++;
                const sCutP = new Date(nextCutFinal.getFullYear(), nextCutFinal.getMonth() + 1, 1);
                const sCutDays = new Date(sCutP.getFullYear(), sCutP.getMonth() + 1, 0).getDate();
                nextCutFinal = new Date(sCutP.getFullYear(), sCutP.getMonth(), Math.min(cDay, sCutDays), 23, 59, 59);

                const sPayP = new Date(sCutP.getFullYear(), sCutP.getMonth() + payMonthOffset, 1);
                const sPayDays = new Date(sPayP.getFullYear(), sPayP.getMonth() + 1, 0).getDate();
                nextPayFinal = new Date(sPayP.getFullYear(), sPayP.getMonth(), Math.min(pDay, sPayDays), 23, 59, 59);
            }

            const isDueInActiveCycle = cycleWin ? (nextPayFinal.getTime() <= cycleWin.activePayDate.getTime()) : true;

            return {
                tx: t, installments: inst, paidInstallments: paid,
                remainingInstallments: Math.max(0, inst - paid),
                rate, rateType, zeroInterest: !!t.zeroInterest || rate === 0,
                nextPeriod: paid + 1, nextQuota: round2(nextQuota), remCapital,
                firstCutEndMs, nextCutDate: nextCutFinal, nextPayDate: nextPayFinal, isDueInActiveCycle
            };
        })
        .filter(item => item.remainingInstallments > 0 && item.remCapital > 0)
        .sort((a, b) => a.tx.id - b.tx.id);
};

const getPendingRevolvingPurchases = (debtId, ignoreTransferTx = null, refDate = currentDate) => {
    const debtObj = getAccountObj(debtId);
    const hasCutoff = parseInt(debtObj?.cutoffDay, 10) > 0;
    const cycleWin = hasCutoff ? getCardActivePayCycle(debtObj, refDate) : null;
    const cDay = cycleWin ? cycleWin.cDay : 0;
    const rawPayDay = parseInt(debtObj?.paymentDay, 10);
    const pDay = (rawPayDay >= 1 && rawPayDay <= 31) ? rawPayDay : 0;
    const payMonthOffset = cycleWin ? cycleWin.payMonthOffset : 0;

    const isRevChargeTx = (t) =>
        t.type === 'expense' ||
        (t.type === 'transfer' && String(t.toAccount || '').startsWith('CxC_'));

    return financeData.transactions
        .filter(t => !t.isDeleted && t.account === debtId && isRevChargeTx(t) && !t.isInterestCharge && !(t.linkedToTransfer && /^Intereses\s*\(/i.test(stripLeadingEmoji(t.description || ''))) && isTxClosed(t) && t.installments !== undefined)
        .map(t => {
            const { rollbackPaid, rollbackExtra, restoredQuota } = getRollbackForTxFromTransfer(t, ignoreTransferTx);
            const inst = Math.max(1, parseInt(t.installments, 10) || 1);
            const paid = Math.max(0, (parseInt(t.paidInstallments, 10) || 0) - rollbackPaid);
            const isZero = t.zeroInterest !== undefined ? !!t.zeroInterest : false;
            const rate = isZero ? 0 : (parseFloat(t.rate) || 0);
            const rateType = t.rateType || 'monthly';
            const amort = calculateAmortization(round2(t.amount), inst, rate, rateType);
            const remSchedule = amort.schedule.slice(paid);
            const rawRemCapital = round2(remSchedule.reduce((s, r) => s + r.principal, 0));
            const effExtra = Math.max(0, round2((t.extraPrincipalPaid || 0) - rollbackExtra));
            const remCapital = Math.max(0, round2(rawRemCapital - effExtra));
            const nextInterest = remSchedule.length > 0 ? round2(remCapital * amort.monthlyRate) : 0;
            const customQ = restoredQuota !== null ? restoredQuota : ((t.monthlyQuota && t.monthlyQuota > 0) ? round2(t.monthlyQuota) : 0);
            const rawQuota = customQ > 0 ? customQ : (remSchedule.length > 0 ? remSchedule[0].payment : 0);
            const nextQuota = remSchedule.length > 0 ? Math.min(rawQuota, round2(remCapital + nextInterest)) : 0;
            const nextPrincipal = Math.min(remCapital, Math.max(0, round2(nextQuota - nextInterest)));

            let nextCutDate = null, nextPayDate = null, isDueInActiveCycle = true;
            const txDate = getTxEffectiveDateObj(t, refDate);
            if (hasCutoff && cycleWin) {
                const txY = txDate.getFullYear(), txM = txDate.getMonth();
                const daysInTxM = new Date(txY, txM + 1, 0).getDate();
                const firstCutOffset = txDate.getDate() <= Math.min(cDay, daysInTxM) ? 0 : 1;

                const nextCutProbe = new Date(txY, txM + firstCutOffset + paid, 1);
                const nCutY = nextCutProbe.getFullYear(), nCutM = nextCutProbe.getMonth();
                const nCutDays = new Date(nCutY, nCutM + 1, 0).getDate();
                nextCutDate = new Date(nCutY, nCutM, Math.min(cDay, nCutDays), 23, 59, 59, 999);

                const safePayDay = pDay || 30;
                const nextPayProbe = new Date(nCutY, nCutM + payMonthOffset, 1);
                const nPayY = nextPayProbe.getFullYear(), nPayM = nextPayProbe.getMonth();
                const nPayDays = new Date(nPayY, nPayM + 1, 0).getDate();
                nextPayDate = new Date(nPayY, nPayM, Math.min(safePayDay, nPayDays), 23, 59, 59, 999);
                isDueInActiveCycle = nextPayDate.getTime() <= cycleWin.activePayDate.getTime();
            } else if (pDay > 0) {
                const dueProbe = new Date(txDate.getFullYear(), txDate.getMonth() + paid + 1, 1);
                const dDays = new Date(dueProbe.getFullYear(), dueProbe.getMonth() + 1, 0).getDate();
                nextPayDate = new Date(dueProbe.getFullYear(), dueProbe.getMonth(), Math.min(pDay, dDays), 23, 59, 59, 999);
            }
            if (nextPayDate) {
                let sGuard = 0;
                while (sGuard < 12 && isLiabilityCycleMarkedSettled(debtObj, nextPayDate)) {
                    sGuard++;
                    if (nextCutDate && cDay > 0) {
                        const sCutP = new Date(nextCutDate.getFullYear(), nextCutDate.getMonth() + 1, 1);
                        const sCutD = new Date(sCutP.getFullYear(), sCutP.getMonth() + 1, 0).getDate();
                        nextCutDate = new Date(sCutP.getFullYear(), sCutP.getMonth(), Math.min(cDay, sCutD), 23, 59, 59, 999);
                    }
                    const sPayP = new Date(nextPayDate.getFullYear(), nextPayDate.getMonth() + 1, 1);
                    const sPayD = new Date(sPayP.getFullYear(), sPayP.getMonth() + 1, 0).getDate();
                    nextPayDate = new Date(sPayP.getFullYear(), sPayP.getMonth(), Math.min(pDay || 30, sPayD), 23, 59, 59, 999);
                }
                if (hasCutoff && cycleWin) {
                    isDueInActiveCycle = nextPayDate.getTime() <= cycleWin.activePayDate.getTime();
                }
            }

            return {
                tx: t, installments: inst, paidInstallments: paid,
                remainingInstallments: Math.max(0, inst - paid),
                rate, rateType, nextPeriod: paid + 1,
                nextQuota: round2(nextQuota),
                nextPrincipal: round2(nextPrincipal),
                nextInterest: round2(nextInterest),
                remCapital,
                nextCutDate, nextPayDate, isDueInActiveCycle
            };
        })
        .filter(item => item.remainingInstallments > 0 && item.remCapital > 0)
        .sort((a, b) => a.tx.id - b.tx.id);
};

const getDebtMonthlyQuotaBreakdown = (debtAcc, currentBal) => {
    const bal = Math.max(0, round2(currentBal || 0));
    const subPurchases = getPendingRevolvingPurchases(debtAcc.id);
    const subQuotas = round2(subPurchases.reduce((s, p) => s + p.nextQuota, 0));
    const subCapital = round2(subPurchases.reduce((s, p) => s + p.remCapital, 0));
    const subPrincipal = round2(subPurchases.reduce((s, p) => s + p.nextPrincipal, 0));
    const subInterest = round2(subPurchases.reduce((s, p) => s + p.nextInterest, 0));

    let baseBal = 0;
    let baseQuota = 0;
    let basePrincipal = 0;
    let baseInterest = 0;

    if (debtAcc.debtType !== 'revolving') {
        baseBal = Math.max(0, round2(bal - subCapital));
        const totalQuotes = debtAcc.debtTotalQuotes || 1;
        const paidQuotes = debtAcc.debtPaidQuotes || 0;
        if (baseBal > 0 && paidQuotes < totalQuotes) {
            const amort = calculateAmortization(
                debtAcc.debtOriginal || baseBal,
                totalQuotes,
                debtAcc.debtRate || 0,
                debtAcc.debtRateType || 'monthly'
            );
            let q = round2(debtAcc.debtMonthlyPayment || 0);
            if (q === 0) q = amort.payment;
            baseInterest = round2(baseBal * amort.monthlyRate);
            baseQuota = Math.min(q, round2(baseBal + baseInterest));
            basePrincipal = Math.min(baseBal, Math.max(0, round2(baseQuota - baseInterest)));
        }
    }

    return {
        bal,
        baseBal,
        baseQuota,
        basePrincipal,
        baseInterest,
        subPurchases,
        subQuotas,
        subCapital,
        subPrincipal,
        subInterest,
        totalQuota: round2(baseQuota + subQuotas),
        totalPrincipal: round2(basePrincipal + subPrincipal),
        totalInterest: round2(baseInterest + subInterest)
    };
};

const revertTransferAllocation = (tx) => {
    if (!tx || tx.type !== 'transfer') return;
    if (isTxClosed(tx)) {
        const fromObj = getAccountObj(tx.account);
        const toObj = getAccountObj(tx.toAccount);
        const amt = round2(tx.amount);
        if (fromObj.category === 'pocket') adjustPocketBalance(fromObj.id, amt);
        if (toObj.category === 'pocket') adjustPocketBalance(toObj.id, -amt);
    }
    
    // Ya no eliminamos físicamente los hijos (intereses) aquí.
    // El sistema de borrado en cascada en app.js se encarga de enviarlos a la papelera.

    if (!Array.isArray(tx.allocatedItems)) return;
    tx.allocatedItems.forEach(item => {
        if (item.kind === 'cc_tx') {
            const targetTx = financeData.transactions.find(t => String(t.id) === String(item.txId));
            if (targetTx) {
                if (item.mode === 'extraordinary') {
                    targetTx.extraPrincipalPaid = Math.max(0, round2((targetTx.extraPrincipalPaid || 0) - (item.amountApplied || 0)));
                    if (item.prevMonthlyQuota !== undefined) {
                        targetTx.monthlyQuota = item.prevMonthlyQuota;
                    }
                    if (targetTx.wasClosedByExtra) {
                        targetTx.paidInstallments = item.prevPaidInstallments !== undefined
                            ? item.prevPaidInstallments
                            : Math.max(0, (targetTx.paidInstallments || 1) - 1);
                        delete targetTx.wasClosedByExtra;
                    }
                } else {
                    targetTx.paidInstallments = Math.max(0, (targetTx.paidInstallments || 0) - 1);
                }
            }
        } else if (item.kind === 'debt_quota') {
            const debtAcc = financeData.customAccounts.find(a => a.id === item.debtId);
            if (debtAcc) {
                if (item.mode === 'extraordinary' && item.prevDebtState) {
                    debtAcc.debtTotalQuotes = item.prevDebtState.debtTotalQuotes;
                    debtAcc.debtMonthlyPayment = item.prevDebtState.debtMonthlyPayment;
                } else {
                    debtAcc.debtPaidQuotes = Math.max(0, (debtAcc.debtPaidQuotes || 0) - 1);
                }
            }
        }
    });
};

const getCardCycleActivity = (card, refDate = currentDate) => {
    const cDay = Math.max(1, Math.min(31, parseInt(card.cutoffDay, 10) || 15));
    const y = refDate.getFullYear();
    const m = refDate.getMonth();
    const daysInCurrMonth = new Date(y, m + 1, 0).getDate();

    let cycleStart, cycleEnd;
    if (refDate.getDate() <= cDay) {
        const prevMonthDays = new Date(y, m, 0).getDate();
        const prevCutoff = new Date(y, m - 1, Math.min(cDay, prevMonthDays), 23, 59, 59);
        cycleStart = new Date(prevCutoff.getTime() + 1000);
        cycleEnd = new Date(y, m, Math.min(cDay, daysInCurrMonth), 23, 59, 59);
    } else {
        const currCutoff = new Date(y, m, Math.min(cDay, daysInCurrMonth), 23, 59, 59);
        const nextMonthDays = new Date(y, m + 2, 0).getDate();
        cycleStart = new Date(currCutoff.getTime() + 1000);
        cycleEnd = new Date(y, m + 1, Math.min(cDay, nextMonthDays), 23, 59, 59);
    }

    let cycleSpend = 0;
    let cycleTxCount = 0;
    let hasChargedMgmtFee = false;
    let hasChargedInsurance = false;
    const startMs = cycleStart.getTime();
    const endMs = cycleEnd.getTime();

    financeData.transactions.forEach(t => {
        const isCardUse = t.type === 'expense' || (t.type === 'transfer' && String(t.toAccount || '').startsWith('CxC_'));
        if (!t.isDeleted && !(t.isSharedTrip && t.paidBy === 'companion') && t.account === card.id && isCardUse && !t.isAdjustment && isTxClosed(t)) {
            const txMs = getTxEffectiveDateObj(t, refDate).getTime();
            if (txMs >= startMs && txMs <= endMs) {
                const cleanDesc = stripLeadingEmoji(t.description || '');
                if (/^Cuota de manejo\b/i.test(cleanDesc)) {
                    hasChargedMgmtFee = true;
                    return;
                }
                if (/^Seguro vida deudores\b/i.test(cleanDesc)) {
                    hasChargedInsurance = true;
                    return;
                }
                if (t.isInterestCharge || /^Intereses\b/i.test(cleanDesc)) {
                    return;
                }
                cycleSpend = round2(cycleSpend + round2(t.amount));
                cycleTxCount++;
            }
        }
    });

    return { cycleStart, cycleEnd, cycleSpend, cycleTxCount, hasChargedMgmtFee, hasChargedInsurance };
};

const calculateCardMinPaymentEstimate = (card, currentDebt, refDate = currentDate) => {
    const rawDebt = round2(currentDebt || 0);
    const debt = Math.max(0, rawDebt);
    const creditBalance = rawDebt < 0 ? Math.abs(rawDebt) : 0;
    const activeCycle = getCardActivePayCycle(card, refDate);
    // Si el extracto activo ya cerró corte (estamos entre corte y día de pago), evaluar manejo sobre ese corte cerrado
    const activityRefDate = (activeCycle && activeCycle.isBilledStatementOpen) ? activeCycle.activeCutDate : refDate;
    const pending = debt > 0 ? getPendingCardPurchases(card.id, refDate) : [];
    const duePending = pending.filter(p => p.isDueInActiveCycle !== false);
    const deferredQuota = debt > 0 ? round2(duePending.reduce((s, p) => s + p.nextQuota, 0)) : 0;
    const deferredCapital = debt > 0 ? round2(pending.reduce((s, p) => s + p.remCapital, 0)) : 0;
    const cycleInfo = getCardCycleActivity(card, activityRefDate);

    // Saldo de deuda inicial (no asociado a compras diferidas registradas en la app)
    const unallocatedDebt = Math.max(0, round2(debt - deferredCapital));
    const initialTerm = Math.max(1, parseInt(card.initialDebtTerm, 10) || 12);
    let initialQuotaApplied = 0;
    let initialPrincipalApplied = 0;
    let initialInterestApplied = 0;
    let isInitialFallbackTerm = false;

    if (unallocatedDebt > 0) {
        const customInitQuota = round2(card.initialDebtQuota || 0);
        const cardRate = parseFloat(card.rate) || 0;
        const cardRateType = card.rateType || 'monthly';
        const amortInit = calculateAmortization(unallocatedDebt, initialTerm, cardRate, cardRateType);
        const firstMonthInt = round2(unallocatedDebt * amortInit.monthlyRate);

        if (customInitQuota > 0) {
            initialQuotaApplied = Math.min(round2(unallocatedDebt + firstMonthInt), customInitQuota);
            initialInterestApplied = Math.min(initialQuotaApplied, firstMonthInt);
            initialPrincipalApplied = Math.max(0, round2(initialQuotaApplied - initialInterestApplied));
        } else {
            initialQuotaApplied = amortInit.payment;
            initialInterestApplied = firstMonthInt;
            initialPrincipalApplied = Math.max(0, round2(initialQuotaApplied - initialInterestApplied));
            isInitialFallbackTerm = true;
        }
    }

    // Cuota de manejo genérica (saldo o uso, solo saldo, fija, o exonerada por compras / ingresos en cuenta)
    let mgmtFeeAmt = 0;
    let mgmtFeeStatus = 'disabled';
    let mgmtWaiverDetail = '';
    const hasMgmtFee = !!card.hasMgmtFee && round2(card.mgmtFee || 0) > 0;
    const mgmtFeeRule = card.mgmtFeeRule || (card.mgmtFeeOnlyWithDebt === false ? 'always' : 'balance_or_use');
    const waiverSpend = round2(card.mgmtFeeWaiverSpend || 0);
    const waiverIncome = round2(card.mgmtFeeWaiverIncome || 0);
    const waiverAccountId = card.mgmtFeeWaiverAccountId || '';
    const waiverType = card.mgmtFeeWaiverType || 'spend';

    if (hasMgmtFee) {
        const hasBalance = debt > 0;
        const hasUsage = cycleInfo.cycleTxCount > 0;
        let appliesByRule = false;

        if (mgmtFeeRule === 'always') appliesByRule = true;
        else if (mgmtFeeRule === 'balance_only') appliesByRule = hasBalance;
        else appliesByRule = hasBalance || hasUsage;

        const targetMonthId = getMonthId(refDate);
        const accInflow = waiverAccountId ? getAccountMonthlyInflows(waiverAccountId, targetMonthId, false) : 0;
        const accName = waiverAccountId ? stripLeadingEmoji(getAccountObj(waiverAccountId).name) : '';

        const metSpend = (waiverType === 'spend' || waiverType === 'either') && waiverSpend > 0 && cycleInfo.cycleSpend >= waiverSpend;
        const metIncome = (waiverType === 'account_income' || waiverType === 'either') && waiverIncome > 0 && waiverAccountId && accInflow >= waiverIncome;

        if (cycleInfo.hasChargedMgmtFee) {
            mgmtFeeStatus = 'already_charged';
        } else if (!appliesByRule) {
            mgmtFeeStatus = 'no_activity';
        } else if (metSpend || metIncome) {
            mgmtFeeStatus = 'waived';
            mgmtWaiverDetail = metIncome
                ? `Ingresos ${accName}: ${formatCompact(accInflow)}`
                : `Compras ciclo: ${formatCompact(cycleInfo.cycleSpend)}`;
        } else {
            mgmtFeeAmt = round2(card.mgmtFee);
            mgmtFeeStatus = 'charged';
            if ((waiverType === 'account_income' || waiverType === 'either') && waiverIncome > 0 && waiverAccountId) {
                const missingInc = Math.max(0, round2(waiverIncome - accInflow));
                mgmtWaiverDetail = `Faltan ${formatCompact(missingInc)} en ingresos (${accName})`;
            } else if ((waiverType === 'spend' || waiverType === 'either') && waiverSpend > 0) {
                const missingSp = Math.max(0, round2(waiverSpend - cycleInfo.cycleSpend));
                mgmtWaiverDetail = `Faltan ${formatCompact(missingSp)} en compras`;
            }
        }
    }

    // Seguro de vida deudores genérico
    let insuranceAmt = 0;
    let insuranceDetailLabel = '';
    const hasInsurance = !!card.hasInsurance && round2(card.insurancePerMillion || 0) > 0;
    const insuranceRule = card.insuranceRule || 'per_million_min1';
    const insRate = round2(card.insurancePerMillion || 0);

    if (hasInsurance && debt > 0 && !cycleInfo.hasChargedInsurance) {
        if (insuranceRule === 'fixed_if_debt') {
            insuranceAmt = insRate;
            insuranceDetailLabel = 'tarifa fija';
        } else if (insuranceRule === 'per_million_ceil') {
            const units = Math.max(1, Math.ceil(debt / 1000000));
            insuranceAmt = round2(units * insRate);
            insuranceDetailLabel = `${units}M fracción`;
        } else if (insuranceRule === 'per_million_exact') {
            const millions = debt / 1000000;
            insuranceAmt = round2(millions * insRate);
            insuranceDetailLabel = `${millions.toFixed(2).replace('.', ',')}M prop.`;
        } else {
            // Por millón adeudado con mínimo de 1 millón cuando 0 < deuda <= 1M
            const isMin1M = debt <= 1000000;
            const millions = isMin1M ? 1 : (debt / 1000000);
            insuranceAmt = round2(millions * insRate);
            insuranceDetailLabel = isMin1M ? 'mín. 1M' : `${millions.toFixed(2).replace('.', ',')}M prop.`;
        }
    }

    const totalMinPayment = round2(deferredQuota + initialQuotaApplied + mgmtFeeAmt + insuranceAmt);

    return {
        debt,
        cycleSpend: cycleInfo.cycleSpend,
        cycleTxCount: cycleInfo.cycleTxCount,
        deferredQuota,
        deferredCount: pending.length,
        unallocatedDebt,
        initialQuotaApplied,
        initialTerm,
        initialPrincipalApplied,
        initialInterestApplied,
        isInitialFallbackTerm,
        hasMgmtFee,
        mgmtFeeRule,
        mgmtFeeStatus,
        mgmtWaiverDetail,
        mgmtFeeAmt,
        hasInsurance,
        insuranceRule,
        insuranceDetailLabel,
        insuranceAmt,
        totalMinPayment
    };
};

const getAccountMonthlyInflows = (accountId, monthId, includePending = false) => {
    if (!accountId || !monthId) return 0;
    let totalInflow = 0;
    financeData.transactions.forEach(t => {
        if (!t.isDeleted && getTxMonthId(t) === monthId && !t.isAdjustment && (includePending || isTxClosed(t))) {
            const val = t.status === 'pending' ? round2(t.budgetedAmount || t.amount) : round2(t.amount);
            if (t.type === 'income' && t.account === accountId) {
                totalInflow = round2(totalInflow + val);
            } else if (t.type === 'transfer' && t.toAccount === accountId) {
                totalInflow = round2(totalInflow + val);
            }
        }
    });
    return totalInflow;
};

const calculateCardStatementProjection = (card, currentDebt, monthOffset = 0, refDate = currentDate) => {
    const cDay = Math.max(1, Math.min(31, parseInt(card.cutoffDay, 10) || 15));
    const pDay = Math.max(1, Math.min(31, parseInt(card.paymentDay, 10) || 30));

    // Anclar cada columna al mes calendario de pago (-1 = mes anterior, 0 = mes actual, +1..+4 = próximos 4 meses)
    const payTotalMonths = monthOffset;
    const payDaysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + payTotalMonths + 1, 0).getDate();
    const payDateObj = new Date(refDate.getFullYear(), refDate.getMonth() + payTotalMonths, Math.min(pDay, payDaysInMonth));

    const cutTotalMonths = pDay <= cDay ? payTotalMonths - 1 : payTotalMonths;
    const cutDaysInMonth = new Date(refDate.getFullYear(), refDate.getMonth() + cutTotalMonths + 1, 0).getDate();
    const cutDateObj = new Date(refDate.getFullYear(), refDate.getMonth() + cutTotalMonths, Math.min(cDay, cutDaysInMonth));

    // Offset de pago que corresponde al ciclo activo actual de la tarjeta
    const baseCutMonthOffset = refDate.getDate() <= cDay ? 0 : 1;
    const activePayOffset = pDay <= cDay ? baseCutMonthOffset + 1 : baseCutMonthOffset;
    const cycleDelta = monthOffset - activePayOffset;

    const shortLabel = `${getShortMonthLabel(payDateObj).toUpperCase()} ${String(payDateObj.getFullYear()).slice(-2)}`;
    const rawFullLabel = payDateObj.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
    const fullMonthLabel = rawFullLabel.charAt(0).toUpperCase() + rawFullLabel.slice(1);
    const cutoffDateLabel = cutDateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
    const paymentDateLabel = payDateObj.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });

    const prevCutDays = new Date(cutDateObj.getFullYear(), cutDateObj.getMonth(), 0).getDate();
    const prevCutDateObj = new Date(cutDateObj.getFullYear(), cutDateObj.getMonth() - 1, Math.min(cDay, prevCutDays), 23, 59, 59);
    const cycleStartMs = prevCutDateObj.getTime() + 1000;
    const cycleEndMs = new Date(cutDateObj.getFullYear(), cutDateObj.getMonth(), cutDateObj.getDate(), 23, 59, 59).getTime();

    const nextCutProbe = new Date(cutDateObj.getFullYear(), cutDateObj.getMonth() + 1, 1);
    const nextCutDays = new Date(nextCutProbe.getFullYear(), nextCutProbe.getMonth() + 1, 0).getDate();
    const payWinStartMs = cycleEndMs + 1;
    const payWinEndMs = new Date(nextCutProbe.getFullYear(), nextCutProbe.getMonth(), Math.min(cDay, nextCutDays), 23, 59, 59, 999).getTime();
    const cyclePayData = getPaymentsInWindowForLiability(card, payWinStartMs, payWinEndMs);
    const cyclePayments = cyclePayData.payments;

    const calcInstallmentIdxForPayDate = (p, targetPayDate) => {
        if (!p.nextPayDate) return p.paidInstallments;
        const mDiff = (targetPayDate.getFullYear() - p.nextPayDate.getFullYear()) * 12 + (targetPayDate.getMonth() - p.nextPayDate.getMonth());
        if (mDiff < 0) return -1;
        return p.paidInstallments + mDiff;
    };

    const projectInstallmentStep = (p, targetIdx) => {
        if (targetIdx < p.paidInstallments || targetIdx >= p.installments) return null;
        const amort = calculateAmortization(round2(p.tx.amount), p.installments, p.rate, p.rateType);
        const stepQuota = (p.tx.monthlyQuota && p.tx.monthlyQuota > 0) ? round2(p.tx.monthlyQuota) : amort.payment;
        let simCap = round2(p.remCapital);
        for (let idx = p.paidInstallments; idx <= targetIdx; idx++) {
            if (simCap <= 0.01) return null;
            const stepInt = round2(simCap * amort.monthlyRate);
            const isLast = idx === p.installments - 1;
            const stepPay = isLast ? round2(simCap + stepInt) : Math.min(stepQuota, round2(simCap + stepInt));
            const stepPrin = Math.min(simCap, Math.max(0, round2(stepPay - stepInt)));
            if (idx === targetIdx) {
                return { amount: round2(stepPay), principal: stepPrin, interest: stepInt, remCapital: simCap };
            }
            simCap = Math.max(0, round2(simCap - stepPrin));
        }
        return null;
    };

    if (cycleDelta === 0) {
        const est = calculateCardMinPaymentEstimate(card, currentDebt, cutDateObj);
        const pending = getPendingCardPurchases(card.id, refDate);
        const items = [];

        pending.forEach(p => {
            const targetIdx = calcInstallmentIdxForPayDate(p, payDateObj);
            const step = projectInstallmentStep(p, targetIdx);
            if (!step) return;
            items.push({
                kind: 'deferred',
                txId: p.tx.id,
                title: stripLeadingEmoji(p.tx.description),
                subtitle: `Cuota ${targetIdx + 1} de ${p.installments}`,
                amount: step.amount,
                principal: step.principal,
                interest: step.interest,
                remCapital: step.remCapital
            });
        });

        if (est.initialQuotaApplied > 0) {
            items.push({
                kind: 'initial',
                title: 'Cuota deuda inicial',
                subtitle: est.isInitialFallbackTerm ? `Proyección estándar ${est.initialTerm} cuotas` : 'Cuota fija configurada',
                amount: est.initialQuotaApplied,
                principal: est.initialPrincipalApplied,
                interest: est.initialInterestApplied,
                remCapital: est.unallocatedDebt
            });
        }
        if (est.mgmtFeeAmt > 0) {
            items.push({
                kind: 'fee',
                title: 'Cuota de manejo',
                subtitle: est.mgmtWaiverDetail || 'Cargo mensual de administración',
                amount: est.mgmtFeeAmt,
                principal: 0,
                interest: est.mgmtFeeAmt
            });
        } else if (est.hasMgmtFee && est.mgmtFeeStatus === 'waived') {
            items.push({
                kind: 'fee',
                title: 'Cuota de manejo',
                subtitle: `Exonerada • ${est.mgmtWaiverDetail}`,
                amount: 0,
                principal: 0,
                interest: 0,
                isWaived: true
            });
        }
        if (est.insuranceAmt > 0) {
            items.push({
                kind: 'fee',
                title: 'Seguro de vida deudores',
                subtitle: `Cálculo ${est.insuranceDetailLabel}`,
                amount: est.insuranceAmt,
                principal: 0,
                interest: est.insuranceAmt
            });
        }

        const isMarkedPreAppSettled = isLiabilityCycleMarkedSettled(card, payDateObj);
        const payDateIso = toLocalIsoDateStr(payDateObj);
        const diffPayDays = Math.ceil((payDateObj - refDate) / (1000 * 3600 * 24));
        const badgeText = isMarkedPreAppSettled
            ? 'Pagado'
            : (diffPayDays === 0 ? 'Vence hoy' : (diffPayDays < 0 ? `Venció hace ${Math.abs(diffPayDays)}d` : `En ${diffPayDays}d`));

        return {
            monthOffset,
            isCurrentCycle: true,
            isPreAppSettled: isMarkedPreAppSettled,
            payDateIso,
            shortLabel,
            fullMonthLabel,
            cutoffDateLabel,
            paymentDateLabel,
            badgeText,
            minPayment: isMarkedPreAppSettled ? 0 : round2(items.reduce((s, it) => s + it.amount, 0)),
            debtAtCutoff: est.debt,
            cycleSpend: est.cycleSpend,
            cycleTxCount: est.cycleTxCount,
            items: isMarkedPreAppSettled ? [] : items,
            payments: cyclePayments,
            isHistorical: false
        };
    }

    if (cycleDelta > 0) {
        const baseEst = calculateCardMinPaymentEstimate(card, currentDebt, refDate);
        const pending = getPendingCardPurchases(card.id);
        const items = [];
        let projectedDebtAtCutoff = 0;

        pending.forEach(p => {
            const targetIdx = calcInstallmentIdxForPayDate(p, payDateObj);
            const step = projectInstallmentStep(p, targetIdx);
            if (step && step.remCapital > 0) {
                projectedDebtAtCutoff = round2(projectedDebtAtCutoff + step.remCapital);
                items.push({
                    kind: 'deferred',
                    txId: p.tx.id,
                    title: stripLeadingEmoji(p.tx.description),
                    subtitle: `Cuota ${targetIdx + 1} de ${p.installments}`,
                    amount: step.amount,
                    principal: step.principal,
                    interest: step.interest,
                    remCapital: step.remCapital
                });
            }
        });

        const initTerm = Math.max(1, parseInt(card.initialDebtTerm, 10) || 12);
        const initAmortProj = baseEst.unallocatedDebt > 0
            ? calculateAmortization(baseEst.unallocatedDebt, initTerm, parseFloat(card.rate) || 0, card.rateType || 'monthly')
            : { payment: 0, monthlyRate: 0 };
        const initStepQuota = round2(card.initialDebtQuota || 0) > 0 ? round2(card.initialDebtQuota) : initAmortProj.payment;
        const initStepPrincipal = Math.max(0, round2(initStepQuota - round2(baseEst.unallocatedDebt * initAmortProj.monthlyRate)));
        const remUnallocAtCutoff = Math.max(0, round2(baseEst.unallocatedDebt - (initStepPrincipal > 0 ? initStepPrincipal : initStepQuota) * cycleDelta));
        if (remUnallocAtCutoff > 0 && initStepQuota > 0) {
            const projInt = round2(remUnallocAtCutoff * initAmortProj.monthlyRate);
            const qInit = round2(Math.min(round2(remUnallocAtCutoff + projInt), initStepQuota));
            const qInitPrin = Math.max(0, round2(qInit - projInt));
            projectedDebtAtCutoff = round2(projectedDebtAtCutoff + remUnallocAtCutoff);
            items.push({
                kind: 'initial',
                title: 'Cuota deuda inicial',
                subtitle: `Proyección +${cycleDelta} mes${cycleDelta > 1 ? 'es' : ''}`,
                amount: qInit,
                principal: qInitPrin,
                interest: projInt,
                remCapital: remUnallocAtCutoff
            });
        }

        const hasMgmtFee = !!card.hasMgmtFee && round2(card.mgmtFee || 0) > 0;
        const mgmtFeeRule = card.mgmtFeeRule || (card.mgmtFeeOnlyWithDebt === false ? 'always' : 'balance_or_use');
        if (hasMgmtFee && (mgmtFeeRule === 'always' || projectedDebtAtCutoff > 0)) {
            const waiverIncome = round2(card.mgmtFeeWaiverIncome || 0);
            const waiverAccountId = card.mgmtFeeWaiverAccountId || '';
            const waiverType = card.mgmtFeeWaiverType || 'spend';
            const projMonthId = getMonthId(cutDateObj);
            const scheduledInflow = waiverAccountId ? getAccountMonthlyInflows(waiverAccountId, projMonthId, true) : 0;

            let isFutureWaived = false;
            if ((waiverType === 'account_income' || waiverType === 'either') && waiverIncome > 0 && waiverAccountId) {
                if (scheduledInflow >= waiverIncome) {
                    isFutureWaived = true;
                } else if (waiverAccountId === getDefaultAccountId(true)) {
                    const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
                    if (salCfg) {
                        const salMetrics = calculateLaborMetrics(salCfg, cutDateObj);
                        if (salMetrics.net >= waiverIncome) isFutureWaived = true;
                    }
                }
            }

            if (isFutureWaived) {
                const accName = stripLeadingEmoji(getAccountObj(waiverAccountId).name);
                items.push({
                    kind: 'fee',
                    title: 'Cuota de manejo',
                    subtitle: `Exonerada por ingresos proyectados (${accName})`,
                    amount: 0,
                    principal: 0,
                    interest: 0,
                    isWaived: true
                });
            } else {
                items.push({
                    kind: 'fee',
                    title: 'Cuota de manejo',
                    subtitle: 'Cargo mensual proyectado',
                    amount: round2(card.mgmtFee),
                    principal: 0,
                    interest: round2(card.mgmtFee)
                });
            }
        }

        const hasInsurance = !!card.hasInsurance && round2(card.insurancePerMillion || 0) > 0;
        if (hasInsurance && projectedDebtAtCutoff > 0) {
            const insRate = round2(card.insurancePerMillion || 0);
            const insRule = card.insuranceRule || 'per_million_min1';
            let insAmt = 0;
            if (insRule === 'fixed_if_debt') insAmt = insRate;
            else if (insRule === 'per_million_ceil') insAmt = round2(Math.max(1, Math.ceil(projectedDebtAtCutoff / 1000000)) * insRate);
            else if (insRule === 'per_million_exact') insAmt = round2((projectedDebtAtCutoff / 1000000) * insRate);
            else insAmt = round2(Math.max(1, projectedDebtAtCutoff / 1000000) * insRate);

            items.push({
                kind: 'fee',
                title: 'Seguro de vida deudores',
                subtitle: 'Proyección sobre saldo al corte',
                amount: insAmt,
                principal: 0,
                interest: insAmt
            });
        }

        const minPayment = round2(items.reduce((s, it) => s + it.amount, 0));
        return {
            monthOffset,
            isCurrentCycle: false,
            shortLabel,
            fullMonthLabel,
            cutoffDateLabel,
            paymentDateLabel,
            badgeText: `En ${cycleDelta} mes${cycleDelta > 1 ? 'es' : ''}`,
            minPayment,
            debtAtCutoff: projectedDebtAtCutoff,
            cycleSpend: 0,
            cycleTxCount: 0,
            items,
            payments: [],
            isHistorical: false
        };
    }

    // Extracto de ciclo anterior (cycleDelta < 0): saldo exacto hasta el segundo de cierre del corte
    const refDayStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0);
    const diffHistPayDays = Math.round((payDateObj.getTime() - refDayStart.getTime()) / 86400000);
    const isMarkedPreAppSettled = isLiabilityCycleMarkedSettled(card, payDateObj);
    const payDateIso = toLocalIsoDateStr(payDateObj);

    let rawCutBal = 0;
    financeData.transactions.forEach(t => {
        if (t.isDeleted || !isTxClosed(t) || (t.isSharedTrip && t.paidBy === 'companion')) return;
        const txMs = getTxEffectiveDateObj(t, cutDateObj).getTime();
        const isInitialCardSetup = !!(t.isAdjustment && t.account === card.id && /^Saldo Inicial/i.test(stripLeadingEmoji(t.description || '')));
        // Si el extracto sigue abierto por vencer y NO fue marcado como pagado previamente, incluir el Saldo Inicial
        if (txMs > cycleEndMs && !(diffHistPayDays >= 0 && isInitialCardSetup && !isMarkedPreAppSettled)) return;
        const amt = round2(t.amount);
        if (t.account === card.id) {
            if (t.type === 'expense' || t.type === 'transfer') rawCutBal = round2(rawCutBal + amt);
            else if (t.type === 'income') rawCutBal = round2(rawCutBal - amt);
        }
        if (t.type === 'transfer' && t.toAccount === card.id) {
            rawCutBal = round2(rawCutBal - amt);
        }
    });
    const debtAtCutoff = Math.max(0, rawCutBal);

    // Si el extracto ya cortó pero su fecha límite de pago aún no vence, mostrar lo pendiente real de ese extracto
    if (diffHistPayDays >= 0) {
        if (isMarkedPreAppSettled) {
            return {
                monthOffset,
                isCurrentCycle: false,
                isBilledOpenCycle: true,
                isPreAppSettled: true,
                payDateIso,
                shortLabel,
                fullMonthLabel,
                cutoffDateLabel,
                paymentDateLabel,
                badgeText: 'Pagado',
                minPayment: 0,
                debtAtCutoff,
                cycleSpend: 0,
                cycleTxCount: 0,
                items: [],
                payments: cyclePayments,
                isHistorical: false
            };
        }

        const billedEst = debtAtCutoff > 0 ? calculateCardMinPaymentEstimate(card, Math.min(Math.max(0, round2(currentDebt || 0)), debtAtCutoff), cutDateObj) : null;
        const billedItems = [];

        if (billedEst) {
            const pending = getPendingCardPurchases(card.id, cutDateObj)
                .filter(p => calcInstallmentIdxForPayDate(p, payDateObj) === p.paidInstallments);
            pending.forEach(p => {
                const amort = calculateAmortization(round2(p.tx.amount), p.installments, p.rate, p.rateType);
                const row = amort.schedule[p.paidInstallments] || { principal: p.nextQuota, interest: 0 };
                billedItems.push({
                    kind: 'deferred',
                    txId: p.tx.id,
                    title: stripLeadingEmoji(p.tx.description),
                    subtitle: `Cuota ${p.nextPeriod} de ${p.installments}`,
                    amount: p.nextQuota,
                    principal: Math.min(p.remCapital, row.principal),
                    interest: row.interest,
                    remCapital: p.remCapital
                });
            });

            if (!cyclePayData.hasOrdinaryInstallmentTx) {
                if (billedEst.initialQuotaApplied > 0) {
                    billedItems.push({
                        kind: 'initial',
                        title: 'Cuota deuda al corte',
                        subtitle: billedEst.isInitialFallbackTerm ? `Proyección estándar ${billedEst.initialTerm} cuotas` : 'Cuota fija configurada',
                        amount: billedEst.initialQuotaApplied,
                        principal: billedEst.initialPrincipalApplied,
                        interest: billedEst.initialInterestApplied
                    });
                }
                if (billedEst.mgmtFeeAmt > 0) {
                    billedItems.push({
                        kind: 'fee',
                        title: 'Cuota de manejo',
                        subtitle: billedEst.mgmtWaiverDetail || 'Cargo mensual de administración',
                        amount: billedEst.mgmtFeeAmt,
                        principal: 0,
                        interest: billedEst.mgmtFeeAmt
                    });
                }
                if (billedEst.insuranceAmt > 0) {
                    billedItems.push({
                        kind: 'fee',
                        title: 'Seguro de vida deudores',
                        subtitle: `Cálculo ${billedEst.insuranceDetailLabel}`,
                        amount: billedEst.insuranceAmt,
                        principal: 0,
                        interest: billedEst.insuranceAmt
                    });
                }
            }
        }

        const rawMin = round2(billedItems.reduce((s, it) => s + it.amount, 0));
        const remMin = cyclePayData.hasOrdinaryInstallmentTx && billedItems.length === 0
            ? 0
            : Math.max(0, round2(rawMin - (billedItems.some(i => i.kind === 'initial') ? cyclePayData.ordinaryPaidTotal : 0)));
        const isSettled = remMin <= 0.01 && (cyclePayments.length > 0 || debtAtCutoff <= 0.01);

        return {
            monthOffset,
            isCurrentCycle: false,
            isBilledOpenCycle: true,
            isPreAppSettled: false,
            payDateIso,
            shortLabel,
            fullMonthLabel,
            cutoffDateLabel,
            paymentDateLabel,
            badgeText: isSettled ? 'Pagado' : (diffHistPayDays === 0 ? 'Vence hoy' : `En ${diffHistPayDays}d`),
            minPayment: remMin,
            debtAtCutoff,
            cycleSpend: billedEst ? billedEst.cycleSpend : 0,
            cycleTxCount: billedEst ? billedEst.cycleTxCount : 0,
            items: billedItems,
            payments: cyclePayments,
            isHistorical: false
        };
    }

    const histExpenses = financeData.transactions
        .filter(t => !t.isDeleted && t.account === card.id && t.type === 'expense' && !t.isAdjustment && isTxClosed(t))
        .filter(t => t.id >= cycleStartMs && t.id <= cycleEndMs)
        .map(t => ({
            kind: 'historical_exp',
            txId: t.id,
            title: stripLeadingEmoji(t.description),
            subtitle: t.installments > 1 ? `Compra a ${t.installments} cuotas` : t.date,
            amount: round2(t.amount),
            principal: round2(t.amount),
            interest: 0
        }));

    const histTotal = round2(histExpenses.reduce((s, it) => s + it.amount, 0));

    return {
        monthOffset,
        isCurrentCycle: false,
        shortLabel,
        fullMonthLabel,
        cutoffDateLabel,
        paymentDateLabel,
        badgeText: 'Cerrado',
        minPayment: histTotal,
        debtAtCutoff,
        cycleSpend: histTotal,
        cycleTxCount: histExpenses.length,
        items: histExpenses,
        payments: cyclePayments,
        isHistorical: true
    };
};

const getCommittedMonthlyDebtQuotas = (snap, { onlyUnpaidCurrentMonth = false, refDate = currentDate } = {}) => {
    let committedMonthly = 0;
    const refMonthId = getMonthId(refDate);
    const maxDaysM = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();

    // Solo sumar deudas que NO sean libranzas (las libranzas ya se restan del salario neto)
    financeData.customAccounts.filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
        const bal = Math.max(0, round2(snap.bals[d.id] || 0));
        if (bal <= 0) return;

        if (onlyUnpaidCurrentMonth) {
            if (d.paymentDay) {
                const dueThisM = new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(d.paymentDay, maxDaysM), 12, 0, 0);
                const st = getLiabilityDueCycleState(d, bal, dueThisM, refDate);
                committedMonthly = round2(committedMonthly + st.remainingQuota);
                return;
            }
            const paidThisMonth = isLiabilityCycleMarkedSettled(d, refDate) || (financeData.transactions || []).some(t =>
                !t.isDeleted && isTxClosed(t) && t.paymentMode !== 'extraordinary' && getTxMonthId(t) === refMonthId && t.type === 'transfer' && t.toAccount === d.id
            );
            if (paidThisMonth) return;
        }

        const qInfo = getDebtMonthlyQuotaBreakdown(d, bal);
        committedMonthly = round2(committedMonthly + qInfo.totalQuota);
    });

    financeData.customAccounts.filter(a => a.category === 'credit_card').forEach(c => {
        const bal = Math.max(0, round2(snap.bals[c.id] || 0));
        if (bal <= 0) return;

        if (onlyUnpaidCurrentMonth) {
            const pDay = Math.max(1, Math.min(31, parseInt(c.paymentDay, 10) || 30));
            const dueThisM = new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(pDay, maxDaysM), 12, 0, 0);
            const stThisM = getLiabilityDueCycleState(c, bal, dueThisM, refDate);
            if (!stThisM.isPaid && stThisM.remainingQuota > 0) {
                committedMonthly = round2(committedMonthly + stThisM.remainingQuota);
            } else if (dueThisM.getDate() < refDate.getDate()) {
                const nextCycle = getCardActivePayCycle(c, refDate);
                if (nextCycle && nextCycle.isBilledStatementOpen) {
                    const stNext = getLiabilityDueCycleState(c, bal, nextCycle.activePayDate, refDate);
                    committedMonthly = round2(committedMonthly + stNext.remainingQuota);
                }
            }
            return;
        }

        const est = calculateCardMinPaymentEstimate(c, bal, refDate);
        if (est.totalMinPayment > 0) {
            committedMonthly = round2(committedMonthly + est.totalMinPayment);
        }
    });

    return committedMonthly;
};

const calculateBorrowingCapacity = (monthId, customMaxPct = null) => {
    const snap = computeBalancesUpTo(monthId);
    const maxPct = customMaxPct !== null ? customMaxPct : (financeData.healthGoals?.debt || 30);

    let baseIncome = 0;
    let incomeSource = 'Mes actual';
    let libranzaDebtMonthly = 0;
    const cfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    if (cfg) {
        const metrics = calculateLaborMetrics(cfg, currentDate);
        if (metrics.grossNet > 0) {
            baseIncome = metrics.grossNet;
            libranzaDebtMonthly = round2(metrics.payrollDebtDeductions || 0);
            incomeSource = 'Nómina neta';
        }
    }
    if (baseIncome <= 0) {
        baseIncome = getMonthlyFlow(monthId, false).inc;
    }

    const committedMonthly = round2(getCommittedMonthlyDebtQuotas(snap) + libranzaDebtMonthly);
    const maxMonthlyCapacity = round2(baseIncome * (maxPct / 100));
    const availableMonthlyCapacity = round2(maxMonthlyCapacity - committedMonthly);
    const usedPct = baseIncome > 0 ? round2((committedMonthly / baseIncome) * 100) : 0;

    const refRate = 0.015;
    const calcMaxPrincipal = (months) => {
        if (availableMonthlyCapacity <= 0) return 0;
        return round2(availableMonthlyCapacity * ((1 - Math.pow(1 + refRate, -months)) / refRate));
    };

    return {
        baseIncome, incomeSource, maxPct, usedPct, maxMonthlyCapacity,
        committedMonthly, availableMonthlyCapacity,
        estLoan24m: calcMaxPrincipal(24), estLoan36m: calcMaxPrincipal(36)
    };
};

const calculateFinancialHealth = (monthId, snap) => {
    const goals = financeData.healthGoals || { margin: 15, liquidity: 3, debt: 30, networth: 10 };
    const flow = getMonthlyFlow(monthId, false);

    // Patrimonio Total: Incluye CxC_ para visión realista de riqueza a largo plazo
    const totalAssets = round2(snap.assetsTotal + snap.cxcTotal + snap.fixedAssetsTotal + snap.allPocketsTotal);
    
    if (flow.inc === 0 && flow.exp === 0 && snap.assetsTotal === 0 && snap.liabilitiesTotal === 0 && snap.pocketsTotal === 0 && snap.fixedAssetsTotal === 0) {
        return {
            isNeutral: true,
            scores: { flow: 0, liquidity: 0, debt: 0, networth: 0, global: 0 },
            metrics: { margin: 0, monthsReserve: 0, daysReserve: 0, debtBurden: 0, netWorth: 0 },
            goals
        };
    }

    let margin = 0, scoreFlow = 0;
    if (flow.inc > 0) {
        margin = round2((flow.net / flow.inc) * 100);
        if (margin >= goals.margin) scoreFlow = 100;
        else scoreFlow = Math.max(0, Math.round((margin / goals.margin) * 100));
    }

    // Liquidez Inmediata: Excluye CxC_ (solo activos líquidos reales y bolsillos)
    const liquidAssets = round2(snap.assetsTotal + snap.allPocketsTotal);
    
    const monthlyDebtPayments = getCommittedMonthlyDebtQuotas(snap);

    // Proyección inteligente de gasto (Denominador Híbrido Realista)
    let totalBudget = 0;
    const [evalYear, evalMonth] = monthId.split('-').map(Number);
    const evalMonthIdx = evalMonth - 1;
    
    if (financeData.categories && financeData.categories.expense) {
         financeData.categories.expense.forEach(c => { totalBudget += getCategoryLimitForMonth(c, evalMonthIdx, evalYear); });
    }

    const regularTrans = financeData.transactions.filter(t => !t.isDeleted && !t.isTripIsolated && t.type === 'expense' && !t.isAdjustment && isTxClosed(t));
    const monthsCount = new Set(regularTrans.map(t => getTxMonthId(t))).size || 1;
    const avgExpense = round2(regularTrans.reduce((s, t) => s + round2(t.amount), 0) / monthsCount);

    // Híbrido: el mayor entre lo comprometido (presupuesto + deudas), promedio histórico, o ejecución real del mes
    const committedOutflow = round2(totalBudget + monthlyDebtPayments);
    let effectiveExp = Math.max(committedOutflow, round2(avgExpense + monthlyDebtPayments), round2(flow.exp + monthlyDebtPayments));
    
    if (effectiveExp === 0) {
        const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
        effectiveExp = salCfg ? round2((salCfg.basicSalary || 1000000) * 0.5) : 1000000;
    }

    const monthsReserve = round2(liquidAssets / effectiveExp);
    const daysReserve = Math.floor(monthsReserve * 30);
    
    let scoreLiq = 0;
    if (monthsReserve >= goals.liquidity) scoreLiq = 100;
    else scoreLiq = Math.max(0, Math.round((monthsReserve / goals.liquidity) * 100));

    // Proyección inteligente de Ingresos (para evitar el falso 100% a inicio de mes)
    let effectiveInc = flow.inc;
    if (effectiveInc === 0) {
        let totalIncBudget = 0;
        if (financeData.categories && financeData.categories.income) {
            financeData.categories.income.forEach(c => { totalIncBudget += getCategoryLimitForMonth(c, evalMonthIdx, evalYear); });
        }
        const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
        const baseSalary = salCfg ? (salCfg.basicSalary || 0) : 0;
        effectiveInc = totalIncBudget > 0 ? totalIncBudget : baseSalary;
    }

    // Recálculo del Flujo de Caja con datos efectivos
    let realMargin = 0;
    let realScoreFlow = 0;
    if (effectiveInc > 0) {
        realMargin = round2(((effectiveInc - effectiveExp) / effectiveInc) * 100);
        if (realMargin >= goals.margin) realScoreFlow = 100;
        else if (realMargin < 0) realScoreFlow = 0;
        else realScoreFlow = Math.max(0, Math.round((realMargin / goals.margin) * 100));
    }

    let debtBurden = 0, scoreDebt = 100;

    // La deuda se mide contra tu ingreso efectivo (real o proyectado)
    if (effectiveInc > 0) {
        debtBurden = round2((monthlyDebtPayments / effectiveInc) * 100);
        if (debtBurden <= goals.debt) scoreDebt = 100;
        else if (debtBurden >= 60) scoreDebt = 0;
        else scoreDebt = Math.max(0, 100 - Math.round(((debtBurden - goals.debt) / (60 - goals.debt)) * 100));
    } else if (monthlyDebtPayments > 0) {
        scoreDebt = 0; 
    }

    let scoreNw = 0;
    if (totalAssets > 0) {
        const liabilityRatio = (snap.liabilitiesTotal / totalAssets) * 100;
        if (liabilityRatio === 0) scoreNw = 100;
        else if (liabilityRatio >= 100) scoreNw = 0;
        else scoreNw = Math.max(0, 100 - Math.round(liabilityRatio));
    } else if (snap.liabilitiesTotal > 0) {
        scoreNw = 0; 
    }

    const globalScore = Math.round((realScoreFlow + scoreLiq + scoreDebt + scoreNw) / 4);

    return {
        isNeutral: false,
        scores: { flow: realScoreFlow, liquidity: scoreLiq, debt: scoreDebt, networth: scoreNw, global: globalScore },
        metrics: { 
            margin: realMargin, 
            monthsReserve,
            daysReserve,
            debtBurden, 
            netWorth: snap.netWorth, 
            effectiveExp,
            effectiveInc,
            monthlyDebtPayments,
            totalAssets,
            totalLiabilities: snap.liabilitiesTotal
        },
        goals
    };
};

// --- 7. PARÁMETROS TRIBUTARIOS, NÓMINA COLOMBIA Y LIQUIDACIÓN ---
const DEFAULT_TAX_PARAMS_2026 = {
    year: 2026,
    uvt: 52374,
    smmlv: 1750905,
    transportAid: 249095,
    exempt25AnnualUvt: 790,
    global40AnnualUvt: 1340,
    prepaidMonthlyUvt: 16,
    dependentsMonthlyUvt: 32,
    housingMonthlyUvt: 100,
    voluntaryAnnualUvt: 3800,
    nonSalaryCapPct: 40,
    fspSmmlvThreshold: 4
};

const getTaxParams = () => {
    const stored = safeJsonParse(localStorage.getItem('myFinancesTaxParams'), null);
    if (stored && typeof stored === 'object') return { ...DEFAULT_TAX_PARAMS_2026, ...stored };
    const sCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    if (sCfg && typeof sCfg === 'object') {
        return {
            ...DEFAULT_TAX_PARAMS_2026,
            smmlv: parseMoneyInput(sCfg.smmlv) || DEFAULT_TAX_PARAMS_2026.smmlv,
            transportAid: parseMoneyInput(sCfg.transportAid) || DEFAULT_TAX_PARAMS_2026.transportAid
        };
    }
    return { ...DEFAULT_TAX_PARAMS_2026 };
};

const getTaxParamsByYearMap = () => {
    const storedMain = safeJsonParse(localStorage.getItem('myFinancesTaxParams'), null);
    const fromMain = (storedMain && typeof storedMain.byYear === 'object' && storedMain.byYear) ? storedMain.byYear : {};
    const legacy = safeJsonParse(localStorage.getItem('myFinancesTaxParamsByYear'), null);
    return { ...((legacy && typeof legacy === 'object') ? legacy : {}), ...fromMain };
};

const getTaxParamsForYear = (targetYear) => {
    const current = getTaxParams();
    const yr = parseInt(targetYear, 10);
    if (!yr) return current;
    const byYear = getTaxParamsByYearMap();
    if (byYear[yr] && typeof byYear[yr] === 'object') {
        return { ...DEFAULT_TAX_PARAMS_2026, ...byYear[yr], year: yr };
    }
    if (Number(current.year) === yr) return current;
    if (yr === 2026) return { ...DEFAULT_TAX_PARAMS_2026 };
    return { ...current, year: yr };
};

const saveTaxParams = (params) => {
    const prev = getTaxParams();
    const { byYear: _prevBy, ...cleanPrev } = prev || {};
    const { byYear: _newBy, ...cleanInput } = params || {};
    const merged = { ...DEFAULT_TAX_PARAMS_2026, ...cleanInput };
    const byYear = { ...getTaxParamsByYearMap() };
    if (cleanPrev.year) byYear[cleanPrev.year] = { ...cleanPrev };
    if (merged.year) byYear[merged.year] = { ...merged };
    const toStore = { ...merged, byYear };
    localStorage.setItem('myFinancesTaxParams', JSON.stringify(toStore));
    try { localStorage.removeItem('myFinancesTaxParamsByYear'); } catch (_) {}
    return merged;
};

const checkRentaDeclaration = (year, customParams = null, customSalaryCfg = null, explicitTxs = null) => {
    const params = customParams || getTaxParamsForYear(year);
    const uvt = params.uvt || 52374;
    // Topes DIAN en UVT (Art. 592 y 594-3 E.T.)
    const limits = {
        patrimonio: 4500 * uvt,
        ingresos: 1400 * uvt,
        tarjetas: 1400 * uvt,
        compras: 1400 * uvt,
        consignaciones: 1400 * uvt
    };

    let patrimonio = 0, ingresos = 0, tarjetas = 0, compras = 0, consignaciones = 0;
    
    // 1. Patrimonio Bruto (Activos + Bolsillos + Activos Fijos + CxC + CDTs activos) a corte de 31 Dic
    const snap = computeBalancesUpTo(`${year}-12`);
    const cdtsForYear = safeJsonParse(localStorage.getItem('lumen_cdts_v1'), []);
    const cdtCapitalDec31 = (Array.isArray(cdtsForYear) ? cdtsForYear : [])
        .filter(c => c && c.estado !== 'liquidado' && (!c.fechaApertura || String(c.fechaApertura) <= `${year}-12-31`))
        .reduce((s, c) => round2(s + Math.max(0, round2(c.capital || 0))), 0);
    patrimonio = round2(snap.assetsTotal + snap.fixedAssetsTotal + snap.allPocketsTotal + snap.cxcTotal + cdtCapitalDec31);
    
    // 2. Sumatoria de flujos durante el año (soporta lista combinada con IndexedDB si fue archivado)
    const isPhysicalCashAccount = (acc) => /^(efectivo|caja\s*menor|billetera\s*f[ií]sica)$/i.test(stripLeadingEmoji(acc?.name || '').trim());
    const sourceTxs = Array.isArray(explicitTxs) ? explicitTxs : financeData.transactions;

    sourceTxs.forEach(t => {
        if (!t || t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion')) return;
        const mId = getTxMonthId(t);
        const txYear = /^\d{4}-\d{2}$/.test(String(mId || ''))
            ? parseInt(String(mId).slice(0, 4), 10)
            : new Date(t.id).getFullYear();
        if (txYear === year && isTxClosed(t) && !t.isAdjustment) {
            const val = round2(t.amount);
            if (val <= 0) return;
            const accObj = getAccountObj(t.account);

            if (t.type === 'income') {
                if (!(typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t))) {
                    ingresos = round2(ingresos + val);
                }
                if (!isPhysicalCashAccount(accObj)) {
                    consignaciones = round2(consignaciones + val);
                }
            } else if (t.type === 'expense') {
                compras = round2(compras + val);
                if (accObj?.category === 'credit_card') {
                    tarjetas = round2(tarjetas + val);
                }
            } else if (t.type === 'transfer' && t.toAccount) {
                const toAccObj = getAccountObj(t.toAccount);
                if (isPhysicalCashAccount(accObj) && toAccObj?.category === 'asset' && !isPhysicalCashAccount(toAccObj)) {
                    consignaciones = round2(consignaciones + val);
                }
            }
        }
    });

    const exceeds = {
        patrimonio: patrimonio >= limits.patrimonio,
        ingresos: ingresos >= limits.ingresos,
        tarjetas: tarjetas >= limits.tarjetas,
        compras: compras >= limits.compras,
        consignaciones: consignaciones >= limits.consignaciones
    };

    const mustDeclare = Object.values(exceeds).some(v => v);

    // 3. SIMULACIÓN DE IMPUESTO A CARGO (Cédula General - Art. 241 E.T.)
    let impuestoEstimado = 0, retencionesEstimadas = 0, saldoAPagar = 0;
    let baseGravableAnual = 0, baseGravableUVT = 0;
    const salaryStr = localStorage.getItem('myFinancesSalary');
    let sCfg = customSalaryCfg || null;
    if (!sCfg && salaryStr) {
        try { sCfg = JSON.parse(salaryStr); } catch { sCfg = null; }
    }

    if (sCfg) {
        let contractStart = new Date(year, 0, 1);
        if (sCfg.startDate && /^\d{4}-\d{2}-\d{2}$/.test(sCfg.startDate)) {
            const [csY, csM, csD] = sCfg.startDate.split('-').map(Number);
            contractStart = new Date(csY, csM - 1, csD);
        }

        let raiseEffMonthStr = '';
        let oldBasicForSim = 0;
        if (sCfg.lastRaise && sCfg.lastRaise.effectiveMonth && sCfg.lastRaise.oldBasic > 0) {
            const sched = sCfg.raiseSchedule || {};
            const useRetro = !!(sCfg.lastRaise.isRetro || sched.isRetro);
            raiseEffMonthStr = useRetro
                ? (sCfg.lastRaise.retroFromMonth || sched.retroFromMonth || sCfg.lastRaise.effectiveMonth)
                : sCfg.lastRaise.effectiveMonth;
            oldBasicForSim = round2(sCfg.lastRaise.oldBasic);
        }

        let ingresosBrutosAnuales = 0;
        let incrngoAnual = 0;
        let deduccionesArt387Anual = 0;
        let retMensualSumada = 0;
        let workedMonthsInYear = 0;
        let lastMetrics = null;

        for (let m = 0; m < 12; m++) {
            const monthEnd = new Date(year, m + 1, 0);
            if (contractStart > monthEnd) continue;

            const monthKey = `${year}-${String(m + 1).padStart(2, '0')}`;
            const monthCfg = (raiseEffMonthStr && oldBasicForSim > 0 && monthKey < raiseEffMonthStr)
                ? { ...sCfg, basicSalary: oldBasicForSim }
                : sCfg;

            let monthFactor = 1;
            if (contractStart.getFullYear() === year && contractStart.getMonth() === m && contractStart.getDate() > 1) {
                monthFactor = Math.max(0, Math.min(1, (30 - Math.min(30, contractStart.getDate()) + 1) / 30));
            }

            const mMetrics = calculateLaborMetrics(monthCfg, new Date(year, m, 15), params);
            ingresosBrutosAnuales = round2(ingresosBrutosAnuales + round2(mMetrics.ingresosBrutos * monthFactor));
            incrngoAnual = round2(incrngoAnual + round2(mMetrics.incrngo * monthFactor));
            deduccionesArt387Anual = round2(deduccionesArt387Anual + round2(mMetrics.totalDeduccionesArt387 * monthFactor));
            retMensualSumada = round2(retMensualSumada + round2(mMetrics.ret * monthFactor));
            workedMonthsInYear = round2(workedMonthsInYear + monthFactor);
            lastMetrics = mMetrics;
        }

        let retPrimasAnual = 0;
        if (lastMetrics && workedMonthsInYear > 0) {
            const junBruta = lastMetrics.halfPrimaJunBruta !== undefined
                ? lastMetrics.halfPrimaJunBruta
                : round2((lastMetrics.halfPrimaJunNeta || 0) + (lastMetrics.retPrima || 0));
            const decBruta = lastMetrics.halfPrimaDecBruta !== undefined
                ? lastMetrics.halfPrimaDecBruta
                : round2((lastMetrics.halfPrimaDecNeta || 0) + (lastMetrics.retPrima || 0));
            retPrimasAnual = (lastMetrics.retPrimaJun !== undefined && lastMetrics.retPrimaDec !== undefined)
                ? round2(lastMetrics.retPrimaJun + lastMetrics.retPrimaDec)
                : round2((lastMetrics.retPrima || 0) * 2);
            ingresosBrutosAnuales = round2(ingresosBrutosAnuales + junBruta + decBruta);
        }

        const rentaLiquidaAnual = Math.max(0, round2(ingresosBrutosAnuales - incrngoAnual));
        const dedVoluntaryAnual = Math.min(round2((sCfg.dedVoluntary || 0) * workedMonthsInYear), round2(ingresosBrutosAnuales * 0.30), round2((params.voluntaryAnnualUvt || 3800) * uvt));
        const baseNeta25Anual = Math.max(0, round2(rentaLiquidaAnual - deduccionesArt387Anual - dedVoluntaryAnual));
        const exempt25Anual = Math.min(round2(baseNeta25Anual * 0.25), round2((params.exempt25AnnualUvt || 790) * uvt));

        const beneficiosBrutosAnuales = round2(deduccionesArt387Anual + dedVoluntaryAnual + exempt25Anual);
        const tope40Anual = Math.min(round2(rentaLiquidaAnual * 0.40), round2((params.global40AnnualUvt || 1340) * uvt));
        const beneficiosLimitadosAnuales = Math.min(beneficiosBrutosAnuales, tope40Anual);

        baseGravableAnual = Math.max(0, round2(rentaLiquidaAnual - beneficiosLimitadosAnuales));
        baseGravableUVT = uvt > 0 ? baseGravableAnual / uvt : 0;

        let impuestoUVT = 0;
        if (baseGravableUVT > 31000) impuestoUVT = (baseGravableUVT - 31000) * 0.39 + 10352;
        else if (baseGravableUVT > 18970) impuestoUVT = (baseGravableUVT - 18970) * 0.37 + 5901;
        else if (baseGravableUVT > 8670) impuestoUVT = (baseGravableUVT - 8670) * 0.35 + 2296;
        else if (baseGravableUVT > 4100) impuestoUVT = (baseGravableUVT - 4100) * 0.33 + 788;
        else if (baseGravableUVT > 1700) impuestoUVT = (baseGravableUVT - 1700) * 0.28 + 116;
        else if (baseGravableUVT > 1090) impuestoUVT = (baseGravableUVT - 1090) * 0.19;

        impuestoEstimado = round2(impuestoUVT * uvt);
        retencionesEstimadas = round2(retMensualSumada + retPrimasAnual);
        saldoAPagar = round2(impuestoEstimado - retencionesEstimadas);
    }

    return {
        year, limits, uvt,
        current: { patrimonio, ingresos, tarjetas, compras, consignaciones },
        exceeds, mustDeclare,
        taxSimulation: { hasSalaryConfig: !!salaryStr, baseGravableAnual, baseGravableUVT, impuestoEstimado, retencionesEstimadas, saldoAPagar }
    };
};

const getPocketPayrollMonthlyQuota = (pocket, refDate = currentDate) => {
    if (!pocket || !pocket.payrollDeduction) return 0;
    const refMonthId = getMonthId(refDate);
    if (pocket.startDate && pocket.startDate.slice(0, 7) > refMonthId) return 0;

    const balance = round2((pocket.principal || 0) + (pocket.yields || 0));
    const goal = round2(pocket.goal || 0);
    const customQuota = round2(pocket.customQuota || 0);

    if (goal > 0) {
        const remaining = Math.max(0, round2(goal - balance));
        if (remaining <= 0) return 0;

        let activeQuota = customQuota;
        if (activeQuota <= 0 && pocket.targetDate) {
            const refStr = refDate.toLocaleDateString('en-CA');
            const effStart = (pocket.startDate && pocket.startDate > refStr) ? pocket.startDate : refStr;
            const [sy, sm, sd] = effStart.split('-').map(Number);
            const [ey, em, ed] = pocket.targetDate.split('-').map(Number);
            const monthsLeft = Math.max(1, (ey - sy) * 12 + (em - sm) + (ed > sd ? 1 : 0));
            activeQuota = round2(remaining / monthsLeft);
        }
        return activeQuota > 0 ? Math.min(remaining, activeQuota) : 0;
    }

    return customQuota > 0 ? customQuota : 0;
};

const calcArt383TableUVT = (uvtBase) => {
    if (uvtBase <= 95) return 0;
    if (uvtBase <= 150) return (uvtBase - 95) * 0.19;
    if (uvtBase <= 360) return (uvtBase - 150) * 0.28 + 10;
    if (uvtBase <= 640) return (uvtBase - 360) * 0.33 + 69;
    if (uvtBase <= 945) return (uvtBase - 640) * 0.35 + 162;
    if (uvtBase <= 2300) return (uvtBase - 945) * 0.37 + 268;
    return (uvtBase - 2300) * 0.39 + 770;
};

const calculateLaborMetrics = (config, today = new Date(), customParams = null, overrideTransport = null, capOverrides = null) => {
    const params = customParams || getTaxParams();
    const uvt = round2(params.uvt || 52374);
    const smmlv = round2(params.smmlv || 1750905);
    const rawTransport = round2(params.transportAid || 249095);

    const basic = round2(config.basicSalary || 0);

    // Cálculo dinámico de pagos no salariales para el mes evaluado (today)
    let nonSalary = 0;
    let taxableNonSalary = 0;
    const targetMonthStr = String(today.getMonth());

    if (Array.isArray(config.nonSalaryItems)) {
        if (config.hasNonSalary !== false) {
            config.nonSalaryItems.forEach(item => {
                const amt = round2(item.amount || 0);
                if (amt <= 0) return;
                if (item.month === 'all' || String(item.month) === targetMonthStr) {
                    nonSalary = round2(nonSalary + amt);
                    if (item.taxable !== false) {
                        taxableNonSalary = round2(taxableNonSalary + amt);
                    }
                }
            });
        }
    } else {
        // Compatibilidad con configuraciones anteriores de un solo valor
        nonSalary = round2(config.nonSalary || 0);
        taxableNonSalary = nonSalary;
    }

    // Validación Ley 1393 (Tope 40% del total remunerado para IBC de Seguridad Social) y tope máximo 25 SMMLV (Ley 797)
    const totalRemuneration = round2(basic + nonSalary);
    const nonSalaryCapRatio = (params.nonSalaryCapPct || 40) / 100;
    const maxNonSalary = round2(totalRemuneration * nonSalaryCapRatio);
    const excessNonSalary = nonSalary > maxNonSalary ? round2(nonSalary - maxNonSalary) : 0;
    const rawIbc = round2(basic + excessNonSalary);
    const ibc = smmlv > 0 ? Math.min(rawIbc, round2(smmlv * 25)) : rawIbc;

    const isEligibleTransport = (config.transportAuto !== false) ? (basic > 0 && basic <= round2(smmlv * 2)) : (basic > 0);
    const payTransportInNet = config.transportPayNet !== undefined ? !!config.transportPayNet : true;
    const includeTransportInBenefits = config.transportInBenefits !== undefined ? !!config.transportInBenefits : true;

    const effectiveTransport = overrideTransport !== null ? round2(overrideTransport) : ((isEligibleTransport && payTransportInNet) ? rawTransport : 0);
    const benefitsTransport = (isEligibleTransport && includeTransportInBenefits) ? rawTransport : 0;

    const health = round2(ibc * 0.04);
    const pension = round2(ibc * 0.04);

    let fsp = 0;
    const fspThreshold = round2(smmlv * (params.fspSmmlvThreshold || 4));
    if (ibc >= fspThreshold && smmlv > 0) {
        if (ibc < round2(smmlv * 16)) fsp = ibc * 0.01;
        else if (ibc <= round2(smmlv * 17)) fsp = ibc * 0.012;
        else if (ibc <= round2(smmlv * 18)) fsp = ibc * 0.014;
        else if (ibc <= round2(smmlv * 19)) fsp = ibc * 0.016;
        else if (ibc <= round2(smmlv * 20)) fsp = ibc * 0.018;
        else fsp = ibc * 0.02;
    }
    fsp = round2(fsp);

    // Base tributaria (Art. 103 E.T.): Solo suman los conceptos no salariales marcados con "Base Retefuente"
    const ingresosBrutos = round2(basic + taxableNonSalary);
    const incrngo = round2(health + pension + fsp);
    const rentaLiquida = Math.max(0, round2(ingresosBrutos - incrngo));

    const skipDeductions = !!(capOverrides && capOverrides.skipDeductions);
    const dedPrepaid = skipDeductions ? 0 : Math.min(round2(config.dedPrepaid || 0), round2((params.prepaidMonthlyUvt || 16) * uvt));
    const dedHousing = skipDeductions ? 0 : Math.min(round2(config.dedHousing || 0), round2((params.housingMonthlyUvt || 100) * uvt));
    const dedDependents = (!skipDeductions && config.dedDependents) ? Math.min(round2(ingresosBrutos * 0.10), round2((params.dependentsMonthlyUvt || 32) * uvt)) : 0;
    const dedVoluntary = skipDeductions ? 0 : Math.min(round2(config.dedVoluntary || 0), Math.min(round2(ingresosBrutos * 0.30), round2(((params.voluntaryAnnualUvt || 3800) / 12) * uvt)));
    const totalDeduccionesArt387 = round2(dedPrepaid + dedHousing + dedDependents);
    const baseNeta25 = Math.max(0, round2(rentaLiquida - totalDeduccionesArt387 - dedVoluntary));

    const retCapEval = params.retCapEval || 'monthly';
    const retOrder = params.retOrder || 'salary_first';

    const baseExempt25MonthlyCap = round2(((params.exempt25AnnualUvt || 790) / 12) * uvt);
    const baseGlobalUvtMonthlyCap = round2(((params.global40AnnualUvt || 1340) / 12) * uvt);

    let exempt25MonthlyCapCOP = baseExempt25MonthlyCap;
    let globalUvtMonthlyCapCOP = baseGlobalUvtMonthlyCap;

    if (retCapEval === 'annual') {
        let firstWorkedMonthIdx = 0;
        if (config.startDate && /^\d{4}-\d{2}-\d{2}$/.test(config.startDate)) {
            const [csY, csM] = config.startDate.split('-').map(Number);
            if (csY > today.getFullYear()) firstWorkedMonthIdx = 12;
            else if (csY === today.getFullYear()) firstWorkedMonthIdx = Math.max(0, csM - 1);
        }
        let raiseEffMonthStr = '';
        let oldBasicPrior = 0;
        if (config.lastRaise && config.lastRaise.effectiveMonth && config.lastRaise.oldBasic > 0) {
            const sched = config.raiseSchedule || {};
            const useRetro = !!(config.lastRaise.isRetro || sched.isRetro);
            raiseEffMonthStr = useRetro
                ? (config.lastRaise.retroFromMonth || sched.retroFromMonth || config.lastRaise.effectiveMonth)
                : config.lastRaise.effectiveMonth;
            oldBasicPrior = round2(config.lastRaise.oldBasic);
        }

        const annualEx25TotalCOP = round2((params.exempt25AnnualUvt || 790) * uvt);
        const annualGlobalTotalCOP = round2((params.global40AnnualUvt || 1340) * uvt);
        let remEx25COP = annualEx25TotalCOP;
        let remGlobalCOP = annualGlobalTotalCOP;

        for (let mIdx = firstWorkedMonthIdx; mIdx < today.getMonth(); mIdx++) {
            const mKey = `${today.getFullYear()}-${String(mIdx + 1).padStart(2, '0')}`;
            const mBasic = (raiseEffMonthStr && oldBasicPrior > 0 && mKey < raiseEffMonthStr) ? oldBasicPrior : basic;
            let mNonSal = 0, mTaxNonSal = 0;
            if (Array.isArray(config.nonSalaryItems)) {
                if (config.hasNonSalary !== false) {
                    config.nonSalaryItems.forEach(item => {
                        const amt = round2(item.amount || 0);
                        if (amt > 0 && (item.month === 'all' || String(item.month) === String(mIdx))) {
                            mNonSal = round2(mNonSal + amt);
                            if (item.taxable !== false) mTaxNonSal = round2(mTaxNonSal + amt);
                        }
                    });
                }
            } else {
                mNonSal = nonSalary;
                mTaxNonSal = taxableNonSalary;
            }
            const mTotRem = round2(mBasic + mNonSal);
            const mExcess = mNonSal > round2(mTotRem * nonSalaryCapRatio) ? round2(mNonSal - round2(mTotRem * nonSalaryCapRatio)) : 0;
            const mRawIbc = round2(mBasic + mExcess);
            const mIbc = smmlv > 0 ? Math.min(mRawIbc, round2(smmlv * 25)) : mRawIbc;
            let mFsp = 0;
            if (mIbc >= fspThreshold && smmlv > 0) {
                if (mIbc < round2(smmlv * 16)) mFsp = mIbc * 0.01;
                else if (mIbc <= round2(smmlv * 17)) mFsp = mIbc * 0.012;
                else if (mIbc <= round2(smmlv * 18)) mFsp = mIbc * 0.014;
                else if (mIbc <= round2(smmlv * 19)) mFsp = mIbc * 0.016;
                else if (mIbc <= round2(smmlv * 20)) mFsp = mIbc * 0.018;
                else mFsp = mIbc * 0.02;
            }
            const mIngBrutos = round2(mBasic + mTaxNonSal);
            const mIncrngo = round2(round2(mIbc * 0.04) + round2(mIbc * 0.04) + round2(mFsp));
            const mRentaLiq = Math.max(0, round2(mIngBrutos - mIncrngo));
            const mDedDep = (!skipDeductions && config.dedDependents) ? Math.min(round2(mIngBrutos * 0.10), round2((params.dependentsMonthlyUvt || 32) * uvt)) : 0;
            const mDedVol = skipDeductions ? 0 : Math.min(round2(config.dedVoluntary || 0), Math.min(round2(mIngBrutos * 0.30), round2(((params.voluntaryAnnualUvt || 3800) / 12) * uvt)));
            const mArt387 = round2(dedPrepaid + dedHousing + mDedDep);
            const mBase25 = Math.max(0, round2(mRentaLiq - mArt387 - mDedVol));

            const mEx25 = Math.min(round2(mBase25 * 0.25), remEx25COP);
            const mBenBruto = round2(mArt387 + mDedVol + mEx25);
            const mBenLim = Math.min(mBenBruto, round2(mRentaLiq * 0.40), remGlobalCOP);
            remEx25COP = Math.max(0, round2(remEx25COP - mEx25));
            remGlobalCOP = Math.max(0, round2(remGlobalCOP - mBenLim));
        }
        exempt25MonthlyCapCOP = remEx25COP;
        globalUvtMonthlyCapCOP = remGlobalCOP;
    }

    if (capOverrides) {
        if (capOverrides.exempt25CapCOP !== undefined) exempt25MonthlyCapCOP = Math.max(0, round2(capOverrides.exempt25CapCOP));
        if (capOverrides.globalUvtCapCOP !== undefined) globalUvtMonthlyCapCOP = Math.max(0, round2(capOverrides.globalUvtCapCOP));
    }

    const exempt25 = Math.min(round2(baseNeta25 * 0.25), exempt25MonthlyCapCOP);
    const totalBeneficiosBrutos = round2(totalDeduccionesArt387 + dedVoluntary + exempt25);
    const beneficiosLimitados = Math.min(totalBeneficiosBrutos, round2(rentaLiquida * 0.40), globalUvtMonthlyCapCOP);

    const baseGravable = Math.max(0, round2(rentaLiquida - beneficiosLimitados));
    const numeroUVT = uvt > 0 ? round2(baseGravable / uvt) : 0;
    const retProc = config.retProc !== undefined ? String(config.retProc) : '1';

    let ret = 0, effectiveRetPct = 0;
    if (retProc === '1') {
        ret = round2(calcArt383TableUVT(numeroUVT) * uvt);
        effectiveRetPct = baseGravable > 0 ? round2((ret / baseGravable) * 100) : 0;
    } else if (retProc === '2') {
        effectiveRetPct = round2(config.retPct || 0);
        ret = round2(baseGravable * (effectiveRetPct / 100));
    }

    let payrollDebtDeductions = 0;
    const targetMonthId = getMonthId(today);
    
    financeData.customAccounts.filter(a => a.category === 'debt' && a.payrollDeduction).forEach(d => {
        const bal = round2(financeData.transactions.filter(t => !t.isDeleted && (t.account === d.id || t.toAccount === d.id) && getTxMonthId(t) <= targetMonthId && isTxClosed(t)).reduce((s, t) => {
            if (t.account === d.id) return s + (t.type === 'income' ? -t.amount : t.amount);
            if (t.type === 'transfer' && t.toAccount === d.id) return s - t.amount;
            return s;
        }, 0));
        
        if (bal > 0) {
            const qInfo = getDebtMonthlyQuotaBreakdown(d, bal);
            payrollDebtDeductions = round2(payrollDebtDeductions + qInfo.totalQuota);
        }
    });

    let payrollSavingsDeductions = 0;
    (financeData.pockets || []).filter(p => p.payrollDeduction).forEach(p => {
        const pQuota = getPocketPayrollMonthlyQuota(p, today);
        if (pQuota > 0) {
            payrollSavingsDeductions = round2(payrollSavingsDeductions + pQuota);
        }
    });

    const totalPayrollDeductions = round2(payrollDebtDeductions + payrollSavingsDeductions);
    const grossNet = round2(basic + effectiveTransport + nonSalary - health - pension - fsp - ret);
    const net = Math.max(0, round2(grossNet - totalPayrollDeductions));

    const biweeklyRetMode = config.biweeklyRetMode || 'prorated';
    const gross1Q = round2((basic + effectiveTransport + nonSalary) / 2);
    const gross2Q = round2((basic + effectiveTransport + nonSalary) - gross1Q);

    const ssTotal = round2(health + pension + fsp);
    const ss1Q = round2(ssTotal / 2);
    const ss2Q = round2(ssTotal - ss1Q);

    const ret1Q = biweeklyRetMode === 'second_half' ? 0 : round2(ret / 2);
    const ret2Q = biweeklyRetMode === 'second_half' ? ret : round2(ret - ret1Q);

    const ded1Q = round2(totalPayrollDeductions / 2);
    const ded2Q = round2(totalPayrollDeductions - ded1Q);

    const rawNet1Q = round2(gross1Q - ss1Q - ret1Q - ded1Q);
    const rawNet2Q = round2(gross2Q - ss2Q - ret2Q - ded2Q);
    const net1Q = Math.max(0, rawNet1Q < 0 ? 0 : (rawNet2Q < 0 ? round2(rawNet1Q + rawNet2Q) : rawNet1Q));
    const net2Q = Math.max(0, rawNet1Q < 0 ? round2(rawNet2Q + rawNet1Q) : rawNet2Q);

    let startObj = new Date(today.getFullYear(), 0, 1);
    if (config.startDate) {
        const [sy, sm, sd] = config.startDate.split('-').map(Number);
        startObj = new Date(sy, sm - 1, sd);
    }

    const currentYear = today.getFullYear();
    const currentMonthIdx = today.getMonth();
    const startOfYear = new Date(currentYear, 0, 1);
    const daysYear = startObj > today ? 0 : calcCommercialDays(startObj > startOfYear ? startObj : startOfYear, today);
    const semStartMonth = currentMonthIdx < 6 ? 0 : 6;
    const semStart = new Date(currentYear, semStartMonth, 1);
    const daysSemester = startObj > today ? 0 : calcCommercialDays(startObj > semStart ? startObj : semStart, today);
    const daysTotalContract = startObj > today ? 0 : calcCommercialDays(startObj, today);

    // Motor de Promedios Salariales (Art. 253, 306 y 192 CST Colombia)
    const baseMensualEstandar = round2(basic + benefitsTransport);
    let variableIncomeSemester = 0;
    let variableIncomeSem1 = 0;
    let variableIncomeSem2 = 0;
    let variableIncomeYear = 0;
    const excludedNonVariableRegex = /anticipo|adelanto|cesant[ií]a|interes(es)?\s*(de\s*)?cesant|vacacion|disfrutad|compensad|prima\b|parcial|liquidaci[oó]n|retroactivo/i;

    financeData.transactions.forEach(t => {
        if (!t.isDeleted && !t.isAdjustment && t.type === 'income' && t.category && normalizeCategoryName(stripLeadingEmoji(t.category)).includes('nomina') && isTxClosed(t) && t.monthId) {
            const [ty, tm] = t.monthId.split('-').map(Number);
            if (ty === currentYear) {
                const mIdx = tm - 1;
                const descLower = String(t.description || '').toLowerCase();
                const subLower = String(t.subcategory || '').toLowerCase();
                const isBaseSalary = descLower.includes('nómina') && (t.subcategory === 'General' || !t.subcategory);
                const isExcludedConcept = !!(
                    t.isPayrollAdvance ||
                    t.benefitType ||
                    excludedNonVariableRegex.test(descLower) ||
                    excludedNonVariableRegex.test(subLower)
                );

                if (!isBaseSalary && !isExcludedConcept) {
                    const txVal = round2(t.amount);
                    variableIncomeYear = round2(variableIncomeYear + txVal);
                    if (mIdx < 6) variableIncomeSem1 = round2(variableIncomeSem1 + txVal);
                    else variableIncomeSem2 = round2(variableIncomeSem2 + txVal);
                    if (mIdx >= semStartMonth && mIdx <= currentMonthIdx) {
                        variableIncomeSemester = round2(variableIncomeSemester + txVal);
                    }
                }
            }
        }
    });

    let raiseStartObj = null;
    let oldMonthlyBase = 0;
    let isRetroApplied = false;
    if (config.lastRaise && config.lastRaise.effectiveMonth && config.lastRaise.oldBasic > 0) {
        const sched = config.raiseSchedule || {};
        const useRetroDate = !!(config.lastRaise.isRetro || sched.isRetro);
        const startMonthStr = useRetroDate
            ? (config.lastRaise.retroFromMonth || sched.retroFromMonth || config.lastRaise.effectiveMonth)
            : config.lastRaise.effectiveMonth;
        const startPeriodStr = useRetroDate
            ? (config.lastRaise.retroFromPeriod || sched.retroFromPeriod || config.lastRaise.effectivePeriod)
            : config.lastRaise.effectivePeriod;

        const [ry, rm] = startMonthStr.split('-').map(Number);
        const effDay = startPeriodStr === '2Q' ? 16 : 1;
        raiseStartObj = new Date(ry, rm - 1, effDay);
        isRetroApplied = useRetroDate && startMonthStr !== config.lastRaise.effectiveMonth;

        const oldEligibleTransp = (config.transportAuto !== false)
            ? (config.lastRaise.oldBasic > 0 && config.lastRaise.oldBasic <= round2(smmlv * 2))
            : (config.lastRaise.oldBasic > 0);
        const oldBenefitsTransp = (oldEligibleTransp && includeTransportInBenefits) ? rawTransport : 0;
        oldMonthlyBase = round2(config.lastRaise.oldBasic + oldBenefitsTransp);
    }

    const calcWeightedBaseBetween = (periodStart, periodEnd, totalDays) => {
        if (!raiseStartObj || oldMonthlyBase <= 0 || totalDays <= 0 || raiseStartObj <= periodStart) {
            return { avgBase: baseMensualEstandar, usedAverage: false, oldDays: 0, newDays: totalDays };
        }
        if (raiseStartObj > periodEnd) {
            return { avgBase: oldMonthlyBase, usedAverage: false, oldDays: totalDays, newDays: 0 };
        }
        const dayBeforeRaise = new Date(raiseStartObj.getFullYear(), raiseStartObj.getMonth(), raiseStartObj.getDate() - 1);
        const oldDays = Math.min(totalDays, calcCommercialDays(periodStart, dayBeforeRaise));
        const newDays = Math.max(0, totalDays - oldDays);
        if (oldDays <= 0) {
            return { avgBase: baseMensualEstandar, usedAverage: false, oldDays: 0, newDays: totalDays };
        }
        const avgBase = round2(((oldMonthlyBase * oldDays) + (baseMensualEstandar * newDays)) / totalDays);
        return { avgBase, usedAverage: true, oldDays, newDays };
    };

    const workedMonthsSem = daysSemester > 0 ? Math.max(1, round2(daysSemester / 30)) : 1;
    const workedMonthsYear = daysYear > 0 ? Math.max(1, round2(daysYear / 30)) : 1;

    const effSemStart = startObj > semStart ? startObj : semStart;
    const semWeighted = calcWeightedBaseBetween(effSemStart, today, daysSemester);
    const primaBase = round2(semWeighted.avgBase + (daysSemester > 0 ? (variableIncomeSemester / workedMonthsSem) : 0));
    const usedPrimaAverage = semWeighted.usedAverage || (daysSemester > 0 && variableIncomeSemester > 0);

    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
    const variedLast3Months = !!(raiseStartObj && raiseStartObj > threeMonthsAgo && raiseStartObj <= today);
    const effYearStart = startObj > startOfYear ? startObj : startOfYear;
    const yearWeighted = variedLast3Months
        ? calcWeightedBaseBetween(effYearStart, today, daysYear)
        : { avgBase: baseMensualEstandar, usedAverage: false, oldDays: 0, newDays: daysYear };
    const cesantiasBase = round2(yearWeighted.avgBase + (daysYear > 0 ? (variableIncomeYear / workedMonthsYear) : 0));
    const usedCesantiasAverage = yearWeighted.usedAverage || (daysYear > 0 && variableIncomeYear > 0);

    const jun30 = new Date(currentYear, 5, 30);
    const jul1 = new Date(currentYear, 6, 1);
    const dec30 = new Date(currentYear, 11, 30);
    const calcNetHalfPrimaFromBase = (pBase, semDays = 180) => {
        const safeDays = Math.max(0, Math.min(180, semDays));
        const halfBruta = round2((pBase * safeDays) / 360);
        const ex25 = Math.min(round2(halfBruta * 0.25), baseExempt25MonthlyCap, baseGlobalUvtMonthlyCap);
        const grav = Math.max(0, round2(halfBruta - ex25));
        const pUvt = uvt > 0 ? round2(grav / uvt) : 0;
        let rP = 0;
        if (retProc === '1') rP = round2(calcArt383TableUVT(pUvt) * uvt);
        else if (retProc === '2') rP = round2(grav * (effectiveRetPct / 100));
        return { halfBruta, retPrima: rP, halfNeta: Math.max(0, round2(halfBruta - rP)) };
};

    const effSem1Start = startObj > startOfYear ? startObj : startOfYear;
    const sem1DaysFull = startObj > jun30 ? 0 : calcCommercialDays(effSem1Start, jun30);
    const sem1MonthsDiv = Math.max(1, round2(sem1DaysFull / 30));
    const projPrimaJunBase = round2(calcWeightedBaseBetween(effSem1Start, jun30, sem1DaysFull).avgBase + (sem1DaysFull > 0 ? (variableIncomeSem1 / sem1MonthsDiv) : 0));
    const primaJunCalc = calcNetHalfPrimaFromBase(projPrimaJunBase, sem1DaysFull);

    const effSem2Start = startObj > jul1 ? startObj : jul1;
    const sem2DaysFull = startObj > dec30 ? 0 : calcCommercialDays(effSem2Start, dec30);
    const sem2MonthsDiv = Math.max(1, round2(sem2DaysFull / 30));
    const projPrimaDecBase = round2(calcWeightedBaseBetween(effSem2Start, dec30, sem2DaysFull).avgBase + (sem2DaysFull > 0 ? (variableIncomeSem2 / sem2MonthsDiv) : 0));
    const primaDecCalc = calcNetHalfPrimaFromBase(projPrimaDecBase, sem2DaysFull);

    const fullYearDays = startObj > dec30 ? 0 : calcCommercialDays(effYearStart, dec30);
    const sep30 = new Date(currentYear, 8, 30);
    const variedBeforeYearEnd = !!(raiseStartObj && raiseStartObj > sep30 && raiseStartObj <= dec30);
    const fullYearMonthsDiv = Math.max(1, round2(fullYearDays / 30));
    const projCesantiasBase = round2((variedBeforeYearEnd
        ? calcWeightedBaseBetween(effYearStart, dec30, fullYearDays).avgBase
        : baseMensualEstandar) + (fullYearDays > 0 ? (variableIncomeYear / fullYearMonthsDiv) : 0));

    const activePrimaCalc = currentMonthIdx < 6 ? primaJunCalc : primaDecCalc;
    const halfPrimaBruta = activePrimaCalc.halfBruta;
    const retPrima = activePrimaCalc.retPrima;
    const halfPrimaNeta = activePrimaCalc.halfNeta;

    const liqPrima = round2((primaBase * daysSemester) / 360);
    const liqCesantias = round2((cesantiasBase * daysYear) / 360);
    const liqIntereses = round2((liqCesantias * daysYear * 0.12) / 360);

    const vacDaysEarned = round2((daysTotalContract * 15) / 360);
    const vacDaysTaken = Math.max(0, round2(config.vacDaysTaken || 0));
    const vacDaysComp = Math.max(0, round2(config.vacDaysComp || 0));
    const pureTakenDays = config._combinedVacDays ? Math.max(0, round2(vacDaysTaken - vacDaysComp)) : vacDaysTaken;
    const totalConfigVacDays = config._combinedVacDays ? vacDaysTaken : round2(vacDaysTaken + vacDaysComp);
    const vacDaysPending = Math.max(0, round2(vacDaysEarned - totalConfigVacDays));
    const liqVacaciones = round2((basic * vacDaysPending) / 30);

    const SHORT_MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const benefitPayments = {
        primaJun: [],
        primaDec: [],
        cesantias: [],
        intereses: [],
        vacaciones: []
    };

    financeData.transactions.forEach(t => {
        if (t.isDeleted || t.isAdjustment || t.type !== 'income' || !isTxClosed(t)) return;

        let txYear = currentYear;
        let txMonthIdx = 0;
        if (t.monthId && /^\d{4}-\d{2}$/.test(t.monthId)) {
            const [yStr, mStr] = t.monthId.split('-');
            txYear = parseInt(yStr, 10);
            txMonthIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));
        } else {
            const txDate = new Date(t.id);
            txYear = txDate.getFullYear();
            txMonthIdx = txDate.getMonth();
        }

        if (txYear !== currentYear) return;

        const amt = round2(t.amount || 0);
        if (amt <= 0) return;

        const catNorm = normalizeCategoryName(stripLeadingEmoji(t.category || ''));
        const subNorm = normalizeCategoryName(stripLeadingEmoji(t.subcategory || ''));
        const descNorm = normalizeCategoryName(t.description || '');
        let bType = t.benefitType || '';

        if (!bType) {
            if ((catNorm.includes('prima') || descNorm.includes('prima')) && !descNorm.includes('extralegal') && !catNorm.includes('nomina')) {
                bType = 'prima';
            } else if (catNorm.includes('cesant') || descNorm.includes('cesant')) {
                bType = (descNorm.includes('interes') || descNorm.includes('12%') || subNorm.includes('interes')) ? 'intereses_cesantias' : 'cesantias';
            } else if (catNorm.includes('vacacion') || descNorm.includes('vacacion')) {
                bType = 'vacaciones';
            }
        }

        const entry = { amount: amt, monthIdx: txMonthIdx, monthLabel: SHORT_MONTHS_ES[txMonthIdx] || '' };
        if (bType === 'prima') {
            if (txMonthIdx <= 5) benefitPayments.primaJun.push(entry);
            else benefitPayments.primaDec.push(entry);
        } else if (bType === 'cesantias') {
            benefitPayments.cesantias.push(entry);
        } else if (bType === 'intereses_cesantias') {
            benefitPayments.intereses.push(entry);
        } else if (bType === 'vacaciones') {
            benefitPayments.vacaciones.push(entry);
        }
    });

    const summarizeBenefitPayments = (list) => {
        const sorted = [...list].sort((a, b) => a.monthIdx - b.monthIdx);
        const total = round2(sorted.reduce((s, p) => s + p.amount, 0));
        const months = [...new Set(sorted.map(p => p.monthLabel).filter(Boolean))];
        return { total, months, count: sorted.length, label: months.join(', ') };
    };

    const paidPrimaJun = summarizeBenefitPayments(benefitPayments.primaJun);
    const paidPrimaDec = summarizeBenefitPayments(benefitPayments.primaDec);
    const paidPrimaActiveSem = semStartMonth === 0 ? paidPrimaJun : paidPrimaDec;
    const paidCesantias = summarizeBenefitPayments(benefitPayments.cesantias);
    const paidIntereses = summarizeBenefitPayments(benefitPayments.intereses);
    const paidVacaciones = summarizeBenefitPayments(benefitPayments.vacaciones);

    const advPrima = paidPrimaActiveSem.total;
    const advCes = paidCesantias.total;
    const advInt = paidIntereses.total;
    const advVac = paidVacaciones.total;

    // Equivalencia en pesos de días disfrutados y días compensados ingresados manualmente
    const vacTakenAmount = round2((basic * pureTakenDays) / 30);
    const vacCompAmount = round2((basic * vacDaysComp) / 30);
    // Para compensadas/pagadas toma el mayor entre comprobante y días compensados (sin duplicar) + días disfrutados
    const vacPaidOrCompAmount = Math.max(advVac, vacCompAmount);
    const totalVacUsedAmount = round2(vacTakenAmount + vacPaidOrCompAmount);
    // Si hay comprobante de vacaciones que excede los días compensados ingresados, descuenta solo la diferencia en liquidación
    const extraReceiptVacDeduction = Math.max(0, round2(advVac - vacCompAmount));

    return {
        params, uvt, smmlv, basic, nonSalary, taxableNonSalary, excessNonSalary, ibc, effectiveTransport, benefitsTransport, health, pension, fsp,
        ingresosBrutos, incrngo, rentaLiquida, dedPrepaid, dedHousing, dedDependents, dedVoluntary, totalDeduccionesArt387,
        exempt25, exempt25MonthlyCapCOP, globalUvtMonthlyCapCOP, retCapEval, retOrder,
        totalBeneficiosBrutos, beneficiosLimitados, baseGravable, numeroUVT, retProc, effectiveRetPct, ret,
        net, grossNet, payrollDebtDeductions, payrollSavingsDeductions, biweeklyRetMode, gross1Q, gross2Q, ss1Q, ss2Q, ret1Q, ret2Q, net1Q, net2Q,
        prestacionesBase: projCesantiasBase, primaBase, cesantiasBase,
        projPrimaJunBase, projPrimaDecBase, projCesantiasBase,
        halfPrimaJunNeta: primaJunCalc.halfNeta, halfPrimaDecNeta: primaDecCalc.halfNeta,
        halfPrimaJunBruta: primaJunCalc.halfBruta, halfPrimaDecBruta: primaDecCalc.halfBruta,
        retPrimaJun: primaJunCalc.retPrima, retPrimaDec: primaDecCalc.retPrima,
        usedPrimaAverage, usedCesantiasAverage, semWeighted, yearWeighted, oldMonthlyBase, isRetroApplied,
        halfPrimaBruta, retPrima, halfPrimaNeta, daysYear, daysSemester, daysTotalContract, startObj, currentYear,
        vacDaysEarned, vacDaysTaken, pureTakenDays, vacDaysComp, vacDaysPending,
        vacTakenAmount, vacCompAmount, totalVacUsedAmount,
        paidPrimaJun, paidPrimaDec, paidPrimaActiveSem, paidCesantias, paidIntereses, paidVacaciones,
        liqPrima: Math.max(0, round2(liqPrima - advPrima)),
        liqCesantias: Math.max(0, round2(liqCesantias - advCes)),
        liqIntereses: Math.max(0, round2(liqIntereses - advInt)),
        liqVacaciones: Math.max(0, round2(liqVacaciones - extraReceiptVacDeduction))
    };
};

const simulateExtraBonus = (config, bonusAmount, bonusType = 'non_salary', customParams = null) => {
    const bonus = Math.max(0, round2(bonusAmount));
    const params = customParams || getTaxParams();
    const retOrder = params.retOrder || 'salary_first';
    const retCapEval = params.retCapEval || 'monthly';
    const baseMetrics = calculateLaborMetrics(config, currentDate, params);

    if (bonus <= 0) {
        return {
            bonus: 0, bonusType, retOrder, retCapEval, baseMetrics, simMetrics: baseMetrics,
            deltaHealth: 0, deltaPension: 0, deltaFsp: 0, deltaSS: 0, deltaRet: 0, salaryRetImpact: 0,
            totalDeductions: 0, netBonus: 0, effectiveTaxRate: 0,
            crossedFsp: false, triggeredLey1393: false, deltaExcessLey1393: 0
        };
    }

    const existingItems = Array.isArray(config.nonSalaryItems) && config.hasNonSalary !== false ? config.nonSalaryItems : [];
    const simConfig = bonusType === 'salary'
        ? { ...config, basicSalary: round2((config.basicSalary || 0) + bonus) }
        : {
            ...config,
            hasNonSalary: true,
            nonSalaryItems: [...existingItems, { id: 'sim_extra_bonus', name: 'Bono Ocasional', amount: bonus, month: 'all', taxable: true }],
            nonSalary: round2((config.nonSalary || 0) + bonus)
        };

    const simMetrics = calculateLaborMetrics(simConfig, currentDate, params, baseMetrics.effectiveTransport);

    const deltaHealth = round2(simMetrics.health - baseMetrics.health);
    const deltaPension = round2(simMetrics.pension - baseMetrics.pension);
    const deltaFsp = round2(simMetrics.fsp - baseMetrics.fsp);
    const deltaSS = round2(deltaHealth + deltaPension + deltaFsp);

    let deltaRet = round2(simMetrics.ret - baseMetrics.ret);
    let salaryRetImpact = 0;

    if (retOrder === 'first_payment') {
        const bonusFirstConfig = {
            ...config,
            basicSalary: bonusType === 'salary' ? bonus : 0,
            hasNonSalary: bonusType === 'non_salary',
            nonSalaryItems: bonusType === 'non_salary'
                ? [{ id: 'sim_first_bonus', name: 'Bono Ocasional', amount: bonus, month: 'all', taxable: true }]
                : [],
            nonSalary: bonusType === 'non_salary' ? bonus : 0,
            transportAuto: false
        };
        const bonusFirstMetrics = calculateLaborMetrics(bonusFirstConfig, currentDate, params, 0);
        deltaRet = bonusFirstMetrics.ret;

        const remExempt25 = Math.max(0, round2((baseMetrics.exempt25MonthlyCapCOP || 0) - bonusFirstMetrics.exempt25));
        const remGlobalUvt = Math.max(0, round2((baseMetrics.globalUvtMonthlyCapCOP || 0) - bonusFirstMetrics.beneficiosLimitados));
        const salaryAfterMetrics = calculateLaborMetrics(config, currentDate, params, baseMetrics.effectiveTransport, {
            exempt25CapCOP: remExempt25,
            globalUvtCapCOP: remGlobalUvt,
            skipDeductions: (bonusFirstMetrics.totalDeduccionesArt387 + bonusFirstMetrics.dedVoluntary) > 0
        });
        salaryRetImpact = Math.max(0, round2(salaryAfterMetrics.ret - baseMetrics.ret));
    }

    const totalDeductions = round2(deltaSS + deltaRet);
    const netBonus = Math.max(0, round2(bonus - totalDeductions));
    const effectiveTaxRate = round2((totalDeductions / bonus) * 100);
    const deltaExcessLey1393 = Math.max(0, round2(simMetrics.excessNonSalary - baseMetrics.excessNonSalary));

    return {
        bonus, bonusType, retOrder, retCapEval, baseMetrics, simMetrics,
        deltaHealth, deltaPension, deltaFsp, deltaSS, deltaRet, salaryRetImpact,
        totalDeductions, netBonus, effectiveTaxRate,
        crossedFsp: baseMetrics.fsp === 0 && simMetrics.fsp > 0,
        triggeredLey1393: deltaExcessLey1393 > 0,
        deltaExcessLey1393
    };
};

// --- 8. GENERADOR DE RECORDATORIOS iOS (.ICS VCALENDAR SANITIZADO) ---
const generateICSBlob = (title, description, dateObj) => {
    const pad = (n) => n < 10 ? '0' + n : n;
    const formatDateStr = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

    const safeTitle = globalThis.LumenSecurity?.sanitizeIcsField
        ? globalThis.LumenSecurity.sanitizeIcsField(title, 140)
        : String(title || '').replace(/[\r\n,;\\]+/g, ' ').trim().slice(0, 140);
    const safeDesc = globalThis.LumenSecurity?.sanitizeIcsField
        ? globalThis.LumenSecurity.sanitizeIcsField(description, 400)
        : String(description || '').replace(/[\r\n,;\\]+/g, ' ').trim().slice(0, 400);

    const uidBytes = new Uint8Array(6);
    if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(uidBytes);
    const uidHex = Array.from(uidBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    const dtstart = formatDateStr(dateObj);
    const endObj = new Date(dateObj.getTime() + 30 * 60000);
    const dtend = formatDateStr(endObj);

    const icsData = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Lumen//v2.2.3//ES',
        'BEGIN:VEVENT',
        `UID:${Date.now()}-${uidHex}@lumen.local`,
        `DTSTAMP:${formatDateStr(new Date())}`,
        `DTSTART:${dtstart}`,
        `DTEND:${dtend}`,
        `SUMMARY:${safeTitle}`,
        `DESCRIPTION:${safeDesc}`,
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Recordatorio: ${safeTitle}`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    return new Blob([icsData], { type: 'text/calendar;charset=utf-8' });
};

// --- 9. UTILIDADES DE FECHAS, CICLOS PERSONALIZADOS Y PALETAS ---
const getMonthStartDay = () => {
    const d = parseInt(financeData?.preferences?.monthStartDay, 10);
    return (d >= 1 && d <= 28) ? d : 1;
};

const getMonthId = (date) => {
    const startDay = getMonthStartDay();
    let y = date.getFullYear();
    let m = date.getMonth();
    // Si el ciclo empieza después del día 1 y la fecha es >= día de corte, pertenece al ciclo del mes siguiente
    if (startDay > 1 && date.getDate() >= startDay) {
        m += 1;
        if (m > 11) { m = 0; y += 1; }
    }
    return `${y}-${String(m + 1).padStart(2, '0')}`;
};

const getTxMonthId = (t) => {
    if (t && t.id && !isNaN(Number(t.id))) {
        return getMonthId(new Date(Number(t.id)));
    }
    return t?.monthId || getMonthId(new Date());
};

const getCycleRangeText = (monthId) => {
    const startDay = getMonthStartDay();
    if (startDay === 1) return '';
    const [y, m] = monthId.split('-').map(Number);
    const startObj = new Date(y, m - 2, startDay);
    const endObj = new Date(y, m - 1, startDay - 1);
    const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}`;
    return `${fmt(startObj)} – ${fmt(endObj)}`;
};

const getShortMonthLabel = (date) => date.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
const formatMonthName = (date) => {
    const startDay = getMonthStartDay();
    if (startDay === 1) {
        return date.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
    }
    const [y, m] = getMonthId(date).split('-').map(Number);
    const target = new Date(y, m - 1, 1);
    return target.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' }).replace('.', '');
};
const getAssetEmoji = (cat) => {
    const svg = (inner) => `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; vertical-align:-3px;">${inner}</svg>`;
    const icons = {
        'Inmueble': svg('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'),
        'Vehículo': svg('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
        'Inversión': svg('<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'),
        'Tecnología': svg('<rect x="3" y="4" width="18" height="12" rx="2" ry="2"/><line x1="2" y1="20" x2="22" y2="20"/>'),
        'Coleccionable': svg('<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M11 3 8 9l4 13 4-13-3-6"/><path d="M2 9h20"/>'),
        'Otro': svg('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>')
    };
    return icons[cat] || icons['Otro'];
};

const calcCommercialDays = (sD, eD) => {
    if (sD > eD) return 0;
    return Math.max(0, (eD.getFullYear() - sD.getFullYear()) * 360 + (eD.getMonth() - sD.getMonth()) * 30 + (Math.min(30, eD.getDate()) - Math.min(30, sD.getDate())) + 1);
};

const advanceDateByRecurrence = (base, rec, step) => {
    const d = new Date(base.getTime());
    if (rec === 'biweekly') d.setDate(d.getDate() + 15 * step);
    else if (rec === 'monthly') d.setMonth(d.getMonth() + step);
    else if (rec === 'bimonthly') d.setMonth(d.getMonth() + 2 * step);
    else if (rec === 'quarterly') d.setMonth(d.getMonth() + 3 * step);
    else if (rec === 'annual') d.setFullYear(d.getFullYear() + step);
    return d;
};

const shadeColor = (color, percent) => {
    const cleanHex = /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color) : '#8b5cf6';
    let R = parseInt(cleanHex.substring(1, 3), 16);
    let G = parseInt(cleanHex.substring(3, 5), 16);
    let B = parseInt(cleanHex.substring(5, 7), 16);
    R = Math.max(0, Math.min(255, Math.round(R * (100 + percent) / 100)));
    G = Math.max(0, Math.min(255, Math.round(G * (100 + percent) / 100)));
    B = Math.max(0, Math.min(255, Math.round(B * (100 + percent) / 100)));
    return '#' + R.toString(16).padStart(2, '0') + G.toString(16).padStart(2, '0') + B.toString(16).padStart(2, '0');
};

const hexToRgb = (hex) => {
    const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex || ''));
    return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : null;
};

const getThemeColors = (themeValue) => {
    const themes = {
        lumen: { accent: '#00C49F', gradient: 'linear-gradient(135deg, #00C49F, #0033AA)', shadow: 'rgba(0, 196, 159, 0.35)' },
        tranquilidad: { accent: '#8B5CF6', gradient: 'linear-gradient(135deg, #8B5CF6, #06B6D4)', shadow: 'rgba(139, 92, 246, 0.35)' },
        claridad: { accent: '#06B6D4', gradient: 'linear-gradient(135deg, #06B6D4, #00C49F)', shadow: 'rgba(6, 182, 212, 0.35)' },
        blue: { accent: '#007aff', gradient: 'linear-gradient(135deg, #007aff, #005bb5)', shadow: 'rgba(0, 122, 255, 0.35)' },
        purple: { accent: '#8b5cf6', gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)', shadow: 'rgba(139, 92, 246, 0.35)' },
        green: { accent: '#10b981', gradient: 'linear-gradient(135deg, #10b981, #059669)', shadow: 'rgba(16, 185, 129, 0.35)' },
        orange: { accent: '#f59e0b', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)', shadow: 'rgba(245, 158, 11, 0.35)' },
        pink: { accent: '#ec4899', gradient: 'linear-gradient(135deg, #ec4899, #db2777)', shadow: 'rgba(236, 72, 153, 0.35)' },
        dark: { accent: '#475569', gradient: 'linear-gradient(135deg, #475569, #1e293b)', shadow: 'rgba(71, 85, 105, 0.35)' },
        forest: { accent: '#22c55e', gradient: 'linear-gradient(135deg, #22c55e, #14532d)', shadow: 'rgba(34, 197, 94, 0.35)' },
        rose: { accent: '#f43f5e', gradient: 'linear-gradient(135deg, #f43f5e, #9f1239)', shadow: 'rgba(244, 63, 94, 0.35)' }
    };
    if (themes[themeValue]) return themes[themeValue];
    if (typeof themeValue === 'string' && /^#[0-9a-fA-F]{6}$/.test(themeValue)) {
        return {
            accent: themeValue,
            gradient: `linear-gradient(135deg, ${themeValue}, ${shadeColor(themeValue, -20)})`,
            shadow: `rgba(${hexToRgb(themeValue) || '0,0,0'}, 0.35)`
        };
    }
    return themes.purple;
};

const assetColors = ['#0f4c81', '#0d9488', '#0284c7', '#059669', '#4f46e5', '#64748b', '#0891b2', '#2563eb'];
const cardColors = ['#4f46e5', '#0284c7', '#7c3aed', '#0d9488', '#db2777', '#2563eb', '#059669', '#d97706'];
const debtColors = ['#e11d48', '#d97706', '#dc2626', '#ea580c', '#be185d', '#b91c1c', '#9333ea', '#64748b'];
const categoryColors = ['#007aff', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

// --- COMPRESIÓN LOCAL E INDEXEDDB: CIERRE DE AÑO ---
const DB_NAME = 'MisFinanzasDB';
const DB_VERSION = 1;
const STORE_NAME = 'archived_transactions';

const initArchiveDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveToArchiveDB = async (transactions) => {
    if (!Array.isArray(transactions) || transactions.length === 0) return true;
    const shouldEncrypt = !!(
        globalThis.LumenSecurity?.isPinConfigured?.() &&
        !globalThis.LumenSecurity?.isVaultLocked?.() &&
        typeof globalThis.LumenSecurity?.encryptRecordForArchive === 'function'
    );

    const preparedRecords = shouldEncrypt
        ? await Promise.all(transactions.map((t) => globalThis.LumenSecurity.encryptRecordForArchive(t)))
        : transactions;

    const db = await initArchiveDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        preparedRecords.forEach((rec) => store.put(rec));
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });
};

const getArchivedTransactions = async (targetYear = null) => {
    if (globalThis.LumenSecurity?.isVaultLocked?.()) {
        throw new Error('Debes desbloquear la boveda para consultar el archivo historico.');
    }
    const db = await initArchiveDB();
    const rawRecords = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => { db.close(); resolve(req.result || []); };
        req.onerror = () => { db.close(); reject(req.error); };
    });

    const decryptedList = [];
    for (const rec of rawRecords) {
        if (!rec) continue;
        if (rec._encrypted && typeof globalThis.LumenSecurity?.decryptRecordFromArchive === 'function') {
            const plain = await globalThis.LumenSecurity.decryptRecordFromArchive(rec);
            if (plain) decryptedList.push(plain);
        } else if (!rec._encrypted) {
            decryptedList.push(rec);
        }
    }

    decryptedList.sort((a, b) => (a.id || 0) - (b.id || 0));
    if (targetYear !== null && targetYear !== undefined) {
        const prefix = `${targetYear}-`;
        return decryptedList.filter((t) => getTxMonthId(t).startsWith(prefix));
    }
    return decryptedList;
};

const restoreArchivedYearToActive = async (targetYear) => {
    const yearTxs = await getArchivedTransactions(targetYear);
    if (yearTxs.length === 0) return { restored: 0, success: true };

    const idsToRemove = new Set(yearTxs.map((t) => t.id));
    const existingIds = new Set(financeData.transactions.map((t) => t.id));
    const consolPrefix = `Saldo Consolidado Cierre ${targetYear}`;

    financeData.transactions = financeData.transactions.filter(
        (t) => !(t.isAdjustment && t.description === consolPrefix)
    );
    yearTxs.forEach((t) => {
        if (!existingIds.has(t.id)) financeData.transactions.push(t);
    });
    financeData.transactions.sort((a, b) => (a.id || 0) - (b.id || 0));
    localStorage.setItem('myFinances', JSON.stringify(financeData));

    const db = await initArchiveDB();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        idsToRemove.forEach((id) => store.delete(id));
        tx.oncomplete = () => { db.close(); resolve(true); };
        tx.onerror = () => { db.close(); reject(tx.error); };
    });

    return { restored: yearTxs.length, success: true };
};

globalThis.saveToArchiveDB = saveToArchiveDB;
globalThis.getArchivedTransactions = getArchivedTransactions;
globalThis.restoreArchivedYearToActive = restoreArchivedYearToActive;

globalThis.archiveYearData = async (targetYear) => {
    const yearNum = parseInt(targetYear, 10);
    if (!yearNum) return { deleted: 0, added: 0, success: false };
    const yearPrefix = `${yearNum}-`;
    const cutoffMonthId = `${yearNum}-12`;
    const consolDescForYear = `Saldo Consolidado Cierre ${yearNum}`;
    const txsToArchiveInDB = [];
    const priorYearConsols = [];
    const txsToKeep = [];

    financeData.transactions.forEach(t => {
        const txMId = String(getTxMonthId(t) || '');
        if (!t.isDeleted && txMId.startsWith(yearPrefix) && isTxClosed(t)) {
            if (t.isAdjustment && t.description === consolDescForYear) {
                priorYearConsols.push(t);
                return;
            }
            if (t.isAdjustment && /^Saldo Consolidado Cierre \d{4}$/.test(String(t.description || ''))) {
                txsToKeep.push(t);
                return;
            }
            const accObj = getAccountObj(t.account);
            const isChargeType = t.type === 'expense' || (t.type === 'transfer' && String(t.toAccount || '').startsWith('CxC_'));
            const isCreditPurchase = isChargeType && !t.isAdjustment && !t.isInterestCharge &&
                (accObj.category === 'credit_card' || accObj.debtType === 'revolving') &&
                (t.installments !== undefined || accObj.category === 'credit_card');
            const totalInst = Math.max(1, parseInt(t.installments, 10) || 1);
            const hasUnpaidInstallments = (isCreditPurchase || t.installments > 1) && ((parseInt(t.paidInstallments, 10) || 0) < totalInst);

            if (hasUnpaidInstallments) {
                txsToKeep.push(t);
            } else {
                const enriched = { ...t };
                if (t.account && !enriched._accLabel) enriched._accLabel = getAccountObj(t.account).name;
                if (t.toAccount && !enriched._toAccLabel) enriched._toAccLabel = getAccountObj(t.toAccount).name;
                txsToArchiveInDB.push(enriched);
            }
        } else {
            txsToKeep.push(t);
        }
    });

    if (txsToArchiveInDB.length === 0) return { deleted: 0, added: 0, success: true };

    const txsToDelete = txsToArchiveInDB;
    const netImpact = {};
    [...priorYearConsols, ...txsToArchiveInDB].forEach(t => {
        if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion')) return;
        const amt = round2(t.amount);
        const fromCat = getAccountObj(t.account).category;
        
        if (fromCat !== 'pocket') { 
            if (!netImpact[t.account]) netImpact[t.account] = 0;
            const isLiab = isLiabilityCategory(fromCat);
            if (t.type === 'income') netImpact[t.account] = round2(netImpact[t.account] + (isLiab ? -amt : amt));
            else if (t.type === 'expense') netImpact[t.account] = round2(netImpact[t.account] + (isLiab ? amt : -amt));
            else if (t.type === 'transfer') netImpact[t.account] = round2(netImpact[t.account] + (isLiab ? amt : -amt));
        }

        if (t.type === 'transfer' && t.toAccount) {
            const toCat = getAccountObj(t.toAccount).category;
            if (toCat !== 'pocket') {
                if (!netImpact[t.toAccount]) netImpact[t.toAccount] = 0;
                const isToLiab = isLiabilityCategory(toCat);
                netImpact[t.toAccount] = round2(netImpact[t.toAccount] + (isToLiab ? -amt : amt));
            }
        }
    });

    const cycleStartDay = getMonthStartDay();
    const safeConsolDay = cycleStartDay > 1 ? Math.max(1, cycleStartDay - 1) : 31;
    const consolidationDate = new Date(targetYear, 11, safeConsolDay, 12, 0, 0);
    const existingKeepIds = new Set(txsToKeep.map(t => t.id));
    let addedCount = 0;

    Object.keys(netImpact).forEach((accId, i) => {
        const impact = round2(netImpact[accId]);
        if (impact !== 0) {
            const isLiab = isLiabilityCategory(getAccountObj(accId).category);
            let tType = 'income';
            if (isLiab) tType = impact > 0 ? 'expense' : 'income'; 
            else tType = impact > 0 ? 'income' : 'expense'; 

            let consolId = consolidationDate.getTime() + i;
            while (existingKeepIds.has(consolId)) consolId += 1;
            existingKeepIds.add(consolId);

            txsToKeep.push({
                id: consolId,
                monthId: cutoffMonthId,
                type: tType,
                status: 'closed',
                account: accId,
                description: `Saldo Consolidado Cierre ${targetYear}`,
                amount: Math.abs(impact),
                date: `${safeConsolDay} dic, 12:00`,
                isAdjustment: true
            });
            addedCount++;
        }
    });

    try {
        // Magia: Guardamos en IndexedDB antes de tocar localStorage
        await saveToArchiveDB(txsToDelete);
        financeData.transactions = txsToKeep.sort((a, b) => a.id - b.id);
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        return { deleted: txsToDelete.length, added: addedCount, success: true };
    } catch (error) {
        console.error("Error archivando en IndexedDB:", error);
        return { deleted: 0, added: 0, success: false };
    }
};

// --- 10. MOTORES DE PROYECCIÓN, AHORRO, CALENDARIO Y SIMULADORES (DEPURADOS DE APP.JS) ---

// A. Libre Seguro Hoy
const computeSafeToSpendToday = (monthId, currSnap) => {
    let pendingExp = 0;
    financeData.transactions.forEach(t => {
        if (!t.isDeleted && !t.isTripIsolated && !(t.isSharedTrip && t.paidBy === 'companion') && getTxMonthId(t) === monthId && t.type === 'expense' && t.status === 'pending') {
            pendingExp = round2(pendingExp + round2(t.budgetedAmount || t.amount));
        }
    });

    const [mYearStr, mNumStr] = monthId.split('-');
    const mYear = parseInt(mYearStr, 10);
    const mIdx = parseInt(mNumStr, 10) - 1;
    let totalLimit = 0, totalSpentExp = 0;
    (financeData.categories.expense || []).forEach(c => {
        totalLimit = round2(totalLimit + getCategoryLimitForMonth(c, mIdx, mYear));
    });
    let totalRefundExp = 0;
    financeData.transactions.forEach(t => {
        if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion') || t.isTripIsolated || getTxMonthId(t) !== monthId || t.isAdjustment || !isTxClosed(t)) return;
        if (t.type === 'expense') {
            totalSpentExp = round2(totalSpentExp + round2(t.amount));
        } else if (t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) {
            totalRefundExp = round2(totalRefundExp + round2(t.amount));
        }
    });
    totalSpentExp = Math.max(0, round2(totalSpentExp - totalRefundExp));
    const budgetRemaining = Math.max(0, round2(totalLimit - totalSpentExp));
    const monthlyDebtPayments = getCommittedMonthlyDebtQuotas(currSnap, { onlyUnpaidCurrentMonth: true, refDate: currentDate });

    // Recurrentes activos del mes sin doble conteo:
    // Si ya estan presupuestados en su categoria/subcategoria (limite > 0), ya vienen en budgetRemaining.
    let unbudgetedRecurringDue = 0;
    (financeData.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
        if (!isRecurringDueInMonth(sub, monthId) || isRecurringPaidInMonth(sub, monthId)) return;
        const acc = getAccountObj(sub.accountId);
        if (acc.category === 'credit_card') return;
        const sCat = String(sub.category || '').split('::')[0];
        const sSub = sub.subcategory || 'General';
        const linkedLimit = sCat ? getBudgetedAmountForSelection('expense', sCat, sSub, mIdx, mYear) : 0;
        if (linkedLimit > 0) return;
        unbudgetedRecurringDue = round2(unbudgetedRecurringDue + getRecurringAmountInCOP(sub));
    });

    let liquidAssets = 0;
    financeData.customAccounts.forEach(a => {
        if (a.category === 'asset' && !a.id.startsWith('CxC_') && a.excludeFromLiquidity !== true) {
            liquidAssets = round2(liquidAssets + round2(currSnap.bals[a.id] || 0));
        }
    });

    const obligations = round2(pendingExp + budgetRemaining + monthlyDebtPayments + unbudgetedRecurringDue);
    const safeToSpend = Math.max(0, round2(liquidAssets - obligations));
    return { liquidAssets, pendingExp, budgetRemaining, monthlyDebtPayments, unbudgetedRecurringDue, obligations, safeToSpend };
};

// B. Mapa de Calor del Calendario
const isTxFixedExpense = (t) => {
    const expCats = financeData.categories?.expense || [];
    const catObj = expCats.find(c => c.name === t.category);
    if (catObj?.isFixed) return true;
    if (catObj && t.subcategory && Array.isArray(catObj.subcategories)) {
        const subObj = catObj.subcategories.find(s => s.name === t.subcategory);
        if (subObj?.isFixed) return true;
    }
    return false;
};

const computeCalendarHeatmapData = (baseDate, mode = 'variable') => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayStr = currentDate.toLocaleDateString('en-CA');
    const viewMonthId = `${year}-${String(month + 1).padStart(2, '0')}`;
    const currMonthId = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
    const monthPrefix = `${viewMonthId}-`;

    const dayActivity = {};
    financeData.transactions.forEach(t => {
        if (t.isDeleted) return;
        const dStr = new Date(t.id).toLocaleDateString('en-CA');
        if (!dStr.startsWith(monthPrefix)) return;

        if (!dayActivity[dStr]) {
            dayActivity[dStr] = { inc: false, exp: false, trf: false, pend: false, heatSpend: 0 };
        }
        if (t.status === 'pending') {
            dayActivity[dStr].pend = true;
        } else if (t.type === 'income') {
            dayActivity[dStr].inc = true;
        } else if (t.type === 'expense') {
            dayActivity[dStr].exp = true;
            if (!t.isAdjustment) {
                const excludeFixed = mode === 'variable' && (isTxFixedExpense(t) || t.isTripIsolated);
                if (!excludeFixed) {
                    dayActivity[dStr].heatSpend = round2(dayActivity[dStr].heatSpend + round2(t.amount));
                }
            }
        } else if (t.type === 'transfer') {
            dayActivity[dStr].trf = true;
        }
    });

    const spendValues = Object.values(dayActivity).map(a => a.heatSpend).filter(v => v > 0);
    const avgDailySpend = spendValues.length > 0
        ? round2(spendValues.reduce((s, v) => s + v, 0) / spendValues.length)
        : 0;

    const maxElapsedDay = viewMonthId < currMonthId
        ? daysInMonth
        : (viewMonthId === currMonthId ? currentDate.getDate() : 0);

    let zeroSpendDays = 0;
    const days = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const dStr = new Date(year, month, day).toLocaleDateString('en-CA');
        const act = dayActivity[dStr] || null;
        const daySpend = act ? act.heatSpend : 0;

        let heatClass = '';
        if (daySpend > 0 && avgDailySpend > 0) {
            const ratio = daySpend / avgDailySpend;
            if (ratio > 1.4) heatClass = 'heat-high';
            else if (ratio >= 0.75) heatClass = 'heat-med';
            else heatClass = 'heat-low';
        } else if (day <= maxElapsedDay && daySpend === 0) {
            zeroSpendDays++;
            heatClass = 'heat-zero';
        }

        days.push({
            day,
            dStr,
            act,
            daySpend,
            heatClass,
            isToday: dStr === todayStr
        });
    }

    return { offset, days, avgDailySpend, zeroSpendDays, maxElapsedDay };
};

// C. Bolsillos de Ahorro y Metas
const calcMonthsBetweenDates = (startStr, endStr) => {
    if (!endStr) return 0;
    const todayStr = currentDate.toLocaleDateString('en-CA');
    const [sy, sm, sd] = (startStr || todayStr).split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    return Math.max(1, (ey - sy) * 12 + (em - sm) + (ed > sd ? 1 : 0));
};

const getEffectiveStartStr = (startDateStr) => {
    const todayStr = currentDate.toLocaleDateString('en-CA');
    return (startDateStr && startDateStr > todayStr) ? startDateStr : todayStr;
};

const computePocketMetrics = (p) => {
    const principal = round2(p.principal || 0);
    const yields = round2(p.yields || 0);
    const balance = round2(principal + yields);
    const goal = round2(p.goal || 0);
    const remaining = Math.max(0, round2(goal - balance));
    const customQuota = round2(p.customQuota || 0);

    let suggestedQuota = 0;
    let monthsLeft = 0;
    let totalMonths = 0;

    if (p.targetDate) {
        const effStart = getEffectiveStartStr(p.startDate);
        monthsLeft = calcMonthsBetweenDates(effStart, p.targetDate);
        totalMonths = calcMonthsBetweenDates(p.startDate || effStart, p.targetDate);
        if (remaining > 0) {
            suggestedQuota = round2(remaining / monthsLeft);
        }
    }

    const activeQuota = customQuota > 0 ? customQuota : suggestedQuota;

    let paceStatus = null;
    if (goal > 0 && p.startDate && p.targetDate && remaining > 0) {
        const todayStr = currentDate.toLocaleDateString('en-CA');
        if (todayStr > p.startDate && totalMonths > 1) {
            const elapsedMonths = Math.max(0, totalMonths - monthsLeft);
            const expectedBalance = round2((goal / totalMonths) * elapsedMonths);
            if (balance >= expectedBalance * 0.95) paceStatus = { label: 'Al día', cls: 'good' };
            else paceStatus = { label: 'Atrasado', cls: 'warn' };
        }
    }

    return { principal, yields, balance, goal, remaining, monthsLeft, totalMonths, suggestedQuota, customQuota, activeQuota, paceStatus };
};

const getPocketsTotalSaved = () => {
    return round2((financeData.pockets || []).reduce((sum, p) => sum + round2((p.principal || 0) + (p.yields || 0)), 0));
};

const computeAllPocketsSummary = (currSnap = null) => {
    let totalSaved = 0, totalYields = 0, totalMonthlySuggested = 0;
    let totalPocketsGoal = 0, sumGoalCappedBal = 0;

    (financeData.pockets || []).forEach(p => {
        const m = computePocketMetrics(p);
        totalSaved = round2(totalSaved + m.balance);
        totalYields = round2(totalYields + m.yields);
        if (m.remaining > 0 || m.customQuota > 0) {
            totalMonthlySuggested = round2(totalMonthlySuggested + m.activeQuota);
        }
        if (m.goal > 0) {
            totalPocketsGoal = round2(totalPocketsGoal + m.goal);
            sumGoalCappedBal = round2(sumGoalCappedBal + Math.min(m.goal, m.balance));
        }
    });

    let pocketsPct = 0;
    if (totalPocketsGoal > 0) pocketsPct = Math.min(100, Math.round((sumGoalCappedBal / totalPocketsGoal) * 100));
    else if (totalSaved > 0 || (currSnap && currSnap.pocketsTotal > 0)) pocketsPct = 100;

    return { totalSaved, totalYields, totalMonthlySuggested, totalPocketsGoal, pocketsPct };
};

// D. Modo Viaje
const getTripTagSlug = (name) => {
    const clean = String(name || 'viaje').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
    return clean.length >= 2 ? clean : 'viaje';
};

const computeActiveTripStats = () => {
    const trip = financeData.tripMode || { active: false };
    if (!trip.name) return { spent: 0, count: 0, budget: 0, remaining: 0, pct: 0, slug: 'viaje', mePaid: 0, companionPaid: 0 };
    
    const slug = trip.tag || getTripTagSlug(trip.name);
    let spent = 0, count = 0, mePaid = 0, companionPaid = 0;

    financeData.transactions.forEach(t => {
        if (t.isDeleted || t.type !== 'expense' || t.isAdjustment) return;
        if ((Array.isArray(t.tags) && t.tags.includes(slug)) || t.tripName === trip.name) {
            const amt = round2(t.status === 'pending' ? (t.budgetedAmount || t.amount) : t.amount);
            spent = round2(spent + amt);
            count++;
            
            if (t.isSharedTrip) {
                if (t.paidBy === 'me') mePaid = round2(mePaid + amt);
                else if (t.paidBy === 'companion') companionPaid = round2(companionPaid + amt);
            } else {
                mePaid = round2(mePaid + amt); // Gastos no compartidos también los pagué yo
            }
        }
    });
    
    const budget = round2(trip.budget || 0);
    const remaining = budget > 0 ? round2(budget - spent) : 0;
    const pct = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;
    
    return { spent, count, budget, remaining, pct, slug, mePaid, companionPaid };
};

// Helper centralizado: estado real de Nómina y Anticipos de un mes (Mensual y 1Q/2Q)
const isTxPayrollAdvance = (t) => {
    if (!t || t.isDeleted || t.isAdjustment || t.type !== 'income') return false;
    const catClean = normalizeCategoryName(stripLeadingEmoji(t.category || ''));
    const subClean = normalizeCategoryName(stripLeadingEmoji(t.subcategory || ''));
    const descClean = normalizeCategoryName(t.description || '');
    if (!catClean.includes('nomina') && !catClean.includes('salario') && !descClean.includes('nomina') && !descClean.includes('quincena')) {
        return false;
    }
    return !!(t.isPayrollAdvance || subClean === 'anticipo' || /\b(anticipo|adelanto)\b/.test(descClean));
};

const isTxMainPayrollPayment = (t) => {
    if (!t || t.isDeleted || t.isAdjustment || t.type !== 'income' || !isTxClosed(t)) return false;
    if (isTxPayrollAdvance(t) || t.benefitType) return false;
    const text = normalizeCategoryName(`${stripLeadingEmoji(t.category || '')} ${stripLeadingEmoji(t.subcategory || '')} ${t.description || ''}`);
    if (!/\b(salario|nomina|quincena|sueldo)\b/.test(text)) return false;
    if (/\b(prima|cesantia|vacacion|bono|bonificacion|retroactivo|liquidacion)\b/.test(text)) return false;
    return true;
};

const getPayrollMonthStatus = (monthId, customSalCfg = null, precomputedMetrics = null) => {
    const cfg = customSalCfg || safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    if (!cfg || !(Number(cfg.basicSalary) > 0)) {
        return {
            hasSalary: false, isBiweekly: false, splitBoundary: 15,
            baseNet: 0, baseNet1Q: 0, baseNet2Q: 0,
            advancesTotal: 0, advances1Q: 0, advances2Q: 0,
            paidMonthly: false, paid1Q: false, paid2Q: false,
            netAfterAdvances: 0, effNet1Q: 0, effNet2Q: 0, remNetMonthly: 0, remNet1Q: 0, remNet2Q: 0
        };
    }

    const [yStr, mStr] = String(monthId || getMonthId(currentDate)).split('-');
    const y = parseInt(yStr, 10) || currentDate.getFullYear();
    const m = Math.max(0, Math.min(11, (parseInt(mStr, 10) || (currentDate.getMonth() + 1)) - 1));
    const daysInM = new Date(y, m + 1, 0).getDate();
    const isBiweekly = cfg.frequency === 'biweekly';

    const resolvedDays = typeof globalThis.getResolvedSalaryPayDays === 'function'
        ? globalThis.getResolvedSalaryPayDays(cfg, y, m)
        : (isBiweekly ? [Math.min(15, daysInM), Math.min(30, daysInM)] : [Math.min(parseInt(cfg.payDay, 10) || 30, daysInM)]);
    const d1 = resolvedDays[0] || Math.min(15, daysInM);
    const d2 = resolvedDays[1] || Math.min(30, daysInM);
    const splitBoundary = isBiweekly ? Math.floor((d1 + d2) / 2) : d1;

    const metrics = precomputedMetrics || calculateLaborMetrics(cfg, new Date(y, m, 15));
    const baseNet = round2(metrics.net || 0);
    const baseNet1Q = round2(metrics.net1Q ?? (baseNet / 2));
    const baseNet2Q = round2(metrics.net2Q ?? (baseNet - baseNet1Q));

    let advancesTotal = 0, advances1Q = 0, advances2Q = 0;
    let paidMonthly = false, paid1Q = false, paid2Q = false;

    (financeData.transactions || []).forEach(t => {
        if (t.isDeleted || getTxMonthId(t) !== monthId) return;
        const txDay = getTxEffectiveDateObj(t, new Date(y, m, 15)).getDate();
        const descStr = String(t.description || '');

        if (isTxClosed(t) && isTxPayrollAdvance(t)) {
            const amt = round2(t.amount || 0);
            advancesTotal = round2(advancesTotal + amt);
            if (/\(2Q\)/i.test(descStr) || txDay > splitBoundary) advances2Q = round2(advances2Q + amt);
            else advances1Q = round2(advances1Q + amt);
        } else if (isTxMainPayrollPayment(t)) {
            paidMonthly = true;
            if (isBiweekly) {
                if (/\(1Q\)/i.test(descStr)) paid1Q = true;
                else if (/\(2Q\)/i.test(descStr)) paid2Q = true;
                else if (txDay <= splitBoundary) paid1Q = true;
                else paid2Q = true;
            }
        }
    });

    const netAfterAdvances = Math.max(0, round2(baseNet - advancesTotal));
    const raw1Q = round2(baseNet1Q - advances1Q);
    const overflow1Q = raw1Q < 0 ? Math.abs(raw1Q) : 0;
    const raw2Q = round2(baseNet2Q - advances2Q - overflow1Q);
    const overflow2Q = (!paid1Q && raw2Q < 0) ? Math.abs(raw2Q) : 0;

    const effNet1Q = Math.max(0, round2(Math.max(0, raw1Q) - overflow2Q));
    const effNet2Q = Math.max(0, raw2Q);

    return {
        hasSalary: true, isBiweekly, d1, d2, splitBoundary,
        baseNet, baseNet1Q, baseNet2Q,
        advancesTotal, advances1Q, advances2Q,
        paidMonthly, paid1Q, paid2Q,
        netAfterAdvances,
        effNet1Q,
        effNet2Q,
        remNetMonthly: paidMonthly ? 0 : netAfterAdvances,
        remNet1Q: paid1Q ? 0 : effNet1Q,
        remNet2Q: paid2Q ? 0 : effNet2Q
    };
};

// E. Proyección de Efectivo Día por Día
const computeCashProjectionData = (horizon = 'eom') => {
    const today = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
    const todayStr = today.toLocaleDateString('en-CA');
    let endDate;

    if (horizon === '15d') endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 15);
    else if (horizon === '30d') endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);
    else if (horizon === '60d') endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 60);
    else endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const currMonthId = getMonthId(today);
    const currSnap = computeBalancesUpTo(currMonthId);

    let startBalance = 0;
    financeData.customAccounts.forEach(a => {
        if (a.category === 'asset' && !a.id.startsWith('CxC_') && a.excludeFromLiquidity !== true) {
            startBalance = round2(startBalance + round2(currSnap.bals[a.id] || 0));
        }
    });

    const events = [];
    const pushEvent = (dateObj, type, amount, label) => {
        if (!amount || amount <= 0) return;
        const cleanDate = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
        if (cleanDate < today || cleanDate > endDate) return;
        events.push({
            dateStr: cleanDate.toLocaleDateString('en-CA'),
            dateObj: cleanDate,
            type,
            amount: round2(amount),
            label: stripLeadingEmoji(label)
        });
    };

    // 1. Movimientos pendientes programados
    financeData.transactions.forEach(t => {
        if (t.isDeleted || t.status !== 'pending') return;
        const txDate = new Date(t.id);
        const amt = round2(t.budgetedAmount || t.amount);
        if (t.type === 'income') {
            pushEvent(txDate, 'income', amt, t.description || 'Ingreso pendiente');
        } else if (t.type === 'expense') {
            const acc = getAccountObj(t.account);
            if (acc.category !== 'credit_card') {
                pushEvent(txDate, 'expense', amt, t.description || 'Gasto pendiente');
            }
        } else if (t.type === 'transfer') {
            const fromAcc = getAccountObj(t.account);
            const toAcc = getAccountObj(t.toAccount);
            const fromLiquid = fromAcc.category === 'asset' && !fromAcc.id.startsWith('CxC_') && fromAcc.excludeFromLiquidity !== true;
            const toLiquid = toAcc.category === 'asset' && !toAcc.id.startsWith('CxC_') && toAcc.excludeFromLiquidity !== true;
            if (fromLiquid && !toLiquid) pushEvent(txDate, 'expense', amt, t.description || 'Transferencia');
            else if (!fromLiquid && toLiquid) pushEvent(txDate, 'income', amt, t.description || 'Ingreso por transferencia');
        }
    });

    // 2. Nómina, tarjetas y préstamos mes a mes
    const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);

    let iter = new Date(today.getFullYear(), today.getMonth(), 1);
    const endMonthStart = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (iter <= endMonthStart) {
        const y = iter.getFullYear();
        const m = iter.getMonth();
        const mId = getMonthId(iter);
        const daysInM = new Date(y, m + 1, 0).getDate();

        if (salCfg && salCfg.basicSalary > 0) {
            const pStatus = getPayrollMonthStatus(mId, salCfg);
            const paySlots = pStatus.isBiweekly
                ? [
                    { day: pStatus.d1, amount: pStatus.remNet1Q, label: 'Nómina (1Q)' },
                    { day: pStatus.d2, amount: pStatus.remNet2Q, label: 'Nómina (2Q)' }
                ]
                : [
                    { day: pStatus.d1, amount: pStatus.remNetMonthly, label: pStatus.advancesTotal > 0 ? 'Pago Nómina (Restante)' : 'Pago Nómina' }
                ];

            paySlots.forEach(slot => {
                const hasPendingSameSlot = financeData.transactions.some(t =>
                    !t.isDeleted && t.status === 'pending' && getTxMonthId(t) === mId && t.type === 'income' &&
                    /salario|n[oó]mina|quincena/i.test(`${t.category || ''} ${t.description || ''}`) &&
                    Math.abs(new Date(t.id).getDate() - slot.day) <= 5
                );
                if (!hasPendingSameSlot && slot.amount > 0) {
                    pushEvent(new Date(y, m, slot.day), 'income', slot.amount, slot.label);
                }
            });
        }

        financeData.customAccounts.filter(a => a.category === 'credit_card').forEach(c => {
            const bal = round2(currSnap.bals[c.id] || 0);
            if (bal <= 0 || !c.paymentDay) return;
            const dueDt = new Date(y, m, Math.min(c.paymentDay, daysInM), 12, 0, 0);
            const st = getLiabilityDueCycleState(c, bal, dueDt, today);
            if (!st.isPaid && st.remainingQuota > 0) {
                const cleanName = stripLeadingEmoji(c.name);
                pushEvent(dueDt, 'expense', st.remainingQuota, /^(tc\b|tarjeta\b)/i.test(cleanName) ? cleanName : `TC ${cleanName}`);
            }
        });

        financeData.customAccounts.filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
            const bal = round2(currSnap.bals[d.id] || 0);
            if (bal <= 0) return;
            const dueDt = new Date(y, m, Math.min(d.paymentDay || 30, daysInM), 12, 0, 0);
            const st = d.paymentDay
                ? getLiabilityDueCycleState(d, bal, dueDt, today)
                : {
                    isPaid: financeData.transactions.some(t => !t.isDeleted && isTxClosed(t) && t.paymentMode !== 'extraordinary' && getTxMonthId(t) === mId && t.toAccount === d.id && t.type === 'transfer'),
                    remainingQuota: getDebtMonthlyQuotaBreakdown(d, bal).totalQuota
                };
            if (!st.isPaid && st.remainingQuota > 0) {
                pushEvent(dueDt, 'expense', st.remainingQuota, `Cuota ${stripLeadingEmoji(d.name)}`);
            }
        });

        iter.setMonth(iter.getMonth() + 1);
    }

    // 3. Pagos recurrentes activos con cargo a liquidez
    (financeData.subscriptions || []).filter(s => s.status === 'active' && s.nextBillingDate).forEach(sub => {
        const acc = getAccountObj(sub.accountId);
        if (acc.category === 'credit_card') return;
        const amtCop = getRecurringAmountInCOP(sub);
        const [sy, sm, sd] = sub.nextBillingDate.split('-').map(Number);
        let nextD = new Date(sy, sm - 1, sd);
        let guard = 0;
        while (nextD <= endDate && guard < 24) {
            guard++;
            if (nextD >= today) {
                pushEvent(nextD, 'expense', amtCop, `Recurrente: ${sub.name}`);
            }
            if (sub.cycle === 'monthly') nextD.setMonth(nextD.getMonth() + 1);
            else if (sub.cycle === 'bimonthly') nextD.setMonth(nextD.getMonth() + 2);
            else if (sub.cycle === 'quarterly') nextD.setMonth(nextD.getMonth() + 3);
            else if (sub.cycle === 'semiannual') nextD.setMonth(nextD.getMonth() + 6);
            else if (sub.cycle === 'annual') nextD.setFullYear(nextD.getFullYear() + 1);
            else if (sub.cycle === 'weekly') nextD.setDate(nextD.getDate() + 7);
            else break;
        }
    });

    const grouped = {};
    events.forEach(ev => {
        if (!grouped[ev.dateStr]) grouped[ev.dateStr] = { dateStr: ev.dateStr, dateObj: ev.dateObj, items: [] };
        grouped[ev.dateStr].items.push(ev);
    });

    const sortedDays = Object.values(grouped).sort((a, b) => a.dateObj - b.dateObj);
    let running = startBalance;
    let lowestBalance = startBalance;
    let lowestDateStr = todayStr;
    let totalIn = 0;
    let totalOut = 0;

    sortedDays.forEach(dayGroup => {
        let dayIn = 0, dayOut = 0;
        dayGroup.items.forEach(it => {
            if (it.type === 'income') dayIn = round2(dayIn + it.amount);
            else dayOut = round2(dayOut + it.amount);
        });
        totalIn = round2(totalIn + dayIn);
        totalOut = round2(totalOut + dayOut);
        running = round2(running + dayIn - dayOut);
        dayGroup.endBalance = running;

        if (running < lowestBalance) {
            lowestBalance = running;
            lowestDateStr = dayGroup.dateStr;
        }
    });

    return { today, todayStr, endDate, startBalance, endBalance: running, totalIn, totalOut, lowestBalance, lowestDateStr, sortedDays };
};

// F. Calculadora de Ahorro e Interés Compuesto
const calculateCompoundSavingsProjection = ({ currentAge, targetAge, initial, periodsPerYear, contribution, annualRate, taxRate = 0 }) => {
    const years = targetAge - currentAge;
    if (years <= 0 || years > 70) return { valid: false, years };

    const safeInitial = round2(initial || 0);
    const safeContrib = round2(contribution || 0);
    const safeRate = Math.max(0, Math.min(30, annualRate || 0));
    const periodicRate = safeRate > 0 ? Math.pow(1 + safeRate / 100, 1 / periodsPerYear) - 1 : 0;

    let balance = safeInitial;
    let totalContributed = safeInitial;
    let totalTax = 0;
    const timeline = [{ year: 0, age: currentAge, contributed: totalContributed, interest: 0, tax: 0, balance }];

    for (let y = 1; y <= years; y++) {
        let yearInterest = 0;
        let yearTax = 0;
        for (let p = 0; p < periodsPerYear; p++) {
            const grossInterest = balance * periodicRate;
            const taxWithheld = grossInterest * taxRate;
            const netInterest = grossInterest - taxWithheld;
            
            yearInterest += netInterest;
            yearTax += taxWithheld;
            
            balance = balance + netInterest + safeContrib;
            totalContributed += safeContrib;
        }
        
        totalTax += yearTax;
        const cleanBal = round2(balance);
        const cleanContrib = round2(totalContributed);
        timeline.push({
            year: y,
            age: currentAge + y,
            contributed: cleanContrib,
            interest: Math.max(0, round2(cleanBal - cleanContrib)),
            tax: round2(totalTax),
            balance: cleanBal
        });
    }

    const finalSnap = timeline[timeline.length - 1];
    const totalAdded = round2(finalSnap.contributed - safeInitial);
    const principalPct = finalSnap.balance > 0 ? Math.round((finalSnap.contributed / finalSnap.balance) * 100) : 100;
    const interestPct = Math.max(0, 100 - principalPct);

    return {
        valid: true,
        years,
        currentAge,
        targetAge,
        initial: safeInitial,
        totalAdded,
        totalTax: round2(totalTax),
        finalSnap,
        principalPct,
        interestPct,
        timeline
    };
};

// G. Simulador de Planificador de Deudas (Avalancha / Bola de Nieve)
const computeDebtPlannerSimulation = ({ monthId, strategy = 'avalanche', extraMonthly = 0, primaMode = 'both' }) => {
    const snap = computeBalancesUpTo(monthId);
    const allPositiveDebts = financeData.customAccounts
        .filter(a => (a.category === 'debt' || a.category === 'credit_card') && snap.bals[a.id] > 0)
        .map(a => {
            const bal = round2(snap.bals[a.id]);
            let rate = 0, minPay = 0;
            if (a.category === 'debt') {
                rate = a.debtRateType === 'annual' ? (Math.pow(1 + (a.debtRate || 0) / 100, 1 / 12) - 1) * 100 : (a.debtRate || 0);
                minPay = a.debtMonthlyPayment || 0;
                if (minPay === 0 && a.debtType !== 'revolving') {
                    minPay = calculateAmortization(a.debtOriginal || bal, a.debtTotalQuotes || 1, rate, 'monthly').payment;
                } else if (a.debtType === 'revolving') {
                    const revPurchases = getPendingRevolvingPurchases(a.id);
                    minPay = round2(minPay + revPurchases.reduce((s, p) => s + p.nextQuota, 0));
                    if (rate <= 0 && revPurchases.length > 0) {
                        const maxPurchRate = Math.max(...revPurchases.map(p => p.rateType === 'annual' ? (Math.pow(1 + (p.rate || 0) / 100, 1 / 12) - 1) * 100 : (p.rate || 0)));
                        if (maxPurchRate > 0) rate = maxPurchRate;
                    }
                }
            } else {
                const nominalCardRate = a.rateType === 'annual' ? (Math.pow(1 + (a.rate || 0) / 100, 1 / 12) - 1) * 100 : (a.rate || 0);
                const est = calculateCardMinPaymentEstimate(a, bal);
                const cardPurchases = getPendingCardPurchases(a.id);
                let interestBearingCap = 0;
                let weightedRateSum = 0;
                cardPurchases.forEach(p => {
                    if (!p.zeroInterest && (p.rate || 0) > 0 && p.remCapital > 0) {
                        const pMonthlyPct = p.rateType === 'annual'
                            ? (Math.pow(1 + p.rate / 100, 1 / 12) - 1) * 100
                            : p.rate;
                        interestBearingCap = round2(interestBearingCap + p.remCapital);
                        weightedRateSum += p.remCapital * pMonthlyPct;
                    }
                });
                if ((est.unallocatedDebt || 0) > 0 && nominalCardRate > 0) {
                    interestBearingCap = round2(interestBearingCap + est.unallocatedDebt);
                    weightedRateSum += est.unallocatedDebt * nominalCardRate;
                }
                rate = interestBearingCap > 0
                    ? round2((weightedRateSum / bal) * 100) / 100
                    : (cardPurchases.length > 0 ? 0 : nominalCardRate);
                const realCardServiceQuota = round2((est.deferredQuota || 0) + (est.initialQuotaApplied || 0));
                minPay = realCardServiceQuota > 0 ? realCardServiceQuota : round2(bal * 0.05);
            }
            return { id: a.id, name: stripLeadingEmoji(a.name), bal, rate, minPay };
        });

    const activeDebts = allPositiveDebts.filter(d => d.rate > 0);
    const excludedZeroRateDebts = allPositiveDebts.filter(d => d.rate <= 0);

    if (activeDebts.length === 0) {
        return { activeDebts, excludedZeroRateDebts, baseRes: null, optRes: null, interestSaved: 0 };
    }

    let halfPrimaJun = 0, halfPrimaDec = 0;
    const salCfg = safeJsonParse(localStorage.getItem('myFinancesSalary'), null);
    if (salCfg) {
        const lm = calculateLaborMetrics(salCfg, currentDate);
        halfPrimaJun = lm.halfPrimaJunNeta || lm.halfPrimaNeta || 0;
        halfPrimaDec = lm.halfPrimaDecNeta || lm.halfPrimaNeta || 0;
    }

    const [startY, startM] = monthId.split('-').map(Number);

    const simAmort = (debts, addExtra) => {
        let simDebts = debts.map(d => ({ ...d }));
        const baseMonthlyPool = round2(simDebts.reduce((s, d) => s + d.minPay, 0));
        let monthIter = new Date(startY, startM - 1, 1);
        let totalInterest = 0, monthsCount = 0;
        const schedule = [];
        let isUnpayable = false;

        while (simDebts.length > 0 && monthsCount < 360) {
            monthsCount++;
            let currentMonthExtra = addExtra ? extraMonthly : 0;
            if (addExtra) {
                const mStr = `${monthIter.getFullYear()}-${String(monthIter.getMonth() + 1).padStart(2, '0')}`;
                const monthExtrasSum = (financeData.plannerExtras || [])
                    .filter(e => e.month === mStr)
                    .reduce((s, e) => round2(s + round2(e.amount || 0)), 0);
                if (monthExtrasSum > 0) currentMonthExtra = round2(currentMonthExtra + monthExtrasSum);
                if (monthIter.getMonth() === 5 && (primaMode === 'both' || primaMode === 'june')) currentMonthExtra = round2(currentMonthExtra + halfPrimaJun);
                if (monthIter.getMonth() === 11 && (primaMode === 'both' || primaMode === 'december')) currentMonthExtra = round2(currentMonthExtra + halfPrimaDec);
            }

            let monthInterest = 0, monthTotalPay = 0;
            simDebts.forEach(d => {
                const int = round2(d.bal * (d.rate / 100));
                monthInterest = round2(monthInterest + int);
                totalInterest = round2(totalInterest + int);
                d.bal = round2(d.bal + int);
            });

            if (addExtra) simDebts.sort((a, b) => strategy === 'avalanche' ? b.rate - a.rate : a.bal - b.bal);
            const focusDebtObj = simDebts.length > 0 ? simDebts[0] : null;
            const focusDebtName = focusDebtObj ? focusDebtObj.name : 'Liberado';

            simDebts.forEach(d => {
                const pay = Math.min(d.bal, d.minPay);
                d.bal = round2(d.bal - pay);
                monthTotalPay = round2(monthTotalPay + pay);
            });

            const freedPool = addExtra ? Math.max(0, round2(baseMonthlyPool - monthTotalPay)) : 0;
            let leftover = round2(freedPool + currentMonthExtra);
            if (addExtra && leftover > 0) {
                for (const target of simDebts) {
                    if (target.bal > 0) {
                        const extraPay = Math.min(target.bal, leftover);
                        target.bal = round2(target.bal - extraPay);
                        monthTotalPay = round2(monthTotalPay + extraPay);
                        leftover = round2(leftover - extraPay);
                        if (leftover <= 0) break;
                    }
                }
            }

            const focusRemainingBalance = focusDebtObj ? round2(focusDebtObj.bal) : 0;
            simDebts = simDebts.filter(d => d.bal > 0);
            const currentTotalBalance = round2(simDebts.reduce((s, d) => s + d.bal, 0));

            if (!addExtra && monthsCount === 12 && monthTotalPay <= monthInterest) {
                isUnpayable = true;
                break;
            }

            if (addExtra && monthsCount <= 36) {
                schedule.push({
                    monthStr: `${getShortMonthLabel(monthIter)} ${String(monthIter.getFullYear()).slice(-2)}`,
                    targetName: focusDebtName,
                    pay: monthTotalPay,
                    int: monthInterest,
                    focusRem: focusRemainingBalance,
                    rem: currentTotalBalance
                });
            }
            monthIter.setMonth(monthIter.getMonth() + 1);
        }

        if (!addExtra && monthsCount >= 360) isUnpayable = true;
        return { months: monthsCount, interest: totalInterest, schedule, freedomDate: monthIter, isUnpayable };
    };

    const baseRes = simAmort(activeDebts, false);
    const optRes = simAmort(activeDebts, true);
    const interestSaved = Math.max(0, round2(baseRes.interest - optRes.interest));

    return { activeDebts, excludedZeroRateDebts, baseRes, optRes, interestSaved };
};

// H. Simulador de Aumento Salarial y Retroactivo
const getHalfMonthIndex = (monthStr, period) => {
    if (!monthStr || !monthStr.includes('-')) return 0;
    const [y, m] = monthStr.split('-').map(Number);
    return y * 24 + (m - 1) * 2 + (period === '2Q' ? 1 : 0);
};

const computeSalaryRaiseSimulation = ({
    currentBasic, newBasic, baseSalaryConfig = {},
    effMonth, effPeriod = 'M', isRetro = false,
    retroFromMonth, retroFromPeriod = 'M', retroPayMonth, retroPayPeriod = 'M'
}) => {
    const curB = round2(currentBasic || 0);
    const newB = round2(newBasic || 0);
    if (curB <= 0 || newB <= 0 || newB === curB) return null;

    const diff = round2(newB - curB);
    const pct = round2((diff / curB) * 100);

    const currentMetrics = calculateLaborMetrics({ ...baseSalaryConfig, basicSalary: curB }, currentDate);
    const newMetrics = calculateLaborMetrics({ ...baseSalaryConfig, basicSalary: newB }, currentDate);
    const netDiff = round2(newMetrics.net - currentMetrics.net);

    const activeEffMonth = effMonth || getMonthId(currentDate);
    const activeFromMonth = retroFromMonth || activeEffMonth;
    const activePayMonth = retroPayMonth || activeEffMonth;

    let retroHalfMonths = 0;
    let retroNetAmount = 0;

    if (isRetro) {
        const effIdx = getHalfMonthIndex(activeEffMonth, effPeriod);
        const fromIdx = getHalfMonthIndex(activeFromMonth, retroFromPeriod);
        if (effIdx > fromIdx) {
            retroHalfMonths = effIdx - fromIdx;
            for (let h = fromIdx; h < effIdx; h++) {
                const qDiff = (h % 2 === 0)
                    ? round2(newMetrics.net1Q - currentMetrics.net1Q)
                    : round2(newMetrics.net2Q - currentMetrics.net2Q);
                retroNetAmount = round2(retroNetAmount + qDiff);
            }
        }
    }

    return {
        currentBasic: curB, newBasic: newB, diff, pct,
        currentMetrics, newMetrics, netDiff,
        effMonth: activeEffMonth, effPeriod,
        isRetro, retroFromMonth: activeFromMonth, retroFromPeriod,
        retroPayMonth: activePayMonth, retroPayPeriod,
        retroHalfMonths, retroNetAmount
    };
};

// I. Capacidad de Endeudamiento Detallada con Gastos Fijos y Flujo Libre
const computeDetailedBorrowingCapacity = (monthId) => {
    const cap = calculateBorrowingCapacity(monthId);
    const [yStr, mStr] = monthId.split('-');
    const year = parseInt(yStr, 10) || currentDate.getFullYear();
    const mIdx = Math.max(0, Math.min(11, parseInt(mStr, 10) - 1));

    let totalFixedExpenses = 0;
    (financeData.categories.expense || []).forEach(c => {
        if (c.isArchived) return;
        if (c.isFixed) {
            totalFixedExpenses = round2(totalFixedExpenses + (getCategoryLimitForMonth(c, mIdx, year) || 0));
        } else if (c.subcategories) {
            c.subcategories.forEach(sub => {
                if (!sub.isArchived && sub.isFixed) {
                    const subLim = getCategoryBudgetStatus(c, sub, mIdx, year).currentLimit;
                    totalFixedExpenses = round2(totalFixedExpenses + subLim);
                }
            });
        }
    });

    const healthyDebtLimit = round2((cap.baseIncome * cap.maxPct) / 100);
    const freeCashFlow = round2(cap.baseIncome - totalFixedExpenses - cap.committedMonthly);
    const mathAvailableDebt = round2(healthyDebtLimit - cap.committedMonthly);
    const realSafeQuota = Math.max(0, Math.min(mathAvailableDebt, freeCashFlow));
    const isDeficit = freeCashFlow < 0 || mathAvailableDebt < 0;
    const visualQuota = isDeficit ? Math.min(mathAvailableDebt, freeCashFlow) : realSafeQuota;

    return {
        ...cap,
        totalFixedExpenses,
        healthyDebtLimit,
        freeCashFlow,
        mathAvailableDebt,
        realSafeQuota,
        isDeficit,
        visualQuota,
        loan24: realSafeQuota > 0 ? round2(realSafeQuota * ((1 - Math.pow(1.015, -24)) / 0.015)) : 0,
        loan36: realSafeQuota > 0 ? round2(realSafeQuota * ((1 - Math.pow(1.015, -36)) / 0.015)) : 0
    };
};

// J. Matriz Consolidada de Control Anual
const computeAnnualControlMatrix = (year) => {
    const incPtto = Array(12).fill(0), incReal = Array(12).fill(0);
    const expPtto = Array(12).fill(0), expReal = Array(12).fill(0);

    const buildRows = (type) => {
        const sortedCats = [...(financeData.categories[type] || [])].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
        return sortedCats.map(catObj => {
            const pttoArr = Array(12).fill(0), realArr = Array(12).fill(0);
            for (let m = 0; m < 12; m++) {
                const mId = `${year}-${String(m + 1).padStart(2, '0')}`;
                const lim = getCategoryLimitForMonth(catObj, m, year);
                pttoArr[m] = lim;

                const baseReal = round2(financeData.transactions
                    .filter(t => {
                        if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion') || (type === 'expense' && t.isTripIsolated) || getTxMonthId(t) !== mId || t.type !== type || t.category !== catObj.name || t.isAdjustment || !isTxClosed(t)) return false;
                        if (type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) return false;
                        return true;
                    })
                    .reduce((s, t) => s + round2(t.amount), 0));
                const refOffset = type === 'expense'
                    ? round2(financeData.transactions
                        .filter(t => !t.isDeleted && !t.isTripIsolated && getTxMonthId(t) === mId && t.type === 'income' && !t.isAdjustment && isTxClosed(t) && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name)
                        .reduce((s, t) => s + round2(t.amount), 0))
                    : 0;
                realArr[m] = Math.max(0, round2(baseReal - refOffset));

                if (type === 'income') {
                    incPtto[m] = round2(incPtto[m] + lim);
                    incReal[m] = round2(incReal[m] + realArr[m]);
                } else {
                    expPtto[m] = round2(expPtto[m] + lim);
                    expReal[m] = round2(expReal[m] + realArr[m]);
                }
            }
            return { name: catObj.name, pttoArr, realArr };
        });
    };

    const incRows = buildRows('income');
    const expRows = buildRows('expense');

    let totIncP = 0, totIncR = 0, totExpP = 0, totExpR = 0;
    for (let i = 0; i < 12; i++) {
        totIncP = round2(totIncP + incPtto[i]);
        totIncR = round2(totIncR + incReal[i]);
        totExpP = round2(totExpP + expPtto[i]);
        totExpR = round2(totExpR + expReal[i]);
    }

    return {
        incPtto, incReal, expPtto, expReal,
        incRows, expRows,
        totIncP, totIncR, totExpP, totExpR,
        totNetP: round2(totIncP - totExpP),
        totNetR: round2(totIncR - totExpR)
    };
};

// --- 11. ASESORES INTELIGENTES, COMPRA CONSCIENTE, CIERRE DE MES Y GASTOS HORMIGA ---

// K. Asesor: ¿Con qué tarjeta pago hoy?
const evaluateBestCreditCardForPurchase = (purchaseAmount = 0, installments = 1, refDate = currentDate) => {
    const amt = Math.max(0, round2(purchaseAmount));
    const inst = Math.max(1, parseInt(installments, 10) || 1);
    const cards = financeData.customAccounts.filter(a => a.category === 'credit_card');
    if (cards.length === 0) return { cards: [], bestCard: null };

    const currSnap = computeBalancesUpTo(getMonthId(refDate));
    const cleanRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const y = cleanRef.getFullYear();
    const m = cleanRef.getMonth();

    const evaluated = cards.map(card => {
        const debt = Math.max(0, round2(currSnap.bals[card.id] || 0));
        const limit = round2(card.creditLimit || 0);
        const available = round2(limit - debt);
        const hasEnoughCredit = limit <= 0 || amt <= 0 || available >= amt;

        const cDay = Math.max(1, Math.min(31, parseInt(card.cutoffDay, 10) || 15));
        const pDay = Math.max(1, Math.min(31, parseInt(card.paymentDay, 10) || 30));

        const daysInCurr = new Date(y, m + 1, 0).getDate();
        let nextCut;
        if (cleanRef.getDate() <= cDay) {
            nextCut = new Date(y, m, Math.min(cDay, daysInCurr));
        } else {
            const daysInNext = new Date(y, m + 2, 0).getDate();
            nextCut = new Date(y, m + 1, Math.min(cDay, daysInNext));
        }

        const cutY = nextCut.getFullYear();
        const cutM = nextCut.getMonth();
        const payMonthOffset = pDay > cDay ? 0 : 1;
        const daysInPayM = new Date(cutY, cutM + payMonthOffset + 1, 0).getDate();
        const payDate = new Date(cutY, cutM + payMonthOffset, Math.min(pDay, daysInPayM));

        const daysToCutoff = Math.max(0, Math.round((nextCut - cleanRef) / 86400000));
        const daysToPayment = Math.max(1, Math.round((payDate - cleanRef) / 86400000));

        const est = calculateCardMinPaymentEstimate(card, debt, refDate);
        const liveCycle = getCardCycleActivity(card, refDate);
        const waiverType = card.mgmtFeeWaiverType || 'spend';
        const waiverSpend = round2(card.mgmtFeeWaiverSpend || 0);

        let missingForWaiver = 0;
        let wouldUnlockWaiver = false;
        let waiverSavedAmt = 0;

        if (est.hasMgmtFee && !liveCycle.hasChargedMgmtFee && liveCycle.cycleSpend < waiverSpend && (waiverType === 'spend' || waiverType === 'either') && waiverSpend > 0) {
            missingForWaiver = Math.max(0, round2(waiverSpend - liveCycle.cycleSpend));
            if (amt > 0 && amt >= missingForWaiver) {
                wouldUnlockWaiver = true;
                waiverSavedAmt = round2(card.mgmtFee || 0);
            }
        }

        const zeroIntMax = parseInt(card.zeroInterestMax, 10) || 0;
        const isZeroInterest = inst <= 1 || (zeroIntMax > 0 && inst <= zeroIntMax) || (card.rate || 0) <= 0;
        let interestCost = 0;
        let monthlyQuota = amt > 0 ? round2(amt / inst) : 0;

        if (!isZeroInterest && amt > 0) {
            const amort = calculateAmortization(amt, inst, card.rate || 0, card.rateType || 'monthly');
            interestCost = amort.totalInterest;
            monthlyQuota = amort.payment;
        }

        const newUtilPct = limit > 0 ? round2(((debt + amt) / limit) * 100) : 0;

        let score = daysToPayment;
        if (!hasEnoughCredit) score -= 1000;
        if (wouldUnlockWaiver) score += 45;
        if (!est.hasMgmtFee || est.mgmtFeeStatus === 'waived') score += 12;
        if (inst > 1 && isZeroInterest) score += 25;
        if (interestCost > 0) score -= Math.min(35, interestCost / 2000);
        if (newUtilPct > 75) score -= 12;

        const reasons = [];
        reasons.push(`${daysToPayment} días hasta el pago (corte en ${daysToCutoff}d)`);
        if (wouldUnlockWaiver) reasons.push(`Ahorras ${formatMoney(waiverSavedAmt)} de cuota de manejo`);
        else if (missingForWaiver > 0) reasons.push(`Faltan ${formatMoney(missingForWaiver)} en compras para exonerar manejo`);
        else if (est.mgmtFeeStatus === 'waived') reasons.push('Cuota de manejo ya exonerada');
        if (inst > 1) {
            reasons.push(isZeroInterest ? `0% interés hasta ${zeroIntMax || inst} cuotas` : `Interés estimado: ${formatMoney(interestCost)}`);
        }

        return {
            id: card.id,
            name: stripLeadingEmoji(card.name),
            isDefault: !!card.isDefault,
            debt,
            limit,
            available,
            hasEnoughCredit,
            newUtilPct,
            daysToCutoff,
            daysToPayment,
            payDateStr: `${payDate.getDate()} ${getShortMonthLabel(payDate).toLowerCase()}.`,
            wouldUnlockWaiver,
            waiverSavedAmt,
            missingForWaiver,
            mgmtFeeStatus: est.mgmtFeeStatus,
            isZeroInterest,
            interestCost,
            monthlyQuota,
            score: round2(score),
            reasons
        };
    });

    evaluated.sort((a, b) => b.score - a.score);
    return { cards: evaluated, bestCard: evaluated[0] || null };
};

// L. Simulador de Compra Inteligente (Horas de vida + Impacto en caja)
const simulateSmartPurchase = ({ amount = 0, installments = 1, paymentMethod = 'cash', cardId = '' }) => {
    const amt = Math.max(0, round2(amount));
    const inst = Math.max(1, parseInt(installments, 10) || 1);

    // 1. Equivalencia en horas de trabajo neto
    const salStr = localStorage.getItem('myFinancesSalary');
    let salCfg = null;
    if (salStr) {
        try { salCfg = JSON.parse(salStr); } catch { salCfg = null; }
    }
    let hasSalary = false;
    let hourlyNetRate = 0;
    let workHoursCost = 0;
    let workDaysCost = 0;

    if (salCfg && salCfg.basicSalary > 0) {
        const labor = calculateLaborMetrics(salCfg, currentDate);
        const weeklyHours = parseFloat(salCfg.weeklyHours) || 42;
        const dailyHours = weeklyHours / 6;
        const monthlyHours = round2(dailyHours * 30);
        if (labor.net > 0 && monthlyHours > 0) {
            hasSalary = true;
            hourlyNetRate = round2(labor.net / monthlyHours);
            workHoursCost = round2(amt / hourlyNetRate);
            workDaysCost = dailyHours > 0 ? round2(workHoursCost / dailyHours) : 0;
        }
    }

    // 2. Costo financiero y cuota
    let totalCost = amt;
    let totalInterest = 0;
    let monthlyQuota = amt;
    let isZeroInterest = true;
    let methodLabel = 'Efectivo / Débito';

    if (paymentMethod === 'credit_card' && cardId) {
        const card = getAccountObj(cardId);
        methodLabel = stripLeadingEmoji(card.name || 'Tarjeta');
        const zeroIntMax = parseInt(card.zeroInterestMax, 10) || 0;
        const effRate = (inst === 1 || (zeroIntMax > 0 && inst <= zeroIntMax)) ? 0 : (card.rate || 0);
        const amort = calculateAmortization(amt, inst, effRate, card.rateType || 'monthly');
        totalCost = amort.totalWithInterest;
        totalInterest = amort.totalInterest;
        monthlyQuota = amort.payment;
        isZeroInterest = totalInterest <= 0;
    }

    // 3. Impacto real en liquidez y proyección a 30 días
    const currMonthId = getMonthId(currentDate);
    const currSnap = computeBalancesUpTo(currMonthId);
    const safeData = computeSafeToSpendToday(currMonthId, currSnap);
    const proj30 = computeCashProjectionData('30d');

    const immediateCashOut = paymentMethod === 'cash' ? amt : 0;
    const budgetImpactToday = paymentMethod === 'cash' ? amt : monthlyQuota;
    const safeAfter = round2(safeData.safeToSpend - budgetImpactToday);
    const lowestAfter = round2(proj30.lowestBalance - immediateCashOut);

    const causesDeficit = amt > 0 && lowestAfter < 0;
    const exceedsSafe = amt > 0 && safeAfter < 0;

    let verdict = 'good';
    let verdictTitle = 'Compra viable sin comprometer tu caja';
    if (amt <= 0) {
        verdict = 'neutral';
        verdictTitle = 'Ingresa el valor de la compra para evaluarla';
    } else if (causesDeficit) {
        verdict = 'danger';
        verdictTitle = 'Alerta: esta compra te deja en déficit de caja en los próximos 30 días';
    } else if (exceedsSafe) {
        verdict = 'warn';
        verdictTitle = 'Cuidado: supera tu Libre Seguro Hoy y apretará tu presupuesto';
    } else if (totalInterest > amt * 0.15) {
        verdict = 'warn';
        verdictTitle = 'Viable en caja, pero pagarás bastante en intereses';
    }

    return {
        amount: amt,
        installments: inst,
        paymentMethod,
        cardId,
        methodLabel,
        hasSalary,
        hourlyNetRate,
        workHoursCost,
        workDaysCost,
        totalCost,
        totalInterest,
        monthlyQuota,
        isZeroInterest,
        safeBefore: safeData.safeToSpend,
        safeAfter,
        lowestBefore: proj30.lowestBalance,
        lowestAfter,
        causesDeficit,
        exceedsSafe,
        verdict,
        verdictTitle
    };
};

// M. Resumen / Cierre de Mes en Tarjetas Bento
const computeMonthlyRecapData = (targetMonthId = getMonthId(viewDate)) => {
    const flow = getMonthlyFlow(targetMonthId, false);
    const surplus = round2(flow.inc - flow.exp);
    const savingsRate = flow.inc > 0 ? round2((surplus / flow.inc) * 100) : 0;

    const [yStr, mStr] = targetMonthId.split('-');
    const year = parseInt(yStr, 10);
    const mIdx = parseInt(mStr, 10) - 1;

    const prevDate = new Date(year, mIdx - 1, 1);
    const prevFlow = getMonthlyFlow(getMonthId(prevDate), false);
    const expChangePct = prevFlow.exp > 0 ? round2(((flow.exp - prevFlow.exp) / prevFlow.exp) * 100) : 0;

    const catStats = (financeData.categories.expense || []).map(catObj => {
        const limit = getCategoryLimitForMonth(catObj, mIdx, year);
        const rawSpent = round2(
            financeData.transactions
                .filter(t => !t.isDeleted && !t.isTripIsolated && getTxMonthId(t) === targetMonthId && t.type === 'expense' && !t.isAdjustment && isTxClosed(t) && t.category === catObj.name)
                .reduce((s, t) => s + round2(t.amount), 0)
        );
        const refSpent = round2(
            financeData.transactions
                .filter(t => !t.isDeleted && !t.isTripIsolated && getTxMonthId(t) === targetMonthId && t.type === 'income' && !t.isAdjustment && isTxClosed(t) && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name)
                .reduce((s, t) => s + round2(t.amount), 0)
        );
        const spent = Math.max(0, round2(rawSpent - refSpent));
        const diff = limit > 0 ? round2(spent - limit) : 0;
        const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
        return { name: stripLeadingEmoji(catObj.name), rawName: catObj.name, limit, spent, diff, pct };
    }).filter(c => c.spent > 0 || c.limit > 0);

    const bySpent = [...catStats].sort((a, b) => b.spent - a.spent);
    const byOver = [...catStats].filter(c => c.diff > 0).sort((a, b) => b.diff - a.diff);

    const topCategory = bySpent[0] || null;
    const mostOverBudget = byOver[0] || null;

    const pocketsList = (financeData.pockets || []).map(p => {
        const m = computePocketMetrics(p);
        return { id: p.id, name: stripLeadingEmoji(p.name), balance: m.balance, goal: m.goal, remaining: m.remaining };
    });

    return {
        monthId: targetMonthId,
        inc: flow.inc,
        exp: flow.exp,
        surplus,
        savingsRate,
        prevFlow,
        expChangePct,
        topCategory,
        mostOverBudget,
        pockets: pocketsList
    };
};

// N. Detector de Gastos Hormiga y Alzas Silenciosas en Suscripciones
const computeAntExpensesAndSubHikes = (targetMonthId = getMonthId(viewDate), smallTxThreshold = 35000) => {
    const threshold = Math.max(1000, round2(smallTxThreshold));
    const antTxs = financeData.transactions.filter(t =>
        !t.isDeleted &&
        !t.isTripIsolated &&
        getTxMonthId(t) === targetMonthId &&
        t.type === 'expense' &&
        !t.isAdjustment &&
        isTxClosed(t) &&
        !isTxFixedExpense(t) &&
        round2(t.amount) > 0 &&
        round2(t.amount) <= threshold
    );

    const totalAntSpend = round2(antTxs.reduce((s, t) => s + round2(t.amount), 0));
    const antCount = antTxs.length;
    const annualizedAntSpend = round2(totalAntSpend * 12);

    const grouped = {};
    antTxs.forEach(t => {
        const cleanDesc = stripLeadingEmoji(t.description || t.category || 'Gasto menor').trim();
        const key = cleanDesc.toLowerCase();
        if (!grouped[key]) {
            grouped[key] = { label: cleanDesc, category: stripLeadingEmoji(t.category || ''), count: 0, total: 0 };
        }
        grouped[key].count++;
        grouped[key].total = round2(grouped[key].total + round2(t.amount));
    });

    const topAntItems = Object.values(grouped)
        .sort((a, b) => b.total - a.total || b.count - a.count)
        .slice(0, 4);

    // Detectar suscripciones cuyo último cobro real superó el valor configurado o el cobro anterior
    const subHikes = [];
    (financeData.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
        const cleanSub = stripLeadingEmoji(sub.name).toLowerCase().trim();
        if (!cleanSub) return;
        const matchingTxs = financeData.transactions
            .filter(t => !t.isDeleted && t.type === 'expense' && !t.isAdjustment && isTxClosed(t) && stripLeadingEmoji(t.description || '').toLowerCase().includes(cleanSub))
            .sort((a, b) => b.id - a.id);

        if (matchingTxs.length > 0) {
            const latestAmt = round2(matchingTxs[0].amount);
            const refAmt = round2(sub.amount);
            const prevAmt = matchingTxs.length > 1 ? round2(matchingTxs[1].amount) : refAmt;
            const baseline = Math.min(refAmt, prevAmt);

            if (latestAmt > baseline + 100 && baseline > 0) {
                const delta = round2(latestAmt - baseline);
                const pctIncrease = round2((delta / baseline) * 100);
                subHikes.push({
                    id: sub.id,
                    name: stripLeadingEmoji(sub.name),
                    expectedAmt: baseline,
                    chargedAmt: latestAmt,
                    delta,
                    pctIncrease
                });
            }
        }
    });

    return {
        threshold,
        totalAntSpend,
        antCount,
        annualizedAntSpend,
        topAntItems,
        subHikes
    };
};

// O. Simulador de Crédito y Evaluación de Capacidad Real
const simulateCreditLoan = ({
    principal = 0,
    periods = 12,
    rate = 0,
    rateType = 'annual',
    monthlyInsurance = 0,
    extraMonthly = 0
}) => {
    const amt = Math.max(0, round2(principal));
    const months = Math.max(1, Math.min(360, parseInt(periods, 10) || 12));
    const safeRate = Math.max(0, Math.min(100, parseFloat(rate) || 0));
    const safeIns = Math.max(0, round2(monthlyInsurance));
    const safeExtra = Math.max(0, round2(extraMonthly));

    const baseAmort = calculateAmortization(amt, months, safeRate, rateType);
    const baseMonthlyQuota = baseAmort.payment;
    const totalMonthlyQuota = amt > 0 ? round2(baseMonthlyQuota + safeIns) : 0;
    const totalInterest = baseAmort.totalInterest;
    const totalInsurance = amt > 0 ? round2(safeIns * months) : 0;
    const totalCost = round2(amt + totalInterest + totalInsurance);

    const monthlyRateDecimal = baseAmort.monthlyRate;
    const effectiveMonthlyRatePct = Math.round(monthlyRateDecimal * 1000000) / 10000;
    const effectiveAnnualRatePct = rateType === 'annual'
        ? safeRate
        : round2((Math.pow(1 + monthlyRateDecimal, 12) - 1) * 100);

    // Simulación con abono extra mensual (reducción de plazo)
    let accelMonths = months;
    let accelInterest = totalInterest;
    let savedInterest = 0;
    let savedMonths = 0;

    if (amt > 0 && safeExtra > 0) {
        let simBal = amt;
        let simInt = 0;
        let mCount = 0;
        const targetCapPay = round2(baseMonthlyQuota + safeExtra);

        while (simBal > 0 && mCount < 360) {
            mCount++;
            const intAmt = round2(simBal * monthlyRateDecimal);
            simInt = round2(simInt + intAmt);
            const capPay = Math.min(simBal, Math.max(0, round2(targetCapPay - intAmt)));
            if (capPay <= 0) break;
            simBal = round2(simBal - capPay);
        }

        if (simBal <= 0 && mCount <= months) {
            accelMonths = mCount;
            accelInterest = round2(simInt);
            savedInterest = Math.max(0, round2(totalInterest - accelInterest));
            savedMonths = Math.max(0, months - accelMonths);
        }
    }

    // Cruce con capacidad de endeudamiento y flujo libre real del usuario
    const currMonthId = getMonthId(currentDate);
    const cap = computeDetailedBorrowingCapacity(currMonthId);
    const newCommittedDebt = round2(cap.committedMonthly + totalMonthlyQuota);
    const newDebtBurdenPct = cap.baseIncome > 0 ? round2((newCommittedDebt / cap.baseIncome) * 100) : 0;
    const remainingSafeQuota = round2(cap.realSafeQuota - totalMonthlyQuota);
    const remainingFreeCashFlow = round2(cap.freeCashFlow - totalMonthlyQuota);

    // Monto máximo recomendado según cupo seguro disponible
    const availableForDebtService = Math.max(0, round2(cap.realSafeQuota - safeIns));
    let maxAffordablePrincipal = 0;
    if (availableForDebtService > 0) {
        if (monthlyRateDecimal > 0) {
            maxAffordablePrincipal = round2(availableForDebtService * ((1 - Math.pow(1 + monthlyRateDecimal, -months)) / monthlyRateDecimal));
        } else {
            maxAffordablePrincipal = round2(availableForDebtService * months);
        }
    }

    let viability = 'neutral';
    let viabilityTitle = 'Ingresa el monto y plazo para simular tu crédito';
    if (amt > 0) {
        if (cap.baseIncome <= 0) {
            viability = 'warn';
            viabilityTitle = 'Configura tu nómina o ingresos para validar tu capacidad de pago';
        } else if (remainingFreeCashFlow < 0) {
            viability = 'danger';
            viabilityTitle = 'Riesgo alto: esta cuota supera tu flujo libre mensual tras gastos fijos';
        } else if (remainingSafeQuota < 0) {
            viability = 'warn';
            viabilityTitle = `Precaución: supera tu tope saludable del ${cap.maxPct}%, aunque tu flujo libre alcanza`;
        } else {
            viability = 'good';
            viabilityTitle = 'Crédito viable: cabe dentro de tu capacidad saludable y flujo libre';
        }
    }

    const principalPct = totalCost > 0 ? Math.round((amt / totalCost) * 100) : 100;
    const extraCostPct = Math.max(0, 100 - principalPct);

    return {
        principal: amt,
        periods: months,
        rate: safeRate,
        rateType,
        monthlyInsurance: safeIns,
        extraMonthly: safeExtra,
        baseMonthlyQuota,
        totalMonthlyQuota,
        totalInterest,
        totalInsurance,
        totalCost,
        effectiveMonthlyRatePct,
        effectiveAnnualRatePct,
        schedule: baseAmort.schedule,
        accelMonths,
        accelInterest,
        savedInterest,
        savedMonths,
        principalPct,
        extraCostPct,
        cap,
        newCommittedDebt,
        newDebtBurdenPct,
        remainingSafeQuota,
        remainingFreeCashFlow,
        maxAffordablePrincipal,
        viability,
        viabilityTitle
    };
};

// P. Comparador de Ofertas de Crédito (Banco A vs. Banco B)
const compareCreditOffers = ({ principal = 0, offerA = {}, offerB = {} }) => {
    const amt = Math.max(0, round2(principal));

    const evaluateOffer = (rawOffer, fallbackName) => {
        const name = String(rawOffer.name || '').trim() || fallbackName;
        const periods = Math.max(1, Math.min(360, parseInt(rawOffer.periods, 10) || 12));
        const rate = Math.max(0, Math.min(100, parseFloat(rawOffer.rate) || 0));
        const rateType = rawOffer.rateType === 'monthly' ? 'monthly' : 'annual';
        const monthlyInsurance = Math.max(0, round2(rawOffer.monthlyInsurance));
        const upfrontFee = Math.max(0, round2(rawOffer.upfrontFee));

        const amort = calculateAmortization(amt, periods, rate, rateType);
        const baseQuota = amort.payment;
        const monthlyQuota = amt > 0 ? round2(baseQuota + monthlyInsurance) : 0;
        const totalInterest = amort.totalInterest;
        const totalInsurance = amt > 0 ? round2(monthlyInsurance * periods) : 0;
        const totalExtraCost = amt > 0 ? round2(totalInterest + totalInsurance + upfrontFee) : 0;
        const totalCost = amt > 0 ? round2(amt + totalExtraCost) : 0;

        const monthlyRateDecimal = amort.monthlyRate;
        const effectiveAnnualRatePct = rateType === 'annual'
            ? rate
            : round2((Math.pow(1 + monthlyRateDecimal, 12) - 1) * 100);

        return {
            name,
            periods,
            rate,
            rateType,
            monthlyInsurance,
            upfrontFee,
            baseQuota,
            monthlyQuota,
            totalInterest,
            totalInsurance,
            totalExtraCost,
            totalCost,
            effectiveAnnualRatePct
        };
    };

    const resA = evaluateOffer(offerA, 'Banco A');
    const resB = evaluateOffer(offerB, 'Banco B');

    if (amt <= 0) {
        return { valid: false, principal: 0, resA, resB, winner: null, totalSavings: 0, monthlyDiff: 0, higherQuotaWarning: false };
    }

    const diffTotal = round2(resA.totalCost - resB.totalCost);
    let winner = 'tie';
    if (diffTotal < -1) winner = 'A';
    else if (diffTotal > 1) winner = 'B';

    const totalSavings = Math.abs(diffTotal);
    const monthlyDiff = Math.abs(round2(resA.monthlyQuota - resB.monthlyQuota));

    // Detectar si el banco ganador en costo total exige una cuota mensual más alta (ej. menor plazo)
    const higherQuotaWarning =
        (winner === 'A' && resA.monthlyQuota > resB.monthlyQuota + 1) ||
        (winner === 'B' && resB.monthlyQuota > resA.monthlyQuota + 1);

    return {
        valid: true,
        principal: amt,
        resA,
        resB,
        winner,
        totalSavings,
        monthlyDiff,
        higherQuotaWarning
    };
};

// ============================================================
// MOTOR FINANCIERO: CDT Y CDAT (COLOMBIA)
// ============================================================

/**
 * Calcula los rendimientos de un CDT o CDAT a partir de su tasa Efectiva Anual (E.A.).
 * @param {Object} params
 * @param {number} params.capital - Monto invertido en COP
 * @param {number} params.tasaEA - Tasa Efectiva Anual en porcentaje (ej. 10.5 para 10.5% E.A.)
 * @param {number} params.plazoDias - Plazo total en días (ej. 15, 30, 90, 180, 360)
 * @param {number} [params.baseDias=360] - Base anual del banco: 360 (comercial estándar) o 365 (calendario)
 * @param {number} [params.retefuentePct=4] - Retención en la fuente sobre rendimientos (4% en Colombia)
 * @param {'vencimiento'|'mensual'|'trimestral'|'semestral'} [params.periodicidad='vencimiento']
 */
function calculateCDTReturns({
    capital,
    tasaEA,
    plazoDias,
    baseDias = 360,
    retefuentePct = 4,
    periodicidad = 'vencimiento'
}) {
    const cap = Math.max(0, Number(capital) || 0);
    const ea = Math.max(0, Number(tasaEA) || 0) / 100;
    const dias = Math.max(1, Math.round(Number(plazoDias) || 0));
    const base = Number(baseDias) === 365 ? 365 : 360;
    const retRate = Math.max(0, Number(retefuentePct) || 0) / 100;

    if (cap === 0 || ea === 0) {
        return {
            capital: cap,
            tasaPeriodoPct: 0,
            rendimientoBruto: 0,
            retefuente: 0,
            rendimientoNeto: 0,
            pagoPeriodicoNeto: 0,
            numeroPagos: 1,
            totalAlVencimiento: cap,
            totalAcumulado: cap
        };
    }

    const diasPorPeriodoMap = {
        vencimiento: dias,
        mensual: 30,
        trimestral: 90,
        semestral: 180
    };

    const diasPeriodo = periodicidad === 'vencimiento'
        ? dias
        : Math.min(dias, diasPorPeriodoMap[periodicidad] || dias);

    const numeroPagos = periodicidad === 'vencimiento'
        ? 1
        : Math.max(1, dias / diasPeriodo);

    // Conversión exacta de E.A. a tasa efectiva del período: (1 + EA)^(días/base) - 1
    const tasaPeriodo = Math.pow(1 + ea, diasPeriodo / base) - 1;
    const brutoPorPeriodo = cap * tasaPeriodo;
    const retefuentePorPeriodo = brutoPorPeriodo * retRate;
    const netoPorPeriodo = brutoPorPeriodo - retefuentePorPeriodo;

    const fullPeriods = periodicidad === 'vencimiento' ? 1 : Math.floor(dias / diasPeriodo);
    const stubDays = periodicidad === 'vencimiento' ? 0 : (dias - fullPeriods * diasPeriodo);
    const stubTasa = stubDays > 0 ? (Math.pow(1 + ea, stubDays / base) - 1) : 0;
    const stubBruto = cap * stubTasa;
    const stubRet = stubBruto * retRate;
    const stubNeto = stubBruto - stubRet;

    const rendimientoBruto = (brutoPorPeriodo * fullPeriods) + stubBruto;
    const retefuente = (retefuentePorPeriodo * fullPeriods) + stubRet;
    const rendimientoNeto = (netoPorPeriodo * fullPeriods) + stubNeto;

    // Si paga al vencimiento, recibe capital + todo el rendimiento neto junto.
    // Si paga periódico, en cada corte recibe el interés neto y al final recibe capital + último corte (o fracción final).
    const finalCouponNeto = stubDays > 0 ? stubNeto : netoPorPeriodo;
    const totalAlVencimiento = cap + finalCouponNeto;
    const totalAcumulado = cap + rendimientoNeto;

    return {
        capital: cap,
        tasaPeriodoPct: +(tasaPeriodo * 100).toFixed(4),
        rendimientoBruto: Math.round(rendimientoBruto * 100) / 100,
        retefuente: Math.round(retefuente * 100) / 100,
        rendimientoNeto: Math.round(rendimientoNeto * 100) / 100,
        pagoPeriodicoNeto: Math.round(netoPorPeriodo * 100) / 100,
        numeroPagos: +numeroPagos.toFixed(2),
        totalAlVencimiento: Math.round(totalAlVencimiento * 100) / 100,
        totalAcumulado: Math.round(totalAcumulado * 100) / 100
    };
}

/**
 * Evalúa fechas, progreso y rendimiento causado hasta hoy de un CDT o CDAT guardado.
 * @param {Object} cdt - Objeto { tipo: 'CDT'|'CDAT', capital, tasaEA, plazoDias, fechaApertura, baseDias, retefuentePct, periodicidad, estado }
 * @param {Date} [refDate=new Date()]
 */
/**
 * Evalúa fechas, progreso y rendimiento causado hasta hoy de un CDT o CDAT guardado.
 * @param {Object} cdt - Objeto { tipo: 'CDT'|'CDAT', capital, tasaEA, plazoDias, fechaApertura, baseDias, retefuentePct, periodicidad, estado }
 * @param {Date} [refDate=new Date()]
 */
function evaluateCDTStatus(cdt, refDate = new Date()) {
    const startParts = String(cdt.fechaApertura || '').split('-').map(Number);
    const start = startParts.length === 3
        ? new Date(startParts[0], startParts[1] - 1, startParts[2])
        : new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());

    const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate());
    const plazoDias = Math.max(1, Math.round(Number(cdt.plazoDias) || 30));

    const maturity = new Date(start);
    maturity.setDate(maturity.getDate() + plazoDias);

    const msPerDay = 86400000;
    const rawElapsed = Math.round((today - start) / msPerDay);
    const diasTranscurridos = Math.max(0, Math.min(plazoDias, rawElapsed));
    const diasRestantes = Math.max(0, plazoDias - diasTranscurridos);
    const progresoPct = Math.min(100, Math.max(0, Math.round((diasTranscurridos / plazoDias) * 100)));

    const proyeccionTotal = calculateCDTReturns(cdt);
    let causadoNeto = 0;
    if (diasTranscurridos > 0) {
        if (!cdt.periodicidad || cdt.periodicidad === 'vencimiento') {
            causadoNeto = calculateCDTReturns({ ...cdt, plazoDias: diasTranscurridos, periodicidad: 'vencimiento' }).rendimientoNeto;
        } else {
            causadoNeto = round2(proyeccionTotal.rendimientoNeto * (diasTranscurridos / plazoDias));
        }
    }
    const causadoHoy = { rendimientoNeto: causadoNeto };

    const estaVencido = today >= maturity && cdt.estado !== 'liquidado';
    const yyyy = maturity.getFullYear();
    const mm = String(maturity.getMonth() + 1).padStart(2, '0');
    const dd = String(maturity.getDate()).padStart(2, '0');

    return {
        fechaVencimiento: `${yyyy}-${mm}-${dd}`,
        diasTranscurridos,
        diasRestantes,
        progresoPct,
        estaVencido,
        rendimientoCausadoNeto: causadoHoy.rendimientoNeto,
        valorActualEstimado: Math.round((Number(cdt.capital || 0) + causadoHoy.rendimientoNeto) * 100) / 100,
        proyeccionTotal
    };
}

/**
 * Consolida el portafolio de CDT/CDAT y genera alertas inteligentes para Recaps y Lumi.
 * @param {Date} [refDate=new Date()]
 */
function getCDTPortfolioInsights(refDate = new Date()) {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('lumen_cdts_v1') || '[]'); } catch (e) { list = []; }

    const activos = list.filter(item => item.estado !== 'liquidado');
    let capitalTotal = 0;
    let valorActualTotal = 0;
    let rendimientoCausadoTotal = 0;
    let rendimientoProyectadoTotal = 0;

    const alertas = [];
    const evaluados = activos.map(item => {
        const st = evaluateCDTStatus(item, refDate);
        const cap = Number(item.capital) || 0;

        capitalTotal += cap;
        valorActualTotal += st.valorActualEstimado;
        rendimientoCausadoTotal += st.rendimientoCausadoNeto;
        rendimientoProyectadoTotal += st.proyeccionTotal.rendimientoNeto;

        // 1. Alerta: Título ya vencido pendiente de gestión
        if (st.estaVencido) {
            alertas.push({
                nivel: 'high',
                tipo: 'vencido',
                titulo: `${item.tipo} en ${item.entidad} vencido`,
                mensaje: `Cumplió su plazo el ${st.fechaVencimiento}. Decide si liquidas $${Math.round(st.proyeccionTotal.totalAcumulado).toLocaleString('es-CO')} a tu cuenta o lo renuevas.`
            });
        }
        // 2. Alerta: Próximo a vencer en los siguientes 10 días
        else if (st.diasRestantes <= 10) {
            alertas.push({
                nivel: 'medium',
                tipo: 'proximo_vencer',
                titulo: `${item.tipo} en ${item.entidad} vence en ${st.diasRestantes} día${st.diasRestantes === 1 ? '' : 's'}`,
                mensaje: `El ${st.fechaVencimiento} recibirás $${Math.round(st.proyeccionTotal.totalAcumulado).toLocaleString('es-CO')} netos. Planifica si reinviertes o usas esa liquidez.`
            });
        }

        // 3. Alerta: Pago periódico de intereses (Mensual / Trimestral / Semestral)
        if (!st.estaVencido && item.periodicidad && item.periodicidad !== 'vencimiento') {
            const ciclo = item.periodicidad === 'mensual' ? 30 : (item.periodicidad === 'trimestral' ? 90 : 180);
            if (st.diasTranscurridos > 0 && (st.diasTranscurridos % ciclo <= 3 || st.diasTranscurridos % ciclo >= ciclo - 3)) {
                alertas.push({
                    nivel: 'info',
                    tipo: 'corte_intereses',
                    titulo: `Corte de intereses (${item.tipo} ${item.entidad})`,
                    mensaje: `Pago periódico estimado de +$${Math.round(st.proyeccionTotal.pagoPeriodicoNeto).toLocaleString('es-CO')} netos.`
                });
            }
        }

        return { ...item, status: st };
    });

    // 4. Alerta positiva de crecimiento pasivo en el Recap del mes
    if (rendimientoCausadoTotal > 0) {
        alertas.push({
            nivel: 'positive',
            tipo: 'rendimiento_pasivo',
            titulo: 'Tu dinero trabajó por ti',
            mensaje: `Tus títulos acumulan +$${Math.round(rendimientoCausadoTotal).toLocaleString('es-CO')} netos en rendimientos sin mover un dedo.`
        });
    }

    return {
        cantidadActivos: activos.length,
        capitalTotal: Math.round(capitalTotal * 100) / 100,
        valorActualTotal: Math.round(valorActualTotal * 100) / 100,
        rendimientoCausadoTotal: Math.round(rendimientoCausadoTotal * 100) / 100,
        rendimientoProyectadoTotal: Math.round(rendimientoProyectadoTotal * 100) / 100,
        titulos: evaluados,
        alertas
    };
}

// --- FASE 6D: CIFRADO / DESCIFRADO AES-256-GCM + PBKDF2 PARA ARCHIVOS .LUMEN-CSV ---
const encryptTextPayloadAesGcm = async (plainText, password, meta = {}) => {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Tu navegador no permite cifrado Web Crypto en este contexto.');
    }
    const pass = String(password || '');
    if (pass.length < 6) {
        throw new Error('La contraseña debe tener al menos 6 caracteres.');
    }

    const enc = new TextEncoder();
    const salt = new Uint8Array(16);
    const iv = new Uint8Array(12);
    globalThis.crypto.getRandomValues(salt);
    globalThis.crypto.getRandomValues(iv);

    const iterations = 210000;
    const baseKey = await globalThis.crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
    );

    const cipherBuf = await globalThis.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        enc.encode(String(plainText || ''))
    );

    const toB64 = (buf) => {
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
    };

    return JSON.stringify({
        lumenEncryptedCsv: true,
        version: 1,
        alg: 'AES-256-GCM',
        kdf: 'PBKDF2-SHA256',
        iterations,
        salt: toB64(salt),
        iv: toB64(iv),
        ciphertext: toB64(cipherBuf),
        meta: {
            year: meta.year || currentDate.getFullYear(),
            fileName: meta.fileName || 'Paquete_Contador_DIAN.csv',
            createdAt: new Date().toISOString()
        }
    });
};

const decryptTextPayloadAesGcm = async (rawEnvelopeText, password) => {
    if (!globalThis.crypto?.subtle) {
        throw new Error('Tu navegador no permite descifrado Web Crypto en este contexto.');
    }
    const rawStr = String(rawEnvelopeText || '');
    if (rawStr.length > 20 * 1024 * 1024) {
        throw new Error('El archivo excede el tamaño máximo seguro (20 MB).');
    }
    let env;
    try {
        env = JSON.parse(rawStr);
    } catch {
        throw new Error('El archivo seleccionado no es un paquete cifrado válido (.lumen-csv).');
    }
    if (!env || !env.lumenEncryptedCsv || !env.salt || !env.iv || !env.ciphertext) {
        throw new Error('Formato de archivo .lumen-csv inválido o corrupto.');
    }

    const fromB64 = (b64) => {
        const bin = atob(String(b64));
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
    };

    const enc = new TextEncoder();
    const dec = new TextDecoder();
    const salt = fromB64(env.salt);
    const iv = fromB64(env.iv);
    const cipherBytes = fromB64(env.ciphertext);
    const iterations = Math.min(600000, Math.max(100000, parseInt(env.iterations, 10) || 210000));

    const baseKey = await globalThis.crypto.subtle.importKey('raw', enc.encode(String(password || '')), 'PBKDF2', false, ['deriveKey']);
    const aesKey = await globalThis.crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    try {
        const plainBuf = await globalThis.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            aesKey,
            cipherBytes
        );
        return { text: dec.decode(plainBuf), meta: env.meta || {} };
    } catch {
        throw new Error('Contraseña incorrecta o archivo dañado.');
    }
};

// ==========================================
// FIN DE ARCHIVO: core.js
// ==========================================