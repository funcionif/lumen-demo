// ==========================================
// app.js (v2.2.3 - Fintech Editorial)
// EL PINTOR: INTERFAZ, EVENTOS Y RENDERIZADO
// ==========================================

let isDashboardEditMode = false;
let historySearchQuery = '';
let lastPlannerScheduleText = '';
let isPrivacyMode = localStorage.getItem('myFinancesPrivacyMode') === 'true';
let lastGeneratedRecoveryCode = '';

// --- PUENTE NATIVO ANDROID SANITIZADO (MOVIDO DESDE CORE.JS PARA CERO DOM EN CORE) ---
if (window.Capacitor?.isNativePlatform?.()) {
    const origRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.revokeObjectURL = (url) => {
        setTimeout(() => origRevokeObjectURL(url), 5000);
    };

    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
        const rawDlName = this.getAttribute('download');
        const href = this.getAttribute('href') || this.href || '';
        if (rawDlName && (href.startsWith('blob:') || href.startsWith('data:'))) {
            const safeDlName = window.LumenSecurity?.sanitizeFileName
                ? window.LumenSecurity.sanitizeFileName(rawDlName, 'respaldo_lumen.txt')
                : String(rawDlName).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 90);
            const escapedLabel = window.escapeHtml ? window.escapeHtml(safeDlName) : safeDlName;

            (async () => {
                try {
                    const fs = window.Capacitor?.Plugins?.Filesystem;
                    const share = window.Capacitor?.Plugins?.Share;
                    if (!fs) {
                        nativeAnchorClick.call(this);
                        return;
                    }
                    const resp = await fetch(href);
                    const textData = await resp.text();

                    let savedInDocuments = false;
                    try {
                        await fs.deleteFile({ path: safeDlName, directory: 'DOCUMENTS' }).catch(() => {});
                        await fs.writeFile({
                            path: safeDlName,
                            data: textData,
                            directory: 'DOCUMENTS',
                            encoding: 'utf8'
                        });
                        savedInDocuments = true;
                    } catch (docErr) {
                        console.warn('No se pudo guardar en DOCUMENTS:', docErr);
                    }

                    const openShareSheet = async () => {
                        if (!share) return;
                        const cacheRes = await fs.writeFile({
                            path: safeDlName,
                            data: textData,
                            directory: 'CACHE',
                            encoding: 'utf8'
                        });
                        await share.share({
                            title: safeDlName,
                            url: cacheRes.uri,
                            dialogTitle: 'Compartir archivo'
                        });
                    };

                    if (savedInDocuments) {
                        if (typeof window.openBentoConfirmModal === 'function') {
                            window.openBentoConfirmModal({
                                title: 'Archivo Guardado',
                                subtitle: 'Carpeta Documentos del telefono',
                                message: `Se guardo <b>${escapedLabel}</b> en la carpeta <b>Documentos</b> de tu dispositivo (puedes verlo en la app <b>Files / Archivos</b>).`,
                                confirmText: 'Compartir (Drive / Correo)',
                                cancelText: 'Listo',
                                danger: false,
                                onConfirm: () => {
                                    openShareSheet().catch(() => {});
                                }
                            });
                        } else if (typeof window.openBentoAlertModal === 'function') {
                            window.openBentoAlertModal(`Archivo guardado en la carpeta Documentos del telefono:\n${safeDlName}`, {
                                title: 'Archivo Guardado'
                            });
                        }
                    } else {
                        await openShareSheet();
                    }
                } catch (err) {
                    if (err && err.message && !/cancel/i.test(err.message)) {
                        console.error('Error exportando archivo en Android:', err);
                    }
                }
            })();
            return;
        }
        return nativeAnchorClick.call(this);
    };

    window.print = () => {
        if (window.AndroidNativeBridge && typeof window.AndroidNativeBridge.print === 'function') {
            window.AndroidNativeBridge.print();
        }
    };

    const syncAndroidStatusBarTheme = () => {
        const bridge = window.AndroidNativeBridge;
        if (!bridge || typeof bridge.setDarkStatusBar !== 'function') return;

        const rootCls = `${document.documentElement?.className || ''} ${document.body?.className || ''}`.toLowerCase();
        const dataColorMode = `${document.documentElement?.getAttribute('data-color-mode') || ''} ${document.body?.getAttribute('data-color-mode') || ''}`.toLowerCase();
        const storedMode = String(localStorage.getItem('myFinancesColorMode') || '').toLowerCase();

        const prefersDarkOS = Boolean(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        let isDark = /(dark|oled|black|night)/.test(`${rootCls} ${dataColorMode} ${storedMode}`)
            || ((!storedMode || storedMode === 'auto') && !dataColorMode.includes('light') && prefersDarkOS);
        if (storedMode === 'light' || dataColorMode.includes('light')) isDark = false;

        if (!isDark && document.body) {
            const bg = getComputedStyle(document.body).backgroundColor;
            const rgb = bg && bg.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const r = Number(rgb[0]), g = Number(rgb[1]), b = Number(rgb[2]);
                const alpha = rgb[3] !== undefined ? Number(rgb[3]) : 1;
                if (alpha > 0.2) {
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    isDark = brightness < 128;
                }
            }
        }
        bridge.setDarkStatusBar(isDark);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', syncAndroidStatusBarTheme);
    } else {
        syncAndroidStatusBarTheme();
    }
    setTimeout(syncAndroidStatusBarTheme, 150);

    const themeObserver = new MutationObserver(() => syncAndroidStatusBarTheme());
    if (document.documentElement) {
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'] });
    }
    if (document.body) {
        themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'] });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            if (document.body) {
                themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme', 'data-color-mode', 'style'] });
            }
        });
    }
    window.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', syncAndroidStatusBarTheme);
}

// --- MODAL BENTO Y MOTOR CONECTADO PARA RESPALDOS CIFRADOS (.LUMEN) ---
window.openLumenBackupPasswordModal = ({ mode = 'export', fileName = '', title = '', description = '', labelText = '', submitText = '' } = {}) => {
    return new Promise((resolve) => {
        let modalEl = document.getElementById('bento-backup-pass-modal');
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'bento-backup-pass-modal';
            modalEl.className = 'modal hidden';
            modalEl.style.cssText = 'z-index: 9997; align-items: center; justify-content: center; padding: 18px;';
            document.body.appendChild(modalEl);

            let backdropDown = false;
            modalEl.addEventListener('pointerdown', (e) => { backdropDown = (e.target === modalEl); });
            modalEl.addEventListener('click', (e) => {
                if (e.target === modalEl && backdropDown && typeof modalEl._cancelBackupPrompt === 'function') {
                    e.stopPropagation();
                    modalEl._cancelBackupPrompt();
                }
                backdropDown = false;
            });
        }

        const escM = window.escapeHtml || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
        const isExport = mode === 'export';
        const safeFile = escM(fileName);
        const modalTitle = escM(title || (isExport ? 'Cifrar copia de seguridad' : 'Desbloquear respaldo cifrado'));
        const modalDesc = description
            ? escM(description).replace(/&lt;(\/?b)&gt;/gi, '<$1>')
            : (isExport
                ? 'Crea una contraseña de al menos 6 caracteres para proteger tu archivo <b>.lumen</b>. La necesitarás cuando quieras restaurarlo.'
                : `Ingresa la contraseña con la que protegiste el archivo <b>${safeFile || '.lumen'}</b>.`);
        const passLabel = escM(labelText || 'Contraseña del archivo');
        const btnSubmit = escM(submitText || (isExport ? 'Cifrar y descargar' : 'Desbloquear'));

        modalEl.innerHTML = `
            <div class="modal-content" style="max-width: 390px; width: 100%; border-radius: 24px; padding: 22px 20px;">
                <div class="modal-header" style="margin-bottom: 10px;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span class="drawer-icon-box" style="width:36px; height:36px; background:var(--accent-soft); color:var(--accent); flex-shrink:0;">
                            ${typeof renderIcon === 'function' ? renderIcon('lock', 18) : ''}
                        </span>
                        <div>
                            <h3 style="margin:0; font-size:16px;">${modalTitle}</h3>
                            <small style="color:var(--text-muted); font-size:11px;">AES-256-GCM + PBKDF2</small>
                        </div>
                    </div>
                </div>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.45; margin-bottom:12px;">
                    ${modalDesc}
                </p>
                <form id="bento-backup-pass-form" class="data-form">
                    <div class="form-group" style="margin-bottom:10px;">
                        <label>${passLabel}</label>
                        <input type="password" id="bento-backup-pass-1" minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres" required>
                    </div>
                    ${isExport ? `
                    <div class="form-group" style="margin-bottom:10px;">
                        <label>Confirmar contraseña</label>
                        <input type="password" id="bento-backup-pass-2" minlength="6" autocomplete="new-password" placeholder="Repite la contraseña" required>
                    </div>` : ''}
                    <p id="bento-backup-pass-err" class="auth-error hidden" style="margin-bottom:10px;"></p>
                    <div class="form-row modal-actions-row" style="margin-top:4px;">
                        <button type="button" id="btn-cancel-backup-pass" class="btn btn-secondary">Cancelar</button>
                        <button type="submit" class="btn btn-primary">${btnSubmit}</button>
                    </div>
                </form>
            </div>
        `;

        let settled = false;
        const cleanup = (val) => {
            if (settled) return;
            settled = true;
            modalEl._cancelBackupPrompt = null;
            modalEl.classList.add('hidden');
            modalEl.innerHTML = '';
            resolve(val);
        };
        modalEl._cancelBackupPrompt = () => cleanup(null);

        modalEl.querySelector('#btn-cancel-backup-pass')?.addEventListener('click', () => cleanup(null));
        modalEl.querySelector('#bento-backup-pass-form')?.addEventListener('submit', (ev) => {
            ev.preventDefault();
            const p1 = modalEl.querySelector('#bento-backup-pass-1')?.value || '';
            const p2 = modalEl.querySelector('#bento-backup-pass-2')?.value || '';
            const errEl = modalEl.querySelector('#bento-backup-pass-err');
            if (p1.length < 6) {
                if (errEl) { errEl.textContent = 'Usa al menos 6 caracteres.'; errEl.classList.remove('hidden'); }
                return;
            }
            if (isExport && p1 !== p2) {
                if (errEl) { errEl.textContent = 'Las contrasenas no coinciden.'; errEl.classList.remove('hidden'); }
                return;
            }
            cleanup(p1);
        });

        modalEl.classList.remove('hidden');
        setTimeout(() => modalEl.querySelector('#bento-backup-pass-1')?.focus(), 80);
    });
};

window.runLumenEncryptedExport = async () => {
    try {
        const dbData = localStorage.getItem('myFinances');
        if (!dbData) {
            alert('No hay datos para exportar.');
            return;
        }
        const password = await window.openLumenBackupPasswordModal({ mode: 'export' });
        if (!password) return;

        const fData = JSON.parse(dbData);
        fData.lastBackupDate = Date.now();
        financeData.lastBackupDate = fData.lastBackupDate;
        localStorage.setItem('myFinances', JSON.stringify(fData));

        const encryptedPayload = await window.LumenSecurity.exportEncryptedBackup(password);
        const rawName = `Lumen_Respaldo_${new Date().toLocaleDateString('en-CA')}.lumen`;
        const safeName = window.LumenSecurity.sanitizeFileName(rawName, 'Lumen_Respaldo.lumen');

        const url = URL.createObjectURL(new Blob([encryptedPayload], { type: 'application/octet-stream' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = safeName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        if (typeof updateDashboard === 'function') updateDashboard();
    } catch (err) {
        alert(err?.message || 'Error al generar el respaldo cifrado.');
    }
};

window.runLumenEncryptedImport = async (file) => {
    if (!file) return null;
    if (file.size > 20 * 1024 * 1024) {
        throw new Error('El archivo supera el tamano maximo seguro (20 MB).');
    }
    const rawText = await file.text();
    let parsedEnvelope = null;
    try {
        parsedEnvelope = JSON.parse(rawText);
    } catch {
        throw new Error('El archivo seleccionado no tiene un formato de respaldo valido.');
    }

    let password = '';
    if (parsedEnvelope && parsedEnvelope.lumenEncryptedBackup) {
        password = await window.openLumenBackupPasswordModal({ mode: 'import', fileName: file.name });
        if (!password) return null;
    }

    const res = await window.LumenSecurity.importEncryptedBackup(rawText, password);
    return res.bundle;
};

// --- MODAL UNIVERSAL DE AVISOS (REEMPLAZA ALERT NATIVO DEL SISTEMA) ---
window.openBentoAlertModal = (rawMessage, options = {}) => {
    const text = String(rawMessage ?? '').trim();
    if (!text) return;

    const lower = text.toLowerCase();
    const isSuccess = /copiad[oa]|concedido|actualizado|desactivad[oa]s|exitos[oa]|guardad[oa]|listo/i.test(lower);
    const isComingSoon = /\[próximamente\]/i.test(text);
    const cleanText = text.replace(/^\[Próximamente\]\s*/i, '');

    const escAlertOpt = window.escapeHtml || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
    const title = escAlertOpt(options.title || (isSuccess ? '¡Listo!' : (isComingSoon ? 'Próximamente' : 'Atención')));
    const btnText = escAlertOpt(options.buttonText || 'Entendido');

    let iconBg = 'rgba(245, 158, 11, 0.14)';
    let iconColor = '#f59e0b';
    let iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;

    if (isSuccess) {
        iconBg = 'var(--positive-bg, rgba(16, 185, 129, 0.14))';
        iconColor = 'var(--positive)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
    } else if (isComingSoon) {
        iconBg = 'var(--accent-soft)';
        iconColor = 'var(--accent)';
        iconSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;
    }

    let modalEl = document.getElementById('bento-alert-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'bento-alert-modal';
        modalEl.className = 'modal hidden';
        modalEl.style.cssText = 'z-index: 9998; align-items: center; justify-content: center; padding: 18px;';
        document.body.appendChild(modalEl);

        let pressedBackdrop = false;
        modalEl.addEventListener('pointerdown', (e) => {
            pressedBackdrop = (e.target === modalEl);
        });
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl && pressedBackdrop) {
                e.stopPropagation();
                modalEl.classList.add('hidden');
            }
            pressedBackdrop = false;
        });
    }

    const safeHtml = cleanText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\n/g, '<br>');

    modalEl.innerHTML = `
        <div class="modal-content" style="width: 100%; max-width: 360px; height: auto; min-height: 0; margin: auto; border-radius: 26px; padding: 24px 20px 20px 20px; text-align: center; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22); border: 1px solid var(--border-color); background: var(--modal-bg);">
            <div style="width: 52px; height: 52px; border-radius: 16px; background: ${iconBg}; color: ${iconColor}; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto;">
                ${iconSvg}
            </div>
            <h3 style="margin: 0 0 8px 0; font-size: 18px; font-weight: 800; color: var(--text-main); letter-spacing: -0.2px;">${title}</h3>
            <p style="margin: 0 0 18px 0; font-size: 13.5px; color: var(--text-muted); line-height: 1.5;">${safeHtml}</p>
            <button type="button" id="btn-close-bento-alert" class="btn btn-primary" style="width: 100%; padding: 13px 16px; font-size: 14px; font-weight: 700; border-radius: 14px;">${btnText}</button>
        </div>
    `;

    modalEl.classList.remove('hidden');
    const closeBtn = modalEl.querySelector('#btn-close-bento-alert');
    if (closeBtn) {
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            modalEl.classList.add('hidden');
        };
        setTimeout(() => closeBtn.focus(), 40);
    }
};

window.alert = (message) => {
    window.openBentoAlertModal(message);
};

// --- MODO DEMO ---
const applyDemoData = () => {
    const d = new Date();
    const curY = d.getFullYear();
    const curM = d.getMonth();
    const pad = (n) => String(n).padStart(2, '0');
    const curId = `${curY}-${pad(curM + 1)}`;
    const now = d.getTime();

    const buildDemoDate = (daysAgo, seqOffset) => {
        const safeDay = Math.max(1, d.getDate() - daysAgo);
        const dt = new Date(curY, curM, safeDay, 12, 0, seqOffset);
        return { id: dt.getTime(), label: `${safeDay} ${getShortMonthLabel(dt)}` };
    };
    const dm1 = buildDemoDate(20, 1), dm2 = buildDemoDate(18, 2), dm3 = buildDemoDate(15, 3);
    const dm4 = buildDemoDate(10, 4), dm5 = buildDemoDate(5, 5), dm6 = buildDemoDate(2, 6), dm7 = buildDemoDate(0, 7);

    const dTrans = [
        { id: dm1.id, monthId: curId, type: 'income', status: 'closed', account: 'Efectivo', category: 'Salario / Nómina', description: 'Pago de quincena', amount: 1500000, date: dm1.label },
        { id: dm2.id, monthId: curId, type: 'expense', status: 'closed', account: 'Efectivo', category: 'Vivienda y Servicios', description: 'Arriendo', amount: 800000, date: dm2.label },
        { id: dm3.id, monthId: curId, type: 'expense', status: 'closed', account: 'Efectivo', category: 'Alimentación', description: 'Mercado Exito', amount: 250000, date: dm3.label },
        { id: dm4.id, monthId: curId, type: 'expense', status: 'closed', account: 'Efectivo', category: 'Transporte', description: 'Gasolina', amount: 60000, date: dm4.label },
        { id: dm5.id, monthId: curId, type: 'expense', status: 'closed', account: 'Demo_CC', category: 'Alimentación', description: 'Restaurante', amount: 85000, date: dm5.label },
        { id: dm6.id, monthId: curId, type: 'expense', status: 'closed', account: 'Demo_CC', category: 'Entretenimiento', description: 'Cine', amount: 45000, date: dm6.label },
        { id: dm7.id, monthId: curId, type: 'expense', status: 'pending', account: 'Efectivo', category: 'Salud', description: 'Cita médica (agendada)', amount: 40000, date: 'Mañana' }
    ];

    financeData.customAccounts = [
        { id: 'Efectivo', name: 'Cuenta Nómina', category: 'asset', isDefault: true, showWhenZero: false },
        { id: 'Demo_CC', name: 'Tarjeta Crédito Clásica', category: 'credit_card', isDefault: false, creditLimit: 2000000, cutoffDay: 15, paymentDay: 30, rate: 2.1, rateType: 'monthly' },
        { id: 'Demo_Debt', name: 'Crédito Vehículo', category: 'debt', debtType: 'fixed', isDefault: false, debtOriginal: 15000000, debtTotalQuotes: 48, debtPaidQuotes: 12, debtRate: 1.8, debtRateType: 'monthly', debtMonthlyPayment: 420000, paymentDay: 5 }
    ];
    
    financeData.pockets = [
        { id: 'Demo_Pck', name: 'Vacaciones', goal: 2000000, principal: 400000, yields: 12000, activeQuota: 150000, startDate: `${curY}-01-01`, targetDate: `${curY}-12-15` }
    ];

    financeData.subscriptions = [
    {
        id: 'Demo_Sub1',
        name: 'Netflix Premium',
        amount: 39900,
        currency: 'COP',
        cycle: 'monthly',
        nextBillingDate: `${curY}-${pad(curM+1)}-${pad(Math.min(28, d.getDate()+3))}`,
        accountId: 'Demo_CC',
        category: 'Entretenimiento',
        subcategory: 'Streaming',
        reserveInBudget: true,
        prorateMode: 'monthly',
        status: 'active',
        lastPaidMonthId: ''
    }
];
const demoEntCat = (financeData.categories?.expense || []).find(c => c.name === 'Entretenimiento');
if (demoEntCat) {
    if (!Array.isArray(demoEntCat.subcategories)) demoEntCat.subcategories = [];
    if (!demoEntCat.subcategories.some(s => s.name === 'Streaming')) {
        demoEntCat.subcategories.push({ name: 'Streaming', limit: 39900, isFixed: true, frequency: 'monthly', startMonth: 0 });
    }
}

    financeData.transactions = dTrans;
    financeData.categoryBudgets = { 'Alimentación': 600000, 'Entretenimiento': 200000, 'Vivienda y Servicios': 900000, 'Transporte': 150000 };
    financeData.isDemoMode = true;

    localStorage.setItem('myFinances', JSON.stringify(financeData));
};

const clearDemoDataAndStart = () => {
    financeData = {
        transactions: [],
        customAccounts: [{ id: 'Efectivo', name: 'Efectivo', category: 'asset', isDefault: false, showWhenZero: false }],
        monthlyBudget: 0,
        categoryBudgets: {},
        fixedAssets: [],
        pockets: [],
        subscriptions: [],
        templates: [],
        dismissedAlerts: [],
        lastBackupDate: Date.now(),
        hideZeroAccounts: false,
        categories: financeData.categories,
        preferences: financeData.preferences,
        isDemoMode: false
    };
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    localStorage.removeItem('myFinancesSalary');
    localStorage.removeItem('lumen_cdts_v1');
    localStorage.removeItem('lumenPayrollQuincenaAlert');
};

// --- ICONOGRAFÍA VECTORIAL ---
const getAccountIcon = (category) => {
    const icons = { 'asset': 'bank', 'credit_card': 'card', 'debt': 'scale', 'pocket': 'piggy' };
    return renderIcon(icons[category] || 'bank', 16);
};

const getCategoryIcon = (categoryName, type) => {
    if (!categoryName) return renderIcon(type === 'income' ? 'trending-up' : 'shopping-bag', 16);
    const list = financeData.categories[type] || [];
    const cat = list.find(c => c.name === categoryName);
    if (cat && cat.icon) return renderIcon(cat.icon, 16);
    return renderIcon(inferCategoryIcon(categoryName, type), 16);
};

const cleanCatName = (name) => stripLeadingEmoji(name);

const getAssetVectorIcon = (cat) => {
    const map = { 'Inmueble': 'home', 'Vehículo': 'car', 'Inversión': 'trending-up', 'Tecnología': 'laptop', 'Coleccionable': 'diamond', 'Otro': 'layers' };
    return renderIcon(map[cat] || 'layers', 16);
};

// --- 1. REFERENCIAS PRINCIPALES DEL DOM ---
const modal = document.getElementById('transaction-modal');
const fabBtn = document.getElementById('fab-btn');
const fabMenu = document.getElementById('fab-menu');
const form = document.getElementById('transaction-form');
const typeSelect = document.getElementById('type');
const toAccountGroup = document.getElementById('group-to-account');
const categoryGroup = document.getElementById('group-category');
const ccInstallmentsBox = document.getElementById('cc-installments-box');
const transferAllocBox = document.getElementById('transfer-debt-allocation-box');
const sideDrawer = document.getElementById('side-drawer');
const sideDrawerBackdrop = document.getElementById('side-drawer-backdrop');

// --- 1.5 FORMATO VISUAL FINTECH Y PRIVACIDAD GLOBAL ---
const fitAmountTextSize = (el, numericValue, maxPx, minPx) => {
    if (!el) return;
    const len = formatMoney(numericValue).length;
    if (len <= 13) {
        el.style.fontSize = `${maxPx}px`;
    } else {
        const scaled = Math.max(minPx, Math.round(maxPx * (13 / len) * 10) / 10);
        el.style.fontSize = `${scaled}px`;
    }
};

const PRIVACY_STRING = '****';
const formatMoneyHtml = (amount) => {
    if (isPrivacyMode) {
        return amount < 0 ? `<span style="font-weight:700;">-${PRIVACY_STRING}</span>` : `<span style="font-weight:700;">${PRIVACY_STRING}</span>`;
    }
    const rawFormat = formatMoney(amount);
    const isCompact = financeData.useCompactNumbers && Math.abs(amount) >= 1000;
    if (isCompact) return formatCompact(amount);
    if (rawFormat.includes(',')) {
        const parts = rawFormat.split(',');
        return `${parts[0]}<span style="font-size: 0.66em; opacity: 0.58; font-weight: 600;">,${parts[1]}</span>`;
    }
    return rawFormat;
};

// --- 2. FORMATEO NUMÉRICO EN VIVO ---
window.applyLiveDecimalFormatting = (inputEl) => {
    if (!inputEl) return;
    const rawVal = inputEl.value;
    const selStart = inputEl.selectionStart;

    let sigCharsBefore = 0;
    if (typeof selStart === 'number') {
        for (let i = 0; i < selStart; i++) {
            const ch = rawVal[i];
            if ((ch >= '0' && ch <= '9') || ch === ',' || ch === '.' || ch === '-') {
                if (ch === '.' && (rawVal.match(/\./g) || []).length > 1) continue;
                sigCharsBefore++;
            }
        }
    }

    const formatted = formatNumberInput(rawVal);
    if (formatted === rawVal) return;

    inputEl.value = formatted;

    if (typeof selStart === 'number') {
        let newCursor = 0;
        let seenSig = 0;
        while (newCursor < formatted.length && seenSig < sigCharsBefore) {
            const ch = formatted[newCursor];
            if ((ch >= '0' && ch <= '9') || ch === ',' || ch === '-') seenSig++;
            newCursor++;
        }
        try { inputEl.setSelectionRange(newCursor, newCursor); } catch (err) {}
    }
};

document.addEventListener('input', (e) => {
    if (e.target && (e.target.matches('input[inputmode="decimal"]') || e.target.classList.contains('money-input'))) {
        applyLiveDecimalFormatting(e.target);
    }
    const parentForm = e.target.closest('form');
    if (parentForm && parentForm.classList.contains('data-form') && isAnyModalOpen()) {
        hasUnsavedChanges = true;
    }
}, true);

document.addEventListener('change', (e) => {
    const parentForm = e.target.closest('form');
    if (parentForm && parentForm.classList.contains('data-form') && isAnyModalOpen()) {
        hasUnsavedChanges = true;
    }
});

document.addEventListener('focusin', (e) => {
    if (e.target && e.target.classList.contains('money-input')) {
        setTimeout(() => { try { e.target.setSelectionRange(0, e.target.value.length); } catch (err) {} }, 10);
    }
});

document.addEventListener('touchstart', (e) => {
    const active = document.activeElement;
    if (active && ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName)) {
        if (!e.target.closest('input, textarea, select, button, .calc-key, .fab-option, .fab-btn, a, summary, label')) {
            active.blur();
        }
    }
}, { passive: true });

// --- 3. MODAL UNIVERSAL DE ACCIONES RÁPIDAS ---
let quickActionHandler = null;

const openQuickActionModal = ({
    title, subtitle = 'Completa los datos', infoLabel = '', infoValue = '',
    showAccountSelect = false, accountLabel = 'Cuenta', defaultAccountId = '',
    showCategorySelect = false, showDescription = false,
    amountLabel = 'Monto ($)', defaultAmount = 0, submitLabel = 'Confirmar', onConfirm
}) => {
    const qModal = document.getElementById('quick-action-modal');
    if (!qModal) return;

    const assetsAcc = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_')));
    if (showAccountSelect && assetsAcc.length === 0) {
        alert("Crea primero una cuenta de liquidez en 'Cuentas'.");
        return;
    }

    if (document.getElementById('quick-action-title')) document.getElementById('quick-action-title').innerText = title;
    if (document.getElementById('quick-action-subtitle')) document.getElementById('quick-action-subtitle').innerText = subtitle;

    const infoBanner = document.getElementById('quick-action-info-banner');
    if (infoBanner) {
        if (infoLabel && infoValue) {
            infoBanner.classList.remove('hidden');
            if (document.getElementById('quick-action-info-label')) document.getElementById('quick-action-info-label').innerText = infoLabel;
            if (document.getElementById('quick-action-info-val')) document.getElementById('quick-action-info-val').innerText = infoValue;
        } else {
            infoBanner.classList.add('hidden');
        }
    }

    const accGroup = document.getElementById('quick-action-account-group');
    const accSelect = document.getElementById('quick-action-account');
    if (accGroup && accSelect) {
        if (showAccountSelect) {
            accGroup.classList.remove('hidden');
            if (document.getElementById('quick-action-account-label')) document.getElementById('quick-action-account-label').innerText = accountLabel;
            const escQ = window.escapeHtml || ((s) => String(s ?? ''));
            const escQA = window.escapeAttr || escQ;
            accSelect.innerHTML = assetsAcc.map(a => `<option value="${escQA(a.id)}">${escQ(stripLeadingEmoji(a.name))}${a.isDefault ? ' ★' : ''}</option>`).join('');
            const preferredId = defaultAccountId || getDefaultAccountId(true);
            if (preferredId && assetsAcc.some(a => a.id === preferredId)) accSelect.value = preferredId;
        } else {
            accGroup.classList.add('hidden');
        }
    }

    const catGroup = document.getElementById('quick-action-category-group');
    const catSelect = document.getElementById('quick-action-category');
    if (catGroup && catSelect) {
        if (showCategorySelect) {
            const escQ = window.escapeHtml || ((s) => String(s ?? ''));
            const escQA = window.escapeAttr || escQ;
            catGroup.classList.remove('hidden');
            const list = [...(financeData.categories['expense'] || [])]
                .filter(c => !c.isArchived)
                .sort((a, b) => cleanCatName(a.name).localeCompare(cleanCatName(b.name), 'es', { sensitivity: 'base' }));
            let html = '';
            list.forEach(cat => {
                const labelCat = cleanCatName(cat.name);
                const activeSubs = (cat.subcategories || [])
                    .filter(s => !s.isArchived)
                    .sort((a, b) => cleanCatName(a.name).localeCompare(cleanCatName(b.name), 'es', { sensitivity: 'base' }));
                if (activeSubs.length > 0) {
                    html += `<optgroup label="${escQA(labelCat)}">`;
                    html += `<option value="${escQA(cat.name)}::General">${escQ(labelCat)} (General)</option>`;
                    activeSubs.forEach(sub => {
                        html += `<option value="${escQA(cat.name)}::${escQA(sub.name)}">↳ ${escQ(cleanCatName(sub.name))}</option>`;
                    });
                    html += `</optgroup>`;
                } else {
                    html += `<option value="${escQA(cat.name)}::General">${escQ(labelCat)}</option>`;
                }
            });
            catSelect.innerHTML = html;
        } else {
            catGroup.classList.add('hidden');
        }
    }

    const descGroup = document.getElementById('quick-action-desc-group');
    const descInput = document.getElementById('quick-action-desc');
    if (descGroup && descInput) {
        if (showDescription) {
            descGroup.classList.remove('hidden');
            descInput.value = '';
        } else {
            descGroup.classList.add('hidden');
        }
    }

    if (document.getElementById('quick-action-amount-label')) document.getElementById('quick-action-amount-label').innerText = amountLabel;
    const amtInput = document.getElementById('quick-action-amount');
    if (amtInput) amtInput.value = defaultAmount > 0 ? formatNumberInput(defaultAmount) : '';
    if (document.getElementById('quick-action-submit-btn')) document.getElementById('quick-action-submit-btn').innerHTML = submitLabel;

    quickActionHandler = onConfirm;
    hasUnsavedChanges = false;
    qModal.classList.remove('hidden');
    setTimeout(() => amtInput?.focus(), 80);
};

document.getElementById('quick-action-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseMoneyInput(document.getElementById('quick-action-amount')?.value);
    const accountId = document.getElementById('quick-action-account')?.value || '';
    const categoryVal = document.getElementById('quick-action-category')?.value || '';
    const descVal = document.getElementById('quick-action-desc')?.value.trim() || '';

    if (typeof quickActionHandler === 'function') {
        const ok = quickActionHandler(amount, accountId, categoryVal, descVal);
        if (ok === false) return;
    }
    hasUnsavedChanges = false;
    quickActionHandler = null;
    document.getElementById('quick-action-modal')?.classList.add('hidden');
});

// --- 3.5 FUNCIONES EXPERIMENTALES (SIN CREDENCIALES ESTATICAS EN CODIGO) ---
localStorage.removeItem('myFinancesGodKey');

if (localStorage.getItem('myFinancesExclusiveMode') === 'true') {
    document.body.classList.add('exclusive-mode-active');
    setTimeout(() => {
        const switchEl = document.getElementById('profile-exclusive-mode');
        if (switchEl) switchEl.checked = true;
    }, 500);
}

document.getElementById('btn-change-god-key')?.classList.add('hidden');

document.getElementById('profile-exclusive-mode')?.addEventListener('change', (e) => {
    if (e.target.checked) {
        localStorage.setItem('myFinancesExclusiveMode', 'true');
        document.body.classList.add('exclusive-mode-active');
        alert('Funciones experimentales activadas.');
    } else {
        localStorage.removeItem('myFinancesExclusiveMode');
        document.body.classList.remove('exclusive-mode-active');
        alert('Funciones experimentales ocultas.');
    }
});

// --- 4. TEMAS, MODO CLARO/OSCURO Y SEGURIDAD ---
window.applyColorModeUI = (mode) => {
    const cleanMode = ['light', 'dark', 'black', 'auto'].includes(mode) ? mode : 'auto';
    localStorage.setItem('myFinancesColorMode', cleanMode);
    if (cleanMode === 'auto') {
        document.documentElement.removeAttribute('data-color-mode');
    } else {
        document.documentElement.setAttribute('data-color-mode', cleanMode);
    }
    document.querySelectorAll('#theme-mode-segmented .segmented-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === cleanMode);
    });
};

window.applyThemeUI = (themeValue = null) => {
    const trip = financeData.tripMode || {};
    // Por defecto ahora arranca en 'lumen'
    let activeTheme = themeValue || localStorage.getItem('myFinancesTheme') || 'lumen';
    
    if (trip.active) {
        activeTheme = (financeData.preferences && financeData.preferences.tripTheme) ? financeData.preferences.tripTheme : '#0ea5e9';
    }

    // Mapa de colores base (--accent) para paletas oficiales de Lumen y colores sólidos
    const presets = {
        'lumen': '#00C49F',
        'tranquilidad': '#8B5CF6',
        'claridad': '#06B6D4',
        'blue': '#007aff',
        'purple': '#8b5cf6',
        'green': '#10b981',
        'orange': '#f59e0b',
        'pink': '#ec4899',
        'dark': '#334155',
        'forest': '#22c55e',
        'rose': '#fda4af'
    };

    // Degradados oficiales de Lumen (Luz Lumen, Tranquilidad y Claridad)
    const lumenGradients = {
        'lumen': 'linear-gradient(135deg, #00C49F 0%, #0033AA 100%)',
        'tranquilidad': 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
        'claridad': 'linear-gradient(135deg, #06B6D4 0%, #00C49F 100%)'
    };

    // Determina el color base validando formato hexadecimal estricto para evitar inyeccion CSS
    const isValidCustomHex = typeof activeTheme === 'string' && /^#[0-9a-fA-F]{6}$/.test(activeTheme);
    const baseColor = presets[activeTheme] || (isValidCustomHex ? activeTheme : (trip.active ? '#0ea5e9' : '#00C49F'));

    // Aplicar las variables CSS al :root
    document.documentElement.style.setProperty('--accent', baseColor);
    
    // Si es una paleta oficial de Lumen, aplica su degradado dual; de lo contrario, genera el degradado dinámico
    if (lumenGradients[activeTheme]) {
        document.documentElement.style.setProperty('--theme-gradient', lumenGradients[activeTheme]);
    } else {
        document.documentElement.style.setProperty('--theme-gradient', `linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, #000 40%) 100%)`);
    }

    document.documentElement.style.setProperty('--theme-shadow', `color-mix(in srgb, var(--accent) 35%, transparent)`);
    
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', baseColor);
    
    const picker = document.getElementById('custom-theme-color');
    if (picker && !trip.active) {
        picker.value = baseColor.startsWith('#') ? baseColor : '#00C49F';
        const isPreset = Array.from(document.querySelectorAll('.theme-color-btn')).some(b => b.getAttribute('data-theme') === activeTheme);
        const pickerWrap = picker.closest('.custom-color-row') || picker.parentElement;
        if (pickerWrap) {
            pickerWrap.style.borderColor = !isPreset ? 'var(--accent)' : '';
            pickerWrap.style.boxShadow = !isPreset ? '0 0 0 2px var(--accent-soft)' : '';
        }
    }
    
    const currentTripTheme = (financeData.preferences && financeData.preferences.tripTheme) ? financeData.preferences.tripTheme : '#0ea5e9';
    document.querySelectorAll('.trip-color-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-trip-color') === currentTripTheme);
    });

    document.querySelectorAll('.theme-color-btn').forEach(b => {
        b.classList.toggle('active', !trip.active && b.getAttribute('data-theme') === activeTheme);
    });
};

const persistProfileDisplayName = (rawName) => {
    if (!authData) return false;
    const cleanName = String(rawName || '').trim();
    if (!cleanName) return false;

    const cleanLimited = cleanName.slice(0, 80);
    authData.name = cleanLimited;

    try {
        const storedAuth = typeof safeJsonParse === 'function'
            ? safeJsonParse(localStorage.getItem('myFinancesAuth'), null)
            : JSON.parse(localStorage.getItem('myFinancesAuth') || 'null');
        const nextAuth = (storedAuth && typeof storedAuth === 'object')
            ? { ...storedAuth, name: cleanLimited }
            : { ...authData, name: cleanLimited };
        localStorage.setItem('myFinancesAuth', JSON.stringify(nextAuth));
} catch (e) {
    return false;
}
syncUserUI();
return true;
};

document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-save-profile-name')) {
        const input = document.getElementById('profile-display-name-input');
        const btn = document.getElementById('btn-save-profile-name');
        if (!input || !persistProfileDisplayName(input.value)) {
            alert('Escribe un nombre válido para tu perfil.');
            return;
        }
        if (btn) {
            const origText = btn.innerText;
            btn.innerText = '✓ Listo';
            setTimeout(() => { btn.innerText = origText; }, 1400);
        }
    } else if (e.target.closest('#profile-modal-name')) {
        document.getElementById('profile-main-view')?.classList.add('hidden');
        document.querySelectorAll('.profile-body').forEach(v => v.classList.add('hidden'));
        const themeView = document.getElementById('profile-theme-view');
        if (themeView) {
            themeView.classList.remove('hidden');
            themeView.scrollTop = 0;
        }
    }
});

document.getElementById('profile-display-name-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('btn-save-profile-name')?.click();
    }
});

const syncUserUI = () => {
    if (!authData) return;
    const safeFullName = String(authData.name || 'Usuario').trim() || 'Usuario';
    const firstName = safeFullName.split(/\s+/)[0];
    const initial = safeFullName.charAt(0).toUpperCase();

    if (document.getElementById('app-title')) document.getElementById('app-title').innerText = 'Lumen';
    if (document.getElementById('profile-avatar-initial')) document.getElementById('profile-avatar-initial').innerText = initial;
    if (document.getElementById('profile-modal-avatar')) document.getElementById('profile-modal-avatar').innerText = initial;

    const modalNameEl = document.getElementById('profile-modal-name');
    if (modalNameEl) {
        const safeFirstName = window.escapeHtml ? window.escapeHtml(firstName) : firstName;
        modalNameEl.style.cursor = 'pointer';
        modalNameEl.title = 'Toca para cambiar tu nombre';
        modalNameEl.innerHTML = `Hola, <span style="border-bottom: 2px dashed rgba(255,255,255,0.4); padding-bottom: 2px;">${safeFirstName}</span>`;
    }

    const nameInputEl = document.getElementById('profile-display-name-input');
    if (nameInputEl && document.activeElement !== nameInputEl) {
        nameInputEl.value = authData.name || '';
        nameInputEl.style.width = '';
    }

    if (document.getElementById('login-greeting')) document.getElementById('login-greeting').innerText = `Hola de nuevo, ${firstName}`;

    const lockBtn = document.getElementById('btn-lock-app-profile');
    const pinCheck = document.getElementById('profile-enable-pin');
    const pinGroup = document.getElementById('profile-pin-group');
    const disableGroup = document.getElementById('profile-disable-pin-group');
    const modeHint = document.getElementById('profile-pin-mode-hint');
    const newPinLabel = document.getElementById('profile-new-pin-label');
    const confirmPinLabel = document.getElementById('profile-confirm-pin-label');
    const submitBtn = document.getElementById('profile-pin-submit-btn');
    
    // NUEVO: Instancia del switch de auto-desbloqueo
    const autoUnlockCheck = document.getElementById('pin-auto-unlock-toggle');

    document.getElementById('profile-pin-error')?.classList.add('hidden');
    disableGroup?.classList.add('hidden');
    if (document.getElementById('profile-current-pin')) document.getElementById('profile-current-pin').value = '';

    // Cargar preferencia de auto-desbloqueo y biometría
    if (autoUnlockCheck) {
        autoUnlockCheck.checked = localStorage.getItem('lumen_pin_auto_unlock') === 'true';
    }
    const bioProfileCheck = document.getElementById('profile-use-biometric');
    if (bioProfileCheck) {
        bioProfileCheck.checked = !!authData.biometricEnabled;
    }

    const configuredSecretMode = (window.LumenSecurity?.getConfiguredSecretMode?.() || authData.secretMode || 'pin') === 'passphrase'
    ? 'passphrase'
    : 'pin';

const applyProfileSecretModeUI = (mode) => {
    const isPass = mode === 'passphrase';
    const modeInput = document.getElementById('profile-secret-mode');
    if (modeInput) modeInput.value = isPass ? 'passphrase' : 'pin';

    document.querySelectorAll('#profile-secret-mode-segmented .segmented-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.secretMode === (isPass ? 'passphrase' : 'pin'));
    });

    const newInp = document.getElementById('profile-new-pin');
    const confInp = document.getElementById('profile-new-pin-confirm');
    const strengthHint = document.getElementById('profile-secret-strength-hint');
    const autoRow = document.getElementById('pin-auto-unlock-toggle')?.closest('.switch-row');

    const showSecretCheck = document.getElementById('profile-show-secret-toggle');
    const showSecretLabel = document.getElementById('profile-show-secret-label');
    if (showSecretCheck) showSecretCheck.checked = false;
    if (showSecretLabel) showSecretLabel.textContent = isPass ? 'Mostrar contraseña' : 'Mostrar PIN';

    [newInp, confInp].forEach((inp) => {
        if (!inp) return;
        inp.type = 'password';
        inp.inputMode = isPass ? 'text' : 'numeric';
        inp.maxLength = isPass ? 64 : 6;
        inp.placeholder = isPass ? 'Mín. 8 car.' : '••••';
    });

    if (strengthHint) {
        strengthHint.textContent = isPass
            ? 'Mínimo 8 caracteres (letras y números). Máxima resistencia frente a extracción física offline.'
            : 'Acceso rápido diario (4-6 dígitos). Recomendado junto con Face ID o Huella.';
    }
    if (autoRow) {
        autoRow.classList.toggle('hidden', isPass);
    }

    if (authData.pinEnabled) {
        if (newPinLabel) newPinLabel.innerText = isPass ? 'Nueva Clave Maestra (opc.)' : 'Cambiar PIN (opcional)';
        if (confirmPinLabel) confirmPinLabel.innerText = isPass ? 'Confirmar Clave Maestra' : 'Confirmar nuevo PIN';
        if (submitBtn) submitBtn.innerText = 'Actualizar Seguridad';
    } else {
        if (newPinLabel) newPinLabel.innerText = isPass ? 'Clave Maestra (8+ car.)' : 'Crear PIN (4-6 dígitos)';
        if (confirmPinLabel) confirmPinLabel.innerText = isPass ? 'Confirmar Clave' : 'Confirmar PIN';
        if (submitBtn) submitBtn.innerText = isPass ? 'Guardar y Activar Clave' : 'Guardar y Activar PIN';
    }
};

const segWrap = document.getElementById('profile-secret-mode-segmented');
if (segWrap && !segWrap.dataset.boundSecretMode) {
    segWrap.dataset.boundSecretMode = '1';
    segWrap.addEventListener('click', (ev) => {
        const btn = ev.target.closest('[data-secret-mode]');
        if (!btn) return;
        applyProfileSecretModeUI(btn.dataset.secretMode);
        ['profile-new-pin', 'profile-new-pin-confirm'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        document.getElementById('profile-pin-error')?.classList.add('hidden');
    });
}

const showSecretToggle = document.getElementById('profile-show-secret-toggle');
if (showSecretToggle && !showSecretToggle.dataset.boundShowSecret) {
    showSecretToggle.dataset.boundShowSecret = '1';
    showSecretToggle.addEventListener('change', (ev) => {
        const nextType = ev.target.checked ? 'text' : 'password';
        ['profile-new-pin', 'profile-new-pin-confirm'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.type = nextType;
        });
    });
}

// Sincroniza también la pantalla de login y el campo de desactivación según el modo activo
const loginPinInp = document.getElementById('login-pin');
const loginSubEl = document.getElementById('login-subtitle');
const forgotBtnEl = document.getElementById('btn-forgot-pin');
const curPinInp = document.getElementById('profile-current-pin');
const isPassActive = configuredSecretMode === 'passphrase';

if (loginPinInp) {
    loginPinInp.inputMode = isPassActive ? 'text' : 'numeric';
    loginPinInp.maxLength = isPassActive ? 64 : 6;
    loginPinInp.placeholder = isPassActive ? 'Contraseña maestra' : '••••';
    loginPinInp.style.letterSpacing = isPassActive ? '1px' : '8px';
    loginPinInp.style.fontSize = isPassActive ? '16px' : '22px';
}
if (loginSubEl) {
    loginSubEl.textContent = isPassActive
        ? 'Ingresa tu contraseña maestra para desbloquear tus finanzas'
        : 'Ingresa tu PIN para desbloquear tus finanzas';
}
if (forgotBtnEl) {
    forgotBtnEl.textContent = isPassActive ? '¿Olvidaste tu contraseña?' : '¿Olvidaste tu PIN?';
}
if (curPinInp) {
    curPinInp.inputMode = isPassActive ? 'text' : 'numeric';
    curPinInp.maxLength = isPassActive ? 64 : 6;
    curPinInp.placeholder = isPassActive ? 'Contraseña actual' : '••••';
}

if (authData.pinEnabled) {
    lockBtn?.classList.remove('hidden');
    if (pinCheck) pinCheck.checked = true;
    pinGroup?.classList.remove('hidden');
    modeHint?.classList.remove('hidden');
} else {
    lockBtn?.classList.add('hidden');
    if (pinCheck) pinCheck.checked = false;
    pinGroup?.classList.add('hidden');
    modeHint?.classList.add('hidden');
}
applyProfileSecretModeUI(configuredSecretMode);

const secView = document.getElementById('profile-security-view');
if (secView) {
    let vaultBadge = document.getElementById('lumen-vault-status-badge');
    if (!vaultBadge) {
        vaultBadge = document.createElement('div');
        vaultBadge.id = 'lumen-vault-status-badge';
        vaultBadge.style.cssText = 'display:flex; align-items:center; gap:10px; padding:11px 13px; border-radius:14px; margin-bottom:12px; border:1px solid var(--border-color); background:var(--card-inner-bg); font-size:12px;';
        const anchor = document.getElementById('profile-pin-form') || secView.firstElementChild;
        if (anchor && anchor.parentNode) {
            anchor.parentNode.insertBefore(vaultBadge, anchor);
        }
    }
    const isVaultActive = !!(authData.pinEnabled && localStorage.getItem('lumen_vault_v1'));
    vaultBadge.style.borderColor = isVaultActive ? 'color-mix(in srgb, var(--positive) 38%, transparent)' : 'var(--border-color)';
    vaultBadge.innerHTML = isVaultActive
        ? `<span style="width:32px; height:32px; border-radius:10px; background:var(--positive-bg); color:var(--positive); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${typeof renderIcon === 'function' ? renderIcon('shield', 16) : ''}</span>
           <div style="min-width:0;">
               <strong style="display:block; color:var(--positive); font-size:12.5px;">Bóveda Cifrada (${isPassActive ? 'Clave Maestra' : 'PIN'} • AES-256-GCM)</strong>
               <small style="display:block; color:var(--text-muted); font-size:11px; line-height:1.35;">${isPassActive ? 'Protección reforzada de alta entropía sobre cuentas, movimientos, nómina y archivo anual.' : 'Tus cuentas, movimientos, nómina, CDTs y archivo anual están cifrados en disco.'}</small>
           </div>`
        : (authData.pinEnabled
            ? `<span style="width:32px; height:32px; border-radius:10px; background:rgba(245, 158, 11, 0.14); color:#d97706; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${typeof renderIcon === 'function' ? renderIcon('lock', 16) : ''}</span>
               <div style="min-width:0;">
                   <strong style="display:block; color:#d97706; font-size:12.5px;">Bloqueo activo en modo HTTP local</strong>
                   <small style="display:block; color:var(--text-muted); font-size:11px; line-height:1.35;">En red local sin HTTPS el navegador desactiva WebCrypto. Al usar HTTPS o la app instalada se cifrará con AES-256-GCM.</small>
               </div>`
            : `<span style="width:32px; height:32px; border-radius:10px; background:rgba(245, 158, 11, 0.14); color:#d97706; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">${typeof renderIcon === 'function' ? renderIcon('lock', 16) : ''}</span>
               <div style="min-width:0;">
                   <strong style="display:block; color:var(--text-main); font-size:12.5px;">Bóveda sin cifrado de acceso</strong>
                   <small style="display:block; color:var(--text-muted); font-size:11px; line-height:1.35;">Activa un PIN o una Clave Maestra abajo para cifrar tus datos locales con AES-256-GCM.</small>
               </div>`);
}

    if (financeData.isDemoMode) {
        let demoBanner = document.getElementById('demo-mode-profile-banner');
        if (!demoBanner) {
            const wrap = document.getElementById('profile-main-view');
            demoBanner = document.createElement('div');
            demoBanner.id = 'demo-mode-profile-banner';
            demoBanner.style.cssText = 'background:rgba(59, 130, 246, 0.1); border:1px dashed #3b82f6; border-radius:12px; padding:14px; margin-bottom:14px; text-align:center;';
            demoBanner.innerHTML = `
                <strong style="color:#3b82f6; font-size:13.5px; display:block; margin-bottom:6px;">Modo Demostración Activo</strong>
                <small style="color:var(--text-muted); font-size:11.5px; display:block; margin-bottom:12px;">Estás viendo datos de prueba.</small>
                <button type="button" id="btn-clear-demo" class="btn btn-primary" style="width:100%; font-size:13px; background:#ef4444; border-color:#ef4444;">Limpiar datos y Empezar</button>
            `;
            wrap?.insertBefore(demoBanner, wrap.firstChild);
            
            document.getElementById('btn-clear-demo')?.addEventListener('click', () => {
                window.openBentoConfirmModal({
                    title: 'Limpiar datos de prueba',
                    subtitle: 'Modo Demostración Activo',
                    message: 'Se eliminarán los movimientos, cuentas y presupuestos de ejemplo para que inicies tu cuenta real en limpio.',
                    confirmText: 'Limpiar y empezar',
                    cancelText: 'Cancelar',
                    danger: true,
                    onConfirm: () => {
                        localStorage.removeItem('myFinancesRecapDismissedMonth');
                        localStorage.removeItem('myFinancesAutoRecapSeenMonth');
                        clearDemoDataAndStart();
                        document.getElementById('demo-mode-profile-banner')?.remove();
                        document.getElementById('profile-modal')?.classList.add('hidden');
                        renderAccountSelects();
                        renderCategoryOptions('expense');
                        syncUserUI();
                        updateDashboard();
                    }
                });
            });
        }
    }
};

const presentRecoveryCodeModal = (code) => {
    if (!code) return;
    lastGeneratedRecoveryCode = String(code);
    const recModal = document.getElementById('recovery-success-modal');
    const codeDisplay = document.getElementById('recovery-code-display');
    if (recModal && codeDisplay) {
        codeDisplay.textContent = lastGeneratedRecoveryCode;
        recModal.classList.remove('hidden');
    }
};
window.presentRecoveryCodeModal = presentRecoveryCodeModal;

const unlockAppSuccess = (migratedRecoveryCode = null) => {
    document.getElementById('login-error')?.classList.add('hidden');
    document.body.classList.remove('app-locked');
    document.getElementById('auth-overlay')?.classList.add('hidden');
    const pinInp = document.getElementById('login-pin');
    if (pinInp) pinInp.value = '';
    if (migratedRecoveryCode) {
        presentRecoveryCodeModal(migratedRecoveryCode);
    } else if (typeof checkWhatsNewBanner === 'function') {
        checkWhatsNewBanner();
    }
};

const showLoginLockoutOrError = (res) => {
    const errEl = document.getElementById('login-error');
    const card = document.getElementById('auth-card');
    if (errEl) {
        errEl.textContent = res?.locked
            ? `Demasiados intentos. Espera ${res.remainingSec} s antes de volver a intentar.`
            : 'PIN incorrecto. Intentalo de nuevo.';
        errEl.classList.remove('hidden');
    }
    card?.classList.remove('shake');
    void card?.offsetWidth;
    card?.classList.add('shake');
    const pinInp = document.getElementById('login-pin');
    if (pinInp) pinInp.value = '';
};

const triggerBiometricUnlock = async () => {
    if (!authData || !authData.biometricEnabled) return;
    const res = await verifyBiometricCredential();
    if (res.ok) {
        unlockAppSuccess();
    } else if (res.reason === 'vault_needs_pin') {
        const errEl = document.getElementById('login-error');
        if (errEl) {
            errEl.textContent = 'Ingresa tu PIN una vez para sincronizar el cifrado biometrico.';
            errEl.classList.remove('hidden');
        }
    } else if (res.locked) {
        showLoginLockoutOrError(res);
    }
};

const initAuthUI = async (forceLock = false) => {
    forceCloseAllModals();
    if (forceLock && window.LumenSecurity?.lockVaultSession) {
        window.LumenSecurity.lockVaultSession();
    }
    const overlay = document.getElementById('auth-overlay');
    const welcomeView = document.getElementById('welcome-view');
    const loginView = document.getElementById('login-view');
    if (!overlay) return;

    if (!authData) {
        document.body.classList.add('app-locked');
        overlay.classList.remove('hidden');
        welcomeView?.classList.remove('hidden');
        document.getElementById('welcome-step-1')?.classList.remove('hidden');
        document.getElementById('welcome-step-2')?.classList.add('hidden');
        loginView?.classList.add('hidden');
    } else if (authData.pinEnabled || forceLock) {
        document.body.classList.add('app-locked');
        syncUserUI();
        overlay.classList.remove('hidden');
        welcomeView?.classList.add('hidden');
        document.getElementById('recovery-view')?.classList.add('hidden');
        loginView?.classList.remove('hidden');

        const bioLoginBtn = document.getElementById('btn-login-biometric');
        if (bioLoginBtn) {
            bioLoginBtn.classList.toggle('hidden', !authData.biometricEnabled);
        }

        const pinInput = document.getElementById('login-pin');
        if (pinInput) { pinInput.value = ''; setTimeout(() => pinInput.focus(), 120); }
    } else {
        document.body.classList.remove('app-locked');
        syncUserUI();
        overlay.classList.add('hidden');
        if (typeof checkWhatsNewBanner === 'function') checkWhatsNewBanner();
    }

    const bioAvailable = await isBiometricHardwareAvailable();
    if (!bioAvailable) {
        const wHint = document.getElementById('welcome-biometric-hint');
        const pHint = document.getElementById('profile-biometric-hint');
        const warningText = 'Requiere HTTPS o PWA instalada';
        if (wHint) { wHint.textContent = warningText; wHint.style.color = 'var(--negative)'; }
        if (pHint) { pHint.textContent = warningText; pHint.style.color = 'var(--negative)'; }
        const wCheck = document.getElementById('welcome-use-biometric');
        const pCheck = document.getElementById('profile-use-biometric');
        if (wCheck) wCheck.disabled = true;
        if (pCheck) pCheck.disabled = true;
    } else if (authData && (authData.pinEnabled || forceLock) && authData.biometricEnabled) {
        triggerBiometricUnlock();
    }
};

document.getElementById('welcome-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-welcome-submit');
    const originalText = btnSubmit.innerText;

    const name = document.getElementById('welcome-name').value.trim();
    const usePin = document.getElementById('welcome-use-pin').checked;
    const pin = document.getElementById('welcome-pin').value;
    const pinConfirm = document.getElementById('welcome-pin-confirm').value;
    const useBio = document.getElementById('welcome-use-biometric')?.checked;
    const acceptedTerms = !!document.getElementById('welcome-accept-terms')?.checked;
    const errEl = document.getElementById('welcome-error');

    if (!name) return;

    if (usePin) {
        if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
            if (errEl) { errEl.innerText = 'El PIN debe tener entre 4 y 6 digitos numericos.'; errEl.classList.remove('hidden'); }
            return;
        }
        if (pin !== pinConfirm) {
            if (errEl) { errEl.innerText = 'Los PIN ingresados no coinciden.'; errEl.classList.remove('hidden'); }
            return;
        }
    }

    if (!acceptedTerms) {
        if (errEl) { errEl.innerText = 'Debes aceptar los Terminos y la Politica de Proteccion de Datos.'; errEl.classList.remove('hidden'); }
        return;
    }

    if (errEl) errEl.classList.add('hidden');
    btnSubmit.innerText = 'Cifrando...';
    btnSubmit.disabled = true;

    try {
        let credId = null;
        if (usePin && useBio) {
            const bioRes = await registerBiometricCredential(name);
            if (bioRes.ok) {
                credId = bioRes.credId;
            } else if (bioRes.reason !== 'cancelled') {
                if (errEl) { errEl.innerText = 'No se pudo configurar Face ID/Huella. Activalo luego en Perfil.'; errEl.classList.remove('hidden'); }
            }
        }

        const { recoveryCode } = await registerUser(name, pin, usePin, credId);

        ['welcome-pin', 'welcome-pin-confirm'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });

        if (typeof APP_VERSION !== 'undefined') localStorage.setItem('myFinancesLastSeenVersion', APP_VERSION);
        syncUserUI();
        document.body.classList.remove('app-locked');
        document.getElementById('auth-overlay')?.classList.add('hidden');
        updateDashboard();

        if (usePin && recoveryCode) {
            presentRecoveryCodeModal(recoveryCode);
        }
    } catch (err) {
        if (errEl) {
            errEl.innerText = err?.message || 'Error configurando seguridad local.';
            errEl.classList.remove('hidden');
        }
    } finally {
        btnSubmit.innerText = originalText;
        btnSubmit.disabled = false;
    }
});

document.getElementById('btn-login-biometric')?.addEventListener('click', triggerBiometricUnlock);

// Auto-desbloqueo endurecido: verifica UNICAMENTE al alcanzar pinLength exacto (cero oraculo tecla por tecla)
let isVerifyingPinInput = false;
document.getElementById('login-pin')?.addEventListener('input', async (e) => {
    const isAutoUnlock = localStorage.getItem('lumen_pin_auto_unlock') === 'true';
    if (!isAutoUnlock || isVerifyingPinInput) return;

    const lock = window.LumenSecurity?.checkAuthLockout?.();
    if (lock?.locked) {
        showLoginLockoutOrError(lock);
        return;
    }

    if (window.LumenSecurity?.getConfiguredSecretMode?.() === 'passphrase') return;

const expectedLen = window.LumenSecurity?.getConfiguredPinLength?.();
if (!expectedLen) return;

    const pin = e.target.value;
    if (pin.length !== expectedLen) return;

    isVerifyingPinInput = true;
    try {
        const res = await verifyPin(pin);
        if (res.ok) {
            if (authData?.biometricEnabled) {
                await window.LumenSecurity?.bindBiometricWrapper?.().catch(() => {});
            }
            unlockAppSuccess(res.migratedRecoveryCode || null);
        } else {
            showLoginLockoutOrError(res);
        }
    } finally {
        isVerifyingPinInput = false;
    }
});

document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isVerifyingPinInput) return;
    const pin = document.getElementById('login-pin').value;
    if (!pin) return;

    isVerifyingPinInput = true;
    try {
        const res = await verifyPin(pin);
        if (res.ok) {
            if (authData?.biometricEnabled) {
                await window.LumenSecurity?.bindBiometricWrapper?.().catch(() => {});
            }
            unlockAppSuccess(res.migratedRecoveryCode || null);
        } else {
            showLoginLockoutOrError(res);
        }
    } finally {
        isVerifyingPinInput = false;
    }
});

document.getElementById('btn-forgot-pin')?.addEventListener('click', () => {
    document.getElementById('forgot-pin-confirm-box')?.classList.remove('hidden');
    const bioBtn = document.getElementById('btn-recovery-biometric');
    if (bioBtn) bioBtn.classList.toggle('hidden', !(authData && authData.biometricEnabled));
});

document.getElementById('btn-recovery-biometric')?.addEventListener('click', async () => {
    const errEl = document.getElementById('recovery-error');
    const res = await verifyBiometricCredential();
    if (res.ok) {
        await disableSecurityLock();
        unlockAppSuccess();
    } else {
        if (errEl) {
            errEl.textContent = res.locked
                ? `Bloqueado temporalmente (${res.remainingSec} s).`
                : 'No se pudo desbloquear con biometria. Usa tu Clave de Recuperacion.';
            errEl.classList.remove('hidden');
        }
    }
});

document.getElementById('recovery-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('recovery-code-input').value;
    const errEl = document.getElementById('recovery-error');

    const res = await verifyRecoveryCode(code);
    if (res.ok) {
        await disableSecurityLock();
        unlockAppSuccess();
    } else {
        if (errEl) {
            errEl.textContent = res.locked
                ? `Demasiados intentos. Espera ${res.remainingSec} s.`
                : 'Clave de recuperacion incorrecta.';
            errEl.classList.remove('hidden');
        }
    }
});

document.getElementById('btn-wipe-data-fallback')?.addEventListener('click', async () => {
    const executeFullWipe = async () => {
        await wipeAllLocalFinanceData();
        location.reload();
    };
    if (typeof window.openBentoConfirmModal === 'function') {
        window.openBentoConfirmModal({
            title: 'Borrar datos locales',
            subtitle: 'Acción irreversible',
            message: 'Al no tener tu PIN, clave de recuperación ni biometría, la única salida es borrar todos tus datos para empezar de cero. ¿Confirmas que deseas continuar?',
            confirmText: 'Borrar y reiniciar',
            cancelText: 'Cancelar',
            danger: true,
            onConfirm: executeFullWipe
        });
    } else if (window.confirm('¿Borrar todos tus datos locales y empezar de cero? Esta acción no se puede deshacer.')) {
        await executeFullWipe();
    }
});

document.getElementById('btn-wipe-data')?.addEventListener('click', () => {
    if (typeof window.openBentoConfirmModal === 'function') {
        window.openBentoConfirmModal({
            title: 'Reiniciar aplicacion',
            subtitle: 'Accion irreversible',
            message: 'Se borraran <b>todos tus datos financieros locales, archivos historicos y tu perfil</b> para empezar de cero. Esta accion no se puede deshacer.',
            confirmText: 'Borrar y reiniciar',
            cancelText: 'Cancelar',
            danger: true,
            onConfirm: async () => {
                await wipeAllLocalFinanceData();
                location.reload();
            }
        });
    }
});

const ONBOARDING_SLIDES = [
    {
        title: 'Tu bóveda financiera, 100% tuya',
        desc: 'Organiza cuentas, tarjetas y bolsillos directamente en tu teléfono, sin vincular claves bancarias ni subir datos a la nube.',
        art: `
            <div style="width:100%; display:flex; flex-direction:column; justify-content:center; gap:8px;">
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:14px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 6px 16px rgba(0,0,0,0.05);">
                    <div style="display:flex; align-items:center; gap:8px; text-align:left;">
                        <span style="width:28px; height:28px; border-radius:8px; background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); display:flex; align-items:center; justify-content:center;">${renderIcon('shield', 15)}</span>
                        <div>
                            <strong style="display:block; font-size:11.5px; color:var(--text-main);">Privacidad Local-First</strong>
                            <small style="font-size:9.5px; color:var(--text-muted);">Cifrado en tu dispositivo</small>
                        </div>
                    </div>
                    <span style="font-size:9.5px; font-weight:800; color:var(--positive); background:color-mix(in srgb, var(--positive) 14%, transparent); padding:2px 7px; border-radius:99px;">Activo</span>
                </div>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px;">
                    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:11px; padding:8px 6px; text-align:center;">
                        <span style="color:var(--positive); display:inline-flex;">${renderIcon('bank', 14)}</span>
                        <small style="display:block; font-size:9.5px; font-weight:700; color:var(--text-main); margin-top:2px;">Liquidez</small>
                    </div>
                    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:11px; padding:8px 6px; text-align:center;">
                        <span style="color:var(--accent); display:inline-flex;">${renderIcon('card', 14)}</span>
                        <small style="display:block; font-size:9.5px; font-weight:700; color:var(--text-main); margin-top:2px;">Tarjetas</small>
                    </div>
                    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:11px; padding:8px 6px; text-align:center;">
                        <span style="color:#f59e0b; display:inline-flex;">${renderIcon('piggy', 14)}</span>
                        <small style="display:block; font-size:9.5px; font-weight:700; color:var(--text-main); margin-top:2px;">Bolsillos</small>
                    </div>
                </div>
            </div>
        `
    },
    {
        title: 'Anticipa tu Libre Seguro Hoy',
        desc: 'Descuenta automáticamente tus compromisos y proyecta tu saldo día por día para detectar puntos bajos antes de que ocurran.',
        art: `
            <div style="width:100%; display:flex; flex-direction:column; justify-content:center;">
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:16px; padding:11px 13px; box-shadow:0 8px 20px rgba(0,0,0,0.06); text-align:left; width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                        <span style="font-size:10px; font-weight:700; color:var(--text-muted); display:inline-flex; align-items:center; gap:4px;">${renderIcon('shield', 12)} Libre Seguro Hoy</span>
                        <span style="font-size:9.5px; font-weight:800; color:var(--accent);">Proyección</span>
                    </div>
                    <div style="font-size:16px; font-weight:800; color:var(--text-main); margin-bottom:6px;">$ 1.480.000<span style="font-size:11px; opacity:0.55;">,00</span></div>
                    <svg viewBox="0 0 220 44" style="width:100%; height:40px; display:block; overflow:visible;">
                        <defs>
                            <linearGradient id="onbCurveGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stop-color="#0033AA"/>
                                <stop offset="55%" stop-color="#06B6D4"/>
                                <stop offset="100%" stop-color="#00C49F"/>
                            </linearGradient>
                        </defs>
                        <path d="M 4 28 Q 48 10, 92 34 T 174 14 L 216 6" fill="none" stroke="url(#onbCurveGrad)" stroke-width="3" stroke-linecap="round"/>
                        <circle cx="96" cy="34" r="4" fill="#ef4444" stroke="var(--card-bg)" stroke-width="1.5"/>
                        <circle cx="216" cy="6" r="4.5" fill="#10b981" stroke="var(--card-bg)" stroke-width="1.5"/>
                    </svg>
                    <div style="display:flex; justify-content:space-between; font-size:9px; font-weight:700; color:var(--text-muted); margin-top:2px;">
                        <span>Hoy</span>
                        <span style="color:#ef4444;">● Punto bajo</span>
                        <span class="positive">Cierre mes</span>
                    </div>
                </div>
            </div>
        `
    },
    {
        title: 'Detecta fugas y viaja sin enredos',
        desc: 'Identifica tus días de mayor gasto discrecional con el mapa de calor y aísla el presupuesto de tus viajes en un solo toque.',
        art: `
            <div style="width:100%; display:flex; flex-direction:column; justify-content:center;">
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:16px; padding:11px 12px; box-shadow:0 8px 20px rgba(0,0,0,0.06); width:100%;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:10px; font-weight:800; color:var(--text-main);">Intensidad diaria</span>
                        <span style="font-size:9.5px; font-weight:800; color:#0ea5e9; background:rgba(14,165,233,0.12); padding:2px 8px; border-radius:99px; display:inline-flex; align-items:center; gap:4px;">${renderIcon('pin', 11)} Modo Viaje</span>
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(7, 1fr); gap:5px; margin-bottom:8px;">
                        <span style="height:22px; border-radius:6px; background:rgba(16,185,129,0.16); font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; color:var(--text-main);">12</span>
                        <span style="height:22px; border-radius:6px; background:rgba(16,185,129,0.16); font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; color:var(--text-main);">13</span>
                        <span style="height:22px; border-radius:6px; background:rgba(245,158,11,0.24); font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; color:var(--text-main);">14</span>
                        <span style="height:22px; border-radius:6px; background:rgba(245,158,11,0.24); font-size:9px; font-weight:700; display:flex; align-items:center; justify-content:center; color:var(--text-main);">15</span>
                        <span style="height:22px; border-radius:6px; background:rgba(239,68,68,0.28); font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; color:#ef4444;">16</span>
                        <span style="height:22px; border-radius:6px; border:1.5px solid var(--accent); font-size:9px; font-weight:800; display:flex; align-items:center; justify-content:center; color:var(--accent);">17</span>
                        <span style="height:22px; border-radius:6px; background:var(--hover-bg); font-size:9px; color:var(--text-muted); display:flex; align-items:center; justify-content:center;">18</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:9.5px; color:var(--text-muted); font-weight:600;">
                        <span>Solo variable</span>
                        <span>Prom. activo: <b style="color:var(--text-main);">$ 38.450</b></span>
                    </div>
                </div>
            </div>
        `
    },
    {
        title: 'Nómina, deudas e interés compuesto',
        desc: 'Calcula tu salario y retención en Colombia, acelera la salida de deudas y proyecta el crecimiento de tu ahorro a largo plazo.',
        art: `
            <div style="width:100%; display:flex; flex-direction:column; justify-content:center; gap:7px;">
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">
                    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:8px 10px; text-align:left;">
                        <small style="font-size:9px; font-weight:700; color:var(--text-muted); display:block;">Nómina & UVT</small>
                        <strong style="font-size:11.5px; color:var(--text-main);">Art. 383 • 2026</strong>
                    </div>
                    <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:8px 10px; text-align:left;">
                        <small style="font-size:9px; font-weight:700; color:var(--text-muted); display:block;">Plan Deudas</small>
                        <strong style="font-size:11.5px; color:var(--positive);">Avalancha</strong>
                    </div>
                </div>
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:9px 11px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 6px 16px rgba(0,0,0,0.05);">
                    <div style="text-align:left;">
                        <small style="font-size:9.5px; font-weight:700; color:var(--text-muted); display:block;">Interés Compuesto (8% E.A.)</small>
                        <strong style="font-size:13px; color:var(--positive);">+$ 19.196.207 <span style="font-size:9.5px; color:var(--text-muted); font-weight:600;">en rendim.</span></strong>
                    </div>
                    <span style="width:28px; height:28px; border-radius:50%; background:rgba(245,158,11,0.16); color:#f59e0b; display:flex; align-items:center; justify-content:center;">${renderIcon('trending-up', 15)}</span>
                </div>
            </div>
        `
    },
    {
        title: '¡Conoce a Lumi, tu copiloto!',
        desc: 'Funciona 100% sin conexión y de forma local, manteniendo tu información siempre segura en tu dispositivo. Pregúntale si te alcanza para un gusto, qué tarjeta usar o simula abonos a deudas.',
        art: `
            <div style="width:100%; display:flex; flex-direction:column; justify-content:center; gap:7px; text-align:left;">
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:14px; padding:9px 12px; display:flex; align-items:center; justify-content:space-between; box-shadow:0 6px 16px rgba(0,0,0,0.05);">
                    <div style="display:flex; align-items:center; gap:9px;">
                        <span style="width:28px; height:28px; border-radius:8px; background:linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 3.5L11.65 8.35L16.5 10L11.65 11.65L10 16.5L8.35 11.65L3.5 10L8.35 8.35L10 3.5Z" fill="#ffffff" fill-opacity="0.2"/>
                                <path d="M18.5 14.5L19.15 16.35L21 17L19.15 17.65L18.5 19.5L17.85 17.65L16 17L17.85 16.35L18.5 14.5Z" fill="#ffffff"/>
                                <circle cx="17.5" cy="5.5" r="1.1" fill="#ffffff" stroke="none"/>
                            </svg>
                        </span>
                        <div>
                            <div style="display:flex; align-items:center; gap:5px;">
                                <strong style="font-size:11.5px; font-weight:800; color:var(--text-main); line-height:1.2;">Lumi</strong>
                                <span style="font-size:8.5px; font-weight:800; letter-spacing:0.4px; color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, transparent); border:1px solid color-mix(in srgb, var(--accent) 26%, transparent); padding:1px 5px; border-radius:99px; line-height:1.2;">BETA</span>
                            </div>
                            <small style="display:block; font-size:9.5px; color:var(--text-muted); font-weight:600; margin-top:1px;">Copiloto financiero</small>
                        </div>
                    </div>
                    <span style="font-size:9.5px; font-weight:800; color:var(--positive); background:color-mix(in srgb, var(--positive) 14%, transparent); padding:2px 8px; border-radius:99px; flex-shrink:0;">Sin conexión</span>
                </div>
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:14px; padding:9px 12px; box-shadow:0 6px 16px rgba(0,0,0,0.05); display:flex; flex-direction:column; gap:6px;">
                    <div style="align-self:flex-end; background:var(--hover-bg); color:var(--text-main); font-size:10px; font-weight:700; padding:4px 9px; border-radius:10px 10px 2px 10px;">
                        ¿Qué tarjeta me conviene hoy?
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:700; color:var(--text-main);">
                        <span style="width:7px; height:7px; border-radius:50%; background:var(--positive); flex-shrink:0;"></span>
                        <span>Tarjeta de Crédito <span style="color:var(--positive); font-weight:800;">• 44 días sin interés</span></span>
                    </div>
                </div>
            </div>
        `
    }
];

const goToWelcomeRegistration = () => {
    document.getElementById('welcome-step-1')?.classList.add('hidden');
    document.getElementById('welcome-step-2')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('welcome-name')?.focus(), 100);
};

const initOnboardingCarousel = () => {
    const step1 = document.getElementById('welcome-step-1');
    if (!step1 || step1.dataset.onbReady === '1') return;
    step1.dataset.onbReady = '1';

    let activeSlide = 0;
    let touchStartX = 0;

    step1.innerHTML = `
        <div id="onb-cover-screen" class="onb-stage">
            <div class="onb-top-bar"></div>
            <div>
                <div class="onb-cover-icon">
                    <svg width="56" height="56" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <defs>
                            <linearGradient id="lumenGradTour" x1="15%" y1="10%" x2="85%" y2="90%">
                                <stop offset="0%" stop-color="#00C49F"/>
                                <stop offset="50%" stop-color="#0033AA"/>
                                <stop offset="100%" stop-color="#00C49F"/>
                            </linearGradient>
                        </defs>
                        <path d="M 48 74 L 48 24 A 10 10 0 0 0 28 24 L 28 54 A 12 12 0 0 0 40 66 L 76 66 A 10 10 0 0 1 76 86 L 60 86 A 12 12 0 0 1 48 74 Z" stroke="url(#lumenGradTour)" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <h2 class="onb-slide-title" style="font-size:25px;">¡Hola!</h2>
                <p class="onb-slide-desc">Te damos la bienvenida a <b>Lumen</b>, tu centro privado para controlar dinero, deudas y metas desde tu dispositivo.</p>
                <button type="button" id="btn-onb-start-tour" class="btn btn-primary" style="width:100%; margin-top:24px; padding:13px; font-size:14px;">Saber cómo</button>
            </div>
            <div style="padding-top:14px;">
                <button type="button" id="btn-onb-skip-cover" class="onb-skip-btn" style="font-size:13px;">Omitir demostración</button>
            </div>
        </div>

        <div id="onb-slides-screen" class="onb-stage hidden">
            <div class="onb-top-bar">
                <span id="onb-step-counter" class="onb-step-pill">1 / ${ONBOARDING_SLIDES.length}</span>
                <button type="button" id="btn-onb-skip-slides" class="onb-skip-btn">Omitir</button>
            </div>
            <div id="onb-slide-body" class="onb-anim-enter">
                <div id="onb-slide-art" class="onb-showcase-frame"></div>
                <h2 id="onb-slide-title" class="onb-slide-title"></h2>
                <p id="onb-slide-desc" class="onb-slide-desc"></p>
            </div>
            <div>
                <div id="onb-dots-row" class="onb-dots-row"></div>
                <button type="button" id="btn-onb-next-slide" class="btn btn-primary" style="width:100%; padding:13px; font-size:14px;">Siguiente</button>
            </div>
        </div>
    `;

    const renderSlide = (idx) => {
        activeSlide = Math.max(0, Math.min(ONBOARDING_SLIDES.length - 1, idx));
        const slide = ONBOARDING_SLIDES[activeSlide];
        const isLast = activeSlide === ONBOARDING_SLIDES.length - 1;

        const bodyEl = document.getElementById('onb-slide-body');
        if (bodyEl) {
            bodyEl.classList.remove('onb-anim-enter');
            void bodyEl.offsetWidth;
            bodyEl.classList.add('onb-anim-enter');
        }
        const counterEl = document.getElementById('onb-step-counter');
        const artEl = document.getElementById('onb-slide-art');
        const titleEl = document.getElementById('onb-slide-title');
        const descEl = document.getElementById('onb-slide-desc');
        const nextBtn = document.getElementById('btn-onb-next-slide');
        const dotsEl = document.getElementById('onb-dots-row');

        if (counterEl) counterEl.textContent = `${activeSlide + 1} / ${ONBOARDING_SLIDES.length}`;
        if (artEl) artEl.innerHTML = slide.art;
        if (titleEl) titleEl.textContent = slide.title;
        if (descEl) descEl.textContent = slide.desc;
        if (nextBtn) nextBtn.textContent = isLast ? 'Empecemos' : 'Siguiente';
        if (dotsEl) {
            dotsEl.innerHTML = ONBOARDING_SLIDES.map((_, i) =>
                `<button type="button" class="onb-dot ${i === activeSlide ? 'active' : ''}" data-onb-idx="${i}" aria-label="Hoja ${i + 1}"></button>`
            ).join('');
            dotsEl.querySelectorAll('.onb-dot').forEach(dot => {
                dot.addEventListener('click', () => renderSlide(parseInt(dot.getAttribute('data-onb-idx'), 10)));
            });
        }
    };

    document.getElementById('btn-onb-start-tour')?.addEventListener('click', () => {
        document.getElementById('onb-cover-screen')?.classList.add('hidden');
        document.getElementById('onb-slides-screen')?.classList.remove('hidden');
        renderSlide(0);
    });

    const skipCoverBtn = document.getElementById('btn-onb-skip-cover');
    if (skipCoverBtn) {
        skipCoverBtn.innerText = 'Omitir demostración';
        skipCoverBtn.style.color = 'var(--accent)';
        skipCoverBtn.addEventListener('click', goToWelcomeRegistration);
    }
    
    document.getElementById('btn-onb-skip-slides')?.addEventListener('click', goToWelcomeRegistration);

    document.getElementById('btn-onb-next-slide')?.addEventListener('click', () => {
        if (activeSlide < ONBOARDING_SLIDES.length - 1) renderSlide(activeSlide + 1);
        else goToWelcomeRegistration();
    });

    const slidesScreen = document.getElementById('onb-slides-screen');
    slidesScreen?.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches[0]) touchStartX = e.touches[0].clientX;
    }, { passive: true });
    slidesScreen?.addEventListener('touchend', (e) => {
        if (!e.changedTouches || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 42) return;
        if (dx < 0 && activeSlide < ONBOARDING_SLIDES.length - 1) renderSlide(activeSlide + 1);
        else if (dx > 0 && activeSlide > 0) renderSlide(activeSlide - 1);
    }, { passive: true });
};

document.addEventListener('DOMContentLoaded', initOnboardingCarousel);

document.getElementById('btn-welcome-back')?.addEventListener('click', () => {
    document.getElementById('welcome-step-2')?.classList.add('hidden');
    document.getElementById('welcome-step-1')?.classList.remove('hidden');
    document.getElementById('onb-slides-screen')?.classList.add('hidden');
    document.getElementById('onb-cover-screen')?.classList.remove('hidden');
    document.getElementById('welcome-error')?.classList.add('hidden');
});

document.getElementById('welcome-link-terms')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.openUniversalInfoModal) window.openUniversalInfoModal('terms');
});

document.getElementById('welcome-link-privacy')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.openUniversalInfoModal) window.openUniversalInfoModal('privacy');
});

document.getElementById('welcome-use-pin')?.addEventListener('change', (e) => {
    const fields = document.getElementById('welcome-pin-fields');
    if (e.target.checked) fields?.classList.remove('hidden');
    else fields?.classList.add('hidden');
});

// --- 4.5 AUTO-BLOQUEO Y CORTINA INSTANTANEA GESTIONADOS EN SECURITY.JS (30s + .app-bg-shield) ---

// --- 5. GESTIÓN INTELIGENTE DE MODALES ---
function setActiveNav(activeEl) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    if (activeEl) activeEl.classList.add('active');
}

function isAnyModalOpen() {
    return Array.from(document.querySelectorAll('.modal')).some(m => !m.classList.contains('hidden'));
}

window.openSideDrawer = () => {
    if (fabMenu && !fabMenu.classList.contains('hidden')) {
        fabMenu.classList.add('hidden');
        fabBtn?.classList.remove('active');
    }
    document.getElementById('quick-calendar-popover')?.classList.add('hidden');
    document.body.classList.add('drawer-open');
    sideDrawerBackdrop?.classList.remove('hidden');
    sideDrawer?.classList.remove('closed');
    sideDrawer?.setAttribute('aria-hidden', 'false');
    const scrollArea = sideDrawer?.querySelector('.drawer-scroll');
    if (scrollArea) scrollArea.scrollTop = 0;
};

window.closeSideDrawer = () => {
    document.body.classList.remove('drawer-open');
    sideDrawer?.classList.add('closed');
    sideDrawerBackdrop?.classList.add('hidden');
    sideDrawer?.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('#side-drawer .drawer-accordion-group').forEach(group => {
        group.classList.remove('open');
        group.querySelector('.drawer-accordion-content')?.classList.add('hidden');
        const chev = group.querySelector('.drawer-chevron');
        if (chev) chev.style.transform = 'rotate(-90deg)';
    });
};

// --- 5.1 CONTROLADOR DE ELIMINACIÓN SEGURA (SAFE DELETE) ---
let safeDeleteCallback = null;

window.openSafeDeleteModal = (targetName, impactItems, onConfirm) => {
    const sdModal = document.getElementById('safe-delete-modal');
    if (!sdModal) return;

    document.getElementById('safe-delete-target-name').innerText = targetName;
    
    const escSd = window.escapeHtml || ((s) => String(s ?? ''));
    const impactList = document.getElementById('safe-delete-impact-list');
    impactList.innerHTML = (impactItems || []).map(item => `<li>${escSd(item)}</li>`).join('');
    impactList.innerHTML += `<li><b>Esta acción no se puede deshacer.</b> Recomendamos hacer un respaldo antes de continuar.</li>`;

    const input = document.getElementById('safe-delete-input');
    const submitBtn = document.getElementById('btn-confirm-safe-delete');
    
    input.value = '';
    submitBtn.disabled = true;
    submitBtn.style.opacity = '0.5';

    // Validación estricta en vivo
    input.oninput = (e) => {
        if (e.target.value === 'ELIMINAR') {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
            input.style.borderColor = 'var(--negative)';
        } else {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
            input.style.borderColor = 'var(--border-color)';
        }
    };

    safeDeleteCallback = onConfirm;
    sdModal.classList.remove('hidden');
    setTimeout(() => input.focus(), 100);
};

document.getElementById('close-safe-delete-btn')?.addEventListener('click', () => {
    document.getElementById('safe-delete-modal')?.classList.add('hidden');
    safeDeleteCallback = null;
});

document.getElementById('btn-cancel-safe-delete')?.addEventListener('click', () => {
    document.getElementById('safe-delete-modal')?.classList.add('hidden');
    safeDeleteCallback = null;
});

document.getElementById('safe-delete-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (document.getElementById('safe-delete-input').value === 'ELIMINAR') {
        const cb = safeDeleteCallback;
        document.getElementById('safe-delete-modal')?.classList.add('hidden');
        safeDeleteCallback = null;
        if (typeof cb === 'function') cb();
    }
});

// Apertura instantánea al primer toque en iOS Safari y clic en Desktop
let drawerTouchStartY = 0;
let lastAccordionToggleAt = 0;

sideDrawer?.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches[0]) drawerTouchStartY = e.touches[0].clientY;
}, { passive: true });

const handleDrawerAccordionInstant = (e) => {
    const trigger = e.target.closest('.drawer-accordion-trigger');
    if (!trigger) return;

    if (e.type === 'touchend' && e.changedTouches && e.changedTouches[0]) {
        if (Math.abs(e.changedTouches[0].clientY - drawerTouchStartY) > 10) return;
    }

    const now = Date.now();
    if (now - lastAccordionToggleAt < 350) return;
    lastAccordionToggleAt = now;

    if (e.cancelable) e.preventDefault();
    e.stopPropagation();

    const targetId = trigger.getAttribute('data-target');
    const targetEl = document.getElementById(targetId);
    const groupEl = trigger.closest('.drawer-accordion-group');
    if (!targetEl || !groupEl) return;

    const willOpen = targetEl.classList.contains('hidden');
    groupEl.classList.toggle('open', willOpen);
    targetEl.classList.toggle('hidden', !willOpen);
    const chev = trigger.querySelector('.drawer-chevron');
    if (chev) chev.style.transform = willOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
};

sideDrawer?.addEventListener('touchend', handleDrawerAccordionInstant, { passive: false });
sideDrawer?.addEventListener('click', handleDrawerAccordionInstant);

// Gesto táctil instantáneo para abrir (deslizar a la derecha) y cerrar (deslizar a la izquierda) el menú lateral
let swipeMenuStartX = 0;
let swipeMenuStartY = 0;
let swipeMenuValidStart = false;
let swipeMenuTriggered = false;

const evaluateDrawerSwipe = (currX, currY) => {
    const dx = currX - swipeMenuStartX;
    const dy = currY - swipeMenuStartY;

    if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 18) {
        swipeMenuValidStart = false;
        return;
    }

    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

    swipeMenuTriggered = true;
    swipeMenuValidStart = false;

    const drawerEl = document.getElementById('side-drawer');
    const isDrawerOpen = drawerEl && !drawerEl.classList.contains('closed');
    if (!isDrawerOpen && dx > 0 && typeof window.openSideDrawer === 'function') {
        window.openSideDrawer();
    } else if (isDrawerOpen && dx < 0 && typeof window.closeSideDrawer === 'function') {
        window.closeSideDrawer();
    }
};

document.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) {
        swipeMenuValidStart = false;
        return;
    }
    const t = e.touches[0];
    swipeMenuStartX = t.clientX;
    swipeMenuStartY = t.clientY;
    swipeMenuTriggered = false;

    const drawerEl = document.getElementById('side-drawer');
    const isDrawerOpen = drawerEl && !drawerEl.classList.contains('closed');
    if (isDrawerOpen) {
        swipeMenuValidStart = true;
        return;
    }

    const blockedByUI = document.body.classList.contains('app-locked') || isAnyModalOpen();
    const inHorizontalScroll = e.target.closest('.bs-filter-strip, .pill-row, .table-responsive, input, select, textarea');
    swipeMenuValidStart = !blockedByUI && !inHorizontalScroll;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
    if (!swipeMenuValidStart || swipeMenuTriggered || !e.touches || e.touches.length !== 1) return;
    evaluateDrawerSwipe(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: true });

document.addEventListener('touchend', (e) => {
    if (!swipeMenuValidStart || swipeMenuTriggered || !e.changedTouches || e.changedTouches.length !== 1) return;
    evaluateDrawerSwipe(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    swipeMenuValidStart = false;
}, { passive: true });

window.returnToPocketHistoryId = null;

window.forceCloseAllModals = () => {
    hasUnsavedChanges = false;
    quickActionHandler = null;
    window.returnToPocketHistoryId = null;
    closeSideDrawer();
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.getElementById('quick-calendar-popover')?.classList.add('hidden');
    document.getElementById('tx-calculator-panel')?.classList.add('hidden');
    document.getElementById('toggle-tx-calc-btn')?.classList.remove('active');

    if (fabMenu && !fabMenu.classList.contains('hidden')) {
        fabMenu.classList.add('hidden');
        fabBtn?.classList.remove('active');
    }

    document.querySelectorAll('form.data-form').forEach(f => {
        if (f.id !== 'salary-config-form' && f.id !== 'tax-params-form' && f.id !== 'health-goals-form' && f.id !== 'notifications-config-form') {
            f.reset();
        }
    });
    document.querySelectorAll('details.add-subcat-details').forEach(d => { d.open = false; });
    setActiveNav(document.getElementById('nav-home'));
};

let pendingUnsavedAction = null;

function requestUnsavedDiscard(message, onConfirm) {
    const modal = document.getElementById('unsaved-changes-modal');
    const msgEl = document.getElementById('unsaved-changes-msg');
    if (!modal) {
        if (confirm(message)) onConfirm();
        return;
    }
    if (msgEl) msgEl.textContent = message;
    pendingUnsavedAction = onConfirm;
    modal.classList.remove('hidden');
}

const closeUnsavedModal = () => {
    pendingUnsavedAction = null;
    document.getElementById('unsaved-changes-modal')?.classList.add('hidden');
};

document.getElementById('close-unsaved-modal-btn')?.addEventListener('click', closeUnsavedModal);
document.getElementById('btn-cancel-unsaved')?.addEventListener('click', closeUnsavedModal);
document.getElementById('btn-confirm-unsaved')?.addEventListener('click', () => {
    const action = pendingUnsavedAction;
    closeUnsavedModal();
    hasUnsavedChanges = false;
    if (typeof action === 'function') action();
});
window.attemptCloseModals = () => {
    const childModals = [
        'bento-backup-pass-modal',
        'bento-alert-modal',
        'bento-month-picker-modal',
        'bento-picker-modal',
        'import-csv-mode-modal',
        'category-delete-modal',
        'sync-rates-result-modal',
        'archive-year-modal',
        'import-backup-confirm-modal',
        'unsaved-changes-modal',
        'reset-app-confirm-modal',
        'safe-delete-modal',
        'universal-info-modal',
        'portfolio-buyout-modal', 'archive-search-modal', 'budget-rebalance-modal', 'refund-help-faq-modal', 'pockets-faq-modal', 'pocket-yield-modal',
        'trip-shared-welcome-modal',
        'pockets-earnings-modal',
        'pocket-history-modal',
        'health-modal',
        'quick-action-modal',
        'pocket-edit-modal',
        'pocket-action-modal',
        'quick-income-modal',
        'debt-planner-modal',
        'annual-control-modal',
        'subcat-months-modal',
        'cat-months-modal',
        'asset-detail-modal',
        'subscriptions-modal',
        'split-tx-modal'
    ];
    for (const cId of childModals) {
        const cm = document.getElementById(cId);
        if (cm && !cm.classList.contains('hidden')) {
            if ((cId === 'cat-months-modal' || cId === 'subcat-months-modal') && hasUnsavedChanges) {
                requestUnsavedDiscard('Tienes cambios sin guardar en el presupuesto. ¿Confirmas que quieres salir?', () => {
                    hasUnsavedChanges = false;
                    cm.classList.add('hidden');
                });
                return false;
            }
            hasUnsavedChanges = false;
            if (cId === 'bento-backup-pass-modal' && typeof cm._cancelBackupPrompt === 'function') {
                cm._cancelBackupPrompt();
                return false;
            }
            if (cId === 'quick-action-modal') quickActionHandler = null;
            if (cId === 'unsaved-changes-modal') pendingUnsavedAction = null;
            if (cId === 'safe-delete-modal') safeDeleteCallback = null;
            if (cId === 'category-delete-modal') pendingCatDeleteAction = null;
            cm.classList.add('hidden');
            if (cId === 'asset-detail-modal') {
                document.getElementById('assets-modal')?.classList.remove('hidden');
            }
            return false;
        }
    }

    const accModal = document.getElementById('accounts-modal');
    const accDetailView = document.getElementById('account-detail-view');
    if (accModal && !accModal.classList.contains('hidden') && accDetailView && !accDetailView.classList.contains('hidden')) {
        accDetailView.classList.add('hidden');
        document.getElementById('accounts-list-view')?.classList.remove('hidden');
        if (lastAccountViewOrigin === 'home') {
            forceCloseAllModals();
            document.getElementById('accounts-list-view')?.classList.remove('hidden');
            return true;
        }
        accModal.classList.add('hidden');
        if (lastAccountViewOrigin === 'analytics') {
            document.getElementById('analytics-modal')?.classList.remove('hidden');
        } else if (lastAccountViewOrigin === 'credit_card') {
            document.getElementById('cards-modal')?.classList.remove('hidden');
        } else if (lastAccountViewOrigin === 'debt') {
            document.getElementById('debts-modal')?.classList.remove('hidden');
        } else if (lastAccountViewOrigin === 'receivable') {
            if (typeof openReceivablesModal === 'function') openReceivablesModal();
        } else {
            accModal.classList.remove('hidden');
        }
        return false;
    }

    const openModals = Array.from(document.querySelectorAll('.modal:not(.hidden)'));
    if (openModals.length > 1) {
        openModals.sort((a, b) => (parseInt(getComputedStyle(b).zIndex, 10) || 0) - (parseInt(getComputedStyle(a).zIndex, 10) || 0));
        openModals[0].classList.add('hidden');
        return false;
    }

    if (isAnyModalOpen() && hasUnsavedChanges) {
        requestUnsavedDiscard('Tienes cambios sin guardar en un formulario. ¿Confirmas que quieres salir y perderlos?', () => {
            hasUnsavedChanges = false;
            forceCloseAllModals();
        });
        return false;
    }

    const txModal = document.getElementById('transaction-modal');
    const prevPocketId = window.returnToPocketHistoryId;
    if (txModal && !txModal.classList.contains('hidden') && prevPocketId) {
        forceCloseAllModals();
        document.getElementById('pockets-modal')?.classList.remove('hidden');
        if (typeof openPocketHistoryModal === 'function') openPocketHistoryModal(prevPocketId);
        return false;
    }

    forceCloseAllModals();
    return true;
};

let modalBackdropPressed = null;
document.querySelectorAll('.modal').forEach(modalEl => {
    modalEl.addEventListener('pointerdown', (e) => {
        modalBackdropPressed = (e.target === modalEl) ? modalEl : null;
    });
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl && modalBackdropPressed === modalEl) {
            attemptCloseModals();
        }
        modalBackdropPressed = null;
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const authOverlay = document.getElementById('auth-overlay');
    if (authOverlay && !authOverlay.classList.contains('hidden')) return;
    if (sideDrawer && !sideDrawer.classList.contains('closed')) { closeSideDrawer(); return; }
    const calPop = document.getElementById('quick-calendar-popover');
    if (calPop && !calPop.classList.contains('hidden')) { calPop.classList.add('hidden'); return; }
    if (fabMenu && !fabMenu.classList.contains('hidden')) {
        fabMenu.classList.add('hidden');
        fabBtn?.classList.remove('active');
        return;
    }
    if (isAnyModalOpen()) attemptCloseModals();
});

// --- 5.2 CONTROLADOR NATIVO DEL BOTÓN ATRÁS DE ANDROID (CAPACITOR APP) ---
const initNativeAndroidBackHandler = () => {
    const capApp = window.Capacitor?.Plugins?.App;
    if (!capApp || typeof capApp.addListener !== 'function') return;

    capApp.addListener('backButton', () => {
        if (sideDrawer && !sideDrawer.classList.contains('closed')) {
            closeSideDrawer();
            return;
        }

        const calPop = document.getElementById('quick-calendar-popover');
        if (calPop && !calPop.classList.contains('hidden')) {
            calPop.classList.add('hidden');
            return;
        }

        if (fabMenu && !fabMenu.classList.contains('hidden')) {
            fabMenu.classList.add('hidden');
            fabBtn?.classList.remove('active');
            return;
        }

        if (isAnyModalOpen()) {
            attemptCloseModals();
            return;
        }

        const authOverlay = document.getElementById('auth-overlay');
        if (authOverlay && !authOverlay.classList.contains('hidden')) {
            const step2 = document.getElementById('welcome-step-2');
            if (step2 && !step2.classList.contains('hidden')) {
                document.getElementById('btn-welcome-back')?.click();
                return;
            }
            capApp.exitApp();
            return;
        }

        capApp.exitApp();
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNativeAndroidBackHandler);
} else {
    initNativeAndroidBackHandler();
}

// --- ENRUTADOR GLOBAL ÚNICO (MODALES, MENÚ LATERAL, ACORDEONES Y PERFIL) ---
document.addEventListener('click', async (e) => {
    // 0. Despachador CSP-Safe para comandos data-lumen-cmd (reemplazo seguro de onclick sin eval)
    const safeCmdEl = e.target.closest('[data-lumen-cmd]');
    if (safeCmdEl && window.LumenSecurity?.dispatchSafeCommand) {
        window.LumenSecurity.dispatchSafeCommand(safeCmdEl, e);
        return;
    }

    // 0.1 Copiar y cerrar modal de Clave de Recuperacion
    const copyRecBtn = e.target.closest('#btn-copy-recovery-code');
    if (copyRecBtn && lastGeneratedRecoveryCode) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(lastGeneratedRecoveryCode);
            } else {
                const textArea = document.createElement('textarea');
                textArea.value = lastGeneratedRecoveryCode;
                textArea.style.cssText = 'position:fixed;left:-999999px;';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            copyRecBtn.textContent = 'Copiado';
            setTimeout(() => { copyRecBtn.textContent = 'Copiar'; }, 2000);
        } catch {
            copyRecBtn.textContent = 'Error';
            setTimeout(() => { copyRecBtn.textContent = 'Copiar'; }, 2000);
        }
        return;
    }
    if (e.target.closest('#btn-done-recovery-modal')) {
        lastGeneratedRecoveryCode = '';
        document.getElementById('recovery-success-modal')?.classList.add('hidden');
        const hasRealData = Array.isArray(financeData?.transactions) && financeData.transactions.some(t => !t.isDeleted) && !financeData.isDemoMode;
        if (hasRealData && typeof window.openBentoConfirmModal === 'function') {
            setTimeout(() => {
                window.openBentoConfirmModal({
                    title: 'Verifica tu copia de seguridad',
                    subtitle: 'Recomendación Local-First',
                    message: 'Acabas de actualizar la seguridad de tu bóveda. Te recomendamos exportar ahora un respaldo cifrado <b>.lumen</b> y guardar tu Clave de Recuperación fuera de este dispositivo.',
                    confirmText: 'Exportar respaldo (.lumen)',
                    cancelText: 'Más tarde',
                    danger: false,
                    onConfirm: () => {
                        window.runLumenEncryptedExport?.();
                    }
                });
            }, 260);
        }
        return;
    }

    // 0.2 Apertura de Lumi con sincronizacion dinamica del chip CDT (reemplaza script inline en index.html)
    if (e.target.closest('#btn-open-lumi')) {
        const chip = document.getElementById('lumen-cdt-dynamic-chip');
        const lbl = document.getElementById('lumen-cdt-dynamic-chip-label');
        if (chip && lbl && typeof getCDTPortfolioInsights === 'function') {
            const hasActive = getCDTPortfolioInsights().cantidadActivos > 0;
            const nextQ = hasActive ? '¿Cómo van los rendimientos de mis CDTs?' : '¿Qué diferencia hay entre un CDT y CDAT?';
            chip.setAttribute('data-q', nextQ);
            lbl.textContent = nextQ;
        }
        if (typeof window.openLumenAssistant === 'function') {
            window.openLumenAssistant();
        }
        return;
    }

    // 0.3 Acciones delegadas de Papelera, #Tags y Banner de Nomina
    const restoreTrashBtn = e.target.closest('[data-trash-restore]');
    if (restoreTrashBtn) {
        window.restoreTxFromTrash?.(restoreTrashBtn.getAttribute('data-trash-restore'));
        return;
    }
    const permDelTrashBtn = e.target.closest('[data-trash-perm-del]');
    if (permDelTrashBtn) {
        window.permanentlyDeleteTx?.(permDelTrashBtn.getAttribute('data-trash-perm-del'));
        return;
    }
    const filterTagBtn = e.target.closest('[data-filter-tag]');
    if (filterTagBtn) {
        window.filterByTxTag?.(filterTagBtn.getAttribute('data-filter-tag'), e);
        return;
    }
    if (e.target.closest('#dismiss-payroll-quincena-banner')) {
        localStorage.removeItem('lumenPayrollQuincenaAlert');
        document.getElementById('payroll-quincena-inapp-banner')?.remove();
        return;
    }

    // 1. Cierre unificado de modales
    if (e.target.closest('.btn-close-modal') || e.target.id === 'universal-info-modal') {
        e.stopPropagation();
        attemptCloseModals();
        return;
    }

    // 2. Abrir / Cerrar Menú Lateral
    if (e.target.closest('#open-drawer-btn')) {
        e.stopPropagation();
        openSideDrawer();
        return;
    }
    if (e.target.closest('#close-drawer-btn') || e.target.closest('#side-drawer-backdrop')) {
        e.stopPropagation();
        closeSideDrawer();
        return;
    }

    // 3. Acordeones del Menú Lateral (gestionado por handler táctil/clic directo arriba)
    if (e.target.closest('.drawer-accordion-trigger')) {
        return;
    }

    // 4. Ítems del Menú Lateral y Sub-ítems (incluye Ayuda y Legal)
    const drawerItem = e.target.closest('.drawer-item, .drawer-sub-item, #drawer-version-btn');
    if (drawerItem && !drawerItem.classList.contains('drawer-accordion-trigger')) {
        e.stopPropagation();
        const id = drawerItem.id;
        closeSideDrawer();

        if (id === 'drawer-accounts') { if (attemptCloseModals()) document.getElementById('accounts-modal')?.classList.remove('hidden'); }
        else if (id === 'drawer-cards') { if (attemptCloseModals()) { document.getElementById('cards-modal')?.classList.remove('hidden'); renderCardsBreakdown(currentBalances); } }
        else if (id === 'drawer-debts') { if (attemptCloseModals()) { document.getElementById('debts-modal')?.classList.remove('hidden'); let totalLoansDebt = 0; financeData.customAccounts.forEach(acc => { if (acc.category === 'debt' && currentBalances[acc.id] > 0) totalLoansDebt = round2(totalLoansDebt + currentBalances[acc.id]); }); renderDebtsBreakdown(currentBalances, totalLoansDebt); } }
        else if (id === 'drawer-receivables') { if (attemptCloseModals()) openReceivablesModal(); }
        else if (id === 'drawer-debt-planner') { if (attemptCloseModals()) { document.getElementById('debt-planner-modal')?.classList.remove('hidden'); renderDebtPlanner(); } }
        else if (id === 'drawer-pockets') { if (attemptCloseModals()) { openSavingsSection('pockets'); } }
        else if (id === 'drawer-savings-calc') { if (attemptCloseModals()) { openSavingsSection('simulator'); } }
        else if (id === 'drawer-card-advisor') { if (attemptCloseModals()) { openCardAdvisorModal(); } }
        else if (id === 'drawer-smart-purchase') { if (attemptCloseModals()) { openSmartPurchaseModal(); } }
        else if (id === 'drawer-credit-sim') { if (attemptCloseModals()) { openCreditSimulatorModal(); } }
        else if (id === 'drawer-credit-compare') { if (attemptCloseModals()) { openCreditCompareModal(); } }
        else if (id === 'drawer-month-recap') { if (attemptCloseModals()) { openMonthlyRecapModal(); } }
        else if (id === 'drawer-budget') { if (attemptCloseModals()) { document.getElementById('budget-modal')?.classList.remove('hidden'); renderBudgetView(); setActiveNav(document.getElementById('nav-budget')); } }
        else if (id === 'drawer-expenses') { if (attemptCloseModals()) { document.getElementById('expenses-modal')?.classList.remove('hidden'); renderExpensesBreakdown(getMonthId(viewDate)); } }
        else if (id === 'drawer-subscriptions') { if (attemptCloseModals()) { document.getElementById('subscriptions-modal')?.classList.remove('hidden'); renderSubscriptionsView(); } }
        else if (id === 'drawer-trip-mode') { if (attemptCloseModals()) { document.getElementById('trip-mode-modal')?.classList.remove('hidden'); renderTripModeUI(); } }
        else if (id === 'drawer-salary') {
            if (attemptCloseModals()) {
                document.getElementById('profile-modal')?.classList.remove('hidden');
                document.getElementById('profile-main-view')?.classList.add('hidden');
                ['profile-tax-params-view', 'profile-theme-view', 'profile-currency-view', 'profile-notifications-view', 'profile-backup-view', 'profile-security-view'].forEach(x => document.getElementById(x)?.classList.add('hidden'));
                document.getElementById('profile-salary-view')?.classList.remove('hidden');
                if (typeof renderSalaryUI === 'function') renderSalaryUI(true);
            }
        }
        else if (id === 'drawer-trash' || id === 'drawer-trash-btn') {
            if (attemptCloseModals()) {
                const trashModal = document.getElementById('trash-modal');
                if (trashModal) {
                    document.body.appendChild(trashModal);
                    trashModal.classList.remove('hidden');
                    if (typeof renderTrashModal === 'function') renderTrashModal();
                }
            }
        }
        else if (id === 'drawer-health') { if (attemptCloseModals()) document.getElementById('widget-financial-health')?.click(); }
        else if (id === 'drawer-analytics') { if (attemptCloseModals()) { document.getElementById('analytics-modal')?.classList.remove('hidden'); setActiveNav(document.getElementById('nav-analytics')); } }
        else if (id === 'drawer-annual') { if (attemptCloseModals()) { document.getElementById('annual-control-modal')?.classList.remove('hidden'); annualViewYear = viewDate.getFullYear(); renderAnnualControlTable(); } }
        else if (id === 'drawer-assets') { if (attemptCloseModals()) { document.getElementById('assets-modal')?.classList.remove('hidden'); renderAssetsBreakdown(); } }
        else if (id === 'drawer-tax') {
            if (attemptCloseModals()) {
                document.getElementById('profile-modal')?.classList.remove('hidden');
                document.getElementById('profile-main-view')?.classList.add('hidden');
                document.querySelectorAll('#profile-modal .profile-body').forEach(v => v.classList.add('hidden'));
                document.getElementById('profile-tax-params-view')?.classList.remove('hidden');
                renderTaxParamsUI();
            }
        }
        else if (id === 'drawer-backup') {
            if (attemptCloseModals()) {
                document.getElementById('profile-modal')?.classList.remove('hidden');
                document.getElementById('profile-main-view')?.classList.add('hidden');
                document.querySelectorAll('#profile-modal .profile-body').forEach(v => v.classList.add('hidden'));
                document.getElementById('profile-backup-view')?.classList.remove('hidden');
            }
        }
        else if (id === 'drawer-version-btn' || id === 'drawer-help-about') { if (attemptCloseModals()) window.openUniversalInfoModal?.('about'); }
        else if (id === 'drawer-help-faq') { if (attemptCloseModals()) window.openUniversalInfoModal?.('faq'); }
        else if (id === 'drawer-help-terms') { if (attemptCloseModals()) window.openUniversalInfoModal?.('terms'); }
        else if (id === 'drawer-help-privacy') { if (attemptCloseModals()) window.openUniversalInfoModal?.('privacy'); }
        else if (id === 'drawer-system-storage') { if (attemptCloseModals()) window.openUniversalInfoModal?.('storage'); }
        else if (id === 'drawer-report-bug') { if (attemptCloseModals()) window.openUniversalInfoModal?.('bug'); }
        else if (id === 'drawer-share-app') {
            const rawUrl = window.location.href.split('#')[0].split('?')[0];
            const isPublicWeb = /^https?:\/\//i.test(rawUrl) && !/localhost|127\.0\.0\.1/i.test(rawUrl);
            const appUrl = isPublicWeb ? rawUrl : 'https://funcionif.github.io/mis-finanzas/index.html';

            const shareText = [
                'Gestiona tus finanzas personales de forma 100% privada y local con *Lumen • Función IF*',
                '',
                'Ábrela aquí:',
                appUrl,
                '',
                '*¿Cómo instalarla en tu celular?*',
                '• *iPhone (Safari):* Toca Compartir y selecciona *"Agregar a inicio"*.',
                '• *Android (Chrome):* Toca el menú (⋮) y selecciona *"Instalar aplicación"*.'
            ].join('\n');

            if (typeof navigator.share === 'function' && isPublicWeb) {
                try {
                    await navigator.share({ title: 'Lumen • Función IF', text: shareText });
                    return;
                } catch (err) {
                    if (err && err.name === 'AbortError') return;
                }
            }

            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(shareText);
                } else {
                    const tmp = document.createElement('textarea');
                    tmp.value = shareText;
                    tmp.style.cssText = 'position:fixed;opacity:0;';
                    document.body.appendChild(tmp);
                    tmp.select();
                    document.execCommand('copy');
                    document.body.removeChild(tmp);
                }
                alert('Enlace e instrucciones de instalación copiados al portapapeles.');
            } catch (err) {
                prompt('Copia este mensaje para compartir:', shareText);
            }
        }

        return;
    }

    // 4.5 Botón copiar diagnóstico técnico dentro del modal de reporte
    if (e.target.closest('#btn-copy-bug-diag')) {
        const diagText = document.getElementById('bug-diag-text-box')?.innerText || '';
        if (!diagText) return;
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(diagText);
            } else {
                const tmp = document.createElement('textarea');
                tmp.value = diagText;
                tmp.style.cssText = 'position:fixed;opacity:0;';
                document.body.appendChild(tmp);
                tmp.select();
                document.execCommand('copy');
                document.body.removeChild(tmp);
            }
            alert('¡Diagnóstico copiado al portapapeles!');
        } catch (err) {
            prompt('Copia este diagnóstico manualmente:', diagText);
        }
        return;
    }

    // 5. Navegación Dock Inferior, Perfil y Footers de Versión
    const navBtn = e.target.closest('.nav-item, #profile-trigger-btn, .profile-menu-btn, #shortcut-to-tax-params-btn, #home-version-btn, #profile-version-btn, #back-from-salary-btn, #back-from-tax-params-btn, #back-from-theme-btn, #back-from-currency-btn, #back-from-notifications-btn, #back-from-backup-btn, #back-from-security-btn');
    if (navBtn) {
        const id = navBtn.id;
        if (id === 'nav-home') { forceCloseAllModals(); setActiveNav(document.getElementById('nav-home')); }
        else if (id === 'nav-analytics') { if (attemptCloseModals()) { document.getElementById('analytics-modal')?.classList.remove('hidden'); setActiveNav(document.getElementById('nav-analytics')); } }
        else if (id === 'nav-budget') { if (attemptCloseModals()) { document.getElementById('budget-modal')?.classList.remove('hidden'); renderBudgetView(); setActiveNav(document.getElementById('nav-budget')); } }
        else if (id === 'home-version-btn' || id === 'profile-version-btn') { window.openUniversalInfoModal?.('about'); }
        else if (id === 'profile-trigger-btn') { if (attemptCloseModals()) { document.getElementById('profile-modal')?.classList.remove('hidden'); document.getElementById('profile-main-view')?.classList.remove('hidden'); ['profile-salary-view', 'profile-tax-params-view', 'profile-theme-view', 'profile-currency-view', 'profile-notifications-view', 'profile-backup-view', 'profile-security-view'].forEach(x => document.getElementById(x)?.classList.add('hidden')); } }
        else if (id === 'menu-salary-btn') { document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-salary-view')?.classList.remove('hidden'); renderSalaryUI(true); }
        else if (id === 'menu-tax-params-btn' || id === 'shortcut-to-tax-params-btn') { document.getElementById('profile-salary-view')?.classList.add('hidden'); document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-tax-params-view')?.classList.remove('hidden'); renderTaxParamsUI(); }
        else if (id === 'menu-theme-btn') { document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-theme-view')?.classList.remove('hidden'); }
        else if (id === 'menu-currency-btn') { document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-currency-view')?.classList.remove('hidden'); syncCurrencyPrefs(); }
        else if (id === 'menu-notifications-btn') { 
            document.getElementById('profile-main-view')?.classList.add('hidden'); 
            document.getElementById('profile-notifications-view')?.classList.remove('hidden'); 
            const prefs = getNotificationPrefs(); 
            document.getElementById('notif-days-before').value = prefs.daysBefore; 
            document.getElementById('notif-budget-pct').value = prefs.budgetPct; 
            document.getElementById('notif-pending-enabled').checked = !!prefs.pendingEnabled; 
            if(document.getElementById('pref-show-projections')) document.getElementById('pref-show-projections').checked = financeData.preferences?.showProjections !== false;
            if(document.getElementById('pref-remember-account')) document.getElementById('pref-remember-account').checked = financeData.preferences?.rememberAccount !== false;
            if(document.getElementById('pref-remember-category')) document.getElementById('pref-remember-category').checked = financeData.preferences?.rememberCategory !== false;
            syncDismissedAlertsButton(); 
        }
        else if (id === 'menu-backup-btn') { document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-backup-view')?.classList.remove('hidden'); }
        else if (id === 'menu-security-btn') { document.getElementById('profile-main-view')?.classList.add('hidden'); document.getElementById('profile-security-view')?.classList.remove('hidden'); syncUserUI(); }
        else if (id.startsWith('back-from-')) { ['profile-salary-view', 'profile-tax-params-view', 'profile-theme-view', 'profile-currency-view', 'profile-notifications-view', 'profile-backup-view', 'profile-security-view'].forEach(x => document.getElementById(x)?.classList.add('hidden')); document.getElementById('profile-main-view')?.classList.remove('hidden'); }
        return;
    }

});

// Sincronizar placeholder de Sueldo Básico con el SMMLV configurado en Parámetros Legales
const syncSalaryBasicPlaceholder = () => {
    const basicInput = document.getElementById('profile-basic-salary');
    if (!basicInput) return;
    const params = typeof getTaxParams === 'function' ? getTaxParams() : null;
    const smmlv = Number(params?.smmlv) || 1750905;
    basicInput.placeholder = `Ej. ${formatNumberInput(smmlv)}`;
};

const salaryViewEl = document.getElementById('profile-salary-view');
if (salaryViewEl) {
    new MutationObserver(() => {
        if (!salaryViewEl.classList.contains('hidden')) {
            syncSalaryBasicPlaceholder();
        }
    }).observe(salaryViewEl, { attributes: true, attributeFilter: ['class'] });
}

// Controlador único en fase de captura para apertura directa desde el botón flotante (+)
document.addEventListener('click', (e) => {
    const clickedFabBtn = e.target.closest('#fab-btn');
    if (clickedFabBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        clickedFabBtn.classList.remove('active');
        if (typeof openOmniModal === 'function') {
            openOmniModal({ type: 'expense' });
        }
    }
}, true);

// --- 6. ALERTAS INTELIGENTES, .ICS iOS Y AVISO PREVENTIVO DE RESPALDO ---
const getNotificationPrefs = () => {
    return financeData.notificationPrefs || { daysBefore: 5, budgetPct: 85, pendingEnabled: true };
};

const downloadIcsEvent = (title, description, dateObj) => {
    const blob = generateICSBlob(title, description, dateObj);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const rawFile = `${String(title || 'Recordatorio').replace(/[^a-zA-Z0-9_-]/g, '_')}.ics`;
    a.download = window.LumenSecurity?.sanitizeFileName
        ? window.LumenSecurity.sanitizeFileName(rawFile, 'recordatorio_lumen.ics')
        : rawFile;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const renderSmartAlerts = (monthId, snap) => {
    const container = document.getElementById('ios-alerts-container');
    if (!container) return;
    const prefs = getNotificationPrefs();
    const alerts = [];

    // --- ALERTA DE MEMORIA LOCAL-FIRST ---
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            const rawVal = localStorage.getItem(key) ?? localStorage[key] ?? '';
            totalBytes += ((String(rawVal).length + key.length) * 2);
        }
    }
    const storageKB = totalBytes / 1024;
    const storagePct = (storageKB / 5120) * 100;
    
    const currRealMonthId = getMonthId(currentDate);

    if (storagePct >= 80) {
        alerts.push({
            id: `storage_${currRealMonthId}`,
            title: `${renderIcon('database', 14)} Espacio Crítico`,
            desc: `Tu base de datos está al ${storagePct.toFixed(1)}%. Realiza un Cierre de Año pronto.`,
            actionLabel: 'Ver Memoria',
            onAction: () => { if (typeof openUniversalInfoModal === 'function') openUniversalInfoModal('storage'); }
        });
    }

    if (!financeData.isDemoMode && financeData.transactions.length > 0 && storagePct < 80) {
        const hasBackup = Boolean(financeData.lastBackupDate);
        const daysSinceBackup = hasBackup
            ? Math.floor((Date.now() - financeData.lastBackupDate) / (1000 * 3600 * 24))
            : null;

        if (!hasBackup || daysSinceBackup >= 30) {
            alerts.push({
                id: `backup_${currRealMonthId}`,
                title: `${renderIcon('archive', 14)} Respaldo preventivo`,
                desc: hasBackup
                    ? `Han pasado ${daysSinceBackup} días desde tu última copia.`
                    : 'Aún no has creado tu primera copia de seguridad.',
                actionLabel: 'Exportar Respaldo',
                onAction: () => document.getElementById('btn-export-data')?.click()
            });
        }
    }

    financeData.customAccounts.filter(a => a.category === 'credit_card').forEach(c => {
        const bal = round2(snap.bals[c.id] || 0);
        const nextDue = typeof getNextUnpaidLiabilityCycle === 'function'
            ? getNextUnpaidLiabilityCycle(c, bal, currentDate, 3)
            : null;
        if (nextDue && nextDue.diffDays <= prefs.daysBefore) {
            const payDate = new Date(nextDue.dueDate.getFullYear(), nextDue.dueDate.getMonth(), nextDue.dueDate.getDate(), 8, 30, 0);
            const daysLine = nextDue.diffDays < 0
                ? `Venció hace ${Math.abs(nextDue.diffDays)} día(s)`
                : (nextDue.diffDays === 0 ? `Hoy (día ${c.paymentDay})` : `En ${nextDue.diffDays} día(s) (día ${c.paymentDay})`);
            const balanceLine = `Saldo: ${formatMoney(bal)}`;
            const quotaLine = nextDue.amount > 0
                ? `<span style="display:block; margin-top:2px; color:var(--text-main); font-weight:700;">Mínimo: <b style="font-size:12.5px; font-weight:800;">${formatMoneyHtml(nextDue.amount)}</b></span>`
                : '';

            const cleanCard = stripLeadingEmoji(c.name);
            const escCard = window.escapeHtml ? window.escapeHtml(cleanCard) : cleanCard;
            alerts.push({
                id: `card_${c.id}_${toLocalIsoDateStr(payDate)}`,
                title: `${renderIcon('card', 14)} ${/^(tc\b|tarjeta\b)/i.test(cleanCard) ? escCard : `Tarjeta ${escCard}`}`,
                desc: `<span style="display:block; margin-top:2px;">${daysLine}</span><span style="display:block; margin-top:2px;">${balanceLine}</span>${quotaLine}`,
                actionLabel: `${renderIcon('calendar', 12)} Calendario`,
                onAction: () => downloadIcsEvent(`Pagar ${cleanCard}`, `Pago ${cleanCard} • Cuota mínima estimada: ${formatMoney(nextDue.amount)} • Saldo vigente: ${formatMoney(bal)}.`, payDate)
            });
        }
    });

    financeData.customAccounts.filter(a => a.category === 'debt' && !a.payrollDeduction && a.paymentDay).forEach(debt => {
        const bal = round2(snap.bals[debt.id] || 0);
        const maxWindow = debt.debtType === 'education' ? 7 : prefs.daysBefore;
        const nextDue = typeof getNextUnpaidLiabilityCycle === 'function'
            ? getNextUnpaidLiabilityCycle(debt, bal, currentDate, 5)
            : null;
        if (nextDue && nextDue.diffDays <= maxWindow) {
            const escDebt = window.escapeHtml ? window.escapeHtml(stripLeadingEmoji(debt.name)) : stripLeadingEmoji(debt.name);
            const iconKey = debt.debtType === 'education' ? 'award' : 'scale';
            const prefix = debt.debtType === 'education' ? 'Universidad' : 'Cuota';
            alerts.push({
                id: `debt_${debt.id}_${toLocalIsoDateStr(nextDue.dueDate)}`,
                title: `${renderIcon(iconKey, 14)} ${prefix}: ${escDebt}`,
                desc: nextDue.diffDays < 0
                    ? `Atrasada ${Math.abs(nextDue.diffDays)} día(s) • ${formatMoney(nextDue.amount)}`
                    : (nextDue.diffDays === 0 ? `¡Vence HOY! • ${formatMoney(nextDue.amount)}` : `Vence en ${nextDue.diffDays} día(s) • ${formatMoney(nextDue.amount)}`),
                actionLabel: 'Ver Detalle',
                onAction: () => { openAccountDetail(debt.id, 'home'); document.getElementById('open-pay-installment-btn')?.click(); }
            });
        }
    });

    if (financeData.subscriptions) {
    const escAlert = window.escapeHtml || ((s) => String(s ?? ''));
    financeData.subscriptions.filter(s => s.status === 'active').forEach(sub => {
        if (!sub.nextBillingDate) return;
        if (sub.nextBillingDate.startsWith(currRealMonthId) && typeof isRecurringPaidInMonth === 'function' && isRecurringPaidInMonth(sub, currRealMonthId)) {
            return;
        }
        const [y, m, d] = sub.nextBillingDate.split('-').map(Number);
        const nextDate = new Date(y, m - 1, d, 8, 30, 0);
        const diffDays = Math.ceil((nextDate - currentDate) / (1000 * 3600 * 24));
        const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount);
        const cleanSubTitle = escAlert(stripLeadingEmoji(sub.name));

        if (diffDays >= -5 && diffDays <= (sub.reminderDays || 3)) {
            alerts.push({
                id: `sub_${sub.id}_${sub.nextBillingDate}`,
                title: `${renderIcon('repeat', 14)} Recurrente: ${cleanSubTitle}`,
                desc: diffDays < 0 ? `Vencido hace ${Math.abs(diffDays)} día(s) • ${formatMoney(amtCop)}` : (diffDays === 0 ? `Vence hoy • ${formatMoney(amtCop)}` : `Vence en ${diffDays} día(s) • ${formatMoney(amtCop)}`),
                actionLabel: `${renderIcon('check', 12)} Pagar`,
                onAction: () => {
                    if (typeof window.openBentoConfirmModal === 'function') {
                        window.openBentoConfirmModal({
                            title: 'Confirmar pago recurrente',
                            subtitle: stripLeadingEmoji(sub.name),
                            message: `¿Registrar el pago de <b>${cleanSubTitle}</b> por <b>${formatMoney(amtCop)}</b> e imputarlo a su subcategoría actualizando el próximo cobro?`,
                            confirmText: 'Registrar pago',
                            cancelText: 'Cancelar',
                            danger: false,
                            onConfirm: () => {
                                if (typeof processSubscriptionPayment === 'function') processSubscriptionPayment(sub.id);
                            }
                        });
                    }
                }
            });
        }
    });
}

    // --- ALERTAS DE CDT Y CDAT ---
    if (typeof getCDTPortfolioInsights === 'function') {
        const escCdt = window.escapeHtml || ((s) => String(s ?? ''));
        const hideCdtAmounts = localStorage.getItem('myFinancesPrivacyMode') === 'true';
        const cdtInfo = getCDTPortfolioInsights(currentDate);
        
        cdtInfo.alertas.forEach(alerta => {
            if (alerta.tipo === 'vencido' || alerta.tipo === 'proximo_vencer' || alerta.tipo === 'corte_intereses') {
                const isVencido = alerta.tipo === 'vencido';
                
                // Id único combinando tipo, mes y una firma de la alerta
                const alertId = `cdt_${alerta.tipo}_${currRealMonthId}_${String(alerta.titulo || '').replace(/[^a-zA-Z0-9]/g, '').substring(0,8)}`;
                
                let iconName = 'clock';
                if (isVencido) iconName = 'alert';
                if (alerta.tipo === 'corte_intereses') iconName = 'trending-up';

                const rawMsg = hideCdtAmounts
                    ? String(alerta.mensaje || '').replace(/\+?\$\s?[\d.,]+/g, '$ ****')
                    : String(alerta.mensaje || '');

                alerts.push({
                    id: alertId,
                    title: `${renderIcon(iconName, 14)} ${escCdt(alerta.titulo)}`,
                    desc: escCdt(rawMsg),
                    actionLabel: 'Ver CDT',
                    onAction: () => {
                        document.getElementById('drawer-cdt')?.click();
                    }
                });
            }
        });
    }

    // --- ALERTAS DE CUOTA DE MANEJO EN CUENTAS BANCARIAS ---
    if (typeof evaluateAccountMgmtFeeCycle === 'function') {
        const escFee = window.escapeHtml || ((s) => String(s ?? ''));
        const todayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
        (financeData.customAccounts || []).filter(a => isAccountMgmtFeeEligible(a) && a.hasMgmtFee).forEach(acc => {
            const st = evaluateAccountMgmtFeeCycle(acc, currRealMonthId, snap, currentDate);
            if (!st.enabled || st.status !== 'pending' || !st.dueDate) return;
            const cleanDue = new Date(st.dueDate.getFullYear(), st.dueDate.getMonth(), st.dueDate.getDate());
            const diffDays = Math.round((cleanDue.getTime() - todayStart.getTime()) / 86400000);
            const showInsuff = st.insufficientFunds && st.isDueOrPast && !st.isBeforeConfig;
            if (!showInsuff && (diffDays < -5 || diffDays > (prefs.daysBefore || 3))) return;

            const cleanAcc = stripLeadingEmoji(acc.name);
            const whenTxt = diffDays < 0 ? `venció hace ${Math.abs(diffDays)} día(s)` : (diffDays === 0 ? 'se cobra hoy' : `se cobra en ${diffDays} día(s)`);
            const descTxt = showInsuff
                ? `Saldo insuficiente en ${escFee(cleanAcc)} (${formatMoney(st.balance)}) para debitar ${formatMoney(st.amount)}.`
                : `Cuota de manejo de ${escFee(cleanAcc)} (${formatMoney(st.amount)}) ${whenTxt}.`;

            alerts.push({
                id: `accmgmt_${acc.id}_${currRealMonthId}`,
                title: `${renderIcon(showInsuff ? 'alert' : 'bank', 14)} ${showInsuff ? 'Saldo insuficiente • Manejo' : 'Cuota de manejo próxima'}`,
                desc: descTxt,
                actionLabel: 'Cobrar',
                onAction: () => {
                    window.openBentoConfirmModal?.({
                        title: 'Descontar cuota de manejo',
                        subtitle: cleanAcc,
                        message: `¿Descontar <b>${formatMoney(st.amount)}</b> de <b>${escFee(cleanAcc)}</b> correspondiente a ${currRealMonthId}?`,
                        confirmText: 'Descontar ahora',
                        cancelText: 'Cancelar',
                        danger: false,
                        onConfirm: () => {
                            const res = chargeAccountMgmtFee(acc.id, currRealMonthId, { allowManualOverride: true });
                            if (res.ok) updateDashboard();
                        }
                    });
                }
            });
        });
    }

    // --- ALERTA PREVENTIVA TOPE EXENTO 4x1000 (80% DE 350 / 65 UVT) ---
    if (typeof getGmfAccountInfo === 'function' && typeof getMonthlyGmfUsedOutflows === 'function') {
        const escGmf = window.escapeHtml || ((s) => String(s ?? ''));
        (financeData.customAccounts || []).forEach(acc => {
            if (acc.category !== 'asset' || acc.id === 'Efectivo' || String(acc.id).startsWith('CxC_')) return;
            const info = getGmfAccountInfo(acc);
            if (!info.applies || !info.isExempt || info.monthlyCapCop <= 0) return;

            const used = getMonthlyGmfUsedOutflows(acc.id, currRealMonthId);
            const pct = Math.round((used / info.monthlyCapCop) * 100);
            if (pct >= 80) {
                const rem = Math.max(0, round2(info.monthlyCapCop - used));
                const safeAccName = escGmf(stripLeadingEmoji(acc.name));
                alerts.push({
                    id: `gmf_cap_${acc.id}_${currRealMonthId}_${pct >= 100 ? '100' : '80'}`,
                    title: pct >= 100
                        ? `${renderIcon('alert', 14)} Tope 4x1000 superado (${safeAccName})`
                        : `${renderIcon('shield', 14)} Tope 4x1000 al ${pct}% (${safeAccName})`,
                    desc: pct >= 100
                        ? `Superaste las ${info.capUvt} UVT exentas este mes (${formatMoney(used)}). Los próximos retiros gravarán 0,4%.`
                        : `Has movido ${formatMoney(used)} de ${formatMoney(info.monthlyCapCop)} (${info.capUvt} UVT). Te quedan ${formatMoney(rem)} libres de 4x1000.`,
                    actionLabel: 'Ver cuenta',
                    onAction: () => openAccountDetail(acc.id, 'home')
                });
            }
        });
    }

    if (typeof getAllUpcomingAssetObligations === 'function') {
        const escAsset = window.escapeHtml || ((s) => String(s ?? ''));
        getAllUpcomingAssetObligations(30, currentDate).forEach(({ assetId, assetName, obligation, metrics }) => {
            // Si ya está sincronizada como recurrente activo, evita duplicar la alerta
            const hasActiveRec = obligation.linkedSubscriptionId && (financeData.subscriptions || []).some(
                s => String(s.id) === String(obligation.linkedSubscriptionId) && s.status === 'active'
            );
            if (hasActiveRec) return;

            const isDiscountUrgent = metrics.hasActiveDiscount && metrics.daysToDiscount <= 15;
            const descTxt = isDiscountUrgent
                ? `Pronto pago (-${metrics.discPct}%) en ${metrics.daysToDiscount}d • ${formatMoney(metrics.discAmount)}`
                : (metrics.daysToDue < 0
                    ? `Venció hace ${Math.abs(metrics.daysToDue)}d • ${formatMoney(metrics.effectiveTargetAmount)}`
                    : (metrics.daysToDue === 0
                        ? `Vence hoy • ${formatMoney(metrics.effectiveTargetAmount)}`
                        : `Vence en ${metrics.daysToDue}d • ${formatMoney(metrics.effectiveTargetAmount)}`));

            alerts.push({
                id: `asset_ob_${obligation.id}_${obligation.dueDate}`,
                title: `${renderIcon('calendar', 14)} ${escAsset(obligation.label)} (${escAsset(stripLeadingEmoji(assetName))})`,
                desc: descTxt,
                actionLabel: 'Ver Activo',
                onAction: () => { if (typeof openAssetDetail === 'function') openAssetDetail(assetId); }
            });
        });
    }

    let totalPlannedExp = 0, totalSpentExp = 0, totalRefundAlertExp = 0;
    const mIdx = viewDate.getMonth();
    const vYear = viewDate.getFullYear();
    financeData.categories.expense.forEach(cat => { totalPlannedExp = round2(totalPlannedExp + getCategoryLimitForMonth(cat, mIdx, vYear)); });
    financeData.transactions.forEach(t => {
        if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion') || t.isTripIsolated || getTxMonthId(t) !== monthId || t.isAdjustment || !isTxClosed(t)) return;
        if (t.type === 'expense') {
            totalSpentExp = round2(totalSpentExp + round2(t.amount));
        } else if (t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) {
            totalRefundAlertExp = round2(totalRefundAlertExp + round2(t.amount));
        }
    });
    totalSpentExp = Math.max(0, round2(totalSpentExp - totalRefundAlertExp));
    
    if (totalPlannedExp > 0) {
        const pct = Math.round((totalSpentExp / totalPlannedExp) * 100);
        if (pct >= prefs.budgetPct) {
            alerts.push({
                id: `budget_${monthId}_${pct >= 100 ? '100' : prefs.budgetPct}`,
                title: pct >= 100 ? `${renderIcon('alert', 14)} Presupuesto excedido` : `${renderIcon('alert', 14)} Presupuesto al ${pct}%`,
                desc: `Has gastado ${formatMoney(totalSpentExp)} de ${formatMoney(totalPlannedExp)} este mes.`,
                actionLabel: 'Ver detalle',
                onAction: () => { document.getElementById('budget-modal')?.classList.remove('hidden'); renderBudgetView(); }
            });
        }
    }

    if (prefs.pendingEnabled) {
        const pendingCount = financeData.transactions.filter(t => !t.isDeleted && getTxMonthId(t) === monthId && t.status === 'pending').length;
        if (pendingCount > 0 && monthId === currRealMonthId) {
            alerts.push({
                id: `pending_${monthId}_${pendingCount}`,
                title: `${renderIcon('clock', 14)} ${pendingCount} pendiente(s)`,
                desc: 'Tienes pagos o ingresos programados por confirmar este mes.',
                actionLabel: 'Filtrar',
                onAction: () => {
                    activeHistoryFilter = 'pending';
                    document.querySelectorAll('.pill-btn[data-filter]').forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === 'pending'));
                    updateDashboard();
                }
            });
        }
    }

    const dismissedList = Array.isArray(financeData.dismissedAlerts) ? financeData.dismissedAlerts : [];
    const activeAlerts = alerts.filter(al => !dismissedList.includes(al.id));

    if (activeAlerts.length === 0) {
        container.classList.add('hidden');
        container.innerHTML = '';
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = '';
    const visibleAlerts = activeAlerts.slice(0, 3);
    const hasMultiple = visibleAlerts.length >= 2;

    if (hasMultiple) {
        const grid = document.createElement('div');
        grid.className = 'upcoming-bento-grid';
        visibleAlerts.forEach((al, idx) => {
            const card = document.createElement('div');
            card.className = `upcoming-bento-card ${idx === 0 ? 'soonest' : ''}`;
            card.innerHTML = `
                <div class="upcoming-bento-top">
                    <span class="upcoming-bento-tag">${idx === 0 ? 'Más próximo' : 'Aviso'}</span>
                    <button type="button" class="btn-dismiss-alert" title="Marcar como leída" aria-label="Marcar como leída">${renderIcon('check', 13)}</button>
                </div>
                <strong style="display:flex; align-items:center; gap:4px;">${al.title}</strong>
                <small>${al.desc}</small>
                <button type="button" class="btn-download-ics" style="display:flex; align-items:center; justify-content:center; gap:4px;">${al.actionLabel}</button>
            `;
            card.querySelector('.btn-dismiss-alert').addEventListener('click', (e) => {
                e.stopPropagation();
                dismissSmartAlert(al.id);
                updateDashboard();
            });
            card.querySelector('.btn-download-ics').addEventListener('click', al.onAction);
            grid.appendChild(card);
        });
        container.appendChild(grid);
    } else {
        visibleAlerts.forEach(al => {
            const div = document.createElement('div');
            div.className = 'ios-alert-banner';
            div.innerHTML = `
                <div class="ios-alert-info">
                    <strong style="display:flex; align-items:center; gap:4px;">${al.title}</strong>
                    <small>${al.desc}</small>
                </div>
                <div class="ios-alert-actions">
                    <button type="button" class="btn-download-ics" style="display:flex; align-items:center; justify-content:center; gap:4px;">${al.actionLabel}</button>
                    <button type="button" class="btn-dismiss-alert" title="Marcar como leída" aria-label="Marcar como leída">${renderIcon('check', 14)}</button>
                </div>
            `;
            div.querySelector('.btn-download-ics').addEventListener('click', al.onAction);
            div.querySelector('.btn-dismiss-alert').addEventListener('click', (e) => {
                e.stopPropagation();
                dismissSmartAlert(al.id);
                updateDashboard();
            });
            container.appendChild(div);
        });
    }
};

const syncDismissedAlertsButton = () => {
    const restoreBtn = document.getElementById('btn-restore-dismissed-alerts');
    if (!restoreBtn) return;
    const count = Array.isArray(financeData.dismissedAlerts) ? financeData.dismissedAlerts.length : 0;
    restoreBtn.classList.toggle('hidden', count === 0);
    if (count > 0) {
        restoreBtn.innerText = `Restaurar avisos silenciados (${count})`;
    }
};

document.getElementById('btn-restore-dismissed-alerts')?.addEventListener('click', () => {
    financeData.dismissedAlerts = [];
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    syncDismissedAlertsButton();
    updateDashboard();
});
// --- 7. TABLERO PERSONALIZABLE (ORDEN DE WIDGETS) ---
const DEFAULT_WIDGET_ORDER = ['cash-flow', 'upcoming-7d', 'summary-rings', 'budget-preview', 'balance-sheet', 'credit-cards', 'debts-summary', 'history-list'];
const DEFAULT_ANALYTICS_ORDER = ['analytics-networth', 'analytics-cashflow', 'analytics-balancesheet', 'analytics-daily', 'analytics-donut', 'analytics-tags', 'analytics-ant'];

let analyticsOrder = [];

const applyWidgetOrder = () => {
    // 1. Dashboard Principal
    const container = document.getElementById('dashboard-widgets-container');
    if (container) {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem('myFinancesWidgetOrder') || 'null'); } catch { saved = null; }
        widgetOrder = Array.isArray(saved) && saved.length > 0 ? saved : [...DEFAULT_WIDGET_ORDER];
        DEFAULT_WIDGET_ORDER.forEach(id => { if (!widgetOrder.includes(id)) widgetOrder.push(id); });

        widgetOrder.forEach(id => {
            const el = container.querySelector(`[data-widget-id="${id}"]`);
            if (el) container.appendChild(el);
        });
    }

    // 2. Modal de Análisis Financiero
    const analyticsContainer = document.getElementById('analytics-widgets-container');
    if (analyticsContainer) {
        let savedAnalytics = null;
        try { savedAnalytics = JSON.parse(localStorage.getItem('myFinancesAnalyticsOrder') || 'null'); } catch { savedAnalytics = null; }
        analyticsOrder = Array.isArray(savedAnalytics) && savedAnalytics.length > 0 ? savedAnalytics : [...DEFAULT_ANALYTICS_ORDER];
        DEFAULT_ANALYTICS_ORDER.forEach(id => { if (!analyticsOrder.includes(id)) analyticsOrder.push(id); });

        analyticsOrder.forEach(id => {
            const el = analyticsContainer.querySelector(`[data-analytics-id="${id}"]`);
            if (el) analyticsContainer.appendChild(el);
        });
    }
};

const WIDGET_NAMES = {
    'cash-flow': 'Flujo de Caja',
    'upcoming-7d': 'Próximos 7 Días',
    'summary-rings': 'Metas y Salud',
    'budget-preview': 'Presupuesto',
    'balance-sheet': 'Hoja de Balance',
    'credit-cards': 'Tarjetas',
    'debts-summary': 'Préstamos',
    'history-list': 'Movimientos',
    'analytics-networth': 'Patrimonio Neto',
    'analytics-cashflow': 'Flujo de Caja',
    'analytics-balancesheet': 'Hoja de Balance',
    'analytics-daily': 'Resumen Diario',
    'analytics-donut': 'Distribución de Gastos',
    'analytics-tags': 'Proyectos (#Tags)',
    'analytics-ant': 'Gastos Hormiga y Suscripciones'
};

const refreshEditControlsLimits = (containerId = 'dashboard-widgets-container', selectorAttr = 'data-widget-id') => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const visibleEls = Array.from(container.querySelectorAll(`[${selectorAttr}]`)).filter(el => !el.classList.contains('hidden'));
    visibleEls.forEach((el, idx) => {
        const upBtn = el.querySelector('.widget-move-btn[data-dir="-1"]');
        const downBtn = el.querySelector('.widget-move-btn[data-dir="1"]');
        if (upBtn) upBtn.disabled = (idx === 0);
        if (downBtn) downBtn.disabled = (idx === visibleEls.length - 1);
    });
};

const moveWidgetByOffset = (widgetId, delta, isAnalytics = false) => {
    const containerId = isAnalytics ? 'analytics-widgets-container' : 'dashboard-widgets-container';
    const attrName = isAnalytics ? 'data-analytics-id' : 'data-widget-id';
    const container = document.getElementById(containerId);
    if (!container) return;

    const visibleIds = Array.from(container.querySelectorAll(`[${attrName}]`))
        .filter(el => !el.classList.contains('hidden'))
        .map(el => el.getAttribute(attrName));

    const visIdx = visibleIds.indexOf(widgetId);
    const targetVisIdx = visIdx + delta;
    if (visIdx === -1 || targetVisIdx < 0 || targetVisIdx >= visibleIds.length) return;

    const targetId = visibleIds[targetVisIdx];
    const targetArr = isAnalytics ? analyticsOrder : widgetOrder;
    const storageKey = isAnalytics ? 'myFinancesAnalyticsOrder' : 'myFinancesWidgetOrder';

    const fromIdx = targetArr.indexOf(widgetId);
    const toIdx = targetArr.indexOf(targetId);
    
    // Intercambiar en el array
    const temp = targetArr[fromIdx];
    targetArr[fromIdx] = targetArr[toIdx];
    targetArr[toIdx] = temp;
    
    localStorage.setItem(storageKey, JSON.stringify(targetArr));
    applyWidgetOrder();
    refreshEditControlsLimits(containerId, attrName);
};

const toggleDashboardEditMode = (forceState = null) => {
    isDashboardEditMode = forceState !== null ? forceState : !isDashboardEditMode;
    const dashContainer = document.getElementById('dashboard-widgets-container');
    const analyticsContainer = document.getElementById('analytics-widgets-container');
    const toggleBtn = document.getElementById('toggle-edit-widgets-btn');
    const analyticsToggleBtn = document.getElementById('toggle-edit-analytics-btn');

    if (toggleBtn) toggleBtn.innerText = isDashboardEditMode ? '✓ Listo' : 'Ordenar';
    if (analyticsToggleBtn) analyticsToggleBtn.innerText = isDashboardEditMode ? '✓ Listo' : 'Ordenar';

    document.getElementById('floating-done-edit-btn')?.remove();
    if (isDashboardEditMode) {
        const donePill = document.createElement('button');
        donePill.id = 'floating-done-edit-btn';
        donePill.type = 'button';
        donePill.className = 'floating-done-edit-btn';
        donePill.innerText = '✓ Listo';
        donePill.onclick = () => toggleDashboardEditMode(false);
        document.body.appendChild(donePill);
    }

    const attachControls = (container, isAnalytics) => {
        if (!container) return;
        const attrName = isAnalytics ? 'data-analytics-id' : 'data-widget-id';
        container.querySelectorAll(`[${attrName}]`).forEach(el => {
            const wId = el.getAttribute(attrName);
            const oldControls = el.querySelector('.widget-edit-controls');
            if (oldControls) oldControls.remove();

            if (isDashboardEditMode) {
                el.classList.add('edit-mode');
                const bar = document.createElement('div');
                bar.className = 'widget-edit-controls';
                bar.innerHTML = `
                    <span class="widget-edit-label">⠿ ${WIDGET_NAMES[wId] || 'Bloque'}</span>
                    <div class="widget-edit-btns">
                        <button type="button" class="widget-move-btn" data-dir="-1">▲ Subir</button>
                        <button type="button" class="widget-move-btn" data-dir="1">▼ Bajar</button>
                    </div>
                `;
                bar.querySelectorAll('button').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        moveWidgetByOffset(wId, parseInt(btn.getAttribute('data-dir'), 10), isAnalytics);
                    });
                });
                el.prepend(bar);
            } else {
                el.classList.remove('edit-mode');
            }
        });
    };

    attachControls(dashContainer, false);
    attachControls(analyticsContainer, true);

    if (isDashboardEditMode) {
        refreshEditControlsLimits('dashboard-widgets-container', 'data-widget-id');
        refreshEditControlsLimits('analytics-widgets-container', 'data-analytics-id');
    }
};

const initDashboardDragAndControls = () => {
    document.getElementById('toggle-edit-widgets-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDashboardEditMode();
    });
    document.getElementById('toggle-edit-analytics-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDashboardEditMode();
    });

    const savingsWidget = document.getElementById('widget-savings-goals');
    if (savingsWidget && !savingsWidget.dataset.bound) {
        savingsWidget.dataset.bound = '1';
        savingsWidget.addEventListener('click', () => {
            if (isDashboardEditMode) return;
            if (attemptCloseModals()) {
                if (typeof openSavingsSection === 'function') {
                    openSavingsSection('pockets');
                } else {
                    document.getElementById('pockets-modal')?.classList.remove('hidden');
                    renderPocketsView();
                }
            }
        });
    }
};

// --- 8. SELECTORES DE CUENTAS (CON BOLSILLOS) Y CATEGORÍAS ---
const renderAccountSelects = (onlyAssetsForMain = false, forcedSelectedId = null) => {
    const accountSelect = document.getElementById('account');
    const toAccountSelect = document.getElementById('to-account');
    if (!accountSelect) return;

    const prevFrom = forcedSelectedId || accountSelect.value;
    const prevTo = toAccountSelect ? toAccountSelect.value : '';

    const allAssets = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'asset'));
    const standardAssets = allAssets.filter(a => !a.id.startsWith('CxC_'));
    const editTxId = document.getElementById('edit-id')?.value || '';
    const editingTx = editTxId ? (financeData.transactions || []).find(t => String(t.id) === String(editTxId)) : null;
    const keepCxcIds = new Set(
        [editingTx?.account, editingTx?.toAccount].filter(id => id && String(id).startsWith('CxC_'))
    );
    const cxcAssets = allAssets.filter(a =>
        a.id.startsWith('CxC_') &&
        (round2(currentBalances[a.id] || 0) > 0 || keepCxcIds.has(a.id))
    );
    
    const cards = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'credit_card'));
    const revolvingDebts = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'debt' && a.debtType === 'revolving'));
    const activeFixedDebts = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'debt' && a.debtType !== 'revolving' && currentBalances[a.id] > 0));
    const pockets = [...(financeData.pockets || [])].sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

    const buildOptionsHtml = (includeLiabilities = true, includePockets = false, forExpenseOrigin = false) => {
        const escOpt = window.escapeHtml || ((s) => String(s ?? ''));
        const escAttr = window.escapeAttr || escOpt;
        let html = '';
        if (standardAssets.length > 0) {
            html += `<optgroup label="Liquidez (Cuentas y Efectivo)">`;
            standardAssets.forEach(a => { html += `<option value="${escAttr(a.id)}">${escOpt(stripLeadingEmoji(a.name))}${a.isDefault ? ' ★' : ''}</option>`; });
            html += `</optgroup>`;
        }
        if (cxcAssets.length > 0) {
            html += `<optgroup label="Deudas a Favor (Por Cobrar)">`;
            cxcAssets.forEach(a => { html += `<option value="${escAttr(a.id)}">${escOpt(stripLeadingEmoji(a.name))}</option>`; });
            html += `</optgroup>`;
        }
        if (includePockets && pockets.length > 0) {
            html += `<optgroup label="Bolsillos de Ahorro">`;
            pockets.forEach(p => {
                const bal = round2((p.principal || 0) + (p.yields || 0));
                html += `<option value="${escAttr(p.id)}">${escOpt(stripLeadingEmoji(p.name))} (${formatCompact(bal)})</option>`;
            });
            html += `</optgroup>`;
        }
        if (includeLiabilities && cards.length > 0) {
            html += `<optgroup label="Tarjetas de Crédito">`;
            cards.forEach(c => { html += `<option value="${escAttr(c.id)}">${escOpt(stripLeadingEmoji(c.name))}${c.isDefault ? ' ★' : ''}</option>`; });
            html += `</optgroup>`;
        }
        if (includeLiabilities && revolvingDebts.length > 0) {
            const visibleRev = forExpenseOrigin ? revolvingDebts : revolvingDebts.filter(d => currentBalances[d.id] > 0 || !forExpenseOrigin);
            if (visibleRev.length > 0) {
                html += `<optgroup label="Cupos Rotativos / BNPL">`;
                visibleRev.forEach(d => { html += `<option value="${escAttr(d.id)}">${escOpt(stripLeadingEmoji(d.name))}</option>`; });
                html += `</optgroup>`;
            }
        }
        if (includeLiabilities && !forExpenseOrigin && activeFixedDebts.length > 0) {
            html += `<optgroup label="Préstamos">`;
            activeFixedDebts.forEach(d => { html += `<option value="${escAttr(d.id)}">${escOpt(stripLeadingEmoji(d.name))}</option>`; });
            html += `</optgroup>`;
        }
        return html;
    };

    const isTransfer = typeSelect && typeSelect.value === 'transfer';
    const isExpense = typeSelect && typeSelect.value === 'expense';
    const isIncome = typeSelect && typeSelect.value === 'income';
    accountSelect.innerHTML = buildOptionsHtml(!onlyAssetsForMain, isTransfer || isExpense || isIncome, isExpense);
    if (prevFrom && Array.from(accountSelect.options).some(o => o.value === String(prevFrom))) {
        accountSelect.value = String(prevFrom);
    }

    if (toAccountSelect) {
        toAccountSelect.innerHTML = buildOptionsHtml(true, true, false);
        if (prevTo && Array.from(toAccountSelect.options).some(o => o.value === String(prevTo))) {
            toAccountSelect.value = String(prevTo);
        } else if (pockets.length > 0 && isTransfer) {
            const alternatives = Array.from(toAccountSelect.options).filter(o => o.value !== accountSelect.value);
            if (alternatives.length > 0) toAccountSelect.value = alternatives[0].value;
        }
    }
};

const renderCategoryOptions = (type = 'expense') => {
    const catSelect = document.getElementById('trans-category');
    if (!catSelect || type === 'transfer') return;
    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;
    const list = [...(financeData.categories[type] || [])].filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    let html = '';

    if (list.length === 0) {
        html = `<option value="">Crea una categoría en la pestaña Presupuesto</option>`;
    } else {
        html = `<option value="">Seleccionar categoría...</option>`;
        list.forEach(cat => {
            const labelCat = esc(cleanCatName(cat.name));
            const labelCatAttr = escA(cleanCatName(cat.name));
            const rawCatAttr = escA(cat.name);
            const activeSubs = Array.isArray(cat.subcategories)
                ? [...cat.subcategories].filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }))
                : [];
            if (activeSubs.length > 0) {
                html += `<optgroup label="${labelCatAttr}">`;
                html += `<option value="${rawCatAttr}::General">${labelCat} (General)</option>`;
                activeSubs.forEach(sub => {
                    html += `<option value="${rawCatAttr}::${escA(sub.name)}">↳ ${esc(cleanCatName(sub.name))}</option>`;
                });
                html += `</optgroup>`;
            } else {
                html += `<option value="${rawCatAttr}::General">${labelCat}</option>`;
            }
        });
    }
    catSelect.innerHTML = html;
};
// --- 9. DASHBOARD PRINCIPAL Y CALENDARIO ---
window.updateDashboard = () => {
    const nowReal = new Date();
    if (currentDate.toDateString() !== nowReal.toDateString()) {
        currentDate = nowReal;
    }
    const viewMonthId = getMonthId(viewDate);
    const currentMonthId = getMonthId(currentDate);
    const isFuture = viewMonthId > currentMonthId;
    if (typeof processAutoAccountMgmtFees === 'function') {
        try { processAutoAccountMgmtFees(currentDate); } catch (e) { console.error(e); }
    }

    if (document.getElementById('current-month-display')) document.getElementById('current-month-display').innerText = formatMonthName(viewDate);
    // Lógica para mostrar días restantes solo en el mes actual
    const daysBar = document.getElementById('days-remaining-bar');
    const daysMonthEl = document.getElementById('days-left-month');
    const daysYearEl = document.getElementById('days-left-year');
    
    if (daysBar && daysMonthEl && daysYearEl) {
        const isCurrentMonth = viewDate.getMonth() === currentDate.getMonth() && viewDate.getFullYear() === currentDate.getFullYear();
        
        if (isCurrentMonth) {
            const startOfToday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
            
            // Días restantes del mes (+1 para contar el día actual)
            const lastDayOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth() + 1, 0);
            const daysLeftMonth = lastDayOfMonth.getDate() - startOfToday.getDate() + 1;
            
            // Días restantes del año (+1 para contar el día actual, exacto de medianoche a medianoche)
            const lastDayOfYear = new Date(startOfToday.getFullYear(), 11, 31);
            const daysLeftYear = Math.round((lastDayOfYear.getTime() - startOfToday.getTime()) / 86400000) + 1;
            
            daysMonthEl.innerText = `Faltan ${daysLeftMonth} día${daysLeftMonth === 1 ? '' : 's'} del mes`;
            daysYearEl.innerText = `Faltan ${daysLeftYear} día${daysLeftYear === 1 ? '' : 's'} del año`;
            
            daysBar.classList.remove('hidden');
        } else {
            daysBar.classList.add('hidden');
        }
    }
    if (document.getElementById('quick-month-input')) document.getElementById('quick-month-input').value = viewMonthId;
    if (document.getElementById('analytics-month-label')) document.getElementById('analytics-month-label').innerText = formatMonthName(viewDate);

    document.querySelectorAll('#quick-jump-pills .pill-btn').forEach(btn => {
        const offset = parseInt(btn.getAttribute('data-offset'), 10);
        const targetD = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
        btn.classList.toggle('active', getMonthId(targetD) === viewMonthId);
    });

    const badge = document.getElementById('period-status-badge');
    const todayBtn = document.getElementById('today-month-btn');
    if (badge && todayBtn) {
        if (selectedCalendarDay) { badge.innerText = `Día: ${selectedCalendarDay.split('-')[2]}`; badge.className = 'period-badge day'; todayBtn.classList.remove('hidden'); }
        else if (isFuture) { badge.innerText = 'Proyección'; badge.className = 'period-badge future'; todayBtn.classList.remove('hidden'); }
        else if (viewMonthId < currentMonthId) { badge.innerText = 'Histórico'; badge.className = 'period-badge past'; todayBtn.classList.remove('hidden'); }
        else { badge.innerText = 'Actual'; badge.className = 'period-badge'; todayBtn.classList.add('hidden'); }
    }

    const currSnap = computeBalancesUpTo(viewMonthId);
    currentBalances = currSnap.bals;
    const prevDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
    const prevSnap = computeBalancesUpTo(getMonthId(prevDate));

    const headerLiquidTotal = round2(
        financeData.customAccounts
            .filter(a => a.category === 'asset' && !a.id.startsWith('CxC_') && a.excludeFromLiquidity !== true)
            .reduce((sum, a) => sum + round2(currSnap.bals[a.id] || 0), 0)
    );
    const headerBalEl = document.getElementById('net-worth-header');
    if (headerBalEl) {
        headerBalEl.innerHTML = formatMoneyHtml(headerLiquidTotal);
        headerBalEl.style.color = headerLiquidTotal < 0 ? 'var(--negative)' : 'var(--text-main)';
        fitAmountTextSize(headerBalEl, headerLiquidTotal, 18, 11.5);
    }

    const headerLiqBtn = document.getElementById('header-liquidity-trigger');
    if (headerLiqBtn && !headerLiqBtn.dataset.bound) {
        headerLiqBtn.dataset.bound = '1';
        headerLiqBtn.addEventListener('click', () => document.getElementById('drawer-accounts')?.click());
    }

    const bsCutoffEl = document.getElementById('bs-cutoff-badge');
    if (bsCutoffEl) {
        const now = new Date();
        const realCurrId = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const activeMonthId = document.getElementById('quick-month-input')?.value || realCurrId;

        if (!bsCutoffEl.dataset.histBound) {
            bsCutoffEl.dataset.histBound = '1';
            bsCutoffEl.style.cursor = 'pointer';
            bsCutoffEl.title = 'Toca para consultar la Hoja de Balance en otra fecha';
            bsCutoffEl.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof toggleBalanceSheetDatePicker === 'function') toggleBalanceSheetDatePicker();
            });
        }

        if (window.bsHistoricalDateStr) {
            const [hy, hm, hd] = window.bsHistoricalDateStr.split('-').map(Number);
            const hDate = new Date(hy, hm - 1, hd);
            const mShort = hDate.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
            bsCutoffEl.innerHTML = `${renderIcon('calendar', 11)} ${hd} ${mShort}. ${String(hy).slice(-2)}`;
            bsCutoffEl.style.borderColor = 'var(--accent)';
            bsCutoffEl.style.color = 'var(--accent)';
        } else if (activeMonthId === realCurrId) {
            const mShort = now.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
            bsCutoffEl.innerHTML = `${renderIcon('calendar', 11)} ${now.getDate()} ${mShort}.`;
            bsCutoffEl.style.borderColor = '';
            bsCutoffEl.style.color = '';
        } else {
            bsCutoffEl.innerHTML = `${renderIcon('calendar', 11)} ${activeMonthId > realCurrId ? 'Proyectado' : 'Cierre'}`;
            bsCutoffEl.style.borderColor = '';
            bsCutoffEl.style.color = '';
        }
    }

    const currFlow = getMonthlyFlow(viewMonthId, false);
    let monthlyIncome = currFlow.inc, monthlyExpense = currFlow.exp, projectionData = null;

    if (isFuture) {
        // Ejecutar el motor de simulación realista
        const sim = simulateFutureLiquidity(currentMonthId, viewMonthId, currSnap.assetsTotal);
        
        // Mantener los valores programados para el widget de flujo si existen
        const scheduledFlow = getMonthlyFlow(viewMonthId, true);
        if (scheduledFlow.inc > 0 || scheduledFlow.exp > 0) {
            monthlyIncome = scheduledFlow.inc; 
            monthlyExpense = scheduledFlow.exp;
        } else {
            monthlyIncome = sim.avgInc; 
            monthlyExpense = sim.avgExp;
        }
        
        projectionData = { 
            mode: 'hybrid', 
            avgIncome: sim.avgInc, 
            avgExpense: sim.avgExp, 
            avgCashFlow: sim.avgNet, 
            monthsDiff: sim.monthsDiff, 
            currentLiquidity: currSnap.assetsTotal, 
            projectedLiquidity: sim.projectedLiquidity 
        };
    }

    const cashFlow = round2(monthlyIncome - monthlyExpense);

    // 1. RENDER WIDGET FLUJO DE CAJA Y LIBRE SEGURO
    const incEl = document.getElementById('monthly-income');
    const expEl = document.getElementById('monthly-expense');
    if (incEl) {
        incEl.innerHTML = formatMoneyHtml(monthlyIncome);
        fitAmountTextSize(incEl, monthlyIncome, 15.5, 9.5);
    }
    if (expEl) {
        expEl.innerHTML = formatMoneyHtml(monthlyExpense);
        fitAmountTextSize(expEl, monthlyExpense, 15.5, 9.5);
    }
    if (document.getElementById('monthly-net')) {
        const netEl = document.getElementById('monthly-net');
        netEl.innerHTML = formatMoneyHtml(cashFlow);
        netEl.className = 'hero-amount';
        netEl.style.color = cashFlow >= 0 ? 'var(--positive)' : 'var(--negative)';
        fitAmountTextSize(netEl, cashFlow, 32, 17);
        
        const heroLabel = document.querySelector('.hero-label');
        if (heroLabel) heroLabel.innerText = 'Flujo de Caja del Mes';
    }

    const maxFlow = Math.max(monthlyIncome, monthlyExpense, 1);
    setTimeout(() => {
        if (document.getElementById('flow-income-bar')) document.getElementById('flow-income-bar').style.width = `${(monthlyIncome / maxFlow) * 100}%`;
        if (document.getElementById('flow-expense-bar')) document.getElementById('flow-expense-bar').style.width = `${(monthlyExpense / maxFlow) * 100}%`;
    }, 50);

    // Mover el Badge fuera de las columnas para que no rompa el diseño (Banner ancho abajo)
        let safeBadge = document.getElementById('safe-to-spend-badge');
        if (!safeBadge) {
            safeBadge = document.createElement('div');
            safeBadge.id = 'safe-to-spend-badge';
            safeBadge.title = 'Toca para ver la proyección día por día';
            safeBadge.style.cssText = 'margin-top:14px; font-size:12px; font-weight:600; color:var(--text-muted); background:var(--hover-bg); display:flex; justify-content:space-between; align-items:center; padding:10px 14px; border-radius:12px; border:1px solid var(--border-color); cursor:pointer;';
            safeBadge.innerHTML = '<span style="display:flex; align-items:center; gap:6px;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Libre Seguro Hoy:</span> <span style="display:inline-flex; align-items:center; gap:5px;"><span id="libre-seguro-amount" style="font-size:14px; color:var(--text-main); font-weight:800;">$ 0,00</span><span style="color:var(--text-muted); font-size:15px; font-weight:700;">›</span></span>';
            safeBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof openCashProjectionModal === 'function') openCashProjectionModal();
            });
            const flowWidget = document.getElementById('widget-cash-flow');
            if (flowWidget) flowWidget.appendChild(safeBadge);
        }

    const safeBadgeEl = document.getElementById('safe-to-spend-badge');
    if (viewMonthId === currentMonthId && document.getElementById('libre-seguro-amount')) {
        const marginInfo = typeof computeDailyMarginUntilNextPayday === 'function'
            ? computeDailyMarginUntilNextPayday(currentMonthId, currSnap)
            : { ...computeSafeToSpendToday(currentMonthId, currSnap), daysUntil: 1, dailyAllowance: 0, targetLabel: 'fin de mes' };

        document.getElementById('libre-seguro-amount').innerText = formatMoney(marginInfo.safeToSpend);

        if (safeBadgeEl) {
            safeBadgeEl.style.flexDirection = 'column';
            safeBadgeEl.style.alignItems = 'stretch';
            safeBadgeEl.style.gap = '6px';

            let topRow = safeBadgeEl.querySelector('.safe-to-spend-top-row');
            if (!topRow) {
                topRow = document.createElement('div');
                topRow.className = 'safe-to-spend-top-row';
                topRow.style.cssText = 'display:flex; justify-content:space-between; align-items:center; width:100%;';
                while (safeBadgeEl.firstChild) topRow.appendChild(safeBadgeEl.firstChild);
                safeBadgeEl.appendChild(topRow);
            }

            let dailyLine = document.getElementById('safe-daily-margin-line');
            if (!dailyLine) {
                dailyLine = document.createElement('div');
                dailyLine.id = 'safe-daily-margin-line';
                dailyLine.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; padding-top:6px; border-top:1px dashed var(--border-color); font-size:11px; color:var(--text-muted);';
                safeBadgeEl.appendChild(dailyLine);
            }

            const shortPay = marginInfo.targetShortDate || '';
            if (marginInfo.safeToSpend > 0) {
                const leftLabel = marginInfo.isPaydayToday
                    ? `Margen hoy (nómina ${shortPay}):`
                    : (marginInfo.isPaydayOverdue
                        ? `Margen hoy (nómina pend. ${shortPay}):`
                        : `Margen diario (${marginInfo.daysUntil}d hasta ${marginInfo.targetLabel}):`);
                dailyLine.innerHTML = `
                    <span>${leftLabel}</span>
                    <strong class="positive privacy-sensitive" style="font-size:11.5px; white-space:nowrap;">${formatCompact(marginInfo.dailyAllowance)}/día</strong>
                `;
            } else {
                const leftLabel = marginInfo.isPaydayToday
                    ? `Tu nómina es hoy (${shortPay})`
                    : (marginInfo.isPaydayOverdue
                        ? `Nómina pendiente (${shortPay})`
                        : `${marginInfo.daysUntil === 1 ? 'Falta 1d' : `Faltan ${marginInfo.daysUntil}d`} hasta ${marginInfo.targetLabel}`);
                dailyLine.innerHTML = `
                    <span>${leftLabel}</span>
                    <strong class="negative" style="font-size:11px; white-space:nowrap;">Sin margen libre</strong>
                `;
            }
            dailyLine.classList.remove('hidden');
        }
    } else if (document.getElementById('safe-daily-margin-line')) {
        document.getElementById('safe-daily-margin-line').classList.add('hidden');
    }

        let positiveAssetTotal = 0, positiveLoansTotal = 0;
        financeData.customAccounts.forEach(acc => {
            const b = round2(currentBalances[acc.id] || 0);
            if (acc.category === 'asset' && b > 0) positiveAssetTotal = round2(positiveAssetTotal + b);
            if (acc.category === 'debt' && b > 0) positiveLoansTotal = round2(positiveLoansTotal + b);
        });

        // Banner de Modo Demo en el Tablero si la app está vacía
        let emptyDemoBanner = document.getElementById('dashboard-empty-demo-banner');
        if (financeData.transactions.length === 0 && !financeData.isDemoMode) {
            if (!emptyDemoBanner) {
                const dashContainer = document.getElementById('dashboard-widgets-container');
                emptyDemoBanner = document.createElement('div');
                emptyDemoBanner.id = 'dashboard-empty-demo-banner';
                
                // Degradado y borde dinámicos (cambian según el tema)
                emptyDemoBanner.style.cssText = 'background: linear-gradient(135deg, var(--accent-soft), var(--card-bg)); border: 1.5px dashed var(--accent-border); border-radius: 16px; padding: 18px 16px; text-align: center; margin-bottom: 14px; box-shadow: 0 8px 24px var(--theme-shadow);';
                
                emptyDemoBanner.innerHTML = `
                    <div style="width: 48px; height: 48px; border-radius: 14px; background: var(--card-bg); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: var(--accent);">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
                    </div>
                    <strong style="color: var(--text-main); font-size: 15px; display: block; margin-bottom: 6px;">Tu tablero está en blanco</strong>
                    <small style="color: var(--text-muted); font-size: 12.5px; display: block; margin-bottom: 16px; line-height: 1.4;">Comienza a registrar tus cuentas y gastos, o carga datos de prueba para explorar cómo funciona la app sin miedo a dañar nada.</small>
                    <button type="button" id="btn-dash-load-demo" class="btn btn-primary" style="width: 100%; font-size: 13.5px; padding: 12px; border-radius: 12px;">Poblar con datos de prueba</button>
                `;
                dashContainer?.insertBefore(emptyDemoBanner, dashContainer.firstChild);

                emptyDemoBanner.querySelector('#btn-dash-load-demo')?.addEventListener('click', () => {
                    if (typeof applyDemoData === 'function') {
                        applyDemoData();
                        emptyDemoBanner.remove();
                        renderAccountSelects();
                        renderCategoryOptions('expense');
                        syncUserUI();
                        updateDashboard();
                    }
                });
            }
        } else if (emptyDemoBanner) {
            emptyDemoBanner.remove();
        }

        renderAccountsBreakdown(currentBalances, positiveAssetTotal);

        // 3. RENDER WIDGET METAS AHORRO (BOLSILLOS)
        let totalPocketsGoal = 0;
        financeData.pockets.forEach(p => {
            const g = round2(p.goal ? p.goal : 0);
            totalPocketsGoal = round2(totalPocketsGoal + g);
        });

        const totalSavedPockets = round2(currSnap ? (currSnap.allPocketsTotal || currSnap.pocketsTotal || 0) : 0);

        let pocketsPct = 0;
        if (totalPocketsGoal > 0) pocketsPct = Math.min(100, Math.round((totalSavedPockets / totalPocketsGoal) * 100));
        else if (totalSavedPockets > 0) pocketsPct = 100;

        if (document.getElementById('pockets-ring-pct')) document.getElementById('pockets-ring-pct').innerText = `${pocketsPct}%`;
        if (document.getElementById('pockets-saved-total')) {
            document.getElementById('pockets-saved-total').innerText = `${formatCompact(totalSavedPockets)} de ${formatCompact(totalPocketsGoal)}`;
        }

        const goalsCircle = document.getElementById('pockets-ring-progress');
        if (goalsCircle) {
            if (pocketsPct >= 100 && (totalPocketsGoal > 0 || totalSavedPockets > 0)) goalsCircle.style.stroke = 'var(--positive)';
            else goalsCircle.style.stroke = 'var(--accent)';
            const visualPct = Math.max(0.5, pocketsPct);
            setTimeout(() => { goalsCircle.style.strokeDashoffset = 251.2 - (251.2 * visualPct / 100); }, 150);
        }

        // 3.5 RENDER WIDGET SALUD FINANCIERA
        const healthData = calculateFinancialHealth(viewMonthId, currSnap);
        const hScoreEl = document.getElementById('health-score-val');
        const hBadgeEl = document.getElementById('health-score-badge');
        const hCircleEl = document.getElementById('health-ring-progress');
        if (hScoreEl && hBadgeEl && hCircleEl) {
            const renderStatusPill = (label, dotColor, badgeClass) => {
                hBadgeEl.className = `widget-badge ${badgeClass}`;
                hBadgeEl.style.display = 'inline-flex';
                hBadgeEl.style.alignItems = 'center';
                hBadgeEl.style.justifyContent = 'center';
                hBadgeEl.style.gap = '6px';
                hBadgeEl.innerHTML = `<span>${label}</span><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${dotColor}; flex-shrink:0;"></span>`;
            };

            if (healthData.isNeutral) {
                hScoreEl.innerText = '--';
                renderStatusPill('Faltan datos', 'var(--text-muted)', 'neutral');
                hCircleEl.style.strokeDashoffset = 251.2;
            } else {
                const gScore = healthData.scores.global;
                hScoreEl.innerText = gScore;
                hCircleEl.style.stroke = gScore >= 80 ? 'var(--positive)' : (gScore >= 50 ? '#f59e0b' : 'var(--negative)');
                setTimeout(() => { hCircleEl.style.strokeDashoffset = 251.2 - (251.2 * Math.max(2, gScore) / 100); }, 150);
                if (gScore >= 80) renderStatusPill('Excelente', 'var(--positive)', 'good');
                else if (gScore >= 50) renderStatusPill('Aceptable', '#f59e0b', 'warn');
                else renderStatusPill('En Riesgo', 'var(--negative)', 'danger');
            }
        }

        // 4. RENDER WIDGET PRESUPUESTO
        let globalLimit = 0, totalSpentExp = 0;
        financeData.categories.expense.forEach(c => { globalLimit = round2(globalLimit + getCategoryLimitForMonth(c, viewDate.getMonth(), viewDate.getFullYear())); });
        let totalRefundExpDash = 0;
        financeData.transactions.forEach(t => {
            if (t.isDeleted || (t.isSharedTrip && t.paidBy === 'companion') || t.isTripIsolated || getTxMonthId(t) !== viewMonthId || t.isAdjustment || !isTxClosed(t)) return;
            if (t.type === 'expense') {
                totalSpentExp = round2(totalSpentExp + round2(t.amount));
            } else if (t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) {
                totalRefundExpDash = round2(totalRefundExpDash + round2(t.amount));
        }
    });
    totalSpentExp = Math.max(0, round2(totalSpentExp - totalRefundExpDash));

        const budgetPct = globalLimit > 0 ? Math.min(100, (totalSpentExp / globalLimit) * 100) : 0;
        const bFill = document.getElementById('dash-budget-fill');
        const bBadge = document.getElementById('dash-budget-badge');
        const bPace = document.getElementById('dash-budget-pace-marker');

        if (document.getElementById('dash-budget-spent-text')) {
            document.getElementById('dash-budget-spent-text').innerText = `Gastado: ${formatMoney(totalSpentExp)}`;
        }
        if (document.getElementById('dash-budget-rem-text')) {
            const remBudget = Math.max(0, round2(globalLimit - totalSpentExp));
            document.getElementById('dash-budget-rem-text').innerText = `Disponible: ${formatMoney(remBudget)}`;
        }

        if (bFill) {
            if (globalLimit > 0) {
                bFill.style.backgroundColor = budgetPct > 90 ? 'var(--negative)' : (budgetPct > 75 ? '#f59e0b' : 'var(--positive)');
                setTimeout(() => { bFill.style.width = `${budgetPct}%`; }, 200);

                const rem = Math.max(0, round2(globalLimit - totalSpentExp));
                const mDays = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
                
                if (bBadge) {
                    bBadge.innerText = rem > 0 ? `Quedan ${formatMoney(rem)}` : `Excedido ${formatMoney(Math.abs(rem))}`;
                    bBadge.className = rem > 0 ? 'widget-badge good' : 'widget-badge danger';
                }
                if (bPace) {
                    bPace.classList.remove('hidden');
                    const todayPos = viewMonthId === getMonthId(currentDate) ? Math.min(100, (currentDate.getDate() / mDays) * 100) : 100;
                    bPace.style.left = `${todayPos}%`;
                }
            } else {
                bFill.style.width = '0%';
                if (bBadge) { bBadge.innerText = 'Sin presupuesto'; bBadge.className = 'widget-badge neutral'; }
            }
        }

        // 5. RENDER ALERTAS, SOBRANTE MENSUAL, PRÓXIMOS 7 DÍAS, CALENDARIO Y HOJA DE BALANCE
        try { renderSmartAlerts(viewMonthId, currSnap); } catch (e) { console.error(e); }
        try { if (typeof renderUnassignedSurplusBanner === 'function') renderUnassignedSurplusBanner(viewMonthId); } catch (e) { console.error(e); }
        try { if (typeof renderUpcoming7DaysWidget === 'function') renderUpcoming7DaysWidget(viewMonthId); } catch (e) { console.error(e); }
        try { renderCalendar(viewDate, 'calendar-days-grid'); } catch (e) { console.error(e); }
        try { renderBalanceSheet(currentBalances, currSnap.netWorth, currSnap); } catch (e) { console.error(e); }
        try { renderDashboardCardsSummary(currentBalances); } catch (e) { console.error(e); }
        try { renderDashboardDebtsSummary(currentBalances); } catch (e) { console.error(e); }
        try { renderNetWorthChart(viewDate, prevDate, prevSnap, currSnap); } catch (e) { console.error(e); }
        try { renderCashFlowChart(viewDate, prevDate); } catch (e) { console.error(e); }
        try { renderDailySummary(); } catch (e) { console.error(e); }
        try { renderBudgetDonut(viewMonthId, monthlyExpense); } catch (e) { console.error(e); }
        try { renderAnalyticsBalanceSheet(currentBalances, currSnap.netWorth, currSnap); } catch (e) { console.error(e); }
        try { if (typeof renderAnalyticsTagsCard === 'function') renderAnalyticsTagsCard(); } catch (e) { console.error(e); }
        try { if (typeof renderAnalyticsAntExpensesCard === 'function') renderAnalyticsAntExpensesCard(); } catch (e) { console.error(e); }

        // 6. RENDER HISTORIAL Y PROYECCIONES
        try { renderTransactionHistory(viewMonthId, currSnap, projectionData); } catch (e) { console.error(e); }
        if (typeof renderTripModeBanner === 'function') renderTripModeBanner();
        if (typeof window.syncNativeLocalNotifications === 'function') window.syncNativeLocalNotifications();
};

let calendarHeatmapMode = 'variable'; // 'variable' | 'total'

const renderCalendar = (baseDate, containerId) => {
    const grid = document.getElementById(containerId);
    if (!grid) return;
    grid.innerHTML = '';

    const { offset, days, avgDailySpend, zeroSpendDays, maxElapsedDay } = computeCalendarHeatmapData(baseDate, calendarHeatmapMode);

    for (let i = 0; i < offset; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;

    days.forEach(({ day, dStr, act, daySpend, heatClass, isToday }) => {
        const classes = `cal-day ${heatClass} ${isToday ? 'today' : ''} ${selectedCalendarDay === dStr ? 'selected' : ''}`;
        let dots = '';
        if (act) {
            if (act.inc) dots += `<span class="cal-dot positive-bg"></span>`;
            if (act.exp) dots += `<span class="cal-dot negative-bg"></span>`;
            if (act.pend) dots += `<span class="cal-dot" style="background:#f59e0b;"></span>`;
            if (act.trf && !act.pend) dots += `<span class="cal-dot" style="background:var(--accent);"></span>`;
        }
        const cell = document.createElement('div');
        cell.className = classes;
        if (daySpend > 0) cell.title = `${day}/${baseDate.getMonth() + 1}: ${formatMoney(daySpend)}`;
        cell.innerHTML = `<span>${day}</span><div class="cal-dots">${dots}</div>`;
        cell.onclick = () => {
            selectedCalendarDay = (selectedCalendarDay === dStr) ? null : dStr;
            forceCloseAllModals();
            updateDashboard();
        };
        grid.appendChild(cell);
    });

    let footerEl = document.getElementById('calendar-heatmap-footer');
    if (!footerEl && grid) {
        footerEl = document.createElement('div');
        footerEl.id = 'calendar-heatmap-footer';
        footerEl.className = 'cal-heatmap-footer';
        grid.insertAdjacentElement('afterend', footerEl);
    }
    if (footerEl) {
        const isVarMode = calendarHeatmapMode === 'variable';
        const modeLabel = isVarMode ? 'Solo variable' : 'Gasto total';
        const tooltipText = isVarMode 
            ? '<b>Solo Variable:</b> Mide tu intensidad de gasto diario ignorando gastos fijos marcados en tu presupuesto y viajes. (Mide tus hábitos/fugas)'
            : '<b>Gasto Total:</b> Incluye todo: fijos, suscripciones, compras y viajes. (Mide el impacto real en tu bolsillo)';
        const zeroText = maxElapsedDay > 0 ? `<b class="positive">${zeroSpendDays}d</b> sin gasto` : 'Mes futuro';
        
        footerEl.innerHTML = `
            <div class="cal-heatmap-row">
                <div class="cal-heat-scale">
                    <span class="cal-heat-item"><i class="cal-heat-swatch low"></i>Bajo</span>
                    <span class="cal-heat-item"><i class="cal-heat-swatch med"></i>Medio</span>
                    <span class="cal-heat-item"><i class="cal-heat-swatch high"></i>Alto</span>
                </div>
                <div style="display:flex; align-items:center;">
                    <button type="button" id="toggle-cal-heat-mode" class="mini-action-btn" style="font-size:10px; padding:2px 8px;">${modeLabel}</button>
                    <span class="cal-heat-info-icon" id="info-cal-heat-mode">i
                        <span class="cal-heat-tooltip">${tooltipText}</span>
                    </span>
                </div>
            </div>
            <div class="cal-heatmap-row">
                <span>${zeroText}</span>
                <span>Prom. día activo: <b style="color:var(--text-main);">${formatCompact(avgDailySpend)}</b></span>
            </div>
        `;

        footerEl.querySelector('#toggle-cal-heat-mode')?.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarHeatmapMode = calendarHeatmapMode === 'variable' ? 'total' : 'variable';
            renderCalendar(baseDate, containerId);
        });

        footerEl.querySelector('#info-cal-heat-mode')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const icon = e.currentTarget;
            const wasActive = icon.classList.contains('active');
            document.querySelectorAll('.cal-heat-info-icon').forEach(el => el.classList.remove('active'));
            if (!wasActive) icon.classList.add('active');
        });

        grid.parentNode.addEventListener('click', () => {
            document.querySelectorAll('.cal-heat-info-icon').forEach(el => el.classList.remove('active'));
        }, { once: true });
    }

    const clearBtn = document.getElementById('clear-day-filter-btn');
    if (clearBtn) { if (selectedCalendarDay) clearBtn.classList.remove('hidden'); else clearBtn.classList.add('hidden'); }
};

document.getElementById('prev-month')?.addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); selectedCalendarDay = null; updateDashboard(); });
document.getElementById('next-month')?.addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); selectedCalendarDay = null; updateDashboard(); });

const triggerBtn = document.getElementById('month-picker-trigger');
const popover = document.getElementById('quick-calendar-popover');
if (triggerBtn && popover) {
    triggerBtn.addEventListener('click', (e) => { e.stopPropagation(); popover.classList.toggle('hidden'); });
    document.addEventListener('click', (e) => { if (!popover.classList.contains('hidden') && !popover.contains(e.target) && !triggerBtn.contains(e.target)) popover.classList.add('hidden'); });
}

const goToday = () => { viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1); selectedCalendarDay = null; if (popover) popover.classList.add('hidden'); updateDashboard(); };
document.getElementById('today-month-btn')?.addEventListener('click', goToday);

document.getElementById('quick-month-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
        const [y, m] = e.target.value.split('-');
        viewDate = new Date(y, m - 1, 1);
        selectedCalendarDay = null;
        if (popover) popover.classList.add('hidden');
        updateDashboard();
    }
});

const pillsWrap = document.getElementById('quick-jump-pills');
if (pillsWrap) {
    const jumpOptions = [
        { offset: -1, label: 'Mes ant.' },
        { offset: 0, label: 'Mes actual' },
        { offset: 3, label: '+3 Meses' },
        { offset: 6, label: '+6 Meses' },
        { offset: 12, label: '+1 Año' }
    ];
    pillsWrap.innerHTML = jumpOptions.map(j => `<button type="button" class="pill-btn" data-offset="${j.offset}">${j.label}</button>`).join('');
    pillsWrap.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const offset = parseInt(btn.getAttribute('data-offset'), 10);
            viewDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
            selectedCalendarDay = null;
            if (popover) popover.classList.add('hidden');
            updateDashboard();
        });
    });
}
document.getElementById('close-quick-cal-btn')?.addEventListener('click', () => { if (popover) popover.classList.add('hidden'); });
document.getElementById('clear-day-filter-btn')?.addEventListener('click', () => { selectedCalendarDay = null; updateDashboard(); });

// --- 10. HOJA DE BALANCE, TARJETAS Y PRÉSTAMOS EN INICIO ---
document.getElementById('toggle-zero-accounts-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    financeData.hideZeroAccounts = !financeData.hideZeroAccounts;
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    updateDashboard();
});

window.bsHistoricalDateStr = null;

const toggleBalanceSheetDatePicker = () => {
    const widget = document.getElementById('balance-sheet-list')?.closest('.dashboard-widget, .chart-card, section, div.card')
        || document.getElementById('bs-cutoff-badge')?.closest('div')?.parentElement;
    if (!widget) return;

    const getFreshTodayIso = () => (typeof toLocalIsoDateStr === 'function'
        ? toLocalIsoDateStr(new Date())
        : new Date().toLocaleDateString('en-CA'));

    let pickerBar = document.getElementById('bs-historical-date-bar');
    if (!pickerBar) {
        pickerBar = document.createElement('div');
        pickerBar.id = 'bs-historical-date-bar';
        pickerBar.className = 'glass-sub-box hidden';
        pickerBar.style.cssText = 'margin:8px 0 10px 0; padding:10px 12px; border-color:var(--accent-border); background:var(--card-inner-bg);';

        const todayStr = getFreshTodayIso();
        pickerBar.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:7px;">
                <strong style="font-size:11.5px; color:var(--text-main);">Ver Hoja de Balance en otra fecha</strong>
                <button type="button" id="btn-bs-reset-today" class="mini-action-btn" style="font-size:10.5px; color:var(--accent); font-weight:800; padding:3px 8px;">Volver a Hoy</button>
            </div>
            <div style="display:flex; gap:6px; align-items:center; margin-bottom:7px;">
                <input type="date" id="bs-historical-date-input" max="${todayStr}" value="${todayStr}" style="flex:1; min-width:0; min-height:38px; font-size:13px; padding:6px 10px; border:1px solid var(--border-color); border-radius:12px; background:var(--card-bg); color:var(--text-main); box-sizing:border-box;">
                <button type="button" id="btn-bs-apply-date" class="mini-action-btn" style="background:var(--accent-soft); color:var(--accent); border-color:var(--accent-border); font-weight:800; font-size:11.5px; padding:8px 12px; min-height:38px; flex-shrink:0;">Ver</button>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:5px;">
                <button type="button" class="pill-btn bs-quick-date-btn" data-days-ago="7" style="font-size:10px; padding:3px 8px;">Hace 7 días</button>
                <button type="button" class="pill-btn bs-quick-date-btn" data-days-ago="30" style="font-size:10px; padding:3px 8px;">Hace 30 días</button>
                <button type="button" class="pill-btn bs-quick-date-btn" data-days-ago="prev_month_end" style="font-size:10px; padding:3px 8px;">Fin mes anterior</button>
            </div>
        `;

        const listEl = document.getElementById('balance-sheet-list');
        const heroBox = listEl?.previousElementSibling;
        if (heroBox) heroBox.insertAdjacentElement('beforebegin', pickerBar);
        else listEl?.insertAdjacentElement('beforebegin', pickerBar);

        pickerBar.addEventListener('click', (ev) => ev.stopPropagation());

        const applyHistoricalDate = (rawVal, closeBar = true) => {
            const val = String(rawVal || '').trim();
            const todayIso = getFreshTodayIso();
            if (!/^\d{4}-\d{2}-\d{2}$/.test(val) || val >= todayIso) {
                window.bsHistoricalDateStr = null;
            } else {
                window.bsHistoricalDateStr = val;
            }
            if (closeBar) pickerBar.classList.add('hidden');
            updateDashboard();
        };

        const dateInpEl = pickerBar.querySelector('#bs-historical-date-input');
        dateInpEl?.addEventListener('change', (ev) => {
            ev.stopPropagation();
            if (/^\d{4}-\d{2}-\d{2}$/.test(dateInpEl.value)) {
                applyHistoricalDate(dateInpEl.value, false);
            }
        });
        dateInpEl?.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                applyHistoricalDate(dateInpEl.value, true);
            }
        });

        pickerBar.querySelector('#btn-bs-apply-date')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            applyHistoricalDate(dateInpEl?.value, true);
        });

        pickerBar.querySelector('#btn-bs-reset-today')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (dateInpEl) dateInpEl.value = getFreshTodayIso();
            applyHistoricalDate('', true);
        });

        pickerBar.querySelectorAll('.bs-quick-date-btn').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const nowDt = new Date();
                const mode = btn.getAttribute('data-days-ago');
                let dt;
                if (mode === 'prev_month_end') {
                    dt = new Date(nowDt.getFullYear(), nowDt.getMonth(), 0);
                } else {
                    const offset = parseInt(mode, 10) || 7;
                    dt = new Date(nowDt.getFullYear(), nowDt.getMonth(), nowDt.getDate() - offset);
                }
                const iso = typeof toLocalIsoDateStr === 'function' ? toLocalIsoDateStr(dt) : dt.toLocaleDateString('en-CA');
                if (dateInpEl) dateInpEl.value = iso;
                applyHistoricalDate(iso, true);
            });
        });
    }

    const inp = document.getElementById('bs-historical-date-input');
    const freshToday = getFreshTodayIso();
    if (inp) {
        inp.max = freshToday;
        inp.value = window.bsHistoricalDateStr || freshToday;
    }
    pickerBar.classList.toggle('hidden');
};

const renderBalanceSheet = (balancesInput, netWorthInput, snapInput) => {
    const list = document.getElementById('balance-sheet-list');
    const totalEl = document.getElementById('bs-net-worth');
    const toggleZeroBtn = document.getElementById('toggle-zero-accounts-btn');
    if (!list || !totalEl) return;

    let balances = balancesInput;
    let netWorth = netWorthInput;
    let snap = snapInput;

    let histBanner = document.getElementById('bs-historical-active-banner');
    if (window.bsHistoricalDateStr && typeof computeBalancesUpToDate === 'function') {
        const histSnap = computeBalancesUpToDate(window.bsHistoricalDateStr);
        balances = histSnap.bals;
        netWorth = histSnap.netWorth;
        snap = histSnap;

        if (!histBanner) {
            histBanner = document.createElement('div');
            histBanner.id = 'bs-historical-active-banner';
            histBanner.style.cssText = 'display:flex; justify-content:space-between; align-items:center; gap:8px; margin:6px 0 8px 0; padding:7px 10px; border-radius:10px; background:var(--accent-soft); border:1px solid var(--accent-border); font-size:11px; color:var(--text-main);';
            list.insertAdjacentElement('beforebegin', histBanner);
        }
        const [hy, hm, hd] = window.bsHistoricalDateStr.split('-').map(Number);
        const hLabel = new Date(hy, hm - 1, hd).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
        histBanner.classList.remove('hidden');
        histBanner.innerHTML = `
            <span>Corte histórico al <b>${hLabel}</b></span>
            <button type="button" id="btn-bs-banner-back-today" class="mini-action-btn" style="padding:2px 8px; font-size:10.5px; font-weight:800; color:var(--accent);">Volver a Hoy</button>
        `;
        histBanner.querySelector('#btn-bs-banner-back-today')?.addEventListener('click', (ev) => {
            ev.stopPropagation();
            window.bsHistoricalDateStr = null;
            updateDashboard();
        });
    } else if (histBanner) {
        histBanner.classList.add('hidden');
    }

    totalEl.innerHTML = formatMoneyHtml(netWorth);
    totalEl.className = netWorth >= 0 ? 'positive' : 'negative';

    const totalAssets = round2(snap.assetsTotal + snap.cxcTotal + snap.visibleFixedAssetsTotal + snap.pocketsTotal);
const totalLiabilities = round2(snap.liabilitiesTotal);

    if (document.getElementById('bs-kpi-assets')) document.getElementById('bs-kpi-assets').innerHTML = formatMoneyHtml(totalAssets);
    if (document.getElementById('bs-kpi-liabilities')) document.getElementById('bs-kpi-liabilities').innerHTML = formatMoneyHtml(totalLiabilities);

    const bsRing = document.getElementById('bs-ring-progress');
    const bsPct = document.getElementById('bs-ring-pct');
    if (bsRing && bsPct) {
        let p = 100;
        if (totalAssets > 0) p = Math.max(0, 100 - Math.round((totalLiabilities / totalAssets) * 100));
        else if (totalLiabilities > 0) p = 0;

        bsPct.innerText = `${p}%`;
        bsRing.style.strokeDashoffset = 251.2 - (251.2 * p / 100);
        if (p >= 80) bsRing.style.stroke = 'var(--positive)';
        else if (p >= 50) bsRing.style.stroke = '#f59e0b';
        else bsRing.style.stroke = 'var(--negative)';
    }

    list.innerHTML = '';
    let hiddenCount = 0;

    const assets = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_')));
    const cxcAccounts = financeData.customAccounts.filter(a => a.id.startsWith('CxC_'));
    const cards = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'credit_card'));
    const debts = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'debt' && balances[a.id] > 0));

    const renderAccGroup = (accGroup) => {
        accGroup.forEach(acc => {
            const bal = round2(balances[acc.id] || 0);
            const isZero = Math.abs(bal) < 0.01;

            if (financeData.hideZeroAccounts && isZero && !acc.showWhenZero) {
                hiddenCount++;
                return;
            }

            const isLiab = isLiabilityCategory(acc.category);
            const displayVal = isZero ? 0 : (isLiab ? -bal : bal);
            
            // Color semántico dinámico: gris en $0, rojo si es negativo/deuda, verde si es positivo
            const inlineColor = isZero
                ? 'var(--text-muted)'
                : (displayVal < 0 ? 'var(--negative)' : 'var(--positive)');
            const iconSvg = getAccountIcon(acc.category);
            const starTag = acc.isDefault ? ' ★' : '';

            const row = document.createElement('div');
            row.className = 'bs-row';
            row.onclick = (e) => {
                e.stopPropagation();
                if (attemptCloseModals()) openAccountDetail(acc.id, 'home');
            };
            
            // El nowrap garantiza que los centavos no salten a la línea de abajo.
            const safeAccLabel = window.escapeHtml ? window.escapeHtml(stripLeadingEmoji(acc.name)) : stripLeadingEmoji(acc.name);
            row.innerHTML = `<span style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:8px;"><span style="color:var(--accent); display:inline-flex;">${iconSvg}</span> ${safeAccLabel}${starTag}</span><strong class="privacy-sensitive" style="color: ${inlineColor}; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: baseline;">${formatMoneyHtml(displayVal)}</strong>`;
            list.appendChild(row);
        });
    };

    renderAccGroup(assets);
    renderAccGroup(cards);
    renderAccGroup(debts);

    if (toggleZeroBtn) {
        if (financeData.hideZeroAccounts) {
            toggleZeroBtn.innerHTML = `${renderIcon('eye', 13)} ${hiddenCount > 0 ? `Ver todas (+${hiddenCount})` : 'Ver todas'}`;
        } else {
            toggleZeroBtn.innerHTML = `${renderIcon('eye-off', 13)} Ocultar $0`;
        }
    }

    const cxcTotal = round2(cxcAccounts.reduce((sum, a) => sum + Math.max(0, round2(balances[a.id] || 0)), 0));
    if (cxcTotal > 0) {
        const cxcRow = document.createElement('div');
        cxcRow.className = 'bs-row';
        cxcRow.onclick = (e) => {
            e.stopPropagation();
            if (attemptCloseModals()) openReceivablesModal();
        };
        cxcRow.innerHTML = `<span style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:8px;"><span style="color:var(--positive); display:inline-flex;">${renderIcon('users', 16)}</span> Deudas a Favor</span><strong class="privacy-sensitive" style="color: var(--positive); white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: baseline;">${formatMoneyHtml(cxcTotal)}</strong>`;
        list.appendChild(cxcRow);
}

if (snap.pocketsTotal > 0) {
    const pRow = document.createElement('div');
    pRow.className = 'bs-row';
    pRow.onclick = (e) => {
        e.stopPropagation();
        if (attemptCloseModals()) {
            document.getElementById('pockets-modal')?.classList.remove('hidden');
            renderPocketsView();
        }
    };
    pRow.innerHTML = `<span style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:8px;"><span style="color:var(--positive); display:inline-flex;">${renderIcon('piggy', 16)}</span> Bolsillos de Ahorro</span><strong class="privacy-sensitive" style="color: var(--positive); white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: baseline;">${formatMoneyHtml(snap.pocketsTotal)}</strong>`;
    list.appendChild(pRow);
}

if (snap.visibleFixedAssetsTotal > 0) {
    const faRow = document.createElement('div');
    faRow.className = 'bs-row';
    faRow.onclick = (e) => {
        e.stopPropagation();
        if (attemptCloseModals()) {
            document.getElementById('assets-modal')?.classList.remove('hidden');
            renderAssetsBreakdown();
        }
    };
    faRow.innerHTML = `<span style="min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:8px;"><span style="color:var(--accent); display:inline-flex;">${renderIcon('diamond', 16)}</span> Activos Fijos</span><strong class="privacy-sensitive" style="color: var(--positive); white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: baseline;">${formatMoneyHtml(snap.visibleFixedAssetsTotal)}</strong>`;
    list.appendChild(faRow);
}

    if (list.children.length === 0) {
        list.innerHTML = '<div class="bs-row" style="cursor:default;"><small style="color:var(--text-muted);">Todas las cuentas están en $ 0,00.</small></div>';
    }
};

const renderDashboardCardsSummary = (balances) => {
    const widget = document.getElementById('dashboard-cards-widget');
    const badge = document.getElementById('dash-tc-count-badge');
    const list = document.getElementById('dash-tc-list');
    if (!widget || !list) return;

    const cards = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'credit_card'));
    if (cards.length === 0) {
        widget.classList.add('hidden');
        return;
    }

    widget.classList.remove('hidden');
    list.innerHTML = '';

    let totalCardsDebt = 0, totalCardsLimit = 0, totalMinQuotas = 0;
    cards.forEach(card => {
        const debt = Math.max(0, round2(balances[card.id] || 0));
        totalCardsDebt = round2(totalCardsDebt + debt);
        totalCardsLimit = round2(totalCardsLimit + round2(card.creditLimit || 0));
        const activeCyc = typeof getCardActivePayCycle === 'function' ? getCardActivePayCycle(card, currentDate) : null;
        const cycSt = (activeCyc && debt > 0 && typeof getLiabilityDueCycleState === 'function')
            ? getLiabilityDueCycleState(card, debt, activeCyc.activePayDate, currentDate)
            : null;
        const remMin = cycSt ? cycSt.remainingQuota : calculateCardMinPaymentEstimate(card, debt).totalMinPayment;
        totalMinQuotas = round2(totalMinQuotas + remMin);
    });

    const totalCardsAvailable = Math.max(0, round2(totalCardsLimit - totalCardsDebt));
    const utilPct = totalCardsLimit > 0 ? (totalCardsDebt / totalCardsLimit) * 100 : 0;

    if (badge) {
        badge.innerText = `${cards.length} activa${cards.length !== 1 ? 's' : ''} • ${utilPct.toFixed(0)}%`;
        badge.className = `widget-badge ${utilPct <= 30 ? 'good' : (utilPct <= 70 ? 'warn' : 'danger')}`;
    }

    if (document.getElementById('dash-tc-total-debt')) document.getElementById('dash-tc-total-debt').innerText = formatCompact(totalCardsDebt);
    if (document.getElementById('dash-tc-total-avail')) document.getElementById('dash-tc-total-avail').innerText = formatCompact(totalCardsAvailable);
    if (document.getElementById('dash-tc-monthly-quota')) document.getElementById('dash-tc-monthly-quota').innerText = formatCompact(totalMinQuotas);

    const todayDay = currentDate.getDate();
    cards.forEach(card => {
        const debt = round2(balances[card.id] || 0);
        const limit = round2(card.creditLimit || 0);
        const pct = limit > 0 ? Math.min(100, Math.max(0, (debt / limit) * 100)) : 0;
        const barColor = pct > 80 ? 'var(--negative)' : (pct > 50 ? '#f59e0b' : 'var(--positive)');
        const cyclePos = Math.min(98, Math.max(2, (todayDay / 30) * 100));
        const est = calculateCardMinPaymentEstimate(card, debt);
        const iconSvg = renderIcon('card', 14);
        const minTag = est.totalMinPayment > 0 ? ` • Mín: <b style="color:var(--accent);">${formatCompact(est.totalMinPayment)}</b>` : '';

        const row = document.createElement('div');
        row.className = 'dash-tc-row';
        row.onclick = (e) => {
            e.stopPropagation();
            if (attemptCloseModals()) openAccountDetail(card.id, 'home');
        };
        row.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px;">
                <span style="display:flex; align-items:center; gap:6px; font-size:13.5px; font-weight:700; color:var(--text-main);">
                    <span class="drawer-icon-box subtle-box" style="width:22px; height:22px; flex-shrink:0;">${iconSvg}</span>
                    <span>${window.escapeHtml ? window.escapeHtml(stripLeadingEmoji(card.name)) : stripLeadingEmoji(card.name)}${card.isDefault ? ' ★' : ''}</span>
                </span>
                ${est.deferredCount > 0 ? `<small style="color:var(--accent); font-weight:700; font-size:11px; flex-shrink:0;">(${est.deferredCount} diff.)</small>` : ''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; font-weight:700; margin-bottom:6px; padding-left:28px;">
                <span>${formatMoneyHtml(debt)} <small style="color:var(--text-muted); font-weight:500;">/ ${formatCompact(limit)}</small></span>
                <span style="font-size:11px; color:var(--text-muted); font-weight:600;">Corte: ${card.cutoffDay || '-'} • Pago: ${card.paymentDay || '-'}</span>
            </div>
            <div class="pace-bar-track">
                <div class="pace-bar-fill" style="width:${pct}%; background-color:${barColor};"></div>
                <div class="pace-marker" style="left:${cyclePos}%; height:14px; top:-3px;"></div>
            </div>
            <div class="dash-tc-sub" style="align-items:center; margin-top:6px;">
                <span>Disp: <b class="positive">${formatMoneyHtml(Math.max(0, limit - debt))}</b></span>
                ${(() => {
                    const activeCyc = typeof getCardActivePayCycle === 'function' ? getCardActivePayCycle(card, currentDate) : null;
                    const cycSt = (activeCyc && debt > 0 && typeof getLiabilityDueCycleState === 'function')
                        ? getLiabilityDueCycleState(card, debt, activeCyc.activePayDate, currentDate)
                        : null;
                    if (cycSt && cycSt.isPaid && debt > 0) {
                        return `<span style="color:var(--positive); font-weight:700;">✓ Ciclo al día</span>`;
                    }
                    const shownMin = cycSt ? cycSt.remainingQuota : est.totalMinPayment;
                    return shownMin > 0 ? `<span>Mín: <b style="color:var(--accent);">${formatMoneyHtml(shownMin)}</b></span>` : '';
                })()}
            </div>
        `;
        list.appendChild(row);
    });
};

const renderDashboardDebtsSummary = (balances) => {
    const widget = document.getElementById('dashboard-debts-widget');
    const badge = document.getElementById('dash-debts-count-badge');
    const list = document.getElementById('dash-debts-list') || document.getElementById('dashboard-debts-list');
    if (!widget || !list) return;

    const debts = sortAlphabeticallyWithDefault(financeData.customAccounts.filter(a => a.category === 'debt'));
    if (debts.length === 0) {
        widget.classList.add('hidden');
        return;
    }

    widget.classList.remove('hidden');
    list.innerHTML = '';

    let totalDebtsBalance = 0, totalOriginalDebts = 0, totalMonthlyQuotas = 0;
    debts.forEach(debt => {
        const bal = Math.max(0, round2(balances[debt.id] || 0));
        const orig = round2(debt.debtOriginal || bal);
        const qInfo = getDebtMonthlyQuotaBreakdown(debt, bal);

        totalDebtsBalance = round2(totalDebtsBalance + bal);
        totalOriginalDebts = round2(totalOriginalDebts + Math.max(orig, bal));
        if (bal > 0) totalMonthlyQuotas = round2(totalMonthlyQuotas + qInfo.totalQuota);
    });

    const amortPct = totalOriginalDebts > 0 ? Math.min(100, (Math.max(0, round2(totalOriginalDebts - totalDebtsBalance)) / totalOriginalDebts) * 100) : 0;
    if (badge) badge.innerText = `${debts.length} activo${debts.length !== 1 ? 's' : ''}`;
    if (document.getElementById('dash-debts-total-bal')) document.getElementById('dash-debts-total-bal').innerText = formatCompact(totalDebtsBalance);
    if (document.getElementById('dash-debts-monthly-quota')) document.getElementById('dash-debts-monthly-quota').innerText = formatCompact(totalMonthlyQuotas);
    if (document.getElementById('dash-debts-avg-progress')) document.getElementById('dash-debts-avg-progress').innerText = `${amortPct.toFixed(0)}%`;

    debts.forEach(debt => {
        const bal = Math.max(0, round2(balances[debt.id] || 0));
        const orig = Math.max(bal, round2(debt.debtOriginal || bal));
        const totQ = debt.debtTotalQuotes || 1, paidQ = debt.debtPaidQuotes || 0;
        const rate = debt.debtRate || 0, rateType = debt.debtRateType || 'monthly';
        const qInfo = getDebtMonthlyQuotaBreakdown(debt, bal);

        const monthlyPay = qInfo.totalQuota;
        let labelProgress = qInfo.subPurchases.length > 0
            ? (debt.debtType === 'revolving' ? `${qInfo.subPurchases.length} comp. activas` : `${paidQ}/${totQ}c + ${qInfo.subPurchases.length} comp.`)
            : `Cuotas: ${paidQ}/${totQ}`;
        const subBadge = debt.debtType === 'revolving'
            ? ` <span class="widget-badge warn" style="font-size:9px; padding:1px 6px;">Rotativo</span>`
            : '';

        const itemPct = orig > 0 ? Math.min(100, Math.max(0, (Math.max(0, round2(orig - bal)) / orig) * 100)) : 0;
        const payrollTag = debt.payrollDeduction
            ? ` • <span style="display:inline-flex; align-items:center; gap:3px;">${renderIcon('briefcase', 11)} Libranza</span>`
            : '';
        const iconSvg = renderIcon('scale', 14);

        const row = document.createElement('div');
        row.className = 'dash-tc-row';
        row.onclick = (e) => {
            e.stopPropagation();
            if (attemptCloseModals()) openAccountDetail(debt.id, 'home');
        };
        row.innerHTML = `
            <div class="dash-tc-top">
                <span style="display:flex; align-items:center; gap:6px;"><span class="drawer-icon-box subtle-box" style="width:22px; height:22px;">${iconSvg}</span> ${window.escapeHtml ? window.escapeHtml(stripLeadingEmoji(debt.name)) : stripLeadingEmoji(debt.name)}${subBadge}</span>
                <span>${formatMoneyHtml(bal)} <small style="color:var(--text-muted); font-weight:500;">/ ${formatCompact(orig)}</small></span>
            </div>
            <div class="pace-bar-track">
                <div class="pace-bar-fill positive-bg" style="width:${itemPct}%;"></div>
            </div>
            <div class="dash-tc-sub">
                <span>Cuota: <b style="color:var(--accent);">${formatMoneyHtml(monthlyPay)}/m</b>${payrollTag}</span>
                <span>${debt.paymentDay ? `${debt.cutoffDay ? `C:${debt.cutoffDay} • ` : ''}Pago:${debt.paymentDay} • ` : ''}${labelProgress} • ${String(rate).replace('.', ',')}%</span>
            </div>
        `;
        list.appendChild(row);
    });
};

// ==========================================
// 11B. PRIVACIDAD, CICLOS, PAPELERA, #TAGS Y MULTIMONEDA
// ==========================================

// --- MODO PRIVACIDAD (OJITO HEADER) ---
document.getElementById('toggle-privacy-btn')?.addEventListener('click', () => {
    isPrivacyMode = !isPrivacyMode;
    localStorage.setItem('myFinancesPrivacyMode', isPrivacyMode);
    
    const iconOpen = document.querySelector('#toggle-privacy-btn .privacy-icon-open');
    const iconClosed = document.querySelector('#toggle-privacy-btn .privacy-icon-closed');
    
    if (isPrivacyMode) {
        iconOpen?.classList.add('hidden');
        iconClosed?.classList.remove('hidden');
    } else {
        iconOpen?.classList.remove('hidden');
        iconClosed?.classList.add('hidden');
    }

    updateDashboard(); 
    if (typeof window.renderPayrollQuincenaBanner === 'function') {
        window.renderPayrollQuincenaBanner();
    }
    if (document.getElementById('profile-salary-view') && !document.getElementById('profile-salary-view').classList.contains('hidden')) {
        if (typeof renderSalaryUI === 'function') renderSalaryUI(false);
    }
});

if (isPrivacyMode) {
    document.querySelector('#toggle-privacy-btn .privacy-icon-open')?.classList.add('hidden');
    document.querySelector('#toggle-privacy-btn .privacy-icon-closed')?.classList.remove('hidden');
}

// --- CICLOS DE FECHA PERSONALIZADOS ---
window.syncCycleStartDayUI = () => {
    const sel = document.getElementById('pref-month-start-day');
    const hint = document.getElementById('pref-month-start-hint');
    const currentDay = getMonthStartDay();
    if (sel) sel.value = String(currentDay);
    if (hint) {
        hint.innerText = currentDay === 1
            ? 'Tus presupuestos y gráficos van del día 1 al último día del mes.'
            : `Ejemplo: Tu ciclo actual va del ${getCycleRangeText(getMonthId(viewDate))}.`;
    }
};

window.updateCycleRangeBadge = () => {
    const pill = document.getElementById('cycle-range-pill');
    if (!pill) return;
    const rangeTxt = getCycleRangeText(getMonthId(viewDate));
    if (rangeTxt) {
        pill.innerText = rangeTxt;
        pill.classList.remove('hidden');
    } else {
        pill.classList.add('hidden');
    }
};

document.getElementById('menu-notifications-btn')?.addEventListener('click', syncCycleStartDayUI);

document.getElementById('pref-month-start-day')?.addEventListener('change', (e) => {
    if (!financeData.preferences) financeData.preferences = {};
    financeData.preferences.monthStartDay = parseInt(e.target.value, 10) || 1;
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    syncCycleStartDayUI();
    updateCycleRangeBadge();
    updateDashboard();
});

['prev-month', 'next-month', 'today-month-btn'].forEach(btnId => {
    document.getElementById(btnId)?.addEventListener('click', () => setTimeout(updateCycleRangeBadge, 20));
});
document.getElementById('quick-month-input')?.addEventListener('change', () => setTimeout(updateCycleRangeBadge, 20));

// --- SISTEMA DE PAPELERA DE RECICLAJE Y BORRADO EN CASCADA ---
window.moveTxToTrash = (txId) => {
    const tx = financeData.transactions.find(t => String(t.id) === String(txId));
    if (!tx) return;

    const linkedLibIds = new Set(
        Array.isArray(tx.linkedLibranzas)
            ? tx.linkedLibranzas.flatMap(l => [l.txId, l.intTxId].filter(Boolean).map(String))
            : []
    );

    // Detectar registros hijos vinculados (intereses, libranzas, cobros compartidos, splits)
    const children = financeData.transactions.filter(t =>
        !t.isDeleted && (
            String(t.linkedToTransfer) === String(tx.id) ||
            String(t.parentId) === String(tx.id) ||
            String(t.linkedLibranza) === String(tx.id) ||
            linkedLibIds.has(String(t.id))
        )
    );

    if (Array.isArray(tx.linkedLibranzas)) {
        tx.linkedLibranzas.forEach(l => {
            if (l.pocketId && l.pocketAmt > 0 && typeof adjustPocketBalance === 'function') {
                adjustPocketBalance(l.pocketId, -l.pocketAmt);
            } else if (l.targetTxId && l.quoteStep > 0) {
                const targetTx = financeData.transactions.find(t => String(t.id) === String(l.targetTxId));
                if (targetTx) targetTx.paidInstallments = Math.max(0, (targetTx.paidInstallments || 0) - l.quoteStep);
            } else if (l.debtId && l.quoteStep > 0) {
                const debtAcc = financeData.customAccounts.find(a => a.id === l.debtId);
                if (debtAcc) debtAcc.debtPaidQuotes = Math.max(0, (debtAcc.debtPaidQuotes || 0) - l.quoteStep);
            }
        });
    }

    const allToTrash = [tx, ...children].filter((item, idx, arr) => arr.findIndex(x => String(x.id) === String(item.id)) === idx);
const deleteTimestamp = Date.now();

    allToTrash.forEach(targetTx => {
        if (typeof revertTransferAllocation === 'function' && targetTx.type === 'transfer') {
            try {
                revertTransferAllocation(targetTx);
            } catch (err) {
                console.warn('No se pudo revertir asignación de transferencia:', err);
            }
        }
        if (isTxClosed(targetTx) && getAccountObj(targetTx.account).category === 'pocket' && !linkedLibIds.has(String(targetTx.id))) {
            if (targetTx.type === 'income') {
                const p = financeData.pockets.find(x => String(x.id) === String(targetTx.account));
                if (p) p.yields = Math.max(0, round2((p.yields || 0) - round2(targetTx.amount)));
            } else if (targetTx.type === 'expense' && typeof adjustPocketBalance === 'function') {
                adjustPocketBalance(targetTx.account, round2(targetTx.amount));
            }
        }
        targetTx.isDeleted = true;
        targetTx.deletedAt = deleteTimestamp;
        if (targetTx.id !== tx.id) {
            targetTx.deletedWithParent = tx.id;
        }
    });

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    hasUnsavedChanges = false;

    const returnAcc = window.returnToAccountDetail;
    window.returnToAccountDetail = null;

    forceCloseAllModals();
    updateDashboard();
    if (typeof updateTrashBadge === 'function') updateTrashBadge();

    if (returnAcc && returnAcc.accountId && typeof openAccountDetail === 'function') {
        openAccountDetail(returnAcc.accountId, returnAcc.originType || 'home');
    }
};

window.restoreTxFromTrash = (txId) => {
    const tx = financeData.transactions.find(t => String(t.id) === String(txId));
    if (!tx) return;

    const linkedLibIds = new Set(
        Array.isArray(tx.linkedLibranzas)
            ? tx.linkedLibranzas.flatMap(l => [l.txId, l.intTxId].filter(Boolean).map(String))
            : []
    );

    if (Array.isArray(tx.linkedLibranzas)) {
        tx.linkedLibranzas.forEach(l => {
            if (l.pocketId && l.pocketAmt > 0 && typeof adjustPocketBalance === 'function') {
                adjustPocketBalance(l.pocketId, l.pocketAmt);
            } else if (l.targetTxId && l.quoteStep > 0) {
                const targetTx = financeData.transactions.find(t => String(t.id) === String(l.targetTxId));
                if (targetTx) targetTx.paidInstallments = (targetTx.paidInstallments || 0) + l.quoteStep;
            } else if (l.debtId && l.quoteStep > 0) {
                const debtAcc = financeData.customAccounts.find(a => a.id === l.debtId);
                if (debtAcc) debtAcc.debtPaidQuotes = (debtAcc.debtPaidQuotes || 0) + l.quoteStep;
            }
        });
    }

    // Restaurar también los hijos que fueron borrados junto a este padre
    const toRestore = financeData.transactions.filter(t => 
        String(t.id) === String(txId) || String(t.deletedWithParent) === String(txId)
    );

    toRestore.forEach(targetTx => {
        if (isTxClosed(targetTx)) {
            const amt = round2(targetTx.amount);
            if (targetTx.type === 'transfer') {
                const fromObj = getAccountObj(targetTx.account);
                const toObj = getAccountObj(targetTx.toAccount);
                if (fromObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(fromObj.id, -amt);
                if (toObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(toObj.id, amt);

                if (Array.isArray(targetTx.allocatedItems)) {
                    targetTx.allocatedItems.forEach(item => {
                        if (item.kind === 'cc_tx') {
                            const refTx = financeData.transactions.find(t => String(t.id) === String(item.txId));
                            if (refTx) {
                                if (item.mode === 'extraordinary') {
                                    const inst = Math.max(1, parseInt(refTx.installments, 10) || 1);
                                    const paid = Math.max(0, parseInt(refTx.paidInstallments, 10) || 0);
                                    const rate = inst === 1 ? 0 : (parseFloat(refTx.rate) || 0);
                                    const rateType = refTx.rateType || 'monthly';
                                    const amort = calculateAmortization(round2(refTx.amount), inst, rate, rateType);
                                    refTx.extraPrincipalPaid = round2((refTx.extraPrincipalPaid || 0) + (item.amountApplied || 0));
                                    const rawRem = round2(amort.schedule.slice(paid).reduce((s, r) => s + r.principal, 0));
                                    const newRem = Math.max(0, round2(rawRem - refTx.extraPrincipalPaid));
                                    if (newRem <= 0.01) {
                                        item.prevPaidInstallments = paid;
                                        refTx.paidInstallments = inst;
                                        refTx.wasClosedByExtra = true;
                                    } else if ((item.strategy || targetTx.extraStrategy) === 'reduce_quota') {
                                        item.prevMonthlyQuota = refTx.monthlyQuota;
                                        refTx.monthlyQuota = calculateAmortization(newRem, Math.max(1, inst - paid), rate, rateType).payment;
                                    }
                                } else {
                                    refTx.paidInstallments = (refTx.paidInstallments || 0) + 1;
                                }
                            }
                        } else if (item.kind === 'debt_quota') {
                            if (item.mode === 'extraordinary' && typeof window.applyTransferAllocatedItems === 'function') {
                                window.applyTransferAllocatedItems({ ...targetTx, allocatedItems: [item] }, new Date(Number(targetTx.id) || Date.now()));
                            } else {
                                const debtAcc = financeData.customAccounts.find(a => a.id === item.debtId);
                                if (debtAcc) debtAcc.debtPaidQuotes = (debtAcc.debtPaidQuotes || 0) + 1;
                            }
                        }
                    });
                }
            } else if (getAccountObj(targetTx.account).category === 'pocket' && !linkedLibIds.has(String(targetTx.id))) {
                if (targetTx.type === 'income') {
                    const p = financeData.pockets.find(x => String(x.id) === String(targetTx.account));
                    if (p) p.yields = round2((p.yields || 0) + amt);
                } else if (targetTx.type === 'expense' && typeof adjustPocketBalance === 'function') {
                    adjustPocketBalance(targetTx.account, -amt);
                }
            }
        }
        delete targetTx.isDeleted;
        delete targetTx.deletedAt;
        delete targetTx.deletedWithParent;
    });

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    if (typeof renderTrashModal === 'function') renderTrashModal();
    updateDashboard();
    if (typeof updateTrashBadge === 'function') updateTrashBadge();
};

window.permanentlyDeleteTx = (txId) => {
    if (typeof window.openBentoConfirmModal === 'function') {
        window.openBentoConfirmModal({
            title: 'Eliminar Movimiento',
            subtitle: 'Acción irreversible',
            message: '¿Eliminar este movimiento <b>definitivamente</b>? Esta acción no se puede deshacer.',
            confirmText: 'Sí, eliminar',
            cancelText: 'Cancelar',
            danger: true,
            onConfirm: () => {
                // Eliminar definitivamente el padre y sus hijos en cascada
                financeData.transactions = financeData.transactions.filter(t => 
                    String(t.id) !== String(txId) && String(t.deletedWithParent) !== String(txId)
                );

                localStorage.setItem('myFinances', JSON.stringify(financeData));
                if (typeof renderTrashModal === 'function') renderTrashModal();
                if (typeof updateTrashBadge === 'function') updateTrashBadge();
            }
        });
    } else {
        // Fallback de seguridad
        if (!confirm('¿Eliminar este movimiento definitivamente? Esta acción no se puede deshacer.')) return;
        financeData.transactions = financeData.transactions.filter(t => 
            String(t.id) !== String(txId) && String(t.deletedWithParent) !== String(txId)
        );
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        if (typeof renderTrashModal === 'function') renderTrashModal();
        if (typeof updateTrashBadge === 'function') updateTrashBadge();
    }
};

window.updateTrashBadge = () => {
    const count = financeData.transactions.filter(t => t.isDeleted).length;
    const badge = document.getElementById('drawer-trash-badge');
    if (badge) {
        badge.innerText = count;
        badge.classList.toggle('hidden', count === 0);
    }
};

document.getElementById('drawer-trash')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (typeof closeSideDrawer === 'function') closeSideDrawer();
    if (typeof attemptCloseModals === 'function' && !attemptCloseModals()) return;
    const trashModal = document.getElementById('trash-modal');
    if (trashModal) {
        document.body.appendChild(trashModal);
        trashModal.classList.remove('hidden');
        if (typeof renderTrashModal === 'function') renderTrashModal();
    }
}, true);

window.renderTrashModal = () => {
    const container = document.getElementById('trash-list-container');
    const countLabel = document.getElementById('trash-count-label');
    const emptyBtn = document.getElementById('btn-empty-trash');
    if (!container) return;

    const deletedTxs = financeData.transactions
        .filter(t => t.isDeleted)
        .sort((a, b) => (b.deletedAt || b.id) - (a.deletedAt || a.id));

    if (countLabel) countLabel.innerText = `${deletedTxs.length} elemento${deletedTxs.length !== 1 ? 's' : ''}`;
    if (emptyBtn) emptyBtn.classList.toggle('hidden', deletedTxs.length === 0);

    if (deletedTxs.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:13px;">La papelera está vacía.</div>`;
        return;
    }

    container.innerHTML = deletedTxs.map(t => {
        const sign = t.type === 'income' ? '+' : (t.type === 'expense' ? '-' : '');
        const colorCls = t.type === 'income' ? 'positive' : (t.type === 'expense' ? 'negative' : 'accent');
        const esc = window.escapeHtml || ((s) => String(s ?? ''));
        const escA = window.escapeAttr || esc;
        const safeDesc = esc(stripLeadingEmoji(t.description));
        const safeAcc = esc(stripLeadingEmoji(getAccountObj(t.account).name));
        const safeDate = esc(t.date || '');
        const safeId = escA(t.id);
        return `
            <div class="acc-list-item" style="cursor:default; padding:12px; align-items:center; gap:8px;">
                <div style="flex:1; min-width:0;">
                    <strong style="display:block; font-size:13.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeDesc}</strong>
                    <small style="display:block; font-size:11px; color:var(--text-muted);">${safeAcc} • ${safeDate}</small>
                    <strong class="${colorCls}" style="font-size:13px;">${sign}${formatMoney(t.amount)}</strong>
                </div>
                <div style="display:flex; gap:6px; flex-shrink:0;">
                    <button type="button" data-trash-restore="${safeId}" class="mini-action-btn" style="color:var(--positive); border-color:rgba(16,185,129,0.3); background:rgba(16,185,129,0.1); font-weight:700; padding:6px 12px;">Restaurar</button>
                    <button type="button" data-trash-perm-del="${safeId}" class="mini-action-btn" style="color:var(--negative); border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.08); padding:6px 12px;">✕</button>
                </div>
            </div>
        `;
    }).join('');
};

document.addEventListener('click', (e) => {
    const delBtn = e.target.closest('#delete-btn');
    if (delBtn) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const editId = document.getElementById('edit-id')?.value;
        if (!editId) return;

        if (typeof window.openBentoConfirmModal === 'function') {
            window.openBentoConfirmModal({
                title: 'Mover a la Papelera',
                subtitle: 'Borrado seguro',
                message: '¿Deseas mover este movimiento a la papelera de reciclaje? Podrás restaurarlo después si lo necesitas.',
                confirmText: 'Mover a papelera',
                cancelText: 'Cancelar',
                danger: true,
                onConfirm: () => {
                    moveTxToTrash(editId);
                }
            });
        } else {
            moveTxToTrash(editId);
        }
    }
}, true);

document.getElementById('btn-empty-trash')?.addEventListener('click', () => {
    const count = financeData.transactions.filter(t => t.isDeleted).length;
    if (count === 0) return;

    const executeEmptyTrash = () => {
        financeData.transactions = financeData.transactions.filter(t => !t.isDeleted);
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        renderTrashModal();
        updateTrashBadge();
    };

    if (typeof window.openBentoConfirmModal === 'function') {
        window.openBentoConfirmModal({
            title: 'Vaciar Papelera',
            subtitle: 'Acción irreversible',
            message: `¿Vaciar la papelera y eliminar definitivamente <b>${count} movimiento${count !== 1 ? 's' : ''}</b>? Esta acción no se puede deshacer.`,
            confirmText: 'Sí, vaciar',
            cancelText: 'Cancelar',
            danger: true,
            onConfirm: executeEmptyTrash
        });
    } else if (confirm(`¿Vaciar la papelera y eliminar definitivamente ${count} movimiento(s)?`)) {
        executeEmptyTrash();
    }
});

// --- SISTEMA DE ETIQUETAS #TAGS Y CLONACIÓN DE MOVIMIENTOS ---
window.filterByTxTag = (tag, event) => {
    if (event) event.stopPropagation();
    const targetQuery = `#${String(tag).toLowerCase()}`;
    const searchInput = document.getElementById('history-search-input');

    if (historySearchQuery.toLowerCase() !== targetQuery) {
        historySearchQuery = targetQuery;
        if (searchInput) searchInput.value = targetQuery;
    } else if (event) {
        historySearchQuery = '';
        if (searchInput) searchInput.value = '';
    }
    
    forceCloseAllModals();
    updateDashboard();
    
    const listContainer = document.getElementById('transaction-list');
    if (listContainer) listContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

const renderHistoryTagsUI = (monthId, filteredTxs) => {
    const stripEl = document.getElementById('history-tags-strip');
    const summaryEl = document.getElementById('history-tag-summary');

    if (stripEl) {
        const monthTagCounts = {};
        financeData.transactions.forEach(t => {
            if (!t.isDeleted && getTxMonthId(t) === monthId && Array.isArray(t.tags)) {
                t.tags.forEach(tg => {
                    monthTagCounts[tg] = (monthTagCounts[tg] || 0) + 1;
                });
            }
        });
        const monthTags = Object.keys(monthTagCounts).sort((a, b) => monthTagCounts[b] - monthTagCounts[a]);

        if (monthTags.length === 0) {
            stripEl.classList.add('hidden');
            stripEl.innerHTML = '';
        } else {
            stripEl.classList.remove('hidden');
            const activeClean = historySearchQuery.startsWith('#') ? historySearchQuery.slice(1).toLowerCase() : '';
            const esc = window.escapeHtml || ((s) => String(s ?? ''));
        const escA = window.escapeAttr || esc;
        stripEl.innerHTML = monthTags.map(tg => {
            const isActive = activeClean === tg.toLowerCase();
            return `<button type="button" class="pill-btn ${isActive ? 'active' : ''}" style="font-size:10.5px; padding:4px 9px;" data-filter-tag="${escA(tg)}">#${esc(tg)} (${monthTagCounts[tg]})</button>`;
        }).join('');
    }
}

    if (summaryEl) {
        if (historySearchQuery.startsWith('#') && historySearchQuery.length > 1) {
            const esc = window.escapeHtml || ((s) => String(s ?? ''));
            const escA = window.escapeAttr || esc;
            const tagLabel = historySearchQuery;
            let tagInc = 0, tagExp = 0;
            filteredTxs.forEach(t => {
                const amt = round2(t.status === 'pending' ? (t.budgetedAmount || t.amount) : t.amount);
                if (t.type === 'income') tagInc = round2(tagInc + amt);
                else if (t.type === 'expense') tagExp = round2(tagExp + amt);
            });
            const displayTotal = tagInc > 0 && tagExp > 0
                ? `<span class="positive">+${formatCompact(tagInc)}</span> / <span class="negative">-${formatCompact(tagExp)}</span>`
                : (tagInc > 0
                    ? `<strong class="positive">+${formatMoney(tagInc)}</strong>`
                    : `<strong class="negative">-${formatMoney(tagExp)}</strong>`);

            summaryEl.classList.remove('hidden');
            summaryEl.innerHTML = `
                <div style="min-width:0;">
                    <strong style="color:var(--accent); display:block;">Resumen ${esc(tagLabel)} (${filteredTxs.length})</strong>
                    <div style="margin-top:2px;">Total acumulado: ${displayTotal}</div>
                </div>
                <button type="button" class="mini-action-btn" data-filter-tag="${escA(tagLabel.slice(1))}">✕ Limpiar</button>
            `;
        } else {
            summaryEl.classList.add('hidden');
            summaryEl.innerHTML = '';
        }
    }
};

const renderTxModalTagSuggestions = () => {
    const box = document.getElementById('trans-tags-suggestions');
    const input = document.getElementById('trans-tags');
    if (!box || !input) return;

    const topTags = getAllUsedTags().slice(0, 8);
    if (topTags.length === 0) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const currentSelected = new Set(extractTransactionTags(input.value, ''));
    box.classList.remove('hidden');
    const escTag = window.escapeHtml || ((s) => String(s ?? ''));
    const escTagAttr = window.escapeAttr || escTag;
    box.innerHTML = topTags.map(({ tag }) => {
        const isSel = currentSelected.has(tag);
        return `<button type="button" class="tag-suggestion-chip ${isSel ? 'selected' : ''}" data-suggest-tag="${escTagAttr(tag)}">#${escTag(tag)}</button>`;
    }).join('');
};

document.getElementById('trans-tags')?.addEventListener('input', renderTxModalTagSuggestions);

document.getElementById('trans-tags-suggestions')?.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-suggest-tag]');
    const input = document.getElementById('trans-tags');
    if (!chip || !input) return;

    const clickedTag = chip.getAttribute('data-suggest-tag');
    const current = new Set(extractTransactionTags(input.value, ''));
    if (current.has(clickedTag)) current.delete(clickedTag);
    else current.add(clickedTag);

    input.value = Array.from(current).map(tg => `#${tg}`).join(' ');
    renderTxModalTagSuggestions();
});

// --- ORGANIZADOR VISUAL Y LÓGICA DE BOTONES (GUARDAR / DUPLICAR / ELIMINAR) ---
window.syncTxModalActionButtons = (isEditMode = false) => {
    const txForm = document.getElementById('transaction-form');
    if (!txForm) return;

    const submitBtn = txForm.querySelector('button[type="submit"]');
    const delBtn = document.getElementById('delete-btn');
    let dupBtn = document.getElementById('duplicate-tx-btn');

    if (!submitBtn) return;

    if (!dupBtn) {
        dupBtn = document.createElement('button');
        dupBtn.type = 'button';
        dupBtn.id = 'duplicate-tx-btn';
    }

    let actionsStack = document.getElementById('tx-modal-actions-stack');
    if (!actionsStack) {
        actionsStack = document.createElement('div');
        actionsStack.id = 'tx-modal-actions-stack';
        actionsStack.style.cssText = 'display:flex; flex-direction:column; gap:10px; margin-top:16px; width:100%;';

        const secondaryRow = document.createElement('div');
        secondaryRow.id = 'tx-edit-secondary-actions';
        secondaryRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:10px; width:100%;';

        const oldWrapper = submitBtn.parentElement;
        txForm.appendChild(actionsStack);
        actionsStack.appendChild(submitBtn);
        actionsStack.appendChild(secondaryRow);
        secondaryRow.appendChild(dupBtn);
        if (delBtn) secondaryRow.appendChild(delBtn);

        if (oldWrapper && oldWrapper !== txForm && oldWrapper.children.length === 0) {
            oldWrapper.style.display = 'none';
        }
    }

    submitBtn.style.width = '100%';
    submitBtn.style.margin = '0';
    submitBtn.style.minHeight = '46px';
    submitBtn.style.borderRadius = '14px';
    submitBtn.style.fontSize = '14.5px';
    submitBtn.style.fontWeight = '700';

    dupBtn.className = 'btn btn-secondary';
    dupBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; min-height:42px; margin:0; padding:0 12px; border-radius:13px; font-size:13px; font-weight:700; background:var(--hover-bg); color:var(--text-main); border:1px solid var(--border-color);';
    dupBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>Duplicar</span>`;

    if (delBtn) {
        delBtn.className = 'btn';
        delBtn.style.cssText = 'display:inline-flex; align-items:center; justify-content:center; gap:6px; width:100%; min-height:42px; margin:0; padding:0 12px; border-radius:13px; font-size:13px; font-weight:700; background:rgba(239, 68, 68, 0.12); color:var(--negative); border:1px solid rgba(239, 68, 68, 0.28);';
        delBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg><span>Eliminar</span>`;
    }

    const secondaryRow = document.getElementById('tx-edit-secondary-actions');
    if (secondaryRow) {
        secondaryRow.classList.toggle('hidden', !isEditMode);
        secondaryRow.style.display = isEditMode ? 'grid' : 'none';
    }
    dupBtn.classList.toggle('hidden', !isEditMode);
    if (delBtn) delBtn.classList.toggle('hidden', !isEditMode);

    if (!dupBtn.dataset.boundDup) {
        dupBtn.dataset.boundDup = '1';
        dupBtn.addEventListener('click', () => {
            const editInput = document.getElementById('edit-id');
            if (!editInput || !editInput.value) return;

            editInput.value = '';
            syncTxModalActionButtons(false);

            const titleEl = document.getElementById('modal-title');
            if (titleEl) titleEl.innerText = 'Duplicar Movimiento';

            const now = new Date();
            const dateInput = document.getElementById('trans-date');
            const timeInput = document.getElementById('trans-time');
            if (dateInput) dateInput.value = now.toLocaleDateString('en-CA');
            if (timeInput) timeInput.value = now.toTimeString().slice(0, 5);

            const statusInput = document.getElementById('trans-status');
            if (statusInput) statusInput.value = 'closed';

            if (typeSelect?.value === 'transfer' && typeof updateTransferAllocationUI === 'function') {
                updateTransferAllocationUI({ preserveSelection: false, keepProvidedAmount: true });
            }

            hasUnsavedChanges = true;
            document.getElementById('amount')?.focus();
        });
    }
};

const txModalEl = document.getElementById('transaction-modal');
if (txModalEl) {
    const txModalObserver = new MutationObserver(() => {
        if (!txModalEl.classList.contains('hidden')) {
            const editId = document.getElementById('edit-id')?.value;
            syncTxModalActionButtons(!!editId);

            const tagsInput = document.getElementById('trans-tags');
            if (tagsInput) {
                if (editId) {
                    const tx = financeData.transactions.find(t => String(t.id) === String(editId));
                    tagsInput.value = (tx && Array.isArray(tx.tags) && tx.tags.length > 0)
                        ? tx.tags.map(tg => `#${tg}`).join(' ')
                        : '';
                } else {
                    tagsInput.value = '';
                }
                renderTxModalTagSuggestions();
            }
        }
    });
    txModalObserver.observe(txModalEl, { attributes: true, attributeFilter: ['class'] });
}

window.renderPayrollQuincenaBanner = () => {
    const existing = document.getElementById('payroll-quincena-inapp-banner');
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('lumenPayrollQuincenaAlert') || 'null'); } catch {}

    // Ocultar si no existe o si ya pasaron más de 4 días
    if (!saved || !saved.items?.length || (Date.now() - saved.createdAt) > 4 * 24 * 60 * 60 * 1000) {
        if (existing) existing.remove();
        return;
    }

    const hideAmounts = localStorage.getItem('myFinancesPrivacyMode') === 'true';
    const totalLabel = hideAmounts
        ? `${saved.items.length} pago(s) próximos`
        : `${saved.items.length} pago(s) • Total ${formatMoney(saved.totalDue)}`;

    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const rowsHtml = saved.items.map(item => {
        if (typeof item === 'string') {
            return `<div style="font-size:11.5px; color:var(--text-main); font-weight:600;">• ${esc(item)}</div>`;
        }
        const amtText = hideAmounts ? '••••' : formatMoney(item.amount || 0);
        const dateBadge = item.dateStr
            ? `<span style="font-size:10.5px; color:var(--text-muted); font-weight:600; white-space:nowrap;">• Vence ${esc(item.dateStr)}</span>`
            : '';
        return `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; font-size:11.5px; line-height:1.3;">
                <div style="min-width:0; flex:1; display:flex; align-items:center; gap:5px; flex-wrap:wrap;">
                    <span style="font-weight:700; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:100%;">${esc(item.name)}</span>
                    ${dateBadge}
                </div>
                <strong style="font-size:12px; font-weight:800; color:var(--text-main); white-space:nowrap; flex-shrink:0;">${amtText}</strong>
            </div>
        `;
    }).join('');

    const bannerEl = existing || document.createElement('div');
    bannerEl.id = 'payroll-quincena-inapp-banner';
    bannerEl.style.cssText = 'display:flex; flex-direction:column; gap:8px; width:100%; box-sizing:border-box; padding:12px 14px; margin:0 0 12px 0; border-radius:16px; background:var(--card-bg); border:1px solid var(--border-color); border-left:4px solid var(--accent); box-shadow:0 4px 14px rgba(0,0,0,0.04);';

    bannerEl.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
            <div style="min-width:0; flex:1;">
                <div style="font-size:13px; font-weight:800; color:var(--text-main); display:flex; align-items:center; gap:6px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>
                    <span>${esc(saved.title || 'Pagos de esta quincena')}</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-weight:700; margin-top:1px;">${esc(totalLabel)}</div>
            </div>
            <button type="button" id="dismiss-payroll-quincena-banner" title="Entendido" style="width:30px; height:30px; border-radius:10px; border:1px solid var(--border-color); background:var(--hover-bg); color:var(--text-muted); display:inline-flex; align-items:center; justify-content:center; cursor:pointer; flex-shrink:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
        </div>
        <div style="display:flex; flex-direction:column; gap:6px; padding-top:8px; border-top:1px dashed var(--border-color);">
            ${rowsHtml}
        </div>
    `;

    if (!existing) {
        const summaryCard = document.querySelector('#current-month-display, .month-selector')?.closest('.card, .bento-card, .summary-card, section')
            || document.querySelector('#current-month-display, .month-selector')?.parentElement?.parentElement;
        if (summaryCard && summaryCard.parentNode) {
            summaryCard.parentNode.insertBefore(bannerEl, summaryCard);
        }
    }
};

window.triggerPayrollQuincenaAlert = async (refDateStr) => {
    try {
        let salCfg = {};
        try { salCfg = JSON.parse(localStorage.getItem('myFinancesSalary') || '{}'); } catch {}
        const cfgValues = Object.values(salCfg).map(v => String(v || '').toLowerCase().trim());
        const rawDays = String(salCfg.payDays || salCfg.paymentDays || '');
        const nums = (rawDays.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 31);
        const isMonthly = cfgValues.some(v => v === 'monthly' || v === 'mensual')
            || salCfg.isBiweekly === false
            || (!cfgValues.some(v => v === 'biweekly' || v === 'quincenal') && salCfg.isBiweekly !== true && nums.length === 1);

        const periodTitle = isMonthly ? 'Pagos de este mes' : 'Pagos de esta quincena';
        const periodPhrase = isMonthly ? 'este mes' : 'esta quincena';

        const rawBase = refDateStr ? new Date(`${refDateStr}T12:00:00`) : new Date();
        const baseDate = new Date(rawBase.getFullYear(), rawBase.getMonth(), rawBase.getDate(), 0, 0, 0);

        let horizon = new Date(rawBase.getFullYear(), rawBase.getMonth(), rawBase.getDate() + (isMonthly ? 30 : 15), 23, 59, 59);
        if (typeof window.getResolvedSalaryPayDays === 'function') {
            const y = baseDate.getFullYear();
            const m = baseDate.getMonth();
            const nextM = new Date(y, m + 1, 1);
            const candidates = [
                ...window.getResolvedSalaryPayDays(salCfg, y, m).map(d => new Date(y, m, d, 23, 59, 59)),
                ...window.getResolvedSalaryPayDays(salCfg, nextM.getFullYear(), nextM.getMonth()).map(d => new Date(nextM.getFullYear(), nextM.getMonth(), d, 23, 59, 59))
            ];
            const minAhead = new Date(baseDate.getTime() + 7 * 86400000);
            const nextPay = candidates.find(dt => dt >= minAhead);
            if (nextPay) {
                horizon = new Date(nextPay.getFullYear(), nextPay.getMonth(), nextPay.getDate() - 1, 23, 59, 59);
            }
        }

        const formatShortDue = (d) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        const hideAmounts = localStorage.getItem('myFinancesPrivacyMode') === 'true';
        const items = [];
        let totalDue = 0;

        // 1. Suscripciones activas en el horizonte (15 o 30 días)
        (financeData.subscriptions || []).filter(s => s.status === 'active' && s.nextBillingDate).forEach(sub => {
            const d = new Date(`${sub.nextBillingDate}T12:00:00`);
            const amt = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(Number(sub.amount) || 0);
            if (d >= baseDate && d <= horizon && amt > 0) {
                items.push({ name: stripLeadingEmoji(sub.name), amount: amt, dateStr: formatShortDue(d), ts: d.getTime() });
                totalDue = round2(totalDue + amt);
            }
        });

        // 2. Gastos pendientes en el horizonte
        (financeData.transactions || []).filter(t => !t.isDeleted && t.type === 'expense' && t.status === 'pending').forEach(tx => {
            const d = new Date(tx.id);
            const amt = round2(tx.budgetedAmount || tx.amount || 0);
            if (d >= baseDate && d <= horizon && amt > 0) {
                items.push({ name: stripLeadingEmoji(tx.description || tx.category || 'Pago programado'), amount: amt, dateStr: formatShortDue(d), ts: d.getTime() });
                totalDue = round2(totalDue + amt);
            }
        });

        // 3. Tarjetas de crédito con pago en el horizonte
        const currSnap = computeBalancesUpTo(getMonthId(baseDate));
        const maxDaysBase = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
        const maxDaysNext = new Date(baseDate.getFullYear(), baseDate.getMonth() + 2, 0).getDate();

        (financeData.customAccounts || []).filter(a => a.category === 'credit_card' && a.paymentDay).forEach(c => {
            const bal = round2(currSnap.bals[c.id] || 0);
            if (bal > 0) {
                let payDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), Math.min(c.paymentDay, maxDaysBase), 12, 0, 0);
                if (payDate < baseDate) {
                    payDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, Math.min(c.paymentDay, maxDaysNext), 12, 0, 0);
                }
                if (payDate <= horizon) {
                    const est = calculateCardMinPaymentEstimate(c, bal);
                    const amt = round2(est.totalMinPayment || 0);
                    if (amt > 0) {
                        items.push({ name: `TC ${stripLeadingEmoji(c.name)}`, amount: amt, dateStr: formatShortDue(payDate), ts: payDate.getTime() });
                        totalDue = round2(totalDue + amt);
                    }
                }
            }
        });

        // 4. Préstamos activos (no libranza) con pago en el horizonte
        (financeData.customAccounts || []).filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
            const bal = round2(currSnap.bals[d.id] || 0);
            if (bal > 0) {
                const payDay = Number(d.paymentDay) || 30;
                let payDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), Math.min(payDay, maxDaysBase), 12, 0, 0);
                if (payDate < baseDate) {
                    payDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, Math.min(payDay, maxDaysNext), 12, 0, 0);
                }
                if (payDate <= horizon) {
                    const qInfo = typeof getDebtMonthlyQuotaBreakdown === 'function'
                        ? getDebtMonthlyQuotaBreakdown(d, bal)
                        : { totalQuota: round2(d.debtMonthlyPayment || 0) };
                    const amt = round2(qInfo.totalQuota || 0);
                    if (amt > 0) {
                        items.push({ name: stripLeadingEmoji(d.name), amount: amt, dateStr: formatShortDue(payDate), ts: payDate.getTime() });
                        totalDue = round2(totalDue + amt);
                    }
                }
            }
        });

        if (items.length === 0) return;

        // Ordenar cronológicamente del vencimiento más cercano al más lejano
        items.sort((a, b) => a.ts - b.ts);

        // A. Guardar y mostrar la tarjeta inteligente dentro de la app
        localStorage.setItem('lumenPayrollQuincenaAlert', JSON.stringify({
            title: periodTitle,
            items,
            totalDue,
            createdAt: Date.now()
        }));
        window.renderPayrollQuincenaBanner();

        // B. Disparar notificación nativa de Android
        if (!window.Capacitor?.isNativePlatform?.()) return;
        const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
        if (!LocalNotifications) return;

        let perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'prompt') perm = await LocalNotifications.requestPermissions();
        if (perm.display !== 'granted') return;

        const previewList = items.slice(0, 3).map(it =>
            hideAmounts ? `${it.name} (${it.dateStr})` : `${it.name} (${it.dateStr}: ${formatMoney(it.amount)})`
        ).join(', ') + (items.length > 3 ? ` y ${items.length - 3} más` : '');

        const bodyText = hideAmounts
            ? `Tienes ${items.length} pago(s) ${periodPhrase}: ${previewList}.`
            : `Cubre ${items.length} pago(s) (${formatMoney(totalDue)}) ${periodPhrase}: ${previewList}.`;

        await LocalNotifications.schedule({
            notifications: [{
                id: 8888,
                title: `Nómina registrada • ${periodTitle}`,
                body: bodyText,
                channelId: 'lumen_alerts_v1',
                schedule: { at: new Date(Date.now() + 2500), allowWhileIdle: true }
            }]
        });
    } catch (err) {
        console.warn('Error en alerta de nómina:', err);
    }
};

// Renderizar el banner si ya había una alerta activa al abrir la app
document.addEventListener('DOMContentLoaded', () => setTimeout(() => window.renderPayrollQuincenaBanner(), 300));

// --- SOPORTE MULTIMONEDA OFFLINE Y CAPTURA TRANSACCIONAL DE #TAGS EN MODAL ---
let activeTxCurrency = 'COP';
let pendingTxTagsPayload = null;

const updateTxCurrencyPreview = () => {
    const previewEl = document.getElementById('tx-currency-preview');
    const inputEl = document.getElementById('amount');
    if (!previewEl || !inputEl) return;

    if (activeTxCurrency === 'COP') {
        previewEl.classList.add('hidden');
        return;
    }

    const rawForeign = parseMoneyInput(inputEl.value);
    if (rawForeign <= 0) {
        previewEl.classList.add('hidden');
        return;
    }

    const rate = (financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420);
    const convertedCop = round2(rawForeign * rate);
    
    previewEl.classList.remove('hidden');
    previewEl.innerHTML = `Conversión: <b style="color:var(--text-main);">${formatMoney(convertedCop)} COP</b> (Tasa: ${formatMoney(rate)})`;
};

document.getElementById('amount')?.addEventListener('input', updateTxCurrencyPreview);

document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        activeTxCurrency = e.target.getAttribute('data-curr') || 'COP';
        
        const amtInput = document.getElementById('amount');
        if (amtInput) {
            amtInput.value = '';
            updateTxCurrencyPreview();
            amtInput.focus();
        }
    });
});

if (txModalEl) {
    const currObserver = new MutationObserver(() => {
        if (!txModalEl.classList.contains('hidden')) {
            document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => {
                const isCop = b.getAttribute('data-curr') === 'COP';
                b.classList.toggle('active', isCop);
                if (isCop) activeTxCurrency = 'COP';
            });
            const previewEl = document.getElementById('tx-currency-preview');
            if (previewEl) previewEl.classList.add('hidden');
        }
    });
    currObserver.observe(txModalEl, { attributes: true, attributeFilter: ['class'] });
}

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'transaction-form') {
        let fxRollback = null;
        if (activeTxCurrency !== 'COP') {
            const inputEl = document.getElementById('amount');
            const owedEl = document.getElementById('shared-owed-amount');
            const isSharedChk = !!document.getElementById('is-shared-expense')?.checked;
            const descEl = document.getElementById('description');
            const tagsInput = document.getElementById('trans-tags');

            if (inputEl && descEl && tagsInput) {
                const rawForeign = parseMoneyInput(inputEl.value);
                if (rawForeign > 0) {
                    fxRollback = {
                        amountVal: inputEl.value,
                        owedVal: owedEl ? owedEl.value : '',
                        descVal: descEl.value,
                        tagsVal: tagsInput.value
                    };
                    const rate = (financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420);
                    const convertedCop = round2(rawForeign * rate);

                    inputEl.value = formatNumberInput(convertedCop);
                    if (isSharedChk && owedEl) {
                        const rawOwedForeign = parseMoneyInput(owedEl.value);
                        if (rawOwedForeign > 0) {
                            owedEl.value = formatNumberInput(round2(rawOwedForeign * rate));
                        }
                    }
                    descEl.value = `${descEl.value.trim()} [${formatNumberInput(rawForeign, 2)} ${activeTxCurrency}]`;

                    const currencyTag = `#${activeTxCurrency.toLowerCase()}`;
                    if (!tagsInput.value.toLowerCase().includes(currencyTag)) {
                        tagsInput.value = `${tagsInput.value} ${currencyTag}`.trim();
                    }
                }
            }
        }

        const editId = document.getElementById('edit-id')?.value || '';
        const rawTags = document.getElementById('trans-tags')?.value || '';
        const desc = document.getElementById('description')?.value || '';
        pendingTxTagsPayload = {
            editId,
            tags: extractTransactionTags(rawTags, desc),
            existingIds: new Set(financeData.transactions.map(t => String(t.id))),
            type: document.getElementById('type')?.value || '',
            cat: (document.getElementById('trans-category')?.value || '').toLowerCase(),
            desc: desc.toLowerCase(),
            date: document.getElementById('trans-date')?.value || '',
            fxRollback
        };
        if (financeData.preferences?.rememberAccount) {
            financeData.preferences.lastAccount = document.getElementById('account')?.value;
        }
        if (financeData.preferences?.rememberCategory && document.getElementById('type')?.value === 'expense') {
            financeData.preferences.lastCategory = document.getElementById('trans-category')?.value;
        }
    }
}, true);

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'transaction-form' && pendingTxTagsPayload) {
        const payload = pendingTxTagsPayload;
        pendingTxTagsPayload = null;

        // Si el modal sigue abierto, la validacion aborto el envio: restaurar montos en divisa original
        if (!document.getElementById('transaction-modal')?.classList.contains('hidden')) {
            if (payload.fxRollback) {
                const inputEl = document.getElementById('amount');
                const owedEl = document.getElementById('shared-owed-amount');
                const descEl = document.getElementById('description');
                const tagsInput = document.getElementById('trans-tags');
                if (inputEl) inputEl.value = payload.fxRollback.amountVal;
                if (owedEl) owedEl.value = payload.fxRollback.owedVal;
                if (descEl) descEl.value = payload.fxRollback.descVal;
                if (tagsInput) tagsInput.value = payload.fxRollback.tagsVal;
                updateTxCurrencyPreview();
            }
            return;
        }

        if (payload.editId) {
            const tx = financeData.transactions.find(t => String(t.id) === String(payload.editId));
            if (tx) {
                const merged = tx.isRefund && !payload.tags.includes('reembolso')
                    ? [...payload.tags, 'reembolso']
                    : payload.tags;
                if (merged.length > 0) tx.tags = Array.from(new Set(merged));
                else delete tx.tags;
            }
        } else if (payload.tags.length > 0) {
            financeData.transactions.forEach((newTx) => {
                if (newTx && !newTx.isAdjustment && !payload.existingIds.has(String(newTx.id))) {
                    newTx.tags = Array.from(new Set([...(Array.isArray(newTx.tags) ? newTx.tags : []), ...payload.tags]));
                }
            });
        }
        if (!payload.editId && payload.type === 'income' && (/salario|n[oó]mina|quincena/.test(payload.cat) || /salario|n[oó]mina|quincena/.test(payload.desc))) {
            window.triggerPayrollQuincenaAlert(payload.date);
        }
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        updateDashboard();
    }
}, false);

// --- MEMORIA PREDICTIVA DE ÚLTIMA CUENTA / CATEGORÍA ---
document.addEventListener('click', (e) => {
    const clickedFabOpt = e.target.closest('.fab-option');
    if (clickedFabOpt) {
        setTimeout(() => {
            const prefs = financeData.preferences || {};
            if (prefs.rememberAccount && prefs.lastAccount) {
                const accSelect = document.getElementById('account');
                if (accSelect && Array.from(accSelect.options).some(o => o.value === prefs.lastAccount)) {
                    accSelect.value = prefs.lastAccount;
                }
            }
            if (prefs.rememberCategory && prefs.lastCategory && clickedFabOpt.getAttribute('data-type') === 'expense') {
                const catSelect = document.getElementById('trans-category');
                if (catSelect && Array.from(catSelect.options).some(o => o.value === prefs.lastCategory)) {
                    catSelect.value = prefs.lastCategory;
                    catSelect.dispatchEvent(new Event('change'));
                }
            }
        }, 60);
    }
}, true);

// ==========================================
// 15D. OMNI-MODAL: CENTRALIZACIÓN DE REGISTROS
// ==========================================
let pendingOmniPayrollLibranza = null;
let pendingOmniSubscriptionId = null;
let userEditedBudgetField = false;

window.openOmniModal = (config = {}) => {
    const {
        mode = 'create', txId = null, type = 'expense', title = null,
        lockType = false, amount = '', account = '', toAccount = '',
        category = '', description = '', status = 'closed',
        dateMs = null, hideRecurrence = false, installments = 1,
        autoSelectBilled = false
    } = config;

    if (typeof forceCloseAllModals === 'function') forceCloseAllModals();
    const tModal = document.getElementById('transaction-modal');
    if (!tModal) return;

    form?.reset();
    document.getElementById('edit-id').value = mode === 'edit' ? txId : '';
    const defaultTitles = mode === 'edit'
        ? { expense: 'Editar Gasto', income: 'Editar Ingreso', transfer: 'Editar Transferencia' }
        : { expense: 'Nuevo Gasto', income: 'Nuevo Ingreso', transfer: 'Nueva Transferencia' };
    document.getElementById('modal-title').innerText = title || defaultTitles[type];
    
    if (typeSelect) {
        typeSelect.value = type; 
        typeSelect.disabled = lockType;
        typeSelect.dispatchEvent(new Event('change'));
    }
    
    if (lockType) {
        document.getElementById('quick-payroll-shortcut')?.classList.add('hidden');
    }

    const statusEl = document.getElementById('trans-status');
    if (statusEl) statusEl.value = status;
    
    if (amount !== '') {
        document.getElementById('amount').value = formatNumberInput(amount);
        document.getElementById('amount').dispatchEvent(new Event('input'));
    }
    if (account) {
        document.getElementById('account').value = account;
        if (type === 'expense') {
            if (installments > 1 && document.getElementById('trans-installments')) {
                document.getElementById('trans-installments').value = installments;
            }
            if (typeof updateCCInstallmentsPreview === 'function') updateCCInstallmentsPreview(true);
        }
    }
    if (toAccount && type === 'transfer') document.getElementById('to-account').value = toAccount;
    if (category && type !== 'transfer') {
        document.getElementById('trans-category').value = category;
        userEditedBudgetField = false; 
        if (typeof autoFillBudgetedAmountForTransaction === 'function') autoFillBudgetedAmountForTransaction(true);
    }
    if (description) document.getElementById('description').value = description;

    const targetDate = dateMs ? new Date(dateMs) : new Date();
    document.getElementById('trans-date').value = (mode === 'create' && typeof selectedCalendarDay !== 'undefined' && selectedCalendarDay) ? selectedCalendarDay : targetDate.toLocaleDateString('en-CA');
    document.getElementById('trans-time').value = targetDate.toTimeString().slice(0, 5);

    const recGroup = document.getElementById('group-recurrence');
    if (recGroup) {
        if (hideRecurrence || mode === 'edit') recGroup.classList.add('hidden');
        else recGroup.classList.remove('hidden');
    }
    document.getElementById('group-recurrence-count')?.classList.add('hidden');
    
    if (typeof syncTxModalActionButtons === 'function') {
        syncTxModalActionButtons(mode === 'edit');
    }

    document.getElementById('shared-expense-fields')?.classList.add('hidden');
    document.getElementById('coin-round-fields')?.classList.add('hidden');
    document.getElementById('omni-sub-suggest-box')?.classList.add('hidden');
    if (typeof resetTransferAllocationBox === 'function') resetTransferAllocationBox();
    if (typeof updateTransferAllocationUI === 'function') {
        updateTransferAllocationUI({ autoSelectBilled, keepProvidedAmount: amount !== '' });
    }
    pendingOmniPayrollLibranza = null;
    pendingOmniSubscriptionId = config.subscriptionId || null;
    window.pendingOmniAssetObligation = config.assetObligationContext || null;
    if (typeof hasUnsavedChanges !== 'undefined') hasUnsavedChanges = false;
    tModal.classList.remove('hidden');
};

window.openEditModal = (id) => {
    const tx = financeData.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;
    
    let catFull = '';
    if (tx.type !== 'transfer' && tx.category) catFull = `${tx.category}::${tx.subcategory || 'General'}`;
    
    openOmniModal({
        mode: 'edit', txId: tx.id, type: tx.type, 
        amount: tx.amount, account: tx.account, toAccount: tx.toAccount,
        category: catFull, description: tx.description,
        status: tx.status === 'pending' ? 'pending' : 'closed', dateMs: tx.id
    });

    if (tx.account === 'CxC_Gastos_Acompanante') {
        const accSel = document.getElementById('account');
        if (accSel) {
            const compName = financeData.tripMode?.companionName || 'Acompañante';
            const opt = document.createElement('option');
            opt.value = 'CxC_Gastos_Acompanante';
            opt.textContent = `Pagó ${compName} (No descuenta saldo)`;
            accSel.insertBefore(opt, accSel.firstChild);
            accSel.value = 'CxC_Gastos_Acompanante';
        }
    }
    
    const budgetInput = document.getElementById('trans-budgeted-amount');
    if(budgetInput) budgetInput.value = tx.budgetedAmount ? formatNumberInput(tx.budgetedAmount) : '';
    userEditedBudgetField = !!tx.budgetedAmount;
    if (typeof autoFillBudgetedAmountForTransaction === 'function') autoFillBudgetedAmountForTransaction(false);
    
if (tx.type === 'expense') {
        if (tx.basePurchaseAmount > 0 && tx.fianzaAmount > 0) {
            document.getElementById('amount').value = formatNumberInput(tx.basePurchaseAmount);
            document.getElementById('description').value = tx.description.replace(/\s*\(\+Fianza [^)]+\)$/, '');
        }
        const instInput = document.getElementById('trans-installments');
        if (instInput) instInput.value = tx.installments || 1;
        const rateInput = document.getElementById('trans-rate');
        if (rateInput) rateInput.value = tx.rate ? formatNumberInput(tx.rate) : '0';
        const rateTypeInput = document.getElementById('trans-rate-type');
        if (rateTypeInput) rateTypeInput.value = tx.rateType || 'monthly';
        const zeroCheck = document.getElementById('trans-zero-interest');
        if (zeroCheck) zeroCheck.checked = !!tx.zeroInterest;
        const fianzaInput = document.getElementById('trans-fianza');
        if (fianzaInput) fianzaInput.value = tx.fianzaRate ? formatNumberInput(tx.fianzaRate) : '';
        const fianzaTypeSel = document.getElementById('trans-fianza-type');
        if (fianzaTypeSel) fianzaTypeSel.value = tx.fianzaType || 'pct';
        const fianzaIvaCheck = document.getElementById('trans-fianza-iva');
        if (fianzaIvaCheck) fianzaIvaCheck.checked = !!tx.fianzaHasIva;
        if (typeof updateCCInstallmentsPreview === 'function') updateCCInstallmentsPreview(false);
    } else if (tx.type === 'transfer') {
        const payModeSel = document.getElementById('transfer-payment-mode');
        const stratSel = document.getElementById('transfer-extra-strategy');
        if (payModeSel) {
            payModeSel.value = tx.paymentMode || 'installments';
            payModeSel.dispatchEvent(new Event('change'));
        }
        if (stratSel && tx.extraStrategy) {
            stratSel.value = tx.extraStrategy;
            stratSel.dispatchEvent(new Event('change'));
        }
        const extraChargesInput = document.getElementById('transfer-extra-charges');
        if (extraChargesInput) extraChargesInput.value = tx.extraCharges > 0 ? formatNumberInput(tx.extraCharges) : '';
        if (typeof updateTransferAllocationUI === 'function') {
            updateTransferAllocationUI({ restoreFromTx: tx, keepProvidedAmount: true });
        }
        if (tx.extraCharges > 0) {
            document.getElementById('amount').value = formatNumberInput(round2(tx.amount + tx.extraCharges));
        }
    }
};

document.querySelectorAll('.fab-option').forEach(opt => {
    opt.addEventListener('click', () => {
        const selectedType = opt.getAttribute('data-type');
        if (!selectedType) return;
        fabMenu?.classList.add('hidden'); fabBtn?.classList.remove('active');
        openOmniModal({ type: selectedType });
    });
});

// Borrado seguro delegado en el controlador de Papelera (#delete-btn en fase de captura)

form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const editId = document.getElementById('edit-id').value;
    const type = typeSelect ? typeSelect.value : 'expense';
    const status = document.getElementById('trans-status').value;
    const recurrence = !editId ? (document.getElementById('trans-recurrence')?.value || 'none') : 'none';
    const recCount = recurrence !== 'none' ? Math.max(2, Math.min(60, parseInt(document.getElementById('trans-recurrence-count')?.value, 10) || 12)) : 1;
    const account = document.getElementById('account').value;
    const toAccount = document.getElementById('to-account').value;
    let description = document.getElementById('description').value.trim();
    const amount = parseMoneyInput(document.getElementById('amount').value);
    const budgetedVal = parseMoneyInput(document.getElementById('trans-budgeted-amount')?.value);
    const baseDateObj = new Date(`${document.getElementById('trans-date').value}T${document.getElementById('trans-time').value}`);

    if (amount <= 0) {
        alert("El monto debe ser mayor a $0.");
        return;
    }

    // --- LÓGICA DE GASTO COMPARTIDO (PADRE + HIJO VINCULADO) ---
    let finalAmount = amount;
    const isShared = document.getElementById('is-shared-expense')?.checked;
    const owedAmount = parseMoneyInput(document.getElementById('shared-owed-amount')?.value);
    const debtorName = document.getElementById('shared-debtor-name')?.value.trim() || 'Alguien';
    let createdSharedChildTx = null;

    if (type === 'expense' && isShared && owedAmount > 0) {
        if (owedAmount >= amount) { alert('El monto que te deben debe ser menor al total pagado.'); return; }
        finalAmount = round2(amount - owedAmount); 
        const originalAmountFormatted = formatMoney(amount);
        description = `${description} (Mi parte de ${originalAmountFormatted})`;

        const accId = 'CxC_' + debtorName.replace(/\s+/g, '_');
        if (!financeData.customAccounts.some(a => a.id === accId)) {
            financeData.customAccounts.push({ id: accId, name: `Me debe: ${debtorName}`, category: 'asset', isDefault: false, showWhenZero: true });
        }

        createdSharedChildTx = {
            id: baseDateObj.getTime() + 999,
            monthId: (typeof getMonthId === 'function') ? getMonthId(baseDateObj) : '0000-00',
            type: 'transfer',
            status: status,
            account: account,
            toAccount: accId,
            description: `Préstamo a ${debtorName} (Compra total: ${originalAmountFormatted})`,
            amount: owedAmount,
            date: `${baseDateObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${baseDateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
            isAdjustment: false
        };
        financeData.transactions.push(createdSharedChildTx);
    }

    // --- LÓGICA DE REEMBOLSO / DEVOLUCIÓN / CASHBACK ---
    const isRefundChecked = type === 'income' && !!document.getElementById('tx-is-refund-check')?.checked;
    const refundTargetRaw = isRefundChecked ? (document.getElementById('tx-refund-category-select')?.value || '') : '';
    const [refundCatName, refundSubName = 'General'] = refundTargetRaw ? refundTargetRaw.split('::') : ['', 'General'];
    if (isRefundChecked && refundCatName && !/\(reembolso\)/i.test(description)) {
        description = `${description} (Reembolso ${cleanCatName(refundCatName)})`;
    }

    // --- LÓGICA DE REDONDEO DE AHORRO (SOLO EFECTIVO Y CUENTAS LÍQUIDAS / DIGITALES) ---
    const isCoinRound = !editId && !!document.getElementById('is-coin-round')?.checked;
    const coinSavedAmt = parseMoneyInput(document.getElementById('coin-round-amount')?.value);
    const originAccObj = getAccountObj(account);
    const canRoundAccount = account && !String(account).startsWith('CxC_') && originAccObj.category === 'asset';
    let createdRoundUpTx = null;

    if (type === 'expense' && canRoundAccount && isCoinRound && coinSavedAmt > 0) {
        const isCashOrigin = account === 'Efectivo' || originAccObj.accountSubType === 'cash';
        const chosenPocketVal = document.getElementById('coin-round-target-pocket')?.value || (isCashOrigin ? 'Pocket_Monedas' : 'Pocket_Redondeo');
        let targetPocket = (financeData.pockets || []).find(p => String(p.id) === String(chosenPocketVal));

        if (!targetPocket) {
            targetPocket = isCashOrigin
                ? { id: 'Pocket_Monedas', name: 'Alcancía Monedas', entity: 'Efectivo físico', goal: 0, startDate: baseDateObj.toLocaleDateString('en-CA'), targetDate: '', customQuota: 0, principal: 0, yields: 0, excludeFromBalance: true }
                : { id: 'Pocket_Redondeo', name: 'Redondeo Digital', entity: 'Ahorro automático', goal: 0, startDate: baseDateObj.toLocaleDateString('en-CA'), targetDate: '', customQuota: 0, principal: 0, yields: 0, excludeFromBalance: false };
            financeData.pockets.push(targetPocket);
        }

        if (status === 'closed' && typeof adjustPocketBalance === 'function') {
            adjustPocketBalance(targetPocket.id, coinSavedAmt);
        } else if (status === 'closed') {
            targetPocket.principal = round2((targetPocket.principal || 0) + coinSavedAmt);
        }

        createdRoundUpTx = {
            id: baseDateObj.getTime() + 998,
            monthId: (typeof getMonthId === 'function') ? getMonthId(baseDateObj) : '0000-00',
            type: 'transfer',
            status: status,
            account: account,
            toAccount: targetPocket.id,
            description: `${isCashOrigin ? 'Ahorro de monedas' : 'Redondeo de ahorro'} (de: ${description})`,
            amount: coinSavedAmt,
            date: `${baseDateObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${baseDateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
            isAdjustment: false
        };
        financeData.transactions.push(createdRoundUpTx);
    }

    let preservedEditMeta = null;
    if (editId) {
        const oldT = financeData.transactions.find(t => String(t.id) === String(editId));
        if (oldT) {
            preservedEditMeta = {
                id: oldT.id,
                isCleared: !!oldT.isCleared,
                tags: Array.isArray(oldT.tags) ? [...oldT.tags] : undefined,
                linkedLibranzas: Array.isArray(oldT.linkedLibranzas) ? [...oldT.linkedLibranzas] : undefined,
                splitGroupId: oldT.splitGroupId,
                tripName: oldT.tripName,
                isTripIsolated: oldT.isTripIsolated,
                isSharedTrip: oldT.isSharedTrip,
                paidBy: oldT.paidBy,
                paidInstallments: parseInt(oldT.paidInstallments, 10) || 0,
            extraPrincipalPaid: round2(oldT.extraPrincipalPaid || 0),
            wasClosedByExtra: !!oldT.wasClosedByExtra,
            isRefund: !!oldT.isRefund,
            refundCategory: oldT.refundCategory || '',
            refundSubcategory: oldT.refundSubcategory || '',
            linkedSubscriptionId: oldT.linkedSubscriptionId || null,
            prevSubscriptionBillingDate: oldT.prevSubscriptionBillingDate || '',
            linkedAssetId: oldT.linkedAssetId || null,
            linkedObligationId: oldT.linkedObligationId || null,
            assetExpenseApplied: round2(oldT.assetExpenseApplied || 0),
            assetObligationPaidYear: oldT.assetObligationPaidYear || null,
            isGmfTax: !!oldT.isGmfTax,
            isAccountMgmtFee: !!oldT.isAccountMgmtFee,
            mgmtFeeAccountId: oldT.mgmtFeeAccountId || null,
            mgmtFeeMonthId: oldT.mgmtFeeMonthId || ''
        };
        }
        if (oldT && oldT.type === 'transfer' && typeof revertTransferAllocation === 'function') revertTransferAllocation(oldT);
        if (oldT && typeof isTxClosed === 'function' && isTxClosed(oldT) && typeof getAccountObj === 'function' && getAccountObj(oldT.account).category === 'pocket') {
            if (oldT.type === 'income') {
                const oldPocket = financeData.pockets.find(x => String(x.id) === String(oldT.account));
                if (oldPocket) oldPocket.yields = Math.max(0, round2((oldPocket.yields || 0) - round2(oldT.amount)));
            } else if (oldT.type === 'expense' && typeof adjustPocketBalance === 'function') {
                adjustPocketBalance(oldT.account, round2(oldT.amount));
            }
        }
        financeData.transactions = financeData.transactions.filter(t => String(t.id) !== String(editId) && String(t.linkedToTransfer) !== String(editId));
    }

    let savedCategory = null, savedSubcategory = null;
    if (type !== 'transfer') {
        const parts = (document.getElementById('trans-category')?.value || '').split('::');
        savedCategory = parts[0]; savedSubcategory = parts[1] || 'General';
    }

    for (let step = 0; step < recCount; step++) {
        const txDate = (typeof advanceDateByRecurrence === 'function') ? advanceDateByRecurrence(baseDateObj, recurrence, step) : baseDateObj;
        const instStatus = step === 0 ? status : 'pending';
        let resolvedTxId = txDate.getTime() + step + Math.floor(Math.random() * 500);
        if (preservedEditMeta && step === 0) {
            const origDt = new Date(Number(preservedEditMeta.id));
            const sameDate = !Number.isNaN(origDt.getTime())
                && origDt.toLocaleDateString('en-CA') === txDate.toLocaleDateString('en-CA')
                && origDt.toTimeString().slice(0, 5) === txDate.toTimeString().slice(0, 5);
            resolvedTxId = sameDate ? preservedEditMeta.id : resolvedTxId;

            if (String(resolvedTxId) !== String(preservedEditMeta.id)) {
                const oldIdStr = String(preservedEditMeta.id);
                if (pendingTxTagsPayload && String(pendingTxTagsPayload.editId) === oldIdStr) {
                    pendingTxTagsPayload.editId = String(resolvedTxId);
                }
                (financeData.transactions || []).forEach(other => {
                    if (String(other.parentId) === oldIdStr) other.parentId = resolvedTxId;
                    if (String(other.deletedWithParent) === oldIdStr) other.deletedWithParent = resolvedTxId;
                    if (Array.isArray(other.allocatedItems)) {
                        other.allocatedItems.forEach(al => {
                            if (al.kind === 'cc_tx' && String(al.txId) === oldIdStr) al.txId = resolvedTxId;
                        });
                    }
                    if (Array.isArray(other.linkedLibranzas)) {
                        other.linkedLibranzas.forEach(lb => {
                            if (String(lb.targetTxId) === oldIdStr) lb.targetTxId = resolvedTxId;
                        });
                    }
                });
                (financeData.pockets || []).forEach(pk => {
                    if (Array.isArray(pk.yieldHistory)) {
                        pk.yieldHistory.forEach(yh => {
                            if (String(yh.txId) === oldIdStr) yh.txId = resolvedTxId;
                        });
                    }
                });
            }
        }
        const txData = {
            id: resolvedTxId,
            monthId: (typeof getMonthId === 'function') ? getMonthId(txDate) : '0000-00', type, status: instStatus,
            account, category: savedCategory, subcategory: savedSubcategory,
            description: recCount > 1 ? `${description} (${step + 1}/${recCount})` : description,
            amount: finalAmount, budgetedAmount: budgetedVal > 0 ? budgetedVal : (instStatus === 'pending' ? finalAmount : 0),
            date: `${txDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${txDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`, isAdjustment: false
        };
        if (preservedEditMeta && step === 0) {
            if (preservedEditMeta.isCleared) txData.isCleared = true;
            if (preservedEditMeta.isGmfTax) txData.isGmfTax = true;
            if (preservedEditMeta.isAccountMgmtFee) {
                txData.isAccountMgmtFee = true;
                txData.mgmtFeeAccountId = preservedEditMeta.mgmtFeeAccountId;
                txData.mgmtFeeMonthId = preservedEditMeta.mgmtFeeMonthId || txData.monthId;
            }
            if (preservedEditMeta.tags) txData.tags = preservedEditMeta.tags;
            if (preservedEditMeta.linkedLibranzas) txData.linkedLibranzas = preservedEditMeta.linkedLibranzas;
            if (preservedEditMeta.splitGroupId) txData.splitGroupId = preservedEditMeta.splitGroupId;
            if (preservedEditMeta.tripName) txData.tripName = preservedEditMeta.tripName;
            if (preservedEditMeta.isTripIsolated) txData.isTripIsolated = preservedEditMeta.isTripIsolated;
            if (preservedEditMeta.isSharedTrip) txData.isSharedTrip = preservedEditMeta.isSharedTrip;
            if (preservedEditMeta.paidBy) txData.paidBy = preservedEditMeta.paidBy;
            if (preservedEditMeta.isRefund) {
                txData.isRefund = true;
                if (preservedEditMeta.refundCategory) txData.refundCategory = preservedEditMeta.refundCategory;
                if (preservedEditMeta.refundSubcategory) txData.refundSubcategory = preservedEditMeta.refundSubcategory;
            }
            if (preservedEditMeta.linkedSubscriptionId) {
                txData.linkedSubscriptionId = preservedEditMeta.linkedSubscriptionId;
                if (preservedEditMeta.prevSubscriptionBillingDate) txData.prevSubscriptionBillingDate = preservedEditMeta.prevSubscriptionBillingDate;
            }
            if (preservedEditMeta.linkedAssetId && preservedEditMeta.linkedObligationId) {
                txData.linkedAssetId = preservedEditMeta.linkedAssetId;
                txData.linkedObligationId = preservedEditMeta.linkedObligationId;
                txData.assetExpenseApplied = finalAmount;
                txData.assetObligationPaidYear = preservedEditMeta.assetObligationPaidYear;
                const diffExp = round2(finalAmount - round2(preservedEditMeta.assetExpenseApplied || 0));
                if (diffExp !== 0 && Array.isArray(financeData.fixedAssets)) {
                    const refAsset = financeData.fixedAssets.find(a => String(a.id) === String(preservedEditMeta.linkedAssetId));
                    if (refAsset) refAsset.linkedExpenses = Math.max(0, round2((refAsset.linkedExpenses || 0) + diffExp));
                }
            }
        }
        
        const accObj = (typeof getAccountObj === 'function') ? getAccountObj(account) : { category: 'asset' };
        
        if (type === 'expense' && (accObj.category === 'credit_card' || accObj.debtType === 'revolving')) {
            const inst = Math.max(1, parseInt(document.getElementById('trans-installments')?.value, 10) || 1);
            const isZeroChecked = !!document.getElementById('trans-zero-interest')?.checked;
            const rate = isZeroChecked ? 0 : parseMoneyInput(document.getElementById('trans-rate')?.value);
            const rateType = document.getElementById('trans-rate-type')?.value || 'monthly';
            const fianzaVal = parseMoneyInput(document.getElementById('trans-fianza')?.value);
            const fianzaType = document.getElementById('trans-fianza-type')?.value || 'pct';
            const fianzaIva = !!document.getElementById('trans-fianza-iva')?.checked;
            const fianzaAmt = typeof calculateFianzaAmount === 'function'
                ? calculateFianzaAmount(finalAmount, fianzaVal, fianzaType, fianzaIva)
                : 0;
            const financedPrincipal = round2(finalAmount + fianzaAmt);

            if (fianzaAmt > 0) {
                txData.basePurchaseAmount = finalAmount;
                txData.fianzaAmount = fianzaAmt;
                txData.fianzaRate = fianzaVal;
                txData.fianzaType = fianzaType;
                txData.fianzaHasIva = fianzaIva;
                txData.amount = financedPrincipal;
                if (!txData.description.includes('(+Fianza')) {
                    txData.description = `${txData.description} (+Fianza ${formatCompact(fianzaAmt)})`;
                }
            }

            if (typeof calculateAmortization === 'function') {
                const amort = calculateAmortization(financedPrincipal, inst, rate, rateType);
                const keptPaid = (preservedEditMeta && step === 0) ? Math.min(inst, Math.max(0, preservedEditMeta.paidInstallments || 0)) : 0;
                const keptExtra = (preservedEditMeta && step === 0) ? Math.max(0, round2(preservedEditMeta.extraPrincipalPaid || 0)) : 0;
                txData.installments = inst; txData.rate = rate; txData.rateType = rateType;
                txData.zeroInterest = document.getElementById('trans-zero-interest')?.checked || rate === 0;
                txData.paidInstallments = keptPaid;
                if (keptExtra > 0) txData.extraPrincipalPaid = keptExtra;
                if (preservedEditMeta && step === 0 && preservedEditMeta.wasClosedByExtra && keptPaid >= inst) {
                    txData.wasClosedByExtra = true;
                }
                txData.monthlyQuota = amort.payment;
                txData.totalWithInterest = amort.totalWithInterest;
            }
        }
        
        let extraChargesAmt = 0;
        if (type === 'transfer') {
            txData.toAccount = toAccount;
            const payMode = document.getElementById('transfer-payment-mode')?.value || 'installments';
            const extraStrategy = document.getElementById('transfer-extra-strategy')?.value || 'reduce_term';
            txData.paymentMode = payMode;
            if (payMode === 'extraordinary') txData.extraStrategy = extraStrategy;
            extraChargesAmt = round2(parseMoneyInput(document.getElementById('transfer-extra-charges')?.value));

            if (extraChargesAmt > 0) {
                if (extraChargesAmt >= finalAmount) {
                    alert('Los intereses o cargos extra deben ser menores al monto total transferido.');
                    return;
                }
                txData.extraCharges = extraChargesAmt;
                txData.amount = round2(finalAmount - extraChargesAmt);
            }
            
            const netDebtPayment = txData.amount;
            const toAccObj = (typeof getAccountObj === 'function') ? getAccountObj(toAccount) : null;
            if (toAccObj && (toAccObj.category === 'credit_card' || toAccObj.debtType === 'revolving' || (toAccObj.category === 'debt' && getPendingRevolvingPurchases(toAccount).length > 0))) {
                const selectedChecks = Array.from(document.querySelectorAll('.transfer-alloc-check:checked'));
                if (selectedChecks.length > 0) {
                    if (payMode === 'extraordinary') {
                        let pool = netDebtPayment;
                        const allocs = [];
                        selectedChecks.forEach((cb, idx) => {
                            if (pool <= 0) return;
                            const capMax = parseFloat(cb.getAttribute('data-cap')) || pool;
                            const applied = idx === selectedChecks.length - 1 ? Math.min(capMax, pool) : Math.min(capMax, pool);
                            if (applied > 0) {
                                allocs.push({ kind: 'cc_tx', txId: cb.value, mode: payMode, strategy: extraStrategy, amountApplied: round2(applied) });
                                pool = round2(pool - applied);
                            }
                        });
                        txData.allocatedItems = allocs;
                    } else {
                        txData.allocatedItems = selectedChecks
                            .filter(cb => {
                                if (step === 0) return true;
                                const refT = financeData.transactions.find(t => String(t.id) === String(cb.value));
                                if (!refT) return false;
                                const remAfterStep0 = Math.max(1, parseInt(refT.installments, 10) || 1) - (parseInt(refT.paidInstallments, 10) || 0);
                                return remAfterStep0 > step;
                            })
                            .map(cb => ({
                                kind: 'cc_tx', txId: cb.value, mode: payMode, amountApplied: parseFloat(cb.getAttribute('data-quota'))
                            }));
                    }
                } else if (toAccObj.category === 'debt' && toAccObj.debtType !== 'revolving') {
                    txData.allocatedItems = [{ kind: 'debt_quota', debtId: toAccObj.id, mode: payMode, strategy: extraStrategy, amountApplied: netDebtPayment }];
                }
            } else if (toAccObj && toAccObj.category === 'debt') {
                txData.allocatedItems = [{ kind: 'debt_quota', debtId: toAccObj.id, mode: payMode, strategy: extraStrategy, amountApplied: netDebtPayment }];
            }
        }
        
        if (instStatus === 'closed') {
            if (type === 'transfer') {
                const netTransferAmt = txData.amount;
                if (accObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(accObj.id, -netTransferAmt);
                const toObj = (typeof getAccountObj === 'function') ? getAccountObj(toAccount) : null;
                if (toObj && toObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(toObj.id, netTransferAmt);

                const applyAdvanceFee = !!document.getElementById('tx-apply-tc-advance-fee')?.checked;
                const tcAdvanceFeeAmt = (accObj.category === 'credit_card' && accObj.hasAdvanceFee && toAccount && toAccount !== account && applyAdvanceFee)
                    ? round2(accObj.advanceFee || 0)
                    : 0;

                if (tcAdvanceFeeAmt > 0) {
                    const feeCat = (financeData.categories?.expense || []).find(c => /cuotas|intereses|bancari|financiero/i.test(c.name));
                    const catName = feeCat ? feeCat.name : 'Cuotas / Intereses';
                    const destLabel = toObj ? stripLeadingEmoji(toObj.name) : 'otra cuenta';
                    financeData.transactions.push({
                        id: txData.id + 333,
                        monthId: txData.monthId,
                        type: 'expense',
                        status: 'closed',
                        account: account,
                        category: catName,
                        subcategory: 'General',
                        description: `Comisión avance TC → ${destLabel}`,
                        amount: tcAdvanceFeeAmt,
                        date: txData.date,
                        isAdjustment: false,
                        linkedToTransfer: txData.id
                    });
                }

                if (extraChargesAmt > 0) {
                    const intCat = financeData.categories.expense.find(c => stripLeadingEmoji(c.name) === 'Cuotas / Intereses');
                    const targetLabel = toObj ? stripLeadingEmoji(toObj.name) : 'Crédito';
                    financeData.transactions.push({
                        id: baseDateObj.getTime() + 750 + Math.floor(Math.random() * 500),
                        monthId: txData.monthId,
                        type: 'expense',
                        status: 'closed',
                        account: account,
                        category: intCat ? intCat.name : 'Cuotas / Intereses',
                        subcategory: 'General',
                        description: `Cargos / Fianza / Intereses (${targetLabel})`,
                        amount: extraChargesAmt,
                        date: txData.date,
                        isAdjustment: false,
                        linkedToTransfer: txData.id
                    });
                }
                
                if (typeof window.applyTransferAllocatedItems === 'function') {
                    window.applyTransferAllocatedItems(txData, baseDateObj);
                }
            } else if (type === 'income' && accObj.category === 'pocket' && typeof adjustPocketBalance === 'function') {
                const p = financeData.pockets.find(x => x.id === accObj.id);
                if (p) p.yields = round2((p.yields || 0) + finalAmount);
            } else if (type === 'expense' && accObj.category === 'pocket' && typeof adjustPocketBalance === 'function') {
                adjustPocketBalance(accObj.id, -finalAmount);
            } else if (step === 0 && type === 'income' && pendingOmniPayrollLibranza && typeof applyPayrollLibranzas === 'function') {
                const appliedLib = applyPayrollLibranzas(txData.monthId, pendingOmniPayrollLibranza.periodVal, txDate, pendingOmniPayrollLibranza.isBiweekly);
                if (appliedLib.length > 0) {
                    txData.linkedLibranzas = appliedLib.map(l => ({ txId: l.txId, intTxId: l.intTxId, debtId: l.debtId, targetTxId: l.targetTxId, pocketId: l.pocketId, pocketAmt: l.pocketAmt, quoteStep: l.quoteStep }));
                }
                pendingOmniPayrollLibranza = null;
            }
        }
        if (step === 0 && createdRoundUpTx) {
            createdRoundUpTx.parentId = txData.id;
        }
        if (step === 0 && createdSharedChildTx) {
            createdSharedChildTx.parentId = txData.id;
            if (accObj.category === 'credit_card' || accObj.debtType === 'revolving') {
                const cInst = txData.installments || 1;
                const cRate = txData.rate || 0;
                const cRateType = txData.rateType || 'monthly';
                const cAmort = typeof calculateAmortization === 'function'
                    ? calculateAmortization(createdSharedChildTx.amount, cInst, cRate, cRateType)
                    : { payment: createdSharedChildTx.amount, totalWithInterest: createdSharedChildTx.amount };
                createdSharedChildTx.installments = cInst;
                createdSharedChildTx.paidInstallments = 0;
                createdSharedChildTx.rate = cRate;
                createdSharedChildTx.rateType = cRateType;
                createdSharedChildTx.zeroInterest = !!txData.zeroInterest;
                createdSharedChildTx.monthlyQuota = cAmort.payment;
                createdSharedChildTx.totalWithInterest = cAmort.totalWithInterest;
            }
        }
        if (isRefundChecked && refundCatName) {
            txData.isRefund = true;
            txData.refundCategory = refundCatName;
            txData.refundSubcategory = refundSubName;
            const refTag = 'reembolso';
            if (!Array.isArray(txData.tags)) txData.tags = [];
            if (!txData.tags.includes(refTag)) txData.tags.push(refTag);
        }
        financeData.transactions.push(txData);
    }

    // --- AUTO-VINCULACIÓN BIDIRECCIONAL CON RECURRENTES Y PRESUPUESTO ---
    let tariffSyncPromptPayload = null;
    if (!editId && type === 'expense' && status === 'closed' && recCount === 1) {
        const txMonthStr = typeof getMonthId === 'function' ? getMonthId(baseDateObj) : '';
        let matchedSub = null;

        if (pendingOmniSubscriptionId) {
            matchedSub = (financeData.subscriptions || []).find(s => String(s.id) === String(pendingOmniSubscriptionId) && s.status === 'active') || null;
        }
        if (!matchedSub && savedCategory && savedSubcategory && savedSubcategory !== 'General' && typeof getRecurringLinkedToSubcat === 'function') {
            const candidates = getRecurringLinkedToSubcat(savedCategory, savedSubcategory, true);
            matchedSub = candidates.find(s => !isRecurringPaidInMonth(s, txMonthStr)) || candidates[0] || null;
        }
        if (!matchedSub && typeof findMatchingSubscriptionForExpense === 'function') {
            matchedSub = findMatchingSubscriptionForExpense(description, null);
        }

        if (matchedSub) {
            const paidDateStr = document.getElementById('trans-date')?.value || baseDateObj.toLocaleDateString('en-CA');
            const prevBilling = matchedSub.nextBillingDate || paidDateStr;
            const createdTx = financeData.transactions[financeData.transactions.length - 1];
            if (createdTx && createdTx.type === 'expense') {
                createdTx.linkedSubscriptionId = matchedSub.id;
                createdTx.prevSubscriptionBillingDate = prevBilling;
                // Los pagos recurrentes fijos del hogar nunca contaminan un presupuesto aislado de Modo Viaje
                createdTx.isTripIsolated = false;
                delete createdTx.tripName;
            }

            matchedSub.lastPaidMonthId = txMonthStr;
            if (typeof advanceSubscriptionNextDate === 'function') {
                advanceSubscriptionNextDate(matchedSub, paidDateStr);
            }

            const expectedCop = typeof getRecurringAmountInCOP === 'function'
                ? getRecurringAmountInCOP(matchedSub)
                : round2(matchedSub.amount || 0);

            if (expectedCop > 0 && Math.abs(finalAmount - expectedCop) >= 1 && (!matchedSub.currency || matchedSub.currency === 'COP')) {
                tariffSyncPromptPayload = {
                    subRef: matchedSub,
                    newAmt: finalAmount,
                    oldAmt: expectedCop
                };
            }
        }
    }
    // --- VINCULACIÓN CON OBLIGACIONES ANUALES DE ACTIVOS FIJOS ---
    if (!editId && type === 'expense' && status === 'closed' && recCount === 1) {
        const savedTx = financeData.transactions[financeData.transactions.length - 1];
        let obCtx = window.pendingOmniAssetObligation || null;

        if (!obCtx && savedTx?.linkedSubscriptionId && Array.isArray(financeData.subscriptions)) {
            const subRef = financeData.subscriptions.find(s => String(s.id) === String(savedTx.linkedSubscriptionId));
            if (subRef?.linkedAssetId && subRef?.linkedObligationId) {
                obCtx = { assetId: subRef.linkedAssetId, obId: subRef.linkedObligationId, dueYear: baseDateObj.getFullYear() };
            }
        }

        if (obCtx && savedTx && Array.isArray(financeData.fixedAssets)) {
            const refAsset = financeData.fixedAssets.find(a => String(a.id) === String(obCtx.assetId));
            const refOb = refAsset?.annualObligations?.find(o => String(o.id) === String(obCtx.obId));
            if (refAsset && refOb) {
                const paidYear = obCtx.dueYear || (/^\d{4}/.test(refOb.dueDate || '') ? parseInt(refOb.dueDate.slice(0, 4), 10) : baseDateObj.getFullYear());
                refOb.lastPaidYear = paidYear;
                refAsset.linkedExpenses = round2((refAsset.linkedExpenses || 0) + finalAmount);
                savedTx.linkedAssetId = refAsset.id;
                savedTx.linkedObligationId = refOb.id;
                savedTx.assetExpenseApplied = finalAmount;
                savedTx.assetObligationPaidYear = paidYear;
            }
        }
    }
    window.pendingOmniAssetObligation = null;
    pendingOmniSubscriptionId = null;
    document.getElementById('omni-recurring-prefill-box')?.classList.add('hidden');

    const prevPocketId = window.returnToPocketHistoryId;
    localStorage.setItem('myFinances', JSON.stringify(financeData));
    if (typeof viewDate !== 'undefined') viewDate = new Date(baseDateObj.getFullYear(), baseDateObj.getMonth(), 1);
    
    if (typeof forceCloseAllModals === 'function') forceCloseAllModals(); 
    if (typeof updateDashboard === 'function') updateDashboard();
    if (prevPocketId) {
        document.getElementById('pockets-modal')?.classList.remove('hidden');
        if (typeof openPocketHistoryModal === 'function') openPocketHistoryModal(prevPocketId);
    }

    if (tariffSyncPromptPayload && typeof window.openBentoConfirmModal === 'function') {
        const { subRef, newAmt, oldAmt } = tariffSyncPromptPayload;
        const esc = window.escapeHtml || ((s) => String(s ?? ''));
        const cleanName = esc(stripLeadingEmoji(subRef.name));
        const hasLinkedSubcat = subRef.subcategory && subRef.subcategory !== 'General';
        setTimeout(() => {
            window.openBentoConfirmModal({
                title: 'Cambio en tarifa recurrente',
                subtitle: stripLeadingEmoji(subRef.name),
                message: `Registraste <b>${formatMoney(newAmt)}</b> para <b>${cleanName}</b> (tarifa anterior: ${formatMoney(oldAmt)}). ¿Deseas actualizar el valor del recurrente${hasLinkedSubcat ? ` y sincronizar el límite de <b>${esc(subRef.subcategory)}</b> en Presupuesto` : ''}?`,
                confirmText: 'Sí, actualizar',
                cancelText: 'Fue solo este mes',
                danger: false,
                onConfirm: () => {
                    subRef.amount = newAmt;
                    if (hasLinkedSubcat && typeof syncRecurringToBudgetSubcat === 'function') {
                        subRef.reserveInBudget = true;
                        syncRecurringToBudgetSubcat(subRef, { createSubcatIfMissing: false });
                    }
                    localStorage.setItem('myFinances', JSON.stringify(financeData));
                    updateDashboard();
                }
            });
        }, 220);
    }
});

// --- PRE-LLENADO INTELIGENTE EN OMNIMODAL Y REVERSIÓN EN PAPELERA ---
const renderOmniRecurringPrefillSuggestion = () => {
    const catSelectEl = document.getElementById('trans-category');
    if (!catSelectEl) return;

    let box = document.getElementById('omni-recurring-prefill-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'omni-recurring-prefill-box';
        box.className = 'hidden';
        box.style.cssText = 'margin-top:8px; padding:10px 12px; border-radius:12px; background:var(--accent-soft); border:1px solid color-mix(in srgb, var(--accent) 30%, transparent); display:flex; align-items:center; justify-content:space-between; gap:10px; font-size:11.5px;';
        const group = catSelectEl.closest('.form-group') || catSelectEl.parentElement;
        group?.appendChild(box);

        box.addEventListener('click', (ev) => {
            const btn = ev.target.closest('[data-apply-rec-id]');
            if (!btn) return;
            const recId = btn.getAttribute('data-apply-rec-id');
            const rec = (financeData.subscriptions || []).find(s => String(s.id) === String(recId));
            if (!rec) return;
            pendingOmniSubscriptionId = rec.id;
            const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(rec) : round2(rec.amount);
            const amtInp = document.getElementById('amount');
            if (amtInp) {
                amtInp.value = formatNumberInput(amtCop);
                amtInp.dispatchEvent(new Event('input', { bubbles: true }));
            }
            const descInp = document.getElementById('description');
            if (descInp && !descInp.value.trim()) {
                descInp.value = `Recurrente: ${stripLeadingEmoji(rec.name)}`;
            }
            const accSel = document.getElementById('account');
            if (accSel && rec.accountId && Array.from(accSel.options).some(o => o.value === rec.accountId)) {
                accSel.value = rec.accountId;
                accSel.dispatchEvent(new Event('change', { bubbles: true }));
            }
            box.classList.add('hidden');
        });
    }

    const editVal = document.getElementById('edit-id')?.value || '';
    const txType = document.getElementById('type')?.value || 'expense';
    if (editVal || txType !== 'expense' || typeof getRecurringLinkedToSubcat !== 'function') {
        box.classList.add('hidden');
        return;
    }

    const [selCat, selSub] = String(catSelectEl.value || '').split('::');
    if (!selCat || !selSub || selSub === 'General') {
        box.classList.add('hidden');
        return;
    }

    const dateVal = document.getElementById('trans-date')?.value;
    const refMonth = dateVal ? getMonthId(new Date(dateVal + 'T12:00:00')) : getMonthId(currentDate);
    const pendingRec = getRecurringLinkedToSubcat(selCat, selSub, true).find(s => !isRecurringPaidInMonth(s, refMonth));

    if (!pendingRec) {
        box.classList.add('hidden');
        return;
    }

    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;
    const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(pendingRec) : round2(pendingRec.amount);
    box.innerHTML = `
        <div style="min-width:0; flex:1; color:var(--text-main); line-height:1.35;">
            <strong style="display:block; color:var(--accent); font-size:11.5px;">Pago recurrente pendiente</strong>
            <span>${esc(stripLeadingEmoji(pendingRec.name))} • <b>${formatMoney(amtCop)}</b></span>
        </div>
        <button type="button" data-apply-rec-id="${escA(pendingRec.id)}" class="mini-action-btn" style="color:var(--accent); font-weight:800; flex-shrink:0;">Autocompletar</button>
    `;
    box.classList.remove('hidden');
};

['trans-category', 'type', 'trans-date'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', renderOmniRecurringPrefillSuggestion);
});

// Reconciliacion automatica si el usuario envia un pago recurrente a la Papelera o lo restaura
const reconcileRecurringTrashState = () => {
    if (!Array.isArray(financeData?.transactions) || !Array.isArray(financeData?.subscriptions)) return;
    let changed = false;
    financeData.transactions.forEach(tx => {
        if (!tx.linkedSubscriptionId) return;
        const sub = financeData.subscriptions.find(s => String(s.id) === String(tx.linkedSubscriptionId));
        if (!sub) return;

        if (tx.isDeleted && !tx._recReverted) {
            if (tx.prevSubscriptionBillingDate) {
                sub.nextBillingDate = tx.prevSubscriptionBillingDate;
            } else if (typeof revertRecurringNextDate === 'function') {
                revertRecurringNextDate(sub);
            }
            if (sub.lastPaidMonthId === tx.monthId) sub.lastPaidMonthId = '';
            tx._recReverted = true;
            changed = true;
        } else if (!tx.isDeleted && tx._recReverted) {
            if (typeof advanceSubscriptionNextDate === 'function') {
                advanceSubscriptionNextDate(sub, tx.prevSubscriptionBillingDate || sub.nextBillingDate);
            }
            sub.lastPaidMonthId = tx.monthId || '';
            tx._recReverted = false;
            changed = true;
        }
    });

if (Array.isArray(financeData?.fixedAssets)) {
        financeData.transactions.forEach(tx => {
            if (!tx.linkedAssetId || !tx.linkedObligationId) return;
            const refAsset = financeData.fixedAssets.find(a => String(a.id) === String(tx.linkedAssetId));
            const refOb = refAsset?.annualObligations?.find(o => String(o.id) === String(tx.linkedObligationId));
            if (!refAsset || !refOb) return;
            const appliedAmt = round2(tx.assetExpenseApplied || tx.amount || 0);

            if (tx.isDeleted && !tx._assetObReverted) {
                refAsset.linkedExpenses = Math.max(0, round2((refAsset.linkedExpenses || 0) - appliedAmt));
                if (Number(refOb.lastPaidYear) === Number(tx.assetObligationPaidYear)) {
                    refOb.lastPaidYear = null;
                }
                tx._assetObReverted = true;
                changed = true;
            } else if (!tx.isDeleted && tx._assetObReverted) {
                refAsset.linkedExpenses = round2((refAsset.linkedExpenses || 0) + appliedAmt);
                if (tx.assetObligationPaidYear) refOb.lastPaidYear = tx.assetObligationPaidYear;
                tx._assetObReverted = false;
                changed = true;
            }
        });
    }

    if (changed) {
        localStorage.setItem('myFinances', JSON.stringify(financeData));
    }
};

if (typeof updateDashboard === 'function') {
    const _origUpdateDashboard = updateDashboard;
    updateDashboard = function (...args) {
        reconcileRecurringTrashState();
        return _origUpdateDashboard.apply(this, args);
    };
}
// ==========================================
// 15E. LÓGICA DE INTERFAZ DEL OMNI-MODAL Y CALCULADORA
// ==========================================
let calcExpression = '';
let activeCalcInput = null;

const updateCalculatorDisplay = () => {
    if (document.getElementById('calc-expression')) document.getElementById('calc-expression').innerText = calcExpression || '0';
    const evalRes = evaluateCalculatorExpression(calcExpression);
    if (document.getElementById('calc-result')) document.getElementById('calc-result').innerText = evalRes.valid ? (formatNumberInput(evalRes.value) || '0,00') : 'Error';
};

const openCalculatorFor = (inputId, btnEl) => {
    const panel = document.getElementById('tx-calculator-panel');
    if (!panel) return;
    
    if (activeCalcInput && activeCalcInput.id === inputId && !panel.classList.contains('hidden')) {
        panel.classList.add('hidden');
        btnEl.classList.remove('active');
        activeCalcInput = null;
        return;
    }

    document.querySelectorAll('.btn-calc-toggle').forEach(b => b.classList.remove('active'));

    activeCalcInput = document.getElementById(inputId);
    const curAmt = parseMoneyInput(activeCalcInput?.value);
    calcExpression = curAmt > 0 ? formatNumberInput(curAmt).replace(/\./g, '') : '';
    updateCalculatorDisplay(); 
    panel.classList.remove('hidden'); 
    btnEl.classList.add('active');
};

document.getElementById('toggle-tx-calc-btn')?.addEventListener('click', (e) => openCalculatorFor('amount', e.currentTarget));
document.getElementById('toggle-shared-calc-btn')?.addEventListener('click', (e) => openCalculatorFor('shared-owed-amount', e.currentTarget));

document.querySelectorAll('#tx-calculator-panel [data-calc]').forEach(btn => {
    btn.addEventListener('click', () => {
        const key = btn.getAttribute('data-calc'), ops = ['+', '-', '×', '÷'];
        if (key === 'C') { calcExpression = ''; updateCalculatorDisplay(); return; }
        if (key === 'BACK') { calcExpression = calcExpression.slice(0, -1); updateCalculatorDisplay(); return; }
        if (key === 'OK') {
            const evalRes = evaluateCalculatorExpression(calcExpression);
            if (!evalRes.valid) { alert('Operación inválida.'); return; }
            if (activeCalcInput) { 
                activeCalcInput.value = evalRes.value > 0 ? formatNumberInput(evalRes.value) : ''; 
                activeCalcInput.dispatchEvent(new Event('input', { bubbles: true })); 
            }
            document.getElementById('tx-calculator-panel')?.classList.add('hidden');
            document.querySelectorAll('.btn-calc-toggle').forEach(b => b.classList.remove('active'));
            activeCalcInput = null;
            return;
        }
        if (ops.includes(key)) {
            if (!calcExpression) {
                const curAmt = parseMoneyInput(activeCalcInput?.value);
                if (curAmt > 0) calcExpression = formatNumberInput(curAmt).replace(/\./g, '');
                else if (key === '-') { calcExpression = '-'; updateCalculatorDisplay(); return; }
                else return;
            }
            const lastCh = calcExpression.slice(-1);
            calcExpression = ops.includes(lastCh) ? calcExpression.slice(0, -1) + key : calcExpression + key;
            updateCalculatorDisplay(); return;
        }
        calcExpression += key; updateCalculatorDisplay();
    });
});

const renderUnusualExpenseHint = () => {
    const anchor = document.getElementById('tx-budget-variance-box');
    if (!anchor) return;

    let alertBox = document.getElementById('tx-unusual-expense-alert');
    if (!alertBox) {
        alertBox = document.createElement('div');
        alertBox.id = 'tx-unusual-expense-alert';
        alertBox.className = 'glass-sub-box hidden';
        alertBox.style.cssText = 'margin-bottom:10px; padding:9px 12px; border-color:rgba(245, 158, 11, 0.38); background:rgba(245, 158, 11, 0.08); font-size:11.5px; line-height:1.4;';
        anchor.insertAdjacentElement('afterend', alertBox);
    }

    const txType = typeSelect?.value || 'expense';
    const accVal = document.getElementById('account')?.value || '';
    if (txType !== 'expense' || accVal === 'CxC_Gastos_Acompanante' || typeof evaluateUnusualExpense !== 'function') {
        alertBox.classList.add('hidden');
        alertBox.innerHTML = '';
        return;
    }

    const rawCat = document.getElementById('trans-category')?.value || '';
    const catName = rawCat.split('::')[0];
    const rawAmt = parseMoneyInput(document.getElementById('amount')?.value);
    const fxRate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
        ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
        : 1;
    const amountCop = round2(rawAmt * fxRate);
    const editId = document.getElementById('edit-id')?.value || null;

    const check = evaluateUnusualExpense(catName, amountCop, editId);
    if (!check.isUnusual) {
        alertBox.classList.add('hidden');
        alertBox.innerHTML = '';
        return;
    }

    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const ratioLabel = String(check.ratio).replace('.', ',');
    alertBox.classList.remove('hidden');
    alertBox.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:8px;">
            <span style="color:#d97706; display:inline-flex; flex-shrink:0; margin-top:1px;">${renderIcon('alert', 14)}</span>
            <div style="min-width:0;">
                <strong style="display:block; color:#d97706; font-size:11.5px;">Gasto inusual en ${esc(cleanCatName(catName))} (${ratioLabel}× tu promedio)</strong>
                <span style="color:var(--text-muted); font-size:11px;">Tu promedio habitual aquí es <b style="color:var(--text-main);">${formatMoney(check.avg)}</b> (${check.sampleCount} compras previas).</span>
            </div>
        </div>
    `;
};

const renderTxBudgetVariancePreview = () => {
    const box = document.getElementById('tx-budget-variance-box');
    if (!box) return;
    renderUnusualExpenseHint();
    if (!typeSelect || typeSelect.value === 'transfer') { box.classList.add('hidden'); return; }
    const realVal = parseMoneyInput(document.getElementById('amount')?.value);
    const budgetVal = parseMoneyInput(document.getElementById('trans-budgeted-amount')?.value);
    const v = calculateBudgetVariance(typeSelect.value, realVal, budgetVal);
    if (!v.hasBudget) { box.classList.add('hidden'); return; }
    const colorClass = v.isFavorable ? 'positive' : 'negative';
    box.classList.remove('hidden');
    box.innerHTML = `<span>Diferencia: <b class="${colorClass}">${v.diff > 0 ? '+' : ''}${formatMoney(v.diff)}</b></span><span>Variación: <b class="${colorClass}">${v.pct > 0 ? '+' : ''}${String(v.pct).replace('.', ',')}%</b></span>`;
};

const autoFillBudgetedAmountForTransaction = (force = false) => {
    const budgetInput = document.getElementById('trans-budgeted-amount');
    const bannerEl = document.getElementById('tx-budget-info-banner');
    if (!budgetInput || !typeSelect) return;

    if (typeSelect.value === 'transfer') {
        budgetInput.value = '';
        if (bannerEl) bannerEl.innerHTML = '';
        renderTxBudgetVariancePreview();
        return;
    }

    const [catName, subName] = (document.getElementById('trans-category')?.value || '').split('::');
    if (!catName) {
        budgetInput.value = '';
        if (bannerEl) {
            bannerEl.style.borderColor = 'var(--border-color)';
            bannerEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--text-muted); line-height:1.35;">
                    <span style="display:inline-flex; flex-shrink:0;">${renderIcon('info', 14)}</span>
                    <span>Selecciona una categoría para consultar su presupuesto.</span>
                </div>
            `;
        }
        renderTxBudgetVariancePreview();
        return;
    }

    const dateVal = document.getElementById('trans-date')?.value;
    const targetMonthId = (dateVal && dateVal.length >= 7) ? dateVal.slice(0, 7) : getMonthId(viewDate);
    const excludeTxId = document.getElementById('edit-id')?.value || null;

    const info = getRemainingBudgetForSelection(typeSelect.value, catName, subName || 'General', targetMonthId, excludeTxId);

    if (force || !userEditedBudgetField) {
        budgetInput.value = info.remaining > 0 ? formatNumberInput(info.remaining) : '';
    }

    const savedBudgetVal = parseMoneyInput(budgetInput.value);
    const cleanLabel = `${cleanCatName(catName || '')}${subName && subName !== 'General' ? ` (${cleanCatName(subName)})` : ''}`;

    if (bannerEl) {
        if (info.hasBudget) {
            const isIncome = typeSelect.value === 'income';
            const titleLabel = isIncome ? 'Meta presupuestada restante' : 'Presupuesto disponible';
            const execLabel = isIncome ? 'Recibido' : 'Gastado';
            const remColor = isIncome ? (info.remaining <= 0 ? 'var(--positive)' : 'var(--accent)') : (info.remaining > 0 ? 'var(--positive)' : 'var(--negative)');

            let breakdownText = `Tope: ${formatMoney(info.totalLimit)} • ${execLabel}: ${formatMoney(info.spent)}`;
            if (info.rolloverAmt !== 0) {
                const rollSign = info.rolloverAmt > 0 ? '+' : '−';
                breakdownText = `Base: ${formatCompact(info.baseLimit)} ${rollSign} Arrastre: ${formatCompact(Math.abs(info.rolloverAmt))} • ${execLabel}: ${formatCompact(info.spent)}`;
            }

            bannerEl.style.borderColor = 'var(--accent-border)';
            bannerEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:var(--accent);">
                        ${renderIcon('target', 14)} ${titleLabel}:
                    </span>
                    <strong style="font-size:13px; color:${remColor};">${formatMoney(info.remaining)}</strong>
                </div>
                <small style="display:block; font-size:10.5px; color:var(--text-muted); margin-top:4px; font-weight:600;">${breakdownText}</small>
            `;
        } else if (savedBudgetVal > 0) {
            bannerEl.style.borderColor = 'var(--accent-border)';
            bannerEl.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <span style="display:inline-flex; align-items:center; gap:6px; font-size:11.5px; font-weight:700; color:var(--accent);">
                        ${renderIcon('target', 14)} Presupuesto registrado:
                    </span>
                    <strong style="font-size:13px; color:var(--text-main);">${formatMoney(savedBudgetVal)}</strong>
                </div>
            `;
        } else {
            bannerEl.style.borderColor = 'var(--border-color)';
            bannerEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:7px; font-size:11.5px; color:var(--text-muted); line-height:1.35;">
                    <span style="display:inline-flex; flex-shrink:0;">${renderIcon('info', 14)}</span>
                    <span>No hay un valor presupuestado para <b>${(window.escapeHtml || ((s) => String(s ?? '')))(cleanLabel || 'esta categoría')}</b> este mes.</span>
                </div>
            `;
        }
    }

    renderTxBudgetVariancePreview();
};

document.getElementById('trans-category')?.addEventListener('change', () => { userEditedBudgetField = false; autoFillBudgetedAmountForTransaction(true); });
document.getElementById('trans-date')?.addEventListener('change', () => autoFillBudgetedAmountForTransaction(false));

const updateCCInstallmentsPreview = (syncMode = false) => {
    if (!ccInstallmentsBox) return;
    const acc = getAccountObj(document.getElementById('account')?.value);
    if (typeSelect.value !== 'expense' || (acc.category !== 'credit_card' && acc.debtType !== 'revolving')) { ccInstallmentsBox.classList.add('hidden'); return; }
    ccInstallmentsBox.classList.remove('hidden');
    const amount = parseMoneyInput(document.getElementById('amount').value);
    const installments = Math.max(1, parseInt(document.getElementById('trans-installments').value, 10) || 1);
    const rateInput = document.getElementById('trans-rate'), rateTypeSelect = document.getElementById('trans-rate-type'), zeroCheck = document.getElementById('trans-zero-interest');
    const isRevDebt = acc.category === 'debt' && acc.debtType === 'revolving';
    const defRate = isRevDebt ? (parseFloat(acc.debtRate) || 0) : (parseFloat(acc.rate) || 0);
    const cardZeroMax = isRevDebt ? 0 : Math.max(1, parseInt(acc.zeroInterestMax, 10) || 1);

    if (syncMode) {
        rateTypeSelect.value = isRevDebt ? (acc.debtRateType || 'annual') : (acc.rateType || 'monthly');
        if (syncMode === true || syncMode === 'account' || syncMode === 'installments') {
            if (zeroCheck) {
                zeroCheck.checked = isRevDebt ? (defRate <= 0) : (installments <= cardZeroMax || defRate <= 0);
            }
        }
        rateInput.value = zeroCheck?.checked ? '0' : (defRate > 0 ? formatNumberInput(defRate) : '0');
    }

    const zeroHintEl = document.getElementById('zero-interest-hint');
    if (zeroHintEl) {
        if (!isRevDebt && parseInt(acc.zeroInterestMax, 10) > 1 && installments <= parseInt(acc.zeroInterestMax, 10) && zeroCheck?.checked) {
            zeroHintEl.innerText = `Beneficio activo: hasta ${acc.zeroInterestMax} cuotas al 0% en esta tarjeta.`;
        } else if (isRevDebt && zeroCheck?.checked) {
            zeroHintEl.innerText = 'Compra marcada al 0% de interés en este cupo.';
        } else {
            zeroHintEl.innerText = '';
        }
    }

    const fianzaVal = parseMoneyInput(document.getElementById('trans-fianza')?.value);
    const fianzaType = document.getElementById('trans-fianza-type')?.value || 'pct';
    const fianzaIva = !!document.getElementById('trans-fianza-iva')?.checked;
    const fianzaAmt = typeof calculateFianzaAmount === 'function'
        ? calculateFianzaAmount(amount, fianzaVal, fianzaType, fianzaIva)
        : 0;
    const financedPrincipal = round2(amount + fianzaAmt);

    const fianzaNoteEl = document.getElementById('cc-fianza-preview-note');
    if (fianzaNoteEl) {
        fianzaNoteEl.innerText = fianzaAmt > 0 ? `+${formatMoney(fianzaAmt)} (Cap: ${formatCompact(financedPrincipal)})` : '';
    }

    const effectiveRate = zeroCheck?.checked ? 0 : parseMoneyInput(rateInput.value);
    const amort = calculateAmortization(financedPrincipal, installments, effectiveRate, rateTypeSelect.value);
    document.getElementById('cc-preview-quota').innerText = formatMoney(amort.payment);
    document.getElementById('cc-preview-interest').innerText = formatMoney(amort.totalInterest);
    document.getElementById('cc-preview-total').innerText = formatMoney(amort.totalWithInterest);
    
    const txDateInput = document.getElementById('trans-date')?.value;
    let baseDate;
    if (txDateInput && txDateInput.includes('-')) {
        const [y, m] = txDateInput.split('-').map(Number);
        baseDate = new Date(y, m - 1, 1);
    } else {
        const now = new Date();
        baseDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    
    document.getElementById('tx-amortization-body').innerHTML = amort.schedule.map(r => {
        baseDate.setMonth(baseDate.getMonth() + 1);
        const mLabel = `${getShortMonthLabel(baseDate)} ${String(baseDate.getFullYear()).slice(-2)}`;
        return `<tr><td>${mLabel}</td><td>${formatMoney(r.payment)}</td><td class="positive">${formatMoney(r.principal)}</td><td class="negative">${formatMoney(r.interest)}</td><td>${formatMoney(r.balance)}</td></tr>`;
    }).join('');
};

['change', 'input'].forEach(evt => {
    document.getElementById('trans-date')?.addEventListener(evt, () => updateCCInstallmentsPreview(false));
    document.getElementById('trans-fianza')?.addEventListener(evt, () => updateCCInstallmentsPreview(false));
    document.getElementById('trans-fianza-type')?.addEventListener(evt, () => updateCCInstallmentsPreview(false));
    document.getElementById('trans-fianza-iva')?.addEventListener(evt, () => updateCCInstallmentsPreview(false));
});
document.getElementById('toggle-tx-amort-btn')?.addEventListener('click', () => document.getElementById('tx-amortization-box')?.classList.toggle('hidden'));
document.getElementById('trans-installments')?.addEventListener('input', () => updateCCInstallmentsPreview('installments'));
document.getElementById('trans-rate')?.addEventListener('input', (e) => {
    const zChk = document.getElementById('trans-zero-interest');
    if (zChk && parseMoneyInput(e.target.value) > 0) zChk.checked = false;
    updateCCInstallmentsPreview(false);
});
document.getElementById('trans-rate-type')?.addEventListener('change', () => updateCCInstallmentsPreview(false));
document.getElementById('trans-zero-interest')?.addEventListener('change', () => updateCCInstallmentsPreview('zeroToggle'));
document.getElementById('account')?.addEventListener('change', () => updateCCInstallmentsPreview('account'));
document.getElementById('trans-recurrence')?.addEventListener('change', (e) => { document.getElementById('group-recurrence-count')?.classList.toggle('hidden', e.target.value === 'none'); });

const syncTransferAllocationSummary = (fromExtraInput = false) => {
    const list = document.getElementById('transfer-pending-items-list');
    const sumEl = document.getElementById('transfer-allocation-summary');
    const extraInput = document.getElementById('transfer-extra-charges');
    const amountInput = document.getElementById('amount');
    if (!list || !sumEl) return;

    const isExtraMode = (document.getElementById('transfer-payment-mode')?.value || 'installments') === 'extraordinary';
    let totalSel = 0;
    list.querySelectorAll('.transfer-alloc-check:checked').forEach(c => {
        totalSel = round2(totalSel + (parseFloat(c.getAttribute('data-quota')) || 0));
    });

    const extraVal = round2(parseMoneyInput(extraInput?.value));
    if (fromExtraInput && totalSel > 0 && amountInput && !isExtraMode) {
        amountInput.value = formatNumberInput(round2(totalSel + extraVal));
    }

    const updatedAmount = round2(parseMoneyInput(amountInput?.value));
    const netToCapital = Math.max(0, round2(updatedAmount - extraVal));
    const unallocatedDiff = round2(updatedAmount - totalSel);

    if (totalSel > 0) {
        let html = isExtraMode
            ? `Saldo cap. selec.: <b style="color:var(--text-main);">${formatMoney(totalSel)}</b> • Abono a cap.: <b class="positive">${formatMoney(Math.min(totalSel, netToCapital))}</b>`
            : `Cuotas selec.: <b style="color:var(--text-main);">${formatMoney(totalSel)}</b>`;

        if (extraVal > 0) {
            html += ` • Cargos extra: <b class="negative">+${formatMoney(extraVal)}</b>`;
        } else if (!isExtraMode && unallocatedDiff > 0.01) {
            html += `<div style="margin-top:6px;"><button type="button" id="btn-apply-transfer-diff" class="mini-action-btn" style="width:100%; justify-content:center; font-size:11px; padding:6px;">+ Usar diferencia (${formatMoney(unallocatedDiff)}) como intereses/cargos</button></div>`;
        }
        sumEl.innerHTML = html;
        sumEl.querySelector('#btn-apply-transfer-diff')?.addEventListener('click', () => {
            if (extraInput) {
                extraInput.value = formatNumberInput(unallocatedDiff);
                syncTransferAllocationSummary(true);
            }
        });
    } else {
        sumEl.innerHTML = extraVal > 0 ? `Cargos extra (sin abono a capital): <b class="negative">${formatMoney(extraVal)}</b>` : '';
    }
};

window.applyTransferAllocatedItems = (txData, baseDateObj = new Date()) => {
    if (txData && txData.toAccount && txData.paymentMode !== 'extraordinary' && typeof getAccountObj === 'function') {
        const destAcc = (financeData.customAccounts || []).find(a => String(a.id) === String(txData.toAccount));
        if (destAcc && Array.isArray(destAcc.settledCycles) && destAcc.settledCycles.length > 0 && typeof toggleLiabilityCycleSettled === 'function') {
            const cyc = typeof getCardActivePayCycle === 'function' ? getCardActivePayCycle(destAcc, baseDateObj) : null;
            const targetDt = cyc?.activePayDate || baseDateObj;
            toggleLiabilityCycleSettled(destAcc.id, targetDt, false);
        }
    }
    if (!txData || !Array.isArray(txData.allocatedItems)) return;
    const strategy = txData.extraStrategy || 'reduce_term';

    txData.allocatedItems.forEach(item => {
        if (item.kind === 'cc_tx') {
            const targetTx = financeData.transactions.find(t => String(t.id) === String(item.txId));
            if (!targetTx) return;

            const inst = Math.max(1, parseInt(targetTx.installments, 10) || 1);
            const paid = Math.max(0, parseInt(targetTx.paidInstallments, 10) || 0);
            const rate = inst === 1 ? 0 : (parseFloat(targetTx.rate) || 0);
            const rateType = targetTx.rateType || 'monthly';
            const amort = typeof calculateAmortization === 'function'
                ? calculateAmortization(round2(targetTx.amount), inst, rate, rateType)
                : { schedule: [], monthlyRate: 0, payment: 0 };

            if (item.mode === 'extraordinary') {
                targetTx.extraPrincipalPaid = round2((targetTx.extraPrincipalPaid || 0) + (item.amountApplied || 0));
                const rawRemCap = round2(amort.schedule.slice(paid).reduce((s, r) => s + r.principal, 0));
                const newRemCap = Math.max(0, round2(rawRemCap - targetTx.extraPrincipalPaid));

                if (newRemCap <= 0.01) {
                    item.prevPaidInstallments = paid;
                    targetTx.paidInstallments = inst;
                    targetTx.wasClosedByExtra = true;
                } else if ((item.strategy || strategy) === 'reduce_quota') {
                    const remInst = Math.max(1, inst - paid);
                    item.prevMonthlyQuota = targetTx.monthlyQuota;
                    targetTx.monthlyQuota = calculateAmortization(newRemCap, remInst, rate, rateType).payment;
                }
            } else {
                const remSchedule = amort.schedule.slice(paid);
                const effRemCap = Math.max(0, round2(round2(remSchedule.reduce((s, r) => s + r.principal, 0)) - round2(targetTx.extraPrincipalPaid || 0)));
                const interestAmt = remSchedule.length > 0 ? round2(effRemCap * amort.monthlyRate) : 0;

                if (interestAmt > 0) {
                    const intCat = financeData.categories.expense.find(c => stripLeadingEmoji(c.name) === 'Cuotas / Intereses');
                    financeData.transactions.push({
                        id: baseDateObj.getTime() + 800 + Math.floor(Math.random() * 5000),
                        monthId: txData.monthId,
                        type: 'expense',
                        status: 'closed',
                        account: txData.toAccount,
                        category: intCat ? intCat.name : 'Cuotas / Intereses',
                        subcategory: 'General',
                        description: `Intereses (${targetTx.description})`,
                        amount: interestAmt,
                        date: txData.date,
                        isAdjustment: false,
                        isInterestCharge: true,
                        installments: 1,
                        paidInstallments: 1,
                        linkedToTransfer: txData.id
                    });
                }
                targetTx.paidInstallments = paid + 1;
            }
        } else if (item.kind === 'debt_quota') {
            const debtAcc = financeData.customAccounts.find(a => a.id === item.debtId);
            if (!debtAcc) return;

            if (item.mode === 'extraordinary') {
                item.prevDebtState = {
                    debtTotalQuotes: debtAcc.debtTotalQuotes,
                    debtMonthlyPayment: debtAcc.debtMonthlyPayment
                };
                const snapNow = computeBalancesUpTo(txData.monthId || getMonthId(baseDateObj));
                const alreadyInLedger = financeData.transactions.some(
                    t => String(t.id) === String(txData.id) && !t.isDeleted && isTxClosed(t)
                );
                const rawSnapBal = round2(snapNow.bals[debtAcc.id] || 0);
                const curBal = Math.max(0, alreadyInLedger ? rawSnapBal : round2(rawSnapBal - (item.amountApplied || 0)));
                const remQ = Math.max(1, (debtAcc.debtTotalQuotes || 1) - (debtAcc.debtPaidQuotes || 0));
                const dRate = debtAcc.debtRate || 0;
                const dRateType = debtAcc.debtRateType || 'monthly';

                if (curBal <= 0.01) {
                    debtAcc.debtTotalQuotes = debtAcc.debtPaidQuotes || 1;
                } else if ((item.strategy || strategy) === 'reduce_quota') {
                    debtAcc.debtMonthlyPayment = calculateAmortization(curBal, remQ, dRate, dRateType).payment;
                } else {
                    const curQuota = round2(debtAcc.debtMonthlyPayment || 0) || calculateAmortization(debtAcc.debtOriginal || curBal, debtAcc.debtTotalQuotes || 1, dRate, dRateType).payment;
                    const mRate = dRateType === 'annual' ? (Math.pow(1 + dRate / 100, 1 / 12) - 1) : (dRate / 100);
                    let simB = curBal, newRemM = 0;
                    while (simB > 0.01 && newRemM < 360) {
                        newRemM++;
                        const intM = round2(simB * mRate);
                        const capM = Math.max(0, round2(curQuota - intM));
                        if (capM <= 0) { newRemM = remQ; break; }
                        simB = Math.max(0, round2(simB - capM));
                    }
                    debtAcc.debtTotalQuotes = (debtAcc.debtPaidQuotes || 0) + Math.max(1, newRemM);
                }
            } else {
                debtAcc.debtPaidQuotes = (debtAcc.debtPaidQuotes || 0) + 1;
            }
        }
    });
};

const resetTransferAllocationBox = () => {
    const box = document.getElementById('transfer-debt-allocation-box');
    const list = document.getElementById('transfer-pending-items-list');
    const sumEl = document.getElementById('transfer-allocation-summary');
    const badge = document.getElementById('transfer-alloc-badge');
    const extraInput = document.getElementById('transfer-extra-charges');
    const payModeSel = document.getElementById('transfer-payment-mode');
    const stratSel = document.getElementById('transfer-extra-strategy');
    const stratGroup = document.getElementById('extraordinary-strategy-group');
    if (box) box.classList.add('hidden');
    if (list) list.innerHTML = '';
    if (sumEl) sumEl.innerHTML = '';
    if (badge) badge.innerText = '0 selec.';
    if (extraInput) extraInput.value = '';
    if (payModeSel) payModeSel.value = 'installments';
    if (stratSel) stratSel.value = 'reduce_term';
    if (stratGroup) stratGroup.classList.add('hidden');
};

const resolveAllocationCycleMeta = (item, toAcc, refDate) => {
    const txDate = typeof getTxEffectiveDateObj === 'function' ? getTxEffectiveDateObj(item.tx, refDate) : new Date(refDate);
    const fmtDayMon = (dt, includeYear = false) => {
        const base = `${dt.getDate()} ${getShortMonthLabel(dt).toLowerCase()}`;
        return includeYear ? `${base} ${dt.getFullYear()}` : base;
    };

    const refStart = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0);
    const refEnd = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59);
    const purchLabel = fmtDayMon(txDate, txDate.getFullYear() !== refDate.getFullYear());
    const paidCount = Math.max(0, parseInt(item.paidInstallments, 10) || 0);

    if (toAcc.category === 'credit_card' || toAcc.cutoffDay) {
        const cycleWin = typeof getCardActivePayCycle === 'function' ? getCardActivePayCycle(toAcc, refDate) : null;
        const cutDateObj = item.nextCutDate || (cycleWin ? cycleWin.activeCutDate : refEnd);
        const payDateObj = item.nextPayDate || (cycleWin ? cycleWin.activePayDate : refEnd);
        const inBilledPaymentWindow = !!cycleWin?.isBilledStatementOpen;

        const payShort = fmtDayMon(payDateObj, payDateObj.getFullYear() !== refDate.getFullYear());
        const cutShort = fmtDayMon(cutDateObj, false);
        const cycleKey = payDateObj.toLocaleDateString('en-CA');

        let status = 'current';
        let groupTitle = `Ciclo en curso • Pago ${payShort}`;
        let groupSub = `Corte ${cutShort}`;
        let tone = 'accent';

        if (payDateObj < refStart) {
            status = 'overdue';
            groupTitle = `Ciclo vencido • Pago ${payShort}`;
            tone = 'danger';
        } else if (cutDateObj <= refEnd) {
            status = 'billed';
            groupTitle = `Extracto al cobro • Pago ${payShort}`;
            tone = 'good';
        } else if (inBilledPaymentWindow || (cycleWin && payDateObj.getTime() > cycleWin.activePayDate.getTime())) {
            status = 'next';
            groupTitle = `Próximo ciclo • Pago ${payShort}`;
            groupSub = `Post-corte (corta ${cutShort})`;
            tone = 'neutral';
        }

        return { cycleKey, sortTs: payDateObj.getTime(), purchLabel, payShort, cutShort, status, tone, groupTitle, groupSub };
    }

    const dueProbe = new Date(txDate.getFullYear(), txDate.getMonth() + paidCount + 1, 1);
    const dueY = dueProbe.getFullYear(), dueM = dueProbe.getMonth();
    const daysInDueM = new Date(dueY, dueM + 1, 0).getDate();
    const targetDay = toAcc.paymentDay ? Math.max(1, Math.min(31, parseInt(toAcc.paymentDay, 10))) : txDate.getDate();
    const dueDateObj = new Date(dueY, dueM, Math.min(targetDay, daysInDueM), 12, 0, 0);
    const payShort = fmtDayMon(dueDateObj, dueDateObj.getFullYear() !== refDate.getFullYear());
    const cycleKey = `${dueY}-${String(dueM + 1).padStart(2, '0')}`;
    const isOverdue = dueDateObj < refStart;
    const isCurrentMonth = dueY === refDate.getFullYear() && dueM === refDate.getMonth();

    return {
        cycleKey,
        sortTs: new Date(dueY, dueM, 1).getTime(),
        purchLabel,
        payShort,
        cutShort: '',
        status: isOverdue ? 'overdue' : (isCurrentMonth ? 'billed' : 'next'),
        tone: isOverdue ? 'danger' : (isCurrentMonth ? 'good' : 'neutral'),
        groupTitle: isOverdue ? `Cuotas vencidas • ${getShortMonthLabel(dueDateObj)} ${dueY}` : `Ciclo de pago • ${getShortMonthLabel(dueDateObj)} ${dueY}`,
        groupSub: toAcc.paymentDay ? `Día pago ${toAcc.paymentDay}` : 'Según fecha de compra'
    };
};

const updateTransferAllocationUI = (opts = false) => {
    const options = typeof opts === 'boolean' ? { preserveSelection: opts } : (opts || {});
    const box = document.getElementById('transfer-debt-allocation-box');
    const list = document.getElementById('transfer-pending-items-list');
    const sumEl = document.getElementById('transfer-allocation-summary');
    const extraInput = document.getElementById('transfer-extra-charges');
    const badge = document.getElementById('transfer-alloc-badge');
    if (!box || !list) return;

    const currentType = typeSelect?.value || document.getElementById('type')?.value;
    if (currentType !== 'transfer') {
        resetTransferAllocationBox();
        return;
    }

    const toAccId = document.getElementById('to-account')?.value || '';
    const isPocketTarget = String(toAccId).startsWith('Pocket_') || (financeData.pockets || []).some(p => String(p.id) === String(toAccId));
    if (isPocketTarget) {
        resetTransferAllocationBox();
        return;
    }

    const toAcc = financeData.customAccounts.find(a => String(a.id) === String(toAccId));
    if (!toAcc || (toAcc.category !== 'credit_card' && toAcc.category !== 'debt')) {
        resetTransferAllocationBox();
        return;
    }

    const editIdVal = document.getElementById('edit-id')?.value || '';
    const editingTx = options.restoreFromTx || (editIdVal ? financeData.transactions.find(t => String(t.id) === String(editIdVal)) : null);
    const payMode = document.getElementById('transfer-payment-mode')?.value || 'installments';
    const isExtraMode = payMode === 'extraordinary';

    const prevCheckedIds = new Set();
    if (options.restoreFromTx && Array.isArray(options.restoreFromTx.allocatedItems)) {
        options.restoreFromTx.allocatedItems.forEach(al => { if (al.kind === 'cc_tx') prevCheckedIds.add(String(al.txId)); });
    } else if (options.preserveSelection) {
        Array.from(list.querySelectorAll('.transfer-alloc-check:checked')).forEach(c => prevCheckedIds.add(String(c.value)));
    }

    const dateVal = document.getElementById('trans-date')?.value || '';
    const refDate = /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? new Date(`${dateVal}T12:00:00`) : new Date(currentDate);

    const pendingItems = toAcc.category === 'credit_card'
        ? getPendingCardPurchases(toAccId, refDate, editingTx)
        : getPendingRevolvingPurchases(toAccId, editingTx);

    box.classList.remove('hidden');
    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;

    if (toAcc.category === 'debt' && toAcc.debtType !== 'revolving' && pendingItems.length === 0) {
        const curDebtBal = Math.max(0, round2(currentBalances[toAcc.id] || 0));
        const qInfo = getDebtMonthlyQuotaBreakdown(toAcc, curDebtBal);
        if (badge) badge.innerText = isExtraMode ? 'Capital directo' : `Cuota ${(toAcc.debtPaidQuotes || 0) + 1}/${toAcc.debtTotalQuotes || 1}`;
        list.innerHTML = `
            <div style="padding:9px 11px; border-radius:10px; background:var(--card-inner-bg); border:1px solid var(--border-color); font-size:11px; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center;">
                <span>${isExtraMode ? 'Saldo actual de capital:' : 'Cuota mensual proyectada:'}</span>
                <strong style="color:var(--text-main); font-size:12px;">${formatMoney(isExtraMode ? curDebtBal : qInfo.totalQuota)}</strong>
            </div>
        `;
        return;
    }

    if (pendingItems.length > 0) {
        const enriched = pendingItems.map(item => ({
            item,
            meta: resolveAllocationCycleMeta(item, toAcc, refDate)
        }));

        if (options.autoSelectBilled && prevCheckedIds.size === 0) {
            const hasBilledOrOverdue = enriched.some(e => e.meta.status === 'overdue' || e.meta.status === 'billed');
            enriched.forEach(e => {
                if (hasBilledOrOverdue ? (e.meta.status === 'overdue' || e.meta.status === 'billed') : (e.meta.status === 'current')) {
                    prevCheckedIds.add(String(e.item.tx.id));
                }
            });
        }

        const groupsMap = new Map();
        enriched.forEach(entry => {
            const key = entry.meta.cycleKey;
            if (!groupsMap.has(key)) {
                groupsMap.set(key, {
                    cycleKey: key,
                    sortTs: entry.meta.sortTs,
                    tone: entry.meta.tone,
                    groupTitle: entry.meta.groupTitle,
                    groupSub: entry.meta.groupSub,
                    entries: []
                });
            }
            groupsMap.get(key).entries.push(entry);
        });

        const sortedGroups = Array.from(groupsMap.values()).sort((a, b) => a.sortTs - b.sortTs);
        const toneStyles = {
            good: { dot: 'var(--positive)', pillBg: 'var(--positive-bg)', pillColor: 'var(--positive)', headBorder: 'color-mix(in srgb, var(--positive) 30%, var(--border-color))', headBg: 'color-mix(in srgb, var(--positive) 7%, var(--card-bg))' },
            danger: { dot: 'var(--negative)', pillBg: 'var(--negative-bg)', pillColor: 'var(--negative)', headBorder: 'color-mix(in srgb, var(--negative) 30%, var(--border-color))', headBg: 'color-mix(in srgb, var(--negative) 7%, var(--card-bg))' },
            accent: { dot: 'var(--accent)', pillBg: 'var(--accent-soft)', pillColor: 'var(--accent)', headBorder: 'var(--accent-border)', headBg: 'color-mix(in srgb, var(--accent) 7%, var(--card-bg))' },
            neutral: { dot: 'var(--text-muted)', pillBg: 'var(--hover-bg)', pillColor: 'var(--text-muted)', headBorder: 'var(--border-color)', headBg: 'var(--card-bg)' }
        };

        list.innerHTML = sortedGroups.map(group => {
            const st = toneStyles[group.tone] || toneStyles.neutral;
            const safeKey = escA(group.cycleKey);

            const itemsHtml = group.entries.map(({ item, meta }) => {
                const isChecked = prevCheckedIds.has(String(item.tx.id)) ? 'checked' : '';
                const cleanDesc = esc(stripLeadingEmoji(item.tx.description || 'Compra'));
                const targetVal = isExtraMode ? item.remCapital : item.nextQuota;
                const valLabel = isExtraMode
                    ? `Saldo cap.: <b style="color:var(--text-main);">${formatMoney(item.remCapital)}</b>`
                    : `<b style="color:var(--text-main);">${formatMoney(item.nextQuota)}</b>`;

                return `
                    <label style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:9px 10px; background:var(--card-inner-bg); border:1px solid var(--border-color); border-radius:10px; margin-bottom:6px; cursor:pointer;">
                        <div style="min-width:0; flex:1;">
                            <strong style="display:block; font-size:11.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text-main); margin-bottom:2px;">${cleanDesc}</strong>
                            <div style="display:flex; align-items:center; flex-wrap:wrap; gap:4px 6px; font-size:10.5px; color:var(--text-muted); line-height:1.3;">
                                <span>Compra ${esc(meta.purchLabel)}</span>
                                <span>•</span>
                                <span>Cuota ${item.nextPeriod}/${item.installments}</span>
                                <span>•</span>
                                <span>${valLabel}</span>
                                <span style="font-size:9.5px; font-weight:700; padding:1px 6px; border-radius:99px; background:${st.pillBg}; color:${st.pillColor}; white-space:nowrap;">Pago ${esc(meta.payShort)}</span>
                            </div>
                        </div>
                        <input type="checkbox" class="transfer-alloc-check" data-cycle-key="${safeKey}" value="${escA(item.tx.id)}" data-quota="${targetVal}" data-cap="${item.remCapital}" ${isChecked} style="width:17px; height:17px; accent-color:var(--accent); flex-shrink:0;">
                    </label>
                `;
            }).join('');

            return `
                <div style="margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:6px 9px; margin-bottom:6px; border-radius:9px; background:${st.headBg}; border:1px solid ${st.headBorder};">
                        <div style="min-width:0; flex:1;">
                            <span style="display:flex; align-items:center; gap:6px; font-size:10.5px; font-weight:800; color:var(--text-main);">
                                <span style="width:7px; height:7px; border-radius:50%; background:${st.dot}; flex-shrink:0;"></span>
                                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(group.groupTitle)}</span>
                            </span>
                            <small style="display:block; font-size:9.5px; color:var(--text-muted); padding-left:13px; margin-top:1px;">${esc(group.groupSub)} • ${group.entries.length} compra${group.entries.length !== 1 ? 's' : ''}</small>
                        </div>
                        <button type="button" class="mini-action-btn" data-toggle-cycle="${safeKey}" style="font-size:10px; padding:3px 8px; flex-shrink:0;">Marcar ciclo</button>
                    </div>
                    ${itemsHtml}
                </div>
            `;
        }).join('');
    } else {
        list.innerHTML = '<small style="color:var(--text-muted); font-size:11px;">No hay compras con cuotas pendientes.</small>';
    }

    const checkBoxes = Array.from(list.querySelectorAll('.transfer-alloc-check'));

    const refreshSelectionState = (syncAmountInput = true) => {
        let totalSel = 0, selCount = 0;
        checkBoxes.forEach(c => {
            if (c.checked) {
                selCount++;
                totalSel = round2(totalSel + (parseFloat(c.getAttribute('data-quota')) || 0));
            }
        });

        list.querySelectorAll('[data-toggle-cycle]').forEach(btn => {
            const cKey = btn.getAttribute('data-toggle-cycle');
            const groupChecks = checkBoxes.filter(c => c.getAttribute('data-cycle-key') === cKey);
            const allChecked = groupChecks.length > 0 && groupChecks.every(c => c.checked);
            btn.textContent = allChecked ? 'Quitar' : 'Marcar ciclo';
        });

        if (badge) {
            badge.innerText = selCount > 0
                ? `${selCount}/${pendingItems.length} selec.`
                : (pendingItems.length > 0 ? `${pendingItems.length} pend.` : 'Sin diferidos');
        }

        if (syncAmountInput) {
            if (selCount > 0 && typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP') {
                activeTxCurrency = 'COP';
                document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-curr') === 'COP');
                });
                document.getElementById('tx-currency-preview')?.classList.add('hidden');
            }
            const extraVal = round2(parseMoneyInput(extraInput?.value));
            const amountInput = document.getElementById('amount');
            if (amountInput) {
                if (isExtraMode && parseMoneyInput(amountInput.value) > 0 && selCount > 0) {
                    // En abono extraordinario, respeta el monto libre si el usuario ya escribió uno menor al saldo total
                    const curTyped = parseMoneyInput(amountInput.value);
                    if (curTyped > round2(totalSel + extraVal)) {
                        amountInput.value = formatNumberInput(round2(totalSel + extraVal));
                        amountInput.dispatchEvent(new Event('input'));
                    }
                } else {
                    const nextAmt = round2(totalSel + extraVal);
                    amountInput.value = nextAmt > 0 ? formatNumberInput(nextAmt) : '';
                    amountInput.dispatchEvent(new Event('input'));
                }
            }
        }
        syncTransferAllocationSummary(false);
    };

    checkBoxes.forEach(cb => {
        cb.addEventListener('change', () => refreshSelectionState(true));
    });

    list.querySelectorAll('[data-toggle-cycle]').forEach(btn => {
        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const cKey = btn.getAttribute('data-toggle-cycle');
            const groupChecks = checkBoxes.filter(c => c.getAttribute('data-cycle-key') === cKey);
            const shouldCheck = !groupChecks.every(c => c.checked);
            groupChecks.forEach(c => { c.checked = shouldCheck; });
            refreshSelectionState(true);
        });
    });

    if (sumEl && !options.preserveSelection && !options.restoreFromTx) sumEl.innerHTML = '';
    refreshSelectionState(!options.keepProvidedAmount && prevCheckedIds.size > 0);
};

document.getElementById('transfer-extra-charges')?.addEventListener('input', () => syncTransferAllocationSummary(true));
document.getElementById('amount')?.addEventListener('input', () => {
    if (typeSelect?.value === 'transfer') syncTransferAllocationSummary(false);
});
document.getElementById('to-account')?.addEventListener('change', () => updateTransferAllocationUI({ preserveSelection: false }));
document.getElementById('transfer-payment-mode')?.addEventListener('change', () => updateTransferAllocationUI({ preserveSelection: true }));
document.getElementById('trans-date')?.addEventListener('change', () => {
    if (typeSelect?.value === 'transfer') updateTransferAllocationUI({ preserveSelection: true, keepProvidedAmount: true });
});

document.getElementById('is-shared-expense')?.addEventListener('change', (e) => {
    const sharedFields = document.getElementById('shared-expense-fields');
    if (e.target.checked) {
        sharedFields?.classList.remove('hidden');
        const mainAmount = document.getElementById('amount')?.value;
        const owedInput = document.getElementById('shared-owed-amount');
        if (mainAmount && owedInput && (!owedInput.value || owedInput.value === '0,00' || owedInput.value === '0')) {
            owedInput.value = mainAmount;
            owedInput.style.transition = 'box-shadow 0.3s ease';
            owedInput.style.boxShadow = '0 0 0 2px var(--positive)';
            setTimeout(() => owedInput.style.boxShadow = 'none', 1500);
        }
    } else {
        sharedFields?.classList.add('hidden');
    }
});

// --- EL CONTROLADOR MAESTRO DEL MODAL (AQUÍ ESTABA EL ERROR VISUAL) ---
typeSelect?.addEventListener('change', () => {
    const accEl = document.getElementById('account'), budgetGroup = document.getElementById('group-budgeted-amount'), payrollShortcut = document.getElementById('quick-payroll-shortcut');
    const splitBtn = document.getElementById('btn-open-split-modal');
    const sharedWrap = document.getElementById('shared-expense-wrapper');
    if (typeSelect.value === 'expense') {
        sharedWrap?.classList.remove('hidden');
    } else {
        sharedWrap?.classList.add('hidden');
        const sharedSwitch = document.getElementById('is-shared-expense');
        if (sharedSwitch) {
            sharedSwitch.checked = false;
            sharedSwitch.dispatchEvent(new Event('change')); 
        }
    }
    
    const submitBtn = document.querySelector('#transaction-modal button[type="submit"]');
    const modalContent = document.querySelector('#transaction-modal .modal-content');

    const catEl = document.getElementById('trans-category');
    if (typeSelect.value === 'transfer') {
        if (submitBtn) { submitBtn.style.backgroundColor = 'var(--accent)'; submitBtn.innerText = 'Guardar Transferencia'; }
        if (modalContent) modalContent.style.boxShadow = '0 0 0 2px var(--accent)';
        
        if (splitBtn) splitBtn.classList.add('hidden');
        if (catEl) { catEl.required = false; catEl.value = ''; }
        renderAccountSelects(false); if (accEl) accEl.value = getDefaultAccountId(true);
        toAccountGroup?.classList.remove('hidden'); categoryGroup?.classList.add('hidden'); budgetGroup?.classList.add('hidden'); payrollShortcut?.classList.add('hidden'); ccInstallmentsBox?.classList.add('hidden');
        document.getElementById('label-account').innerText = 'Cuenta Origen';
        updateTransferAllocationUI();
    } else if (typeSelect.value === 'income') {
        if (submitBtn) { submitBtn.style.backgroundColor = 'var(--positive)'; submitBtn.innerText = 'Guardar Ingreso'; }
        if (modalContent) modalContent.style.boxShadow = '0 0 0 2px var(--positive)';
        
        if (splitBtn) splitBtn.classList.remove('hidden');
        if (catEl) catEl.required = false;
        renderAccountSelects(true); if (accEl) accEl.value = getDefaultAccountId(true);
        toAccountGroup?.classList.add('hidden'); categoryGroup?.classList.remove('hidden'); budgetGroup?.classList.remove('hidden'); payrollShortcut?.classList.remove('hidden'); ccInstallmentsBox?.classList.add('hidden');
        document.getElementById('label-account').innerText = 'Cuenta Destino'; renderCategoryOptions('income');
    } else {
        if (submitBtn) { submitBtn.style.backgroundColor = 'var(--negative)'; submitBtn.innerText = 'Guardar Gasto'; }
        if (modalContent) modalContent.style.boxShadow = '0 0 0 2px var(--negative)';
        
        if (splitBtn) splitBtn.classList.remove('hidden');
        if (catEl) catEl.required = false;
        renderAccountSelects(false); if (accEl) accEl.value = getDefaultAccountId(false);
        toAccountGroup?.classList.add('hidden'); categoryGroup?.classList.remove('hidden'); budgetGroup?.classList.remove('hidden'); payrollShortcut?.classList.add('hidden');
        document.getElementById('label-account').innerText = 'Cuenta / Tarjeta'; renderCategoryOptions('expense'); updateCCInstallmentsPreview(true);
    }
    if (typeof updateTransferAllocationUI === 'function') updateTransferAllocationUI();
    userEditedBudgetField = false;
    autoFillBudgetedAmountForTransaction(true);
});

['input', 'change', 'blur'].forEach(evt => {
    document.getElementById('amount')?.addEventListener(evt, () => {
        updateCCInstallmentsPreview(false);
        renderTxBudgetVariancePreview();
        requestAnimationFrame(renderTxBudgetVariancePreview);
    });
});

const renderOmniSubscriptionSuggestions = (rawText) => {
    const descInput = document.getElementById('description');
    if (!descInput) return;

    let suggestBox = document.getElementById('omni-sub-suggest-box');
    if (!suggestBox) {
        suggestBox = document.createElement('div');
        suggestBox.id = 'omni-sub-suggest-box';
        suggestBox.className = 'hidden';
        suggestBox.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; margin-top:6px;';
        const parentGroup = descInput.closest('.form-group') || descInput.parentElement;
        parentGroup?.appendChild(suggestBox);
    }

    const currentType = typeSelect ? typeSelect.value : document.getElementById('type')?.value;
    const editId = document.getElementById('edit-id')?.value;
    const query = (rawText || '').trim().toLowerCase();

    if (editId || currentType !== 'expense' || query.length < 2) {
        suggestBox.classList.add('hidden');
        suggestBox.innerHTML = '';
        return;
    }

    const activeSubs = (financeData.subscriptions || []).filter(s => s.status === 'active');
    const matches = activeSubs.filter(s => {
        const cleanName = stripLeadingEmoji(s.name || '').trim().toLowerCase();
        return cleanName.includes(query) || (query.length >= 3 && query.includes(cleanName));
    });

    if (matches.length === 0) {
        suggestBox.classList.add('hidden');
        suggestBox.innerHTML = '';
        return;
    }

    const escS = window.escapeHtml || ((s) => String(s ?? ''));
    const escSA = window.escapeAttr || escS;
    suggestBox.classList.remove('hidden');
    suggestBox.innerHTML = matches.slice(0, 3).map(sub => {
        const cleanName = escS(stripLeadingEmoji(sub.name));
        const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount);
        let dateTag = '';
        if (sub.nextBillingDate) {
            const [y, m, d] = sub.nextBillingDate.split('-').map(Number);
            const dt = new Date(y, m - 1, d);
            dateTag = ` • ${d} ${dt.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')}.`;
        }
        return `
            <button type="button" data-omni-sub-id="${escSA(sub.id)}" style="display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:999px; border:1px solid var(--accent); background:color-mix(in srgb, var(--accent) 12%, var(--card-inner-bg)); color:var(--text-main); font-size:11.5px; font-weight:700; cursor:pointer;">
                <span style="color:var(--accent);">↻</span>
                <span>${cleanName} • ${formatMoney(amtCop)}${dateTag}</span>
            </button>
        `;
    }).join('');

    suggestBox.querySelectorAll('[data-omni-sub-id]').forEach(btn => {
        btn.addEventListener('click', () => {
            const subId = btn.getAttribute('data-omni-sub-id');
            const sub = (financeData.subscriptions || []).find(s => String(s.id) === String(subId));
            if (!sub) return;

            pendingOmniSubscriptionId = sub.id;
            descInput.value = stripLeadingEmoji(sub.name);

            const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount);
            const amtEl = document.getElementById('amount');
            if (amtEl) {
                if (activeTxCurrency !== 'COP') {
                    activeTxCurrency = 'COP';
                    document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-curr') === 'COP'));
                    updateTxCurrencyPreview();
                }
                amtEl.value = formatNumberInput(amtCop);
                amtEl.dispatchEvent(new Event('input'));
            }

            const accEl = document.getElementById('account');
            if (accEl && sub.accountId && Array.from(accEl.options).some(o => o.value === sub.accountId)) {
                accEl.value = sub.accountId;
                accEl.dispatchEvent(new Event('change'));
            }

            const catEl = document.getElementById('trans-category');
            if (catEl && sub.category) {
                const baseCat = String(sub.category).split('::')[0];
                const baseSub = sub.subcategory || (String(sub.category).includes('::') ? String(sub.category).split('::')[1] : 'General');
                const targetCat = `${baseCat}::${baseSub}`;
                if (Array.from(catEl.options).some(o => o.value === targetCat)) {
                    catEl.value = targetCat;
                    catEl.dispatchEvent(new Event('change'));
                } else if (Array.from(catEl.options).some(o => o.value === `${baseCat}::General`)) {
                    catEl.value = `${baseCat}::General`;
                    catEl.dispatchEvent(new Event('change'));
                }
            }

            suggestBox.classList.add('hidden');
            suggestBox.innerHTML = '';
        });
    });
};

document.getElementById('description')?.addEventListener('input', (e) => {
    const text = e.target.value.trim();
    renderOmniSubscriptionSuggestions(text);
    if (text.length < 3) return;
    const currentType = document.getElementById('type')?.value;
    const editId = document.getElementById('edit-id')?.value;
    if (editId || currentType === 'transfer') return;

    const catSelect = document.getElementById('trans-category');
    const accSelect = document.getElementById('account');
    let aiActed = false, bestCat = null, bestAcc = null;

    const regexInferredCategory = inferCategoryFromName(text, currentType);
    if (regexInferredCategory) {
        const options = Array.from(catSelect.options);
        const exactMatch = options.find(o => o.value === `${regexInferredCategory}::General`);
        const looseMatch = options.find(o => o.value.startsWith(`${regexInferredCategory}::`));
        if (exactMatch) bestCat = exactMatch.value;
        else if (looseMatch) bestCat = looseMatch.value;
    }

    const matches = financeData.transactions.filter(t => t.type === currentType && t.description && t.description.toLowerCase().includes(text.toLowerCase()));
    if (matches.length > 0) {
        const catFreq = {}, accFreq = {};
        matches.forEach(t => {
            const catStr = t.subcategory && t.subcategory !== 'General' ? `${t.category}::${t.subcategory}` : `${t.category}::General`;
            catFreq[catStr] = (catFreq[catStr] || 0) + 1;
            if (t.account) accFreq[t.account] = (accFreq[t.account] || 0) + 1;
        });
        if (!bestCat) bestCat = Object.keys(catFreq).sort((a, b) => catFreq[b] - catFreq[a])[0];
        bestAcc = Object.keys(accFreq).sort((a, b) => accFreq[b] - accFreq[a])[0];
    }

    if (bestAcc && accSelect && accSelect.value !== bestAcc && Array.from(accSelect.options).some(o => o.value === bestAcc)) {
        accSelect.value = bestAcc;
        accSelect.style.transition = 'box-shadow 0.3s ease';
        accSelect.style.boxShadow = '0 0 0 2px var(--accent)';
        setTimeout(() => accSelect.style.boxShadow = 'none', 3000);
        accSelect.dispatchEvent(new Event('change'));
        aiActed = true;
    }

    if (bestCat && catSelect && catSelect.value !== bestCat && Array.from(catSelect.options).some(o => o.value === bestCat)) {
        catSelect.value = bestCat;
        catSelect.style.transition = 'box-shadow 0.3s ease';
        catSelect.style.boxShadow = '0 0 0 2px var(--accent)';
        setTimeout(() => catSelect.style.boxShadow = 'none', 3000);
        catSelect.dispatchEvent(new Event('change'));
        aiActed = true;
    }
    
    if (aiActed) {
        e.target.style.transition = 'box-shadow 0.3s ease';
        e.target.style.boxShadow = '0 0 0 2px var(--positive)';
        setTimeout(() => e.target.style.boxShadow = 'none', 3000);
    }
});

document.getElementById('btn-tx-quick-payroll')?.addEventListener('click', () => {
    const salaryStr = localStorage.getItem('myFinancesSalary');
    if (!salaryStr) { alert("Configura tu Salario en 'Mi Perfil' primero."); return; }
    let config = null;
    try { config = JSON.parse(salaryStr); } catch { config = null; }
    if (!config) { alert("No se pudo leer tu configuración salarial. Guárdala de nuevo en 'Mi Perfil'."); return; }

    const dateVal = document.getElementById('trans-date')?.value || '';
    const refDateObj = /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? new Date(`${dateVal}T12:00:00`) : currentDate;
    const metrics = calculateLaborMetrics(config, refDateObj), isBiweekly = config.frequency === 'biweekly';
    const mId = getMonthId(refDateObj);
    const pSt = typeof getPayrollMonthStatus === 'function' ? getPayrollMonthStatus(mId, config, metrics) : null;

    const periodVal = isBiweekly ? (refDateObj.getDate() <= (pSt?.splitBoundary || 16) ? '1Q' : '2Q') : 'M';
    const baseSlotAmt = isBiweekly ? (periodVal === '1Q' ? metrics.net1Q : metrics.net2Q) : metrics.net;
    const afterAdvAmt = pSt
        ? (isBiweekly ? (periodVal === '1Q' ? pSt.effNet1Q : pSt.effNet2Q) : pSt.netAfterAdvances)
        : baseSlotAmt;
    const applicableAdv = Math.max(0, round2(baseSlotAmt - afterAdvAmt));

    let amt = baseSlotAmt;
    if (applicableAdv > 0) {
        if (confirm(`Tienes anticipos aplicables por ${formatMoney(applicableAdv)} en este periodo.\n\n¿Deseas descontarlos automáticamente de este pago de nómina?`)) {
            amt = afterAdvAmt;
        }
    }

    const salCat = financeData.categories.income.find(c => stripLeadingEmoji(c.name) === 'Salario / Nómina');
    if (salCat) {
        const catSel = document.getElementById('trans-category');
        catSel.value = `${salCat.name}::General`;
        catSel.dispatchEvent(new Event('change'));
    }
    document.getElementById('description').value = isBiweekly ? `Pago Nómina (${periodVal})` : 'Pago Nómina Mensual';
    document.getElementById('amount').value = formatNumberInput(amt);
    document.getElementById('amount').dispatchEvent(new Event('input'));
    pendingOmniPayrollLibranza = (metrics.payrollDebtDeductions > 0 || metrics.payrollSavingsDeductions > 0) ? { periodVal, isBiweekly } : null;
});

document.getElementById('btn-tx-advance-payroll')?.addEventListener('click', () => {
    const catObj = financeData.categories.income.find(c => stripLeadingEmoji(c.name) === 'Salario / Nómina');
    if (catObj) {
        if (!catObj.subcategories.some(s => s.name === 'Anticipo')) {
            catObj.subcategories.push({ name: 'Anticipo', limit: 0, isFixed: false });
            localStorage.setItem('myFinances', JSON.stringify(financeData));
            renderCategoryOptions('income');
        }
        document.getElementById('trans-category').value = `${catObj.name}::Anticipo`;
    }
    document.getElementById('description').value = 'Anticipo de Nómina';
    document.getElementById('amount').focus();
    document.getElementById('trans-category').dispatchEvent(new Event('change'));
});

// --- LÓGICA DE SPLIT (DIVISIÓN DE TRANSACCIONES) ---
let splitState = { baseAmount: 0, type: 'expense', items: [] };

const renderSplitItems = () => {
    const container = document.getElementById('split-items-container');
    if (!container) return;
    container.innerHTML = '';
    
    let assigned = 0;
    const assetsAcc = sortAlphabeticallyWithDefault(
        financeData.customAccounts.filter(a =>
            (a.category === 'asset' && !a.id.startsWith('CxC_')) ||
            (splitState.type === 'expense' && (a.category === 'credit_card' || a.debtType === 'revolving'))
        )
    );
    const escSp = window.escapeHtml || ((s) => String(s ?? ''));
    const escSpA = window.escapeAttr || escSp;
    const accOptionsHtml = assetsAcc.map(a => `<option value="${escSpA(a.id)}">${escSp(stripLeadingEmoji(a.name))}${a.isDefault ? ' ★' : ''}</option>`).join('');
    
    let catOptionsHtml = '';
    [...(financeData.categories[splitState.type] || [])].filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(cat => {
        const cleanCat = escSp(cleanCatName(cat.name));
        const cleanCatAttr = escSpA(cleanCatName(cat.name));
        const rawCatAttr = escSpA(cat.name);
        const activeSubs = Array.isArray(cat.subcategories) ? [...cat.subcategories].filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es')) : [];
        if (activeSubs.length > 0) {
            catOptionsHtml += `<optgroup label="${cleanCatAttr}">`;
            catOptionsHtml += `<option value="${rawCatAttr}::General">${cleanCat} (General)</option>`;
            activeSubs.forEach(sub => { catOptionsHtml += `<option value="${rawCatAttr}::${escSpA(sub.name)}">↳ ${escSp(cleanCatName(sub.name))}</option>`; });
            catOptionsHtml += `</optgroup>`;
        } else { catOptionsHtml += `<option value="${rawCatAttr}::General">${cleanCat}</option>`; }
    });

    splitState.items.forEach((item, index) => {
        assigned += round2(item.amount);
        container.innerHTML += `
            <div class="glass-sub-box" style="padding:12px; margin-bottom:0;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <strong style="font-size:12.5px;">Parte ${index + 1}</strong>
                    <button type="button" class="mini-action-btn" data-lumen-cmd="removeSplitItem" data-lumen-args='[${index}]' style="background:rgba(255,59,48,0.15); color:var(--negative); border:none; padding:3px 8px;">✕ Eliminar</button>
                </div>
                <div class="form-row" style="margin-bottom:8px;">
                    <div class="form-group" style="margin-bottom:0;">
                        <input type="text" class="money-input split-amt-input" data-index="${index}" inputmode="decimal" value="${item.amount > 0 ? formatNumberInput(item.amount) : ''}" placeholder="Monto ($)" style="font-weight:700;">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <select id="split-cat-${index}" class="split-cat-select" data-index="${index}" aria-label="Categoría • Parte ${index + 1}">${catOptionsHtml}</select>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group" style="margin-bottom:0;">
                        <select id="split-acc-${index}" class="split-acc-select" data-index="${index}" aria-label="Cuenta • Parte ${index + 1}">${accOptionsHtml}</select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <input type="text" class="split-desc-input" data-index="${index}" value="${escSpA(item.description || '')}" placeholder="Nota (Ej. Aseo)">
                    </div>
                </div>
            </div>`;
    });
    
    setTimeout(() => {
        document.querySelectorAll('.split-cat-select').forEach(el => { el.value = splitState.items[el.getAttribute('data-index')].category; });
        document.querySelectorAll('.split-acc-select').forEach(el => { el.value = splitState.items[el.getAttribute('data-index')].account; });
        document.querySelectorAll('.split-amt-input').forEach(el => {
            el.addEventListener('input', (e) => {
                applyLiveDecimalFormatting(e.target);
                splitState.items[el.getAttribute('data-index')].amount = parseMoneyInput(e.target.value);
                updateSplitTotals();
            });
        });
        document.querySelectorAll('.split-cat-select').forEach(el => { el.addEventListener('change', (e) => splitState.items[el.getAttribute('data-index')].category = e.target.value); });
        document.querySelectorAll('.split-acc-select').forEach(el => { el.addEventListener('change', (e) => splitState.items[el.getAttribute('data-index')].account = e.target.value); });
        document.querySelectorAll('.split-desc-input').forEach(el => { el.addEventListener('input', (e) => splitState.items[el.getAttribute('data-index')].description = e.target.value); });
    }, 50);

    const modalContent = document.querySelector('#split-tx-modal .modal-content');
    const confirmBtnEl = document.getElementById('btn-confirm-splits');
    if (modalContent && confirmBtnEl && splitState.type === 'expense') {
        let sharedBridge = document.getElementById('split-shared-expense-bridge');
        if (!sharedBridge) {
            sharedBridge = document.createElement('div');
            sharedBridge.id = 'split-shared-expense-bridge';
            sharedBridge.className = 'glass-sub-box';
            sharedBridge.style.cssText = 'margin-top:10px; padding:11px 12px; border-color:color-mix(in srgb, var(--positive) 32%, var(--border-color));';
            sharedBridge.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                    <div>
                        <strong style="display:block; font-size:12px; color:var(--text-main);">Gasto Compartido en esta división</strong>
                        <small style="display:block; font-size:10.5px; color:var(--text-muted);">Crea el gasto (tu parte) y el cobro a tu deudor por cada medio de pago</small>
                    </div>
                    <label class="switch" style="transform:scale(0.85); transform-origin:right center; margin:0;">
                        <input type="checkbox" id="split-shared-enable-check">
                        <span class="slider"></span>
                    </label>
                </div>
                <div id="split-shared-fields-box" class="hidden" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                    <div class="form-row" style="margin-bottom:6px;">
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:10px;">Monto que te deben ($)</label>
                            <input type="text" id="split-shared-owed-input" class="money-input" inputmode="decimal" placeholder="0,00">
                        </div>
                        <div class="form-group" style="margin-bottom:0;">
                            <label style="font-size:10px;">¿Quién te debe?</label>
                            <input type="text" id="split-shared-debtor-input" placeholder="Ej. Lumi">
                        </div>
                    </div>
                    <small id="split-shared-preview-line" style="display:block; font-size:10.5px; color:var(--text-muted); line-height:1.35;"></small>
                </div>
            `;
            confirmBtnEl.parentElement?.insertBefore(sharedBridge, confirmBtnEl);

            const enCheck = sharedBridge.querySelector('#split-shared-enable-check');
            const fieldsBox = sharedBridge.querySelector('#split-shared-fields-box');
            const owedInp = sharedBridge.querySelector('#split-shared-owed-input');
            const debtInp = sharedBridge.querySelector('#split-shared-debtor-input');
            const prevLine = sharedBridge.querySelector('#split-shared-preview-line');

            const refreshBridgePreview = () => {
                const active = !!enCheck?.checked;
                fieldsBox?.classList.toggle('hidden', !active);
                if (!active || !prevLine) return;
                const owed = parseMoneyInput(owedInp?.value);
                const total = round2(splitState.baseAmount || 0);
                if (owed <= 0) {
                    prevLine.textContent = 'Ingresa cuánto te debe esa persona para prorratear cada parte.';
                    return;
                }
                if (owed >= total) {
                    prevLine.innerHTML = `<span class="negative">El cobro debe ser menor al total (${formatMoney(total)}).</span>`;
                    return;
                }
                const myNet = round2(total - owed);
                prevLine.innerHTML = `Tu gasto neto será <b>${formatMoney(myNet)}</b> y se registrarán <b>${formatMoney(owed)}</b> por cobrar prorrateados en cada medio de pago.`;
            };

            enCheck?.addEventListener('change', () => {
                const mainSharedOn = !!document.getElementById('is-shared-expense')?.checked;
                const mainOwed = parseMoneyInput(document.getElementById('shared-owed-amount')?.value);
                const mainDebtor = (document.getElementById('shared-debtor-name')?.value || '').trim();
                if (enCheck.checked) {
                    if (mainSharedOn && mainOwed > 0 && !parseMoneyInput(owedInp?.value)) {
                        owedInp.value = formatNumberInput(mainOwed);
                    }
                    if (mainSharedOn && mainDebtor && !debtInp?.value.trim()) {
                        debtInp.value = mainDebtor;
                    }
                }
                refreshBridgePreview();
            });
            owedInp?.addEventListener('input', () => { applyLiveDecimalFormatting(owedInp); refreshBridgePreview(); });
            debtInp?.addEventListener('input', refreshBridgePreview);
            sharedBridge._refreshPreview = refreshBridgePreview;
        }

        sharedBridge.classList.remove('hidden');
        const mainSharedOn = !!document.getElementById('is-shared-expense')?.checked;
        const mainOwed = parseMoneyInput(document.getElementById('shared-owed-amount')?.value);
        const mainDebtor = (document.getElementById('shared-debtor-name')?.value || '').trim();
        const enCheck = document.getElementById('split-shared-enable-check');
        const owedInp = document.getElementById('split-shared-owed-input');
        const debtInp = document.getElementById('split-shared-debtor-input');

        if (!sharedBridge.dataset.syncedOnce) {
            sharedBridge.dataset.syncedOnce = '1';
            if (enCheck) enCheck.checked = mainSharedOn;
            if (owedInp && mainOwed > 0) owedInp.value = formatNumberInput(mainOwed);
            if (debtInp && mainDebtor) debtInp.value = mainDebtor;
        } else if (mainSharedOn && enCheck && !enCheck.checked) {
            enCheck.checked = true;
            if (owedInp && mainOwed > 0) owedInp.value = formatNumberInput(mainOwed);
            if (debtInp && mainDebtor) debtInp.value = mainDebtor;
        }
        sharedBridge._refreshPreview?.();
    } else {
        const sb = document.getElementById('split-shared-expense-bridge');
        if (sb) {
            sb.classList.add('hidden');
            delete sb.dataset.syncedOnce;
        }
    }

    updateSplitTotals();
};

const updateSplitTotals = () => {
    let assigned = splitState.items.reduce((sum, item) => round2(sum + (parseFloat(item.amount) || 0)), 0);
    const rem = round2(splitState.baseAmount - assigned);
    document.getElementById('split-base-total').innerText = formatMoney(splitState.baseAmount);
    document.getElementById('split-assigned-total').innerText = formatMoney(assigned);
    document.getElementById('split-remaining-total').innerText = formatMoney(rem);

    const remEl = document.getElementById('split-remaining-total');
    const confirmBtn = document.getElementById('btn-confirm-splits');
    if (Math.abs(rem) < 0.01) { 
        remEl.className = 'positive';
        if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.style.opacity = '1'; }
    } else {
        remEl.className = rem < 0 ? 'negative' : 'neutral';
        if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.style.opacity = '0.5'; }
    }
};

window.removeSplitItem = (index) => { splitState.items.splice(index, 1); renderSplitItems(); };

document.getElementById('btn-add-split-item')?.addEventListener('click', () => {
    let currentAssigned = splitState.items.reduce((sum, item) => sum + round2(item.amount), 0);
    let rem = Math.max(0, round2(splitState.baseAmount - currentAssigned));
    const baseCat = document.getElementById('trans-category')?.value || '';
    const baseAcc = document.getElementById('account')?.value || getDefaultAccountId(splitState.type === 'income');
    const baseDesc = document.getElementById('description')?.value || '';
    splitState.items.push({ amount: rem, category: baseCat, account: baseAcc, description: baseDesc });
    renderSplitItems();
});

document.getElementById('btn-open-split-modal')?.addEventListener('click', () => {
    const baseAmt = parseMoneyInput(document.getElementById('amount')?.value);
    if (baseAmt <= 0) { alert('Ingresa primero el Monto Total en el formulario principal.'); return; }
    splitState.type = typeSelect.value;
    splitState.baseAmount = baseAmt;

    const badge = document.getElementById('split-tx-type-badge');
    if (badge) {
        badge.innerText = splitState.type === 'expense' ? 'Gasto' : 'Ingreso';
        badge.className = splitState.type === 'expense' ? 'widget-badge negative-bg' : 'widget-badge positive-bg';
        badge.style.color = 'white';
    }
    const baseCat = document.getElementById('trans-category')?.value || '';
    const baseAcc = document.getElementById('account')?.value || getDefaultAccountId(splitState.type === 'income');
    const baseDesc = document.getElementById('description')?.value || '';

    splitState.items = [
        { amount: baseAmt, category: baseCat, account: baseAcc, description: baseDesc },
        { amount: 0, category: baseCat, account: baseAcc, description: baseDesc }
    ];
    document.getElementById('split-tx-modal')?.classList.remove('hidden');
    renderSplitItems();
});

document.getElementById('close-split-modal-btn')?.addEventListener('click', () => {
    document.getElementById('split-tx-modal')?.classList.add('hidden');
});

document.getElementById('btn-confirm-splits')?.addEventListener('click', () => {
    const showSplitToast = (text, isError = false) => {
        document.querySelectorAll('.sw-toast').forEach(t => t.remove());
        const toast = document.createElement('div');
        toast.className = 'sw-toast';
        toast.style.gap = '7px';
        toast.style.whiteSpace = 'normal';
        toast.style.lineHeight = '1.3';
        toast.style.borderRadius = '16px';
        if (isError) {
            toast.style.background = 'var(--negative)';
            toast.style.boxShadow = '0 8px 24px rgba(239, 68, 68, 0.35)';
        }
        const iconSvg = isError
            ? `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
            : `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
        toast.innerHTML = `${iconSvg}<span>${text}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2600);
    };

    let currentAssigned = splitState.items.reduce((sum, item) => round2(sum + (parseFloat(item.amount) || 0)), 0);
    const rem = round2(splitState.baseAmount - currentAssigned);
    if (Math.abs(rem) >= 0.01) { showSplitToast(`La división no es exacta. Descuadre de ${formatMoney(rem)}.`, true); return; }
    if (splitState.items.length < 2) { showSplitToast('Agrega al menos dos sub-transacciones para dividir.', true); return; }
    
    let assigned = splitState.items.reduce((sum, item) => sum + round2(item.amount), 0);
    if (round2(splitState.baseAmount - assigned) !== 0) { showSplitToast('La suma debe ser igual al monto total base.', true); return; }

    const validItems = splitState.items.filter(i => i.amount > 0);
    if (validItems.length < 2) { showSplitToast('Debes tener al menos 2 divisiones mayores a $0.', true); return; }

    const status = document.getElementById('trans-status').value;
    const baseDateObj = new Date(`${document.getElementById('trans-date').value}T${document.getElementById('trans-time').value}`);
    const splitGroupId = 'Split_' + Date.now();
    const commonDesc = document.getElementById('description').value.trim();

    const useSharedInSplit = splitState.type === 'expense' && !!document.getElementById('split-shared-enable-check')?.checked;
    const splitOwedTotal = useSharedInSplit ? parseMoneyInput(document.getElementById('split-shared-owed-input')?.value) : 0;
    const splitDebtor = useSharedInSplit ? ((document.getElementById('split-shared-debtor-input')?.value || '').trim() || 'Alguien') : '';

    if (useSharedInSplit) {
        if (splitOwedTotal <= 0) {
            showSplitToast('Ingresa el monto que te deben para el gasto compartido.', true);
            return;
        }
        if (splitOwedTotal >= splitState.baseAmount) {
            showSplitToast('El monto que te deben debe ser menor al monto total.', true);
            return;
        }
    }

    let cxcAccId = '';
    if (useSharedInSplit && splitOwedTotal > 0) {
        cxcAccId = 'CxC_' + splitDebtor.replace(/\s+/g, '_');
        if (!financeData.customAccounts.some(a => a.id === cxcAccId)) {
            financeData.customAccounts.push({
                id: cxcAccId,
                name: `Me debe: ${splitDebtor}`,
                category: 'asset',
                isDefault: false,
                showWhenZero: true
            });
        }
    }

    const usedTxIds = new Set((financeData.transactions || []).map(t => t.id));
    const allocUniqueTxId = (seed) => {
        let candidate = Number(seed) || Date.now();
        while (usedTxIds.has(candidate)) candidate += 1;
        usedTxIds.add(candidate);
        return candidate;
    };

    const dateFormatted = `${baseDateObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${baseDateObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
    const mIdSplit = getMonthId(baseDateObj);
    const totalPaidBase = round2(splitState.baseAmount);
    const totalMyNet = useSharedInSplit ? round2(totalPaidBase - splitOwedTotal) : totalPaidBase;
    let allocatedOwedSoFar = 0;

    validItems.forEach((item, idx) => {
        let catName = '', subName = 'General';
        if (item.category) { const parts = item.category.split('::'); catName = parts[0]; subName = parts[1] || 'General'; }

        const partGross = round2(item.amount);
        let partMyExpense = partGross;
        let partOwedChild = 0;

        if (useSharedInSplit && splitOwedTotal > 0) {
            if (idx === validItems.length - 1) {
                partOwedChild = Math.max(0, round2(splitOwedTotal - allocatedOwedSoFar));
                partMyExpense = Math.max(0, round2(partGross - partOwedChild));
            } else {
                const ratio = totalPaidBase > 0 ? (partGross / totalPaidBase) : 0;
                partOwedChild = Math.min(partGross, round2(splitOwedTotal * ratio));
                partMyExpense = Math.max(0, round2(partGross - partOwedChild));
                allocatedOwedSoFar = round2(allocatedOwedSoFar + partOwedChild);
            }
        }

        const baseLabel = `${item.description || commonDesc || catName || 'Movimiento'} [${idx + 1}/${validItems.length}]`;
        const parentTxId = allocUniqueTxId(baseDateObj.getTime() + idx * 10);
        const splitAccObj = getAccountObj(item.account);
        const isCreditSplit = splitState.type === 'expense' && (splitAccObj.category === 'credit_card' || splitAccObj.debtType === 'revolving');

        const splitTx = {
            id: parentTxId,
            monthId: mIdSplit,
            type: splitState.type,
            status: status,
            account: item.account,
            category: catName,
            subcategory: subName,
            description: useSharedInSplit && partOwedChild > 0
                ? `${baseLabel} (Mi parte de ${formatMoney(partGross)})`
                : baseLabel,
            amount: partMyExpense,
            budgetedAmount: status === 'pending' ? partMyExpense : 0,
            date: dateFormatted,
            isAdjustment: false,
            splitGroupId: splitGroupId
        };

        if (isCreditSplit) {
            splitTx.installments = 1;
            splitTx.paidInstallments = 0;
            splitTx.rate = 0;
            splitTx.rateType = 'monthly';
            splitTx.zeroInterest = true;
            splitTx.monthlyQuota = partMyExpense;
            splitTx.totalWithInterest = partMyExpense;
        }

        financeData.transactions.push(splitTx);

        if (useSharedInSplit && partOwedChild > 0 && cxcAccId) {
            const childTx = {
                id: allocUniqueTxId(parentTxId + 5),
                monthId: mIdSplit,
                type: 'transfer',
                status: status,
                account: item.account,
                toAccount: cxcAccId,
                description: `Préstamo a ${splitDebtor} [${idx + 1}/${validItems.length}] (Parte: ${formatMoney(partGross)})`,
                amount: partOwedChild,
                date: dateFormatted,
                isAdjustment: false,
                parentId: parentTxId,
                splitGroupId: splitGroupId
            };
            if (isCreditSplit) {
                childTx.installments = 1;
                childTx.paidInstallments = 0;
                childTx.rate = 0;
                childTx.rateType = 'monthly';
                childTx.zeroInterest = true;
                childTx.monthlyQuota = partOwedChild;
                childTx.totalWithInterest = partOwedChild;
            }
            financeData.transactions.push(childTx);
        }
    });

    const sbEl = document.getElementById('split-shared-expense-bridge');
    if (sbEl) delete sbEl.dataset.syncedOnce;
    if (document.getElementById('split-shared-enable-check')) document.getElementById('split-shared-enable-check').checked = false;
    if (document.getElementById('split-shared-owed-input')) document.getElementById('split-shared-owed-input').value = '';
    if (document.getElementById('split-shared-debtor-input')) document.getElementById('split-shared-debtor-input').value = '';
    document.getElementById('split-shared-fields-box')?.classList.add('hidden');

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    viewDate = new Date(baseDateObj.getFullYear(), baseDateObj.getMonth(), 1);
    document.getElementById('split-tx-modal')?.classList.add('hidden');
    forceCloseAllModals(); updateDashboard();
    showSplitToast(
        useSharedInSplit
            ? `Dividido en ${validItems.length} partes (Tu parte: ${formatMoney(totalMyNet)} • Por cobrar: ${formatMoney(splitOwedTotal)})`
            : `Transacción dividida y guardada en ${validItems.length} partes`
    );
});

// --- LÓGICA DE REDONDEO DE AHORRO (EFECTIVO Y COMPRAS DIGITALES) ---
let userEditedCoinAmount = false;
const updateCoinRoundingUI = () => {
    const wrap = document.getElementById('coin-round-wrapper');
    const fields = document.getElementById('coin-round-fields');
    const pillsWrap = document.getElementById('coin-round-pills');
    const coinInput = document.getElementById('coin-round-amount');
    if (!wrap) return;

    const editId = document.getElementById('edit-id')?.value || '';
    const type = document.getElementById('type')?.value;
    const acc = document.getElementById('account')?.value || '';
    const accObj = getAccountObj(acc);
    const fxRate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
        ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
        : 1;
    const amount = Math.round(parseMoneyInput(document.getElementById('amount')?.value) * fxRate);
    // Solo cuentas de activo/liquidez reales (nunca tarjetas de crédito, deudas ni CxC)
    const isEligibleAcc = acc && !acc.startsWith('CxC_') && accObj.category === 'asset';

    if (!editId && type === 'expense' && isEligibleAcc && amount > 0) {
        const isCash = acc === 'Efectivo' || accObj.accountSubType === 'cash';

        // Actualizar título, ícono y etiqueta del campo numérico según sea Efectivo vs. Cuenta Bancaria/Digital
        const titleStrong = wrap.querySelector('.switch-row strong, .zero-interest-text strong');
        if (titleStrong) {
            titleStrong.textContent = isCash ? 'Ahorro de Monedas (Vueltos)' : 'Redondeo de Ahorro Digital';
        }
        const amtLabelEl = coinInput?.closest('.form-group')?.querySelector('label');
        if (amtLabelEl) {
            amtLabelEl.textContent = isCash ? 'Monedas a guardar en alcancía ($)' : 'Monto a redondear y ahorrar ($)';
        }

        if (fields) {
            let pocketGroup = document.getElementById('coin-round-pocket-group');
            if (!pocketGroup) {
                pocketGroup = document.createElement('div');
                pocketGroup.id = 'coin-round-pocket-group';
                pocketGroup.className = 'form-group';
                pocketGroup.style.cssText = 'margin-top:8px; margin-bottom:4px;';
                pocketGroup.innerHTML = `
                    <label style="font-size:10px; margin-bottom:4px;">Bolsillo destino del ahorro</label>
                    <select id="coin-round-target-pocket" aria-label="Bolsillo destino del ahorro"></select>
                    <small id="coin-round-source-note" style="display:block; font-size:10px; color:var(--text-muted); margin-top:4px;"></small>
                `;
                fields.appendChild(pocketGroup);
            }

            const pocketSel = document.getElementById('coin-round-target-pocket');
            const sourceNote = document.getElementById('coin-round-source-note');
            if (pocketSel) {
                const esc = window.escapeHtml || ((s) => String(s ?? ''));
                const escA = window.escapeAttr || esc;
                const prevMode = pocketSel.dataset.roundMode || '';
                const currentMode = isCash ? 'cash' : 'digital';
                const prevVal = prevMode === currentMode ? pocketSel.value : '';
                pocketSel.dataset.roundMode = currentMode;

                const defaultVirtualId = isCash ? 'Pocket_Monedas' : 'Pocket_Redondeo';
                const defaultVirtualName = isCash ? 'Alcancía Monedas (Automático)' : 'Redondeo Digital (Automático)';

                // En cuentas bancarias/digitales ocultar "Alcancía Monedas" para no mezclar efectivo físico con saldos bancarios
                const eligiblePockets = (financeData.pockets || []).filter(p =>
                    isCash ? true : (p.id !== 'Pocket_Monedas' && !/^alcanc[ií]a\s+monedas$/i.test(stripLeadingEmoji(p.name || '')))
                );

                let opts = '';
                if (!eligiblePockets.some(p => p.id === defaultVirtualId)) {
                    opts += `<option value="${defaultVirtualId}">${defaultVirtualName}</option>`;
                }
                eligiblePockets.forEach(p => {
                    const bal = round2((p.principal || 0) + (p.yields || 0));
                    opts += `<option value="${escA(p.id)}">${esc(stripLeadingEmoji(p.name))} (${formatCompact(bal)})</option>`;
                });
                pocketSel.innerHTML = opts;

                if (prevVal && Array.from(pocketSel.options).some(o => o.value === prevVal)) {
                    pocketSel.value = prevVal;
                } else if (isCash) {
                    pocketSel.value = 'Pocket_Monedas';
                } else {
                    const preferredDigital = eligiblePockets.find(p => p.id === 'Pocket_Redondeo') || eligiblePockets[0];
                    pocketSel.value = preferredDigital ? preferredDigital.id : 'Pocket_Redondeo';
                }
                pocketSel.dispatchEvent(new Event('change'));
            }

            if (sourceNote) {
                sourceNote.textContent = isCash
                    ? 'Se descontará de tu Efectivo y sumará a tu alcancía.'
                    : `Se trasladará como transferencia vinculada desde "${stripLeadingEmoji(accObj.name)}".`;
            }
        }

        const options = [];
        let suggested = 1000;

        if (isCash) {
            const rem5k = amount % 5000;
            const diff5k = rem5k !== 0 ? (5000 - rem5k) : 0;
            const exactCoins = diff5k % 2000;
            const rem2k = amount % 2000;
            const diff2k = rem2k !== 0 ? (2000 - rem2k) : 0;
            const rem1k = amount % 1000;
            const diff1k = rem1k !== 0 ? (1000 - rem1k) : 0;

            suggested = exactCoins > 0 ? exactCoins : (diff2k > 0 ? diff2k : (diff1k > 0 ? diff1k : 1000));
            const completesBill5k = (amount + suggested) % 5000 === 0;
            const descEl = document.getElementById('coin-round-desc');
            if (descEl) {
                descEl.innerText = exactCoins > 0
                    ? (completesBill5k ? `Sugerido: guardar ${formatMoney(suggested)} (completar ${formatMoney(amount + suggested)})` : `Sugerido: guardar ${formatMoney(suggested)} (vuelto en monedas)`)
                    : 'Guardar vuelto en monedas en tu alcancía';
            }
            if (exactCoins > 0) options.push({ val: exactCoins, label: `${formatMoney(exactCoins)} (Billete $5k/$10k)` });
            if (diff2k > 0 && !options.some(o => o.val === diff2k)) options.push({ val: diff2k, label: `${formatMoney(diff2k)} (Billete $2k)` });
            if (diff1k > 0 && !options.some(o => o.val === diff1k)) options.push({ val: diff1k, label: `${formatMoney(diff1k)} (Múltiplo $1k)` });
            if (options.length === 0) options.push({ val: 1000, label: `${formatMoney(1000)} (+$1k)` });
        } else {
            const diff1k = amount % 1000 !== 0 ? (1000 - (amount % 1000)) : 1000;
            const diff5k = amount % 5000 !== 0 ? (5000 - (amount % 5000)) : 5000;
            const diff10k = amount % 10000 !== 0 ? (10000 - (amount % 10000)) : 10000;

            suggested = diff5k <= 3500 ? diff5k : diff1k;
            const descEl = document.getElementById('coin-round-desc');
            if (descEl) {
                descEl.innerText = `Sugerido: apartar ${formatMoney(suggested)} (redondear a ${formatCompact(amount + suggested)})`;
            }
            options.push({ val: diff1k, label: `+${formatMoney(diff1k)} (a ${formatCompact(amount + diff1k)})` });
            if (!options.some(o => o.val === diff5k)) options.push({ val: diff5k, label: `+${formatMoney(diff5k)} (a ${formatCompact(amount + diff5k)})` });
            if (!options.some(o => o.val === diff10k)) options.push({ val: diff10k, label: `+${formatMoney(diff10k)} (a ${formatCompact(amount + diff10k)})` });
        }

        if (pillsWrap) {
            pillsWrap.innerHTML = options.map(o => `<button type="button" class="pill-btn" data-coin-val="${o.val}">${o.label}</button>`).join('');
            pillsWrap.querySelectorAll('.pill-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const val = parseFloat(btn.getAttribute('data-coin-val')) || 0;
                    if (coinInput) { coinInput.value = formatNumberInput(val); userEditedCoinAmount = true; }
                });
            });
        }

        if (coinInput && !userEditedCoinAmount) coinInput.value = formatNumberInput(suggested);
        wrap.classList.remove('hidden');
        const isChecked = !!document.getElementById('is-coin-round')?.checked;
        fields?.classList.toggle('hidden', !isChecked);
    } else {
        wrap.classList.add('hidden');
        fields?.classList.add('hidden');
        if (document.getElementById('is-coin-round')) document.getElementById('is-coin-round').checked = false;
        userEditedCoinAmount = false;
    }
};

document.getElementById('is-coin-round')?.addEventListener('change', (e) => {
    const fields = document.getElementById('coin-round-fields');
    if (e.target.checked) { fields?.classList.remove('hidden'); updateCoinRoundingUI(); } 
    else { fields?.classList.add('hidden'); }
});
document.getElementById('coin-round-amount')?.addEventListener('input', () => { userEditedCoinAmount = true; });
document.getElementById('account')?.addEventListener('change', () => { userEditedCoinAmount = false; updateCoinRoundingUI(); });
document.getElementById('amount')?.addEventListener('input', updateCoinRoundingUI);
document.getElementById('type')?.addEventListener('change', updateCoinRoundingUI);
document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(updateCoinRoundingUI, 25));
});

// ==========================================
// 12. HISTORIAL CON BUSCADOR INSTANTÁNEO Y CONFIRMACIÓN
// ==========================================
window.confirmPendingTx = (id, event) => {
    if (event) event.stopPropagation();
    const tx = financeData.transactions.find(t => String(t.id) === String(id));
    if (!tx) return;

    const defaultAmt = tx.amount > 0 ? tx.amount : (tx.budgetedAmount || 0);
    const refAmt = tx.budgetedAmount || defaultAmt;

    openQuickActionModal({
        title: 'Confirmar Movimiento',
        subtitle: tx.description,
        infoLabel: 'Valor Presupuestado:',
        infoValue: formatMoney(refAmt),
        showAccountSelect: false,
        amountLabel: 'Valor REAL Pagado / Recibido ($)',
        defaultAmount: defaultAmt,
        submitLabel: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><span>Confirmar Movimiento</span>`,
        onConfirm: (realAmt) => {
            if (realAmt < 0) { alert('Ingresa un monto válido.'); return false; }
            if (!tx.budgetedAmount) tx.budgetedAmount = defaultAmt;
            tx.amount = realAmt;
            tx.status = 'closed';
            if (tx.pendingLibranzas) {
                const appliedLib = applyPayrollLibranzas(tx.monthId, tx.payrollPeriod || 'M', new Date(tx.id), !!tx.isBiweeklyPayroll);
                if (appliedLib.length > 0) {
                    tx.linkedLibranzas = appliedLib.map(l => ({
                        txId: l.txId, intTxId: l.intTxId, debtId: l.debtId,
                        targetTxId: l.targetTxId, pocketId: l.pocketId,
                        pocketAmt: l.pocketAmt, quoteStep: l.quoteStep
                    }));
                }
                delete tx.pendingLibranzas;
            }

            const txAccObj = getAccountObj(tx.account);
            if (tx.type === 'transfer') {
                const toObj = getAccountObj(tx.toAccount);
                if (txAccObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(txAccObj.id, -realAmt);
                if (toObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(toObj.id, realAmt);
                if (typeof window.applyTransferAllocatedItems === 'function') {
                    window.applyTransferAllocatedItems(tx, new Date(Number(tx.id) || Date.now()));
                }
            } else if (txAccObj.category === 'pocket') {
                if (tx.type === 'income') {
                    const p = (financeData.pockets || []).find(x => String(x.id) === String(tx.account));
                    if (p) p.yields = round2((p.yields || 0) + realAmt);
                } else if (tx.type === 'expense' && typeof adjustPocketBalance === 'function') {
                    adjustPocketBalance(tx.account, -realAmt);
                }
            } else if (tx.type === 'expense' && (txAccObj.category === 'credit_card' || txAccObj.debtType === 'revolving') && typeof calculateAmortization === 'function') {
                const inst = Math.max(1, parseInt(tx.installments, 10) || 1);
                const rate = tx.zeroInterest ? 0 : (parseFloat(tx.rate) || 0);
                const amort = calculateAmortization(realAmt, inst, rate, tx.rateType || 'monthly');
                tx.monthlyQuota = amort.payment;
                tx.totalWithInterest = amort.totalWithInterest;
            }

            localStorage.setItem('myFinances', JSON.stringify(financeData));
            updateDashboard();
            return true;
        }
    });
};

window.renderTransactionHistory = (monthId, snap, projectionData) => {
    const listEl = document.getElementById('transaction-list');
    const titleEl = document.getElementById('history-section-title');
    const countBadge = document.getElementById('history-count-badge');
    const projBox = document.getElementById('projection-summary-box');
    if (!listEl) return;

    if (titleEl) {
        if (historySearchQuery) titleEl.innerText = 'Resultados de Búsqueda';
        else if (typeof selectedCalendarDay !== 'undefined' && selectedCalendarDay) {
            const dObj = new Date(selectedCalendarDay + 'T12:00:00');
            titleEl.innerText = `Movimientos del ${dObj.getDate()} de ${getShortMonthLabel(dObj)}`;
        } else {
            titleEl.innerText = 'Movimientos del Mes';
        }
    }

    let filteredTxs = financeData.transactions.filter(t => !t.isDeleted && getTxMonthId(t) === monthId);

    if (typeof selectedCalendarDay !== 'undefined' && selectedCalendarDay) {
        filteredTxs = filteredTxs.filter(t => {
            const effD = typeof getTxEffectiveDateObj === 'function' ? getTxEffectiveDateObj(t, currentDate) : new Date(t.id);
            const iso = typeof toLocalIsoDateStr === 'function' ? toLocalIsoDateStr(effD) : effD.toLocaleDateString('en-CA');
            return iso === selectedCalendarDay;
        });
    }

    if (typeof activeHistoryFilter !== 'undefined' && activeHistoryFilter !== 'all') {
        if (activeHistoryFilter === 'pending') {
            filteredTxs = filteredTxs.filter(t => t.status === 'pending');
            const currentMonthId = getMonthId(currentDate);
            if (monthId >= currentMonthId && financeData.preferences?.showProjections !== false) {
                
                financeData.subscriptions.forEach(sub => {
                    if (sub.status === 'active' && sub.nextBillingDate) {
                        const subMonthId = sub.nextBillingDate.slice(0, 7);
                        const cyc = String(sub.cycle || 'monthly').toLowerCase();
                        let matchesCycle = false;
                        if (subMonthId === monthId) {
                            matchesCycle = true;
                        } else if (subMonthId < monthId) {
                            const [sy, sm] = subMonthId.split('-').map(Number);
                            const [ty, tm] = monthId.split('-').map(Number);
                            const monthsDiff = (ty - sy) * 12 + (tm - sm);
                            if (cyc === 'monthly' || cyc === 'weekly') matchesCycle = true;
                            else if (cyc === 'bimonthly' && monthsDiff % 2 === 0) matchesCycle = true;
                            else if (cyc === 'quarterly' && monthsDiff % 3 === 0) matchesCycle = true;
                            else if (cyc === 'semiannual' && monthsDiff % 6 === 0) matchesCycle = true;
                            else if (cyc === 'annual' && monthsDiff % 12 === 0) matchesCycle = true;
                        }
                        if (matchesCycle) {
                            const dueDay = sub.nextBillingDate.split('-')[2] || '01';
                            filteredTxs.push({
                                id: `v_sub_${sub.id}`, isVirtual: true, status: 'pending', type: 'expense',
                                account: sub.accountId || getDefaultAccountId(false),
                                category: sub.category || 'Entretenimiento',
                                description: `Suscripción: ${sub.name}`,
                                amount: cyc === 'weekly' ? round2(sub.amount * 4) : sub.amount,
                                date: `Vence: ${monthId}-${dueDay}`
                            });
                        }
                    }
                });

                const [vY, vM] = monthId.split('-').map(Number);
            const vDaysInM = new Date(vY, vM, 0).getDate();

            financeData.customAccounts.filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
                const bal = round2(snap.bals[d.id] || 0);
                if (bal <= 0) return;
                if (d.paymentDay && typeof getLiabilityDueCycleState === 'function') {
                    const dueDt = new Date(vY, vM - 1, Math.min(d.paymentDay, vDaysInM), 12, 0, 0);
                    const st = getLiabilityDueCycleState(d, bal, dueDt, currentDate);
                    if (!st.isPaid && st.remainingQuota > 0) {
                        filteredTxs.push({
                            id: `v_debt_${d.id}`, isVirtual: true, status: 'pending', type: 'expense',
                            account: getDefaultAccountId(true), category: 'Cuotas / Intereses',
                            description: `Préstamo: ${stripLeadingEmoji(d.name)}`,
                            amount: st.remainingQuota,
                            date: `${d.cutoffDay ? `Corte: Día ${d.cutoffDay} • ` : ''}Pago: Día ${d.paymentDay}`
                        });
                    }
                } else {
                    const paidThisMonth = (typeof isLiabilityCycleMarkedSettled === 'function' && isLiabilityCycleMarkedSettled(d, viewDate)) || financeData.transactions.some(t => !t.isDeleted && getTxMonthId(t) === monthId && t.toAccount === d.id && t.type === 'transfer' && t.paymentMode !== 'extraordinary' && isTxClosed(t));
                    if (!paidThisMonth) {
                        const qInfo = getDebtMonthlyQuotaBreakdown(d, bal);
                        if (qInfo.totalQuota > 0) {
                            filteredTxs.push({
                                id: `v_debt_${d.id}`, isVirtual: true, status: 'pending', type: 'expense',
                                account: getDefaultAccountId(true), category: 'Cuotas / Intereses',
                                description: `Préstamo: ${stripLeadingEmoji(d.name)}`,
                                amount: qInfo.totalQuota, date: 'Cuota del mes'
                            });
                        }
                    }
                }
            });

            financeData.customAccounts.filter(a => a.category === 'credit_card').forEach(c => {
                const bal = round2(snap.bals[c.id] || 0);
                if (bal <= 0) return;
                const pDay = Math.max(1, Math.min(31, parseInt(c.paymentDay, 10) || 30));
                const dueDt = new Date(vY, vM - 1, Math.min(pDay, vDaysInM), 12, 0, 0);
                const st = typeof getLiabilityDueCycleState === 'function'
                    ? getLiabilityDueCycleState(c, bal, dueDt, currentDate)
                    : { isPaid: false, remainingQuota: calculateCardMinPaymentEstimate(c, bal).totalMinPayment };
                if (!st.isPaid && st.remainingQuota > 0) {
                    filteredTxs.push({
                        id: `v_card_${c.id}`, isVirtual: true, status: 'pending', type: 'expense',
                        account: getDefaultAccountId(true), category: 'Cuotas / Intereses',
                        description: `Tarjeta: ${stripLeadingEmoji(c.name)}`,
                        amount: st.remainingQuota,
                        date: `Corte: Día ${c.cutoffDay || '-'} • Pago: Día ${pDay}`
                    });
                }
            });

            if (typeof evaluateAccountMgmtFeeCycle === 'function') {
                financeData.customAccounts.filter(a => isAccountMgmtFeeEligible(a) && a.hasMgmtFee).forEach(acc => {
                    const st = evaluateAccountMgmtFeeCycle(acc, monthId, snap, currentDate);
                    if (st.enabled && st.status === 'pending' && st.amount > 0) {
                        filteredTxs.push({
                            id: `v_accmgmt_${acc.id}`, isVirtual: true, status: 'pending', type: 'expense',
                            account: acc.id, category: 'Cuotas / Intereses',
                            description: `Cuota de manejo: ${stripLeadingEmoji(acc.name)}`,
                            amount: st.amount,
                            date: `Cobro: Día ${st.day}${st.autoCharge ? ' • Auto' : ''}`
                        });
                    }
                });
            }
                
                const mIdx = viewDate.getMonth();
                const vYear = viewDate.getFullYear();
                const calcNetFixedScopeRem = (catObj, subObj) => {
                    const hasActiveSubs = Array.isArray(catObj.subcategories) && catObj.subcategories.some(s => !s.isArchived);
                    const st = getCategoryBudgetStatus(catObj, subObj, mIdx, vYear);
                    const scopeLimit = (!subObj && hasActiveSubs) ? st.ownCurrentLimit : st.currentLimit;
                    if (scopeLimit <= 0) return 0;
                    let rawSpent = 0, refOff = 0;
                    financeData.transactions.forEach(t => {
                        if (t.isDeleted || t.isTripIsolated || (t.isSharedTrip && t.paidBy === 'companion') || getTxMonthId(t) !== monthId || t.isAdjustment || !isTxClosed(t)) return;
                        if (t.type === 'expense' && t.category === catObj.name) {
                            const matchSub = subObj ? (t.subcategory === subObj.name) : (!hasActiveSubs || !t.subcategory || t.subcategory === 'General');
                            if (matchSub) rawSpent = round2(rawSpent + round2(t.amount));
                        } else if (t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name) {
                            const matchRef = subObj ? (t.refundSubcategory === subObj.name) : (!hasActiveSubs || !t.refundSubcategory || t.refundSubcategory === 'General');
                            if (matchRef) refOff = round2(refOff + round2(t.amount));
                        }
                    });
                    return Math.max(0, round2(scopeLimit - Math.max(0, round2(rawSpent - refOff))));
                };

                financeData.categories.expense.forEach(cat => {
                    if (cat.isArchived) return;
                    if (cat.isFixed) {
                        const remaining = calcNetFixedScopeRem(cat, null);
                        if (remaining > 0) {
                            filteredTxs.push({
                                id: `v_budget_${cat.name}`, isVirtual: true, status: 'pending', type: 'expense',
                                account: getDefaultAccountId(false), category: cat.name,
                                description: `Presupuesto Fijo: ${cat.name}`,
                                amount: remaining, date: 'Falta por gastar'
                            });
                        }
                    }
                    if (cat.subcategories) {
                        cat.subcategories.forEach(sub => {
                            if (!sub.isArchived && sub.isFixed) {
                                const remaining = calcNetFixedScopeRem(cat, sub);
                                if (remaining > 0) {
                                    filteredTxs.push({
                                        id: `v_budget_${cat.name}::${sub.name}`, isVirtual: true, status: 'pending', type: 'expense',
                                        account: getDefaultAccountId(false), category: cat.name, subcategory: sub.name,
                                        description: `Fijo: ${sub.name}`,
                                        amount: remaining, date: 'Falta por gastar'
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }
        else {
            filteredTxs = filteredTxs.filter(t => t.type === activeHistoryFilter);
        }
    }

    if (historySearchQuery) {
        const q = historySearchQuery.toLowerCase();
        const cleanTagQuery = q.startsWith('#') ? q.slice(1) : q;
        filteredTxs = filteredTxs.filter(t => {
            const acc = getAccountObj(t.account).name.toLowerCase();
            const toAcc = t.toAccount ? getAccountObj(t.toAccount).name.toLowerCase() : '';
            const cat = (t.category || '').toLowerCase();
            const desc = (t.description || '').toLowerCase();
            const tagsArr = Array.isArray(t.tags) ? t.tags.map(tg => tg.toLowerCase()) : [];
            const matchesTag = q.startsWith('#')
                ? tagsArr.some(tg => tg === cleanTagQuery || tg.includes(cleanTagQuery))
                : tagsArr.some(tg => tg.includes(cleanTagQuery));
            return desc.includes(q) || cat.includes(q) || acc.includes(q) || toAcc.includes(q) || matchesTag;
        });
    }

    if (typeof renderHistoryTagsUI === 'function') {
        renderHistoryTagsUI(monthId, filteredTxs);
    }

    filteredTxs.sort((a, b) => {
        if ((a.status === 'pending') !== (b.status === 'pending')) return a.status === 'pending' ? -1 : 1;
        return b.id - a.id;
    });

    if (countBadge) {
        countBadge.innerText = filteredTxs.length;
    }

    listEl.innerHTML = '';

    if (projBox) {
        const pendingTxs = financeData.transactions.filter(t => !t.isDeleted && getTxMonthId(t) === monthId && t.status === 'pending');
        if (projectionData) {
            projBox.classList.remove('hidden');
            const deltaLiq = round2(projectionData.projectedLiquidity - projectionData.currentLiquidity);
            projBox.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <strong style="color:var(--accent); font-size:13.5px; display:inline-flex; align-items:center; gap:6px; margin-bottom:0;">${renderIcon('trending-up', 15)} Proyección Realista Híbrida</strong>
                    <span class="widget-badge" style="font-size:9.5px;">+${projectionData.monthsDiff}m</span>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-muted); margin-bottom:2px;">
                    <span>Flujo Neto Estimado:</span>
                    <b style="color:${projectionData.avgCashFlow < 0 ? 'var(--negative)' : (projectionData.avgCashFlow > 0 ? 'var(--positive)' : 'var(--text-main)')};">${projectionData.avgCashFlow > 0 ? '+' : ''}${formatMoney(projectionData.avgCashFlow)}/mes</b>
                </div>
                <div style="display:flex; justify-content:space-between; font-size:12.5px; padding-top:6px; border-top:1px dashed rgba(139,92,246,0.3);">
                    <span style="color:var(--text-main); font-weight:700;">Liquidez Proyectada:</span>
                    <strong style="color:${projectionData.projectedLiquidity < 0 ? 'var(--negative)' : (projectionData.projectedLiquidity > 0 ? 'var(--positive)' : 'var(--text-main)')}; font-size:13px;">${formatMoney(projectionData.projectedLiquidity)}</strong>
                </div>
                <details class="changelog-accordion" style="margin-top:10px; background:transparent; border:1px solid color-mix(in srgb, var(--accent) 20%, transparent); padding:8px 10px; box-shadow:none;">
                    <summary style="font-size:10.5px; color:var(--accent); font-weight:700;"><span style="display:inline-flex; align-items:center; gap:6px;">${renderIcon('calculator', 14)} Ver fórmula de cálculo</span> <span>▾</span></summary>
                    <div style="margin-top:8px; font-size:10.5px; color:var(--text-muted); display:flex; flex-direction:column; gap:4px;">
                        <div style="display:flex; justify-content:space-between;"><span>Prom. Ingresos (Presup. + Nómina):</span><b style="color:var(--positive);">${formatMoney(projectionData.avgIncome)}</b></div>
                        <div style="display:flex; justify-content:space-between;"><span>(-) Prom. Egresos (Presup. + Deudas):</span><b style="color:var(--negative);">-${formatMoney(projectionData.avgExpense)}</b></div>
                        <div style="display:flex; justify-content:space-between; border-top:1px dashed rgba(148,163,184,0.3); padding-top:3px;"><span>Flujo Neto Resultante:</span><b style="color:${projectionData.avgCashFlow < 0 ? 'var(--negative)' : (projectionData.avgCashFlow > 0 ? 'var(--positive)' : 'var(--text-main)')};">${projectionData.avgCashFlow > 0 ? '+' : ''}${formatMoney(projectionData.avgCashFlow)} / mes</b></div>
                        <div style="margin:4px 0; border-top:1px solid rgba(148,163,184,0.1);"></div>
                        <div style="display:flex; justify-content:space-between;"><span>Liquidez Disponible Hoy:</span><b style="color:${projectionData.currentLiquidity < 0 ? 'var(--negative)' : (projectionData.currentLiquidity > 0 ? 'var(--positive)' : 'var(--text-main)')};">${formatMoney(projectionData.currentLiquidity)}</b></div>
                        <div style="display:flex; justify-content:space-between;"><span>(±) Flujo acumulado (${projectionData.monthsDiff} meses):</span><b style="color:${deltaLiq < 0 ? 'var(--negative)' : (deltaLiq > 0 ? 'var(--positive)' : 'var(--text-main)')};">${deltaLiq > 0 ? '+' : ''}${formatMoney(deltaLiq)}</b></div>
                        <div style="display:flex; justify-content:space-between; border-top:1px dashed rgba(148,163,184,0.3); padding-top:3px; color:var(--text-main); font-weight:700;"><span>Total Proyectado:</span><b style="color:${projectionData.projectedLiquidity < 0 ? 'var(--negative)' : (projectionData.projectedLiquidity > 0 ? 'var(--positive)' : 'var(--text-main)')}; font-size:11.5px;">${formatMoney(projectionData.projectedLiquidity)}</b></div>
                    </div>
                </details>
            `;
        } else if (pendingTxs.length > 0 && !historySearchQuery && (typeof activeHistoryFilter === 'undefined' || activeHistoryFilter === 'all' || activeHistoryFilter === 'pending')) {
            let pInc = 0, pExp = 0;
            pendingTxs.forEach(p => {
                const v = round2(p.budgetedAmount || p.amount);
                if (p.type === 'income') pInc += v;
                else if (p.type === 'expense') pExp += v;
            });
            const flow = getMonthlyFlow(monthId, false);
            const projNet = round2(flow.net + pInc - pExp);
            projBox.classList.remove('hidden');
            projBox.innerHTML = `
                <div style="display:flex; justify-content:space-between;"><span>Balance realizado:</span><b class="${flow.net >= 0 ? 'positive' : 'negative'}">${formatMoney(flow.net)}</b></div>
                <div style="display:flex; justify-content:space-between; margin-top:2px;"><span>Si confirmas pendientes:</span><b class="${projNet >= 0 ? 'positive' : 'negative'}">${formatMoney(projNet)}</b></div>
            `;
        } else {
            projBox.classList.add('hidden');
        }
    }

    if (filteredTxs.length === 0) {
        listEl.innerHTML = `<li style="text-align:center; padding:18px; color:var(--text-muted); font-size:13px;">${historySearchQuery ? 'No se encontraron coincidencias.' : 'No hay movimientos registrados.'}</li>`;
        return;
    }

    const escTx = window.escapeHtml || ((s) => String(s ?? ''));
    const escTxAttr = window.escapeAttr || escTx;
    let listHtml = '';
    filteredTxs.forEach(t => {
        const isPending = t.status === 'pending';
        let sign = '', colorClass = '', iconClass = '';
        const accObj = getAccountObj(t.account);
        let accInfo = escTx(stripLeadingEmoji(accObj.name));
        
        let categoryDisplay = '';

        if (t.type === 'income') { sign = '+'; colorClass = 'positive'; iconClass = 'positive-bg'; }
        else if (t.type === 'expense') { sign = '-'; colorClass = 'negative'; iconClass = 'negative-box'; }
        else { sign = ''; colorClass = 'accent'; iconClass = 'accent-box'; accInfo = `${escTx(stripLeadingEmoji(accObj.name))} ➔ ${escTx(stripLeadingEmoji(getAccountObj(t.toAccount).name))}`; }

        if (t.type !== 'transfer') {
            categoryDisplay = t.subcategory && t.subcategory !== 'General' 
                ? `${escTx(cleanCatName(t.category))} <span style="opacity:0.75; font-weight:500;">(${escTx(cleanCatName(t.subcategory))})</span>` 
                : escTx(cleanCatName(t.category || ''));
        } else {
            categoryDisplay = 'Transferencia';
        }

        let badgesHtml = '';
        if (isPending) {
            badgesHtml += `<div style="color:#d97706; font-weight:700; margin-top:4px; font-size:11px; display:flex; align-items:center; gap:4px;">${renderIcon('clock', 12)} Pendiente</div>`;
        }
        
        if (t.budgetedAmount && t.budgetedAmount > 0 && t.type !== 'transfer') {
            const variance = calculateBudgetVariance(t.type, t.amount, t.budgetedAmount);
            if (variance.hasBudget) {
                const signDiff = variance.diff > 0 ? '+' : '';
                const signPct = variance.pct > 0 ? '+' : '';
                const colorVar = variance.isFavorable ? 'var(--positive)' : 'var(--negative)';
                badgesHtml += `<div style="color:${colorVar}; font-weight:600; margin-top:4px; font-size:11px;">Ptto: ${formatMoney(t.budgetedAmount)} • Dif: ${signDiff}${formatMoney(variance.diff)} (${signPct}${String(variance.pct).replace('.', ',')}%)</div>`;
            }
        }
        
        if (t.type === 'expense' && t.installments && t.installments > 1) {
            badgesHtml += `<div style="color:var(--text-muted); font-weight:600; margin-top:4px; font-size:11px; display:flex; align-items:center; gap:4px;">${renderIcon('card', 12)} Cuotas: ${t.paidInstallments || 0}/${t.installments}</div>`;
        }

        if (Array.isArray(t.tags) && t.tags.length > 0) {
            const pills = t.tags.map(tg => `<span class="tx-tag-pill" data-filter-tag="${escTxAttr(tg)}">#${escTx(tg)}</span>`).join('');
            badgesHtml += `<div class="tx-tags-row">${pills}</div>`;
        }

        const escBatchId = escTxAttr(t.id);
        const baseAmt = isPending ? round2(t.budgetedAmount || t.amount) : round2(t.amount);
        const btnLabel = t.isVirtual ? 'Gestionar ➔' : '✓ Confirmar';
        const confirmBtnHtml = isPending ? `<button type="button" class="btn-confirm-pending" data-action="confirm-tx" data-id="${escBatchId}" style="margin-top:8px;">${btnLabel}</button>` : '';
        const catIcon = getCategoryIcon(t.category, t.type);
        const accIcon = getAccountIcon(accObj.category);
        
        const isSelectedInBatch = isBatchSelectMode && selectedBatchIds.has(String(t.id));
        let itemHighlightStyle = '';
        if (t.isCleared) {
            itemHighlightStyle = 'background-color: var(--positive-bg); border-color: rgba(16, 185, 129, 0.3);';
        } else if (isSelectedInBatch) {
            itemHighlightStyle = 'background-color: color-mix(in srgb, var(--accent) 8%, var(--card-bg)); border-color: var(--accent);';
        }

        const showBatchBox = isBatchSelectMode && !isClearModeActive;
        const checkboxHtml = showBatchBox
            ? `<div style="margin-right:8px; margin-top:4px; display:flex; align-items:center; flex-shrink:0;">
                 <input type="checkbox" class="tx-batch-check" value="${escBatchId}" ${isSelectedInBatch ? 'checked' : ''} style="width:18px; height:18px; accent-color:var(--accent); cursor:pointer;">
               </div>`
            : '';

        const itemPadding = showBatchBox ? '12px 12px' : '14px 16px';
        const iconBoxStyle = showBatchBox
            ? 'width:30px; height:30px; border-radius:9px; margin-right:9px; margin-top:2px; flex-shrink:0;'
            : 'margin-right:12px; margin-top:2px; flex-shrink:0;';

        listHtml += `
        <li class="history-item ${isPending ? 'pending-item' : ''}" data-action="edit-tx" data-id="${escBatchId}" style="align-items:flex-start; padding:${itemPadding}; ${itemHighlightStyle}">
            ${checkboxHtml}
            <div class="drawer-icon-box ${iconClass}" style="${iconBoxStyle}">
                ${t.type === 'transfer' ? renderIcon('transfer', showBatchBox ? 14 : 16) : catIcon}
            </div>
            <div class="history-info" style="display:flex; flex-direction:column; gap:4px; flex: 1 1 auto; min-width: 0;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:6px;">
                    <strong style="font-size:14px; line-height:1.2; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escTx(stripLeadingEmoji(t.description))}</strong>
                    <div class="history-amount ${colorClass}" style="text-align:right; font-size:14.5px; font-weight:800; white-space:nowrap; flex-shrink: 0;">
                        ${sign}${formatMoneyHtml(baseAmt)}
                    </div>
                </div>
                <span style="font-size:11.5px; color:var(--text-muted); font-weight:700; line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${categoryDisplay}</span>
                <span style="display:flex; align-items:center; gap:4px; font-size:11px; color:var(--text-muted); line-height:1.3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    <span style="display:inline-flex; opacity:0.75; color:var(--text-main);">${accIcon}</span> 
                    <span>${accInfo}</span>
                </span>
                <span style="font-size:10.5px; color:var(--text-muted); opacity:0.85;">${escTx(t.date || '')}</span>
                ${badgesHtml}
                ${confirmBtnHtml ? `<div style="text-align:right;">${confirmBtnHtml}</div>` : ''}
            </div>
        </li>`;
    });
    
    listEl.innerHTML = listHtml;
    
    const clearBanner = document.getElementById('clear-mode-banner');
    if (clearBanner && typeof isClearModeActive !== 'undefined' && isClearModeActive) {
        const clearedCount = filteredTxs.filter(t => t.isCleared).length;
        document.getElementById('clear-mode-count').innerText = `${clearedCount} / ${filteredTxs.length}`;
    }

    ensureBatchSelectToggleBtn();
    syncBatchActionsToolbar();
};

let isBatchSelectMode = false;
const selectedBatchIds = new Set();

const setBatchSelectMode = (active, initialId = null) => {
    isBatchSelectMode = !!active;
    if (!isBatchSelectMode) {
        selectedBatchIds.clear();
    } else {
        if (isClearModeActive) {
            isClearModeActive = false;
            document.getElementById('btn-toggle-clear-mode')?.classList.remove('active');
            document.getElementById('clear-mode-banner')?.classList.add('hidden');
        }
        if (initialId) selectedBatchIds.add(String(initialId));
    }
    updateDashboard();
};

const ensureBatchSelectToggleBtn = () => {
    const countBadge = document.getElementById('history-count-badge');
    if (!countBadge || !countBadge.parentElement) return;

    let btn = document.getElementById('btn-toggle-batch-select');
    if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'btn-toggle-batch-select';
        btn.className = 'mini-action-btn';
        btn.style.cssText = 'font-size:11px; padding:4px 9px; margin-right:6px;';
        countBadge.parentElement.insertBefore(btn, countBadge);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            setBatchSelectMode(!isBatchSelectMode);
        });
    }

    btn.innerText = isBatchSelectMode ? 'Cancelar' : 'Seleccionar';
    btn.classList.toggle('active', isBatchSelectMode);
};

const resolveBatchConfirmables = (rawIds = []) => {
    const items = [];
    const mIdx = viewDate.getMonth();
    const vYear = viewDate.getFullYear();
    const vMonthId = getMonthId(viewDate);
    const snap = computeBalancesUpTo(vMonthId);

    rawIds.forEach(rawId => {
        const idStr = String(rawId);
        if (idStr.startsWith('v_sub_')) {
            const subId = idStr.replace('v_sub_', '');
            const sub = (financeData.subscriptions || []).find(s => String(s.id) === subId && s.status === 'active');
            if (sub) {
                const amt = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount || 0);
                if (amt > 0) items.push({ kind: 'v_sub', subId: sub.id, amount: amt });
            }
            return;
        }
        if (idStr.startsWith('v_card_')) {
            const cardId = idStr.replace('v_card_', '');
            const card = (financeData.customAccounts || []).find(a => a.category === 'credit_card' && String(a.id) === cardId);
            if (card) {
                const bal = round2(snap.bals[card.id] || 0);
                if (bal > 0) {
                    const est = calculateCardMinPaymentEstimate(card, bal);
                    if (est.totalMinPayment > 0) items.push({ kind: 'v_card', card, amount: round2(est.totalMinPayment), monthId: vMonthId });
                }
            }
            return;
        }
        if (idStr.startsWith('v_debt_')) {
            const debtId = idStr.replace('v_debt_', '');
            const debt = (financeData.customAccounts || []).find(a => a.category === 'debt' && String(a.id) === debtId);
            if (debt) {
                const bal = round2(snap.bals[debt.id] || 0);
                if (bal > 0) {
                    const qInfo = getDebtMonthlyQuotaBreakdown(debt, bal);
                    if (qInfo.totalQuota > 0) items.push({ kind: 'v_debt', debt, amount: round2(qInfo.totalQuota), monthId: vMonthId });
                }
            }
            return;
        }
        if (idStr.startsWith('v_accmgmt_')) {
            const accId = idStr.replace('v_accmgmt_', '');
            const acc = (financeData.customAccounts || []).find(a => String(a.id) === accId && a.hasMgmtFee);
            if (acc && typeof evaluateAccountMgmtFeeCycle === 'function') {
                const st = evaluateAccountMgmtFeeCycle(acc, vMonthId, snap, currentDate);
                if (st.enabled && st.status === 'pending' && st.amount > 0) {
                    items.push({ kind: 'v_accmgmt', accId: acc.id, amount: st.amount, monthId: vMonthId });
                }
            }
            return;
        }
        if (idStr.startsWith('v_budget_')) {
            const rawKey = idStr.replace('v_budget_', '');
            const [catPart, subPart = ''] = rawKey.includes('::')
                ? rawKey.split('::')
                : (() => {
                    const idx = rawKey.indexOf('_');
                    return idx !== -1 ? [rawKey.slice(0, idx), rawKey.slice(idx + 1)] : [rawKey, ''];
                })();
            const catObj = (financeData.categories?.expense || []).find(c => c.name === catPart);
            if (catObj) {
                const subObj = subPart ? (catObj.subcategories || []).find(s => s.name === subPart) : null;
                const hasActiveSubs = Array.isArray(catObj.subcategories) && catObj.subcategories.some(s => !s.isArchived);
                const st = getCategoryBudgetStatus(catObj, subObj, mIdx, vYear);
                const lim = (!subObj && hasActiveSubs) ? st.ownCurrentLimit : st.currentLimit;
                const spent = (financeData.transactions || [])
                    .filter(t => !t.isDeleted && !t.isTripIsolated && !(t.isSharedTrip && t.paidBy === 'companion') && getTxMonthId(t) === vMonthId && t.type === 'expense' && t.category === catObj.name && (subObj ? (t.subcategory === subObj.name) : (!hasActiveSubs || !t.subcategory || t.subcategory === 'General')) && !t.isAdjustment && isTxClosed(t))
                    .reduce((s, t) => round2(s + round2(t.amount)), 0);
                const refOff = (financeData.transactions || [])
                    .filter(t => !t.isDeleted && !t.isTripIsolated && getTxMonthId(t) === vMonthId && t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === catObj.name && (subObj ? (t.refundSubcategory === subObj.name) : (!hasActiveSubs || !t.refundSubcategory || t.refundSubcategory === 'General')) && !t.isAdjustment && isTxClosed(t))
                    .reduce((s, t) => round2(s + round2(t.amount)), 0);
                const rem = Math.max(0, round2(lim - Math.max(0, round2(spent - refOff))));
                if (rem > 0) {
                    items.push({ kind: 'v_budget', catObj, subObj, catName: catObj.name, subName: subPart || 'General', amount: rem, monthId: vMonthId, mIdx, vYear });
                }
            }
            return;
        }
        const tx = (financeData.transactions || []).find(t => !t.isDeleted && String(t.id) === idStr && t.status === 'pending');
        if (tx) {
            const amt = round2(tx.amount > 0 ? tx.amount : (tx.budgetedAmount || 0));
            items.push({ kind: 'real_tx', tx, amount: amt });
        }
    });

    // Ordenar para que suscripciones y movimientos reales se asienten antes que v_budget (evita doble cobro si están vinculados)
    const orderWeight = { real_tx: 1, v_sub: 2, v_card: 3, v_debt: 4, v_budget: 5 };
    items.sort((a, b) => (orderWeight[a.kind] || 9) - (orderWeight[b.kind] || 9));
    return items;
};

const confirmPendingTransactionsBatch = (rawIds = []) => {
    const resolved = resolveBatchConfirmables(rawIds);
    if (resolved.length === 0) return 0;

    let doneCount = 0;
    const now = new Date();
    const usedIds = new Set((financeData.transactions || []).map(t => t.id));
    const nextSafeId = () => {
        let candidate = Date.now() + Math.floor(Math.random() * 500);
        while (usedIds.has(candidate)) candidate += 1;
        usedIds.add(candidate);
        return candidate;
    };

    const intCatObj = (financeData.categories?.expense || []).find(c => stripLeadingEmoji(c.name) === 'Cuotas / Intereses');
    const intCatName = intCatObj ? intCatObj.name : 'Cuotas / Intereses';

    resolved.forEach(entry => {
        if (entry.kind === 'v_sub' && typeof processSubscriptionPayment === 'function') {
            processSubscriptionPayment(entry.subId);
            doneCount++;
            return;
        }

        if (entry.kind === 'v_card') {
            const card = entry.card;
            const liveSnap = computeBalancesUpTo(entry.monthId);
            const bal = round2(liveSnap.bals[card.id] || 0);
            if (bal <= 0) return;

            const isCurrMonth = entry.monthId === getMonthId(now);
            const [vy, vm] = entry.monthId.split('-').map(Number);
            const maxDaysVm = new Date(vy, vm, 0).getDate();
            const refDate = isCurrMonth ? now : new Date(vy, vm - 1, Math.min(card.paymentDay || 28, maxDaysVm), 12, 0, 0);
            const est = calculateCardMinPaymentEstimate(card, bal, refDate);
            if (est.totalMinPayment <= 0) return;

            const extraFees = round2((est.mgmtFeeAmt || 0) + (est.insuranceAmt || 0));
            const netDebtPay = Math.max(0, round2(est.totalMinPayment - extraFees));
            const sourceAcc = getDefaultAccountId(true);
            const dateLabel = `${refDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${refDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
            const cleanCard = stripLeadingEmoji(card.name);
            const duePurchases = getPendingCardPurchases(card.id, refDate).filter(p => p.isDueInActiveCycle !== false);

            const transferId = nextSafeId();
            const transferTx = {
                id: transferId,
                monthId: entry.monthId,
                type: 'transfer',
                status: 'closed',
                account: sourceAcc,
                toAccount: card.id,
                description: `Pago tarjeta ${cleanCard}`,
                amount: netDebtPay,
                ...(extraFees > 0 ? { extraCharges: extraFees } : {}),
                date: dateLabel,
                isAdjustment: false,
                paymentMode: 'installments',
                allocatedItems: duePurchases.map(p => ({
                    kind: 'cc_tx',
                    txId: p.tx.id,
                    mode: 'installments',
                    amountApplied: p.nextQuota
                }))
            };

            if (netDebtPay > 0) {
                financeData.transactions.push(transferTx);
                if (typeof window.applyTransferAllocatedItems === 'function') {
                    window.applyTransferAllocatedItems(transferTx, refDate);
                }
            }
            if (extraFees > 0) {
                financeData.transactions.push({
                    id: nextSafeId(),
                    monthId: entry.monthId,
                    type: 'expense',
                    status: 'closed',
                    account: sourceAcc,
                    category: intCatName,
                    subcategory: 'General',
                    description: `Cargos / Manejo / Seguro (${cleanCard})`,
                    amount: extraFees,
                    date: dateLabel,
                    isAdjustment: false,
                    ...(netDebtPay > 0 ? { linkedToTransfer: transferId } : {})
                });
            }
            doneCount++;
            return;
        }

        if (entry.kind === 'v_debt') {
            const debt = entry.debt;
            const liveSnap = computeBalancesUpTo(entry.monthId);
            const bal = round2(liveSnap.bals[debt.id] || 0);
            if (bal <= 0) return;

            const qInfo = getDebtMonthlyQuotaBreakdown(debt, bal);
            const principalAmt = round2(qInfo.totalPrincipal || 0);
            const interestAmt = round2(qInfo.totalInterest || 0);
            if (principalAmt <= 0 && interestAmt <= 0) return;

            const isCurrMonth = entry.monthId === getMonthId(now);
            const [vy, vm] = entry.monthId.split('-').map(Number);
            const refDate = isCurrMonth ? now : new Date(vy, vm - 1, Math.min(28, debt.paymentDay || 15), 12, 0, 0);
            const dateLabel = `${refDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${refDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
            const sourceAcc = getDefaultAccountId(true);
            const cleanDebt = stripLeadingEmoji(debt.name);

            const allocatedItems = [];
            if (debt.debtType !== 'revolving' && qInfo.basePrincipal > 0) {
                allocatedItems.push({ kind: 'debt_quota', debtId: debt.id, mode: 'installments', amountApplied: Math.min(principalAmt, qInfo.basePrincipal) });
                debt.debtPaidQuotes = (debt.debtPaidQuotes || 0) + 1;
            }
            let remPrincipal = round2(principalAmt - (debt.debtType !== 'revolving' ? Math.min(principalAmt, qInfo.basePrincipal) : 0));
            qInfo.subPurchases.forEach(p => {
                if (remPrincipal > 0.01) {
                    const quotaCap = p.nextPrincipal > 0 ? p.nextPrincipal : p.remCapital;
                    const applied = Math.min(remPrincipal, quotaCap);
                    if (applied > 0) {
                        allocatedItems.push({ kind: 'cc_tx', txId: p.tx.id, mode: 'installments', amountApplied: applied });
                        p.tx.paidInstallments = (p.tx.paidInstallments || 0) + 1;
                        remPrincipal = round2(remPrincipal - applied);
                    }
                }
            });

            const payTransferId = principalAmt > 0 ? nextSafeId() : null;
            if (principalAmt > 0) {
                financeData.transactions.push({
                    id: payTransferId,
                    monthId: entry.monthId,
                    type: 'transfer',
                    status: 'closed',
                    account: sourceAcc,
                    toAccount: debt.id,
                    description: `Pago Capital (${cleanDebt})`,
                    amount: principalAmt,
                    date: dateLabel,
                    isAdjustment: false,
                    paymentMode: 'installments',
                    allocatedItems
                });
            }
            if (interestAmt > 0) {
                financeData.transactions.push({
                    id: nextSafeId(),
                    monthId: entry.monthId,
                    type: 'expense',
                    status: 'closed',
                    account: sourceAcc,
                    category: intCatName,
                    subcategory: 'General',
                    description: `Intereses Préstamo (${cleanDebt})`,
                    amount: interestAmt,
                    date: dateLabel,
                    isAdjustment: false,
                    isInterestCharge: true,
                    ...(payTransferId ? { linkedToTransfer: payTransferId } : {})
                });
            }
            doneCount++;
            return;
        }

        if (entry.kind === 'v_accmgmt' && typeof chargeAccountMgmtFee === 'function') {
            const res = chargeAccountMgmtFee(entry.accId, entry.monthId, { allowManualOverride: true });
            if (res.ok) doneCount++;
            return;
        }

        if (entry.kind === 'v_budget') {
            // Recalcular en vivo respetando ownCurrentLimit para no duplicar contra subcategorías fijas
            const hasActiveSubs = Array.isArray(entry.catObj.subcategories) && entry.catObj.subcategories.some(s => !s.isArchived);
            const stNow = getCategoryBudgetStatus(entry.catObj, entry.subObj, entry.mIdx, entry.vYear);
            const lim = (!entry.subObj && hasActiveSubs) ? stNow.ownCurrentLimit : stNow.currentLimit;
            const spentNow = (financeData.transactions || [])
                .filter(t => !t.isDeleted && !t.isTripIsolated && !(t.isSharedTrip && t.paidBy === 'companion') && getTxMonthId(t) === entry.monthId && t.type === 'expense' && t.category === entry.catName && (entry.subObj ? (t.subcategory === entry.subObj.name) : (!hasActiveSubs || !t.subcategory || t.subcategory === 'General')) && !t.isAdjustment && isTxClosed(t))
                .reduce((s, t) => round2(s + round2(t.amount)), 0);
            const refNow = (financeData.transactions || [])
                .filter(t => !t.isDeleted && !t.isTripIsolated && getTxMonthId(t) === entry.monthId && t.type === 'income' && typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t) && t.refundCategory === entry.catName && (entry.subObj ? (t.refundSubcategory === entry.subObj.name) : (!hasActiveSubs || !t.refundSubcategory || t.refundSubcategory === 'General')) && !t.isAdjustment && isTxClosed(t))
                .reduce((s, t) => round2(s + round2(t.amount)), 0);
            const remNow = Math.max(0, round2(lim - Math.max(0, round2(spentNow - refNow))));
            if (remNow <= 0) return;

            const isCurrMonth = entry.monthId === getMonthId(now);
            const [vy, vm] = entry.monthId.split('-').map(Number);
            const txDate = isCurrMonth ? now : new Date(vy, vm - 1, 15, 12, 0, 0);
            financeData.transactions.push({
                id: nextSafeId(),
                monthId: entry.monthId,
                type: 'expense',
                status: 'closed',
                account: getDefaultAccountId(false),
                category: entry.catName,
                subcategory: entry.subName,
                description: entry.subName !== 'General' ? entry.subName : entry.catName,
                amount: remNow,
                budgetedAmount: remNow,
                date: `${txDate.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${txDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
                isAdjustment: false
            });
            doneCount++;
            return;
        }

        if (entry.kind === 'real_tx') {
            const tx = entry.tx;
            const defaultAmt = entry.amount;
            if (!tx.budgetedAmount) tx.budgetedAmount = defaultAmt;
            tx.amount = defaultAmt;
            tx.status = 'closed';

            if (tx.pendingLibranzas && typeof applyPayrollLibranzas === 'function') {
                const appliedLib = applyPayrollLibranzas(tx.monthId || getTxMonthId(tx), tx.payrollPeriod || 'M', new Date(Number(tx.id) || Date.now()), !!tx.isBiweeklyPayroll);
                if (appliedLib.length > 0) {
                    tx.linkedLibranzas = appliedLib.map(l => ({
                        txId: l.txId, intTxId: l.intTxId, debtId: l.debtId,
                        targetTxId: l.targetTxId, pocketId: l.pocketId,
                        pocketAmt: l.pocketAmt, quoteStep: l.quoteStep
                    }));
                }
                delete tx.pendingLibranzas;
            }

            if (tx.type === 'transfer') {
                const fromObj = getAccountObj(tx.account);
                const toObj = getAccountObj(tx.toAccount);
                if (fromObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(fromObj.id, -defaultAmt);
                if (toObj.category === 'pocket' && typeof adjustPocketBalance === 'function') adjustPocketBalance(toObj.id, defaultAmt);
                if (typeof window.applyTransferAllocatedItems === 'function') {
                    window.applyTransferAllocatedItems(tx, new Date(Number(tx.id) || Date.now()));
                }
            } else if (getAccountObj(tx.account).category === 'pocket') {
                if (tx.type === 'income') {
                    const p = (financeData.pockets || []).find(x => String(x.id) === String(tx.account));
                    if (p) p.yields = round2((p.yields || 0) + defaultAmt);
                } else if (tx.type === 'expense' && typeof adjustPocketBalance === 'function') {
                    adjustPocketBalance(tx.account, -defaultAmt);
                }
            }
            doneCount++;
        }
    });

    localStorage.setItem('myFinances', JSON.stringify(financeData));
    return doneCount;
};

const syncBatchActionsToolbar = () => {
    let toolbar = document.getElementById('batch-actions-toolbar');
    if (toolbar && !toolbar.querySelector('#btn-batch-confirm-pending')) {
        toolbar.remove();
        toolbar = null;
    }

    if (!toolbar) {
        toolbar = document.createElement('div');
        toolbar.id = 'batch-actions-toolbar';
        toolbar.className = 'hidden';
        toolbar.style.cssText = 'position:fixed; bottom:calc(88px + env(safe-area-inset-bottom, 0px)); left:50%; transform:translateX(-50%); z-index:1500; background:var(--card-bg); border:1.5px solid var(--accent-border); border-radius:18px; padding:10px 12px; box-shadow:0 12px 32px rgba(0,0,0,0.22); display:flex; align-items:center; justify-content:space-between; gap:8px; width:calc(100% - 28px); max-width:420px;';
        
        toolbar.innerHTML = `
            <div style="display:flex; align-items:center; gap:6px; min-width:0;">
                <button type="button" id="btn-batch-close" style="background:none; border:none; color:var(--text-muted); font-size:16px; font-weight:800; cursor:pointer; padding:4px 6px;">✕</button>
                <div style="display:flex; flex-direction:column; line-height:1.2; min-width:0;">
                    <strong id="batch-count-label" style="font-size:13px; font-weight:800; color:var(--text-main); white-space:nowrap;">0 selec.</strong>
                    <button type="button" id="btn-batch-select-all" style="background:none; border:none; padding:0; text-align:left; font-size:10.5px; color:var(--accent); font-weight:700; cursor:pointer; white-space:nowrap;">Marcar todos</button>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                <button type="button" id="btn-batch-confirm-pending" class="btn hidden" style="background:var(--positive-bg); color:var(--positive); border:1px solid color-mix(in srgb, var(--positive) 32%, transparent); font-size:12px; font-weight:800; padding:8px 11px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span id="btn-batch-confirm-label">Confirmar</span>
                </button>
                <button type="button" id="btn-batch-delete" class="btn" style="background:rgba(239, 68, 68, 0.12); color:var(--negative); border:1px solid rgba(239, 68, 68, 0.28); font-size:12px; font-weight:800; padding:8px 11px; border-radius:12px; display:inline-flex; align-items:center; gap:5px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    <span>Borrar</span>
                </button>
            </div>
        `;
        document.body.appendChild(toolbar);

        toolbar.querySelector('#btn-batch-close').addEventListener('click', () => {
            setBatchSelectMode(false);
        });

        toolbar.querySelector('#btn-batch-select-all').addEventListener('click', () => {
            const visibleChecks = Array.from(document.querySelectorAll('#transaction-list .tx-batch-check'));
            const allSelected = visibleChecks.length > 0 && visibleChecks.every(c => selectedBatchIds.has(String(c.value)));
            if (allSelected) {
                selectedBatchIds.clear();
            } else {
                visibleChecks.forEach(c => selectedBatchIds.add(String(c.value)));
            }
            updateDashboard();
        });

        toolbar.querySelector('#btn-batch-confirm-pending').addEventListener('click', () => {
            const confirmables = resolveBatchConfirmables(Array.from(selectedBatchIds));
            if (confirmables.length === 0) return;

            const sumPending = round2(confirmables.reduce((s, it) => round2(s + it.amount), 0));
            const runBatchConfirm = () => {
                const doneCount = confirmPendingTransactionsBatch(Array.from(selectedBatchIds));
                setBatchSelectMode(false);
                if (doneCount > 0) {
                    const toast = document.createElement('div');
                    toast.className = 'sw-toast';
                    toast.style.gap = '7px';
                    toast.innerHTML = `${renderIcon('check', 15)}<span>${doneCount} compromiso${doneCount !== 1 ? 's' : ''} confirmado${doneCount !== 1 ? 's' : ''}</span>`;
                    document.body.appendChild(toast);
                    setTimeout(() => toast.remove(), 2400);
                }
            };

            if (typeof window.openBentoConfirmModal === 'function') {
                window.openBentoConfirmModal({
                    title: `Confirmar ${confirmables.length} pendiente${confirmables.length !== 1 ? 's' : ''}`,
                    subtitle: 'Cierre rápido en lote',
                    message: `Se registrarán como pagados/recibidos <b>${confirmables.length} compromiso${confirmables.length !== 1 ? 's' : ''}</b> por un total de <b>${formatMoney(sumPending)}</b>.`,
                    confirmText: 'Confirmar ahora',
                    cancelText: 'Cancelar',
                    danger: false,
                    onConfirm: runBatchConfirm
                });
            } else if (confirm(`¿Confirmar ${confirmables.length} pendiente(s)?`)) {
                runBatchConfirm();
            }
        });

        toolbar.querySelector('#btn-batch-delete').addEventListener('click', () => {
            const deletableIds = Array.from(selectedBatchIds).filter(id => !String(id).startsWith('v_'));
            if (deletableIds.length === 0) return;
            
            if (typeof openSafeDeleteModal === 'function') {
                openSafeDeleteModal(
                    `${deletableIds.length} Movimiento${deletableIds.length !== 1 ? 's' : ''}`,
                    [
                        `Se enviarán a la Papelera de Reciclaje.`,
                        `Se ajustarán los saldos y presupuestos.`,
                        `Los intereses y cuotas asociadas también se borrarán.`
                    ],
                    () => {
                        deletableIds.forEach(id => moveTxToTrash(id));
                        setBatchSelectMode(false);
                    }
                );
            } else {
                if (confirm(`¿Mover ${deletableIds.length} movimiento(s) a la papelera?`)) {
                    deletableIds.forEach(id => moveTxToTrash(id));
                    setBatchSelectMode(false);
                }
            }
        });
    }

    if (isBatchSelectMode && selectedBatchIds.size > 0) {
        toolbar.classList.remove('hidden');
        toolbar.style.display = 'flex';
        const count = selectedBatchIds.size;
        document.getElementById('batch-count-label').innerText = `${count} selec.`;

        const confirmables = resolveBatchConfirmables(Array.from(selectedBatchIds));
        const deletablesCount = Array.from(selectedBatchIds).filter(id => !String(id).startsWith('v_')).length;

        const confirmBatchBtn = document.getElementById('btn-batch-confirm-pending');
        const confirmBatchLbl = document.getElementById('btn-batch-confirm-label');
        const deleteBatchBtn = document.getElementById('btn-batch-delete');

        if (confirmBatchBtn) {
            confirmBatchBtn.classList.toggle('hidden', confirmables.length === 0);
            confirmBatchBtn.style.display = confirmables.length > 0 ? 'inline-flex' : 'none';
        }
        if (confirmBatchLbl && confirmables.length > 0) {
            confirmBatchLbl.innerText = `Confirmar (${confirmables.length})`;
        }
        if (deleteBatchBtn) {
            deleteBatchBtn.classList.toggle('hidden', deletablesCount === 0);
            deleteBatchBtn.style.display = deletablesCount > 0 ? 'inline-flex' : 'none';
        }

        const visibleChecks = document.querySelectorAll('#transaction-list .tx-batch-check');
        const allSelected = visibleChecks.length > 0 && visibleChecks.length === count;
        const selAllBtn = document.getElementById('btn-batch-select-all');
        if (selAllBtn) selAllBtn.innerText = allSelected ? 'Desmarcar todos' : 'Marcar todos';
    } else {
        toolbar.classList.add('hidden');
        toolbar.style.display = 'none';
    }
};

// ============================================================
// FASE 2: PLANTILLAS 1 TOQUE, WIDGET 7 DÍAS Y SOBRANTE MENSUAL
// ============================================================
let pendingSurplusSourceMonth = null;

window.renderUnassignedSurplusBanner = (viewMonthId) => {
    const currMonthId = getMonthId(currentDate);
    let banner = document.getElementById('unassigned-surplus-banner');

    if (viewMonthId !== currMonthId || typeof computeUnassignedPreviousSurplus !== 'function') {
        banner?.remove();
        return;
    }

    const info = computeUnassignedPreviousSurplus(currentDate);
    if (!info.available) {
        banner?.remove();
        return;
    }

    const dashContainer = document.getElementById('dashboard-widgets-container');
    if (!dashContainer || !dashContainer.parentElement) return;

    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'unassigned-surplus-banner';
        banner.className = 'surplus-assign-banner';
        dashContainer.parentElement.insertBefore(banner, dashContainer);
    }

    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const pocketBtnText = info.targetPocket
        ? `Guardar en ${esc(info.targetPocket.name)}`
        : 'Crear bolsillo de ahorro';
    const debtBtnHtml = info.topDebt
        ? `<button type="button" class="mini-action-btn" data-surplus-action="debt" style="flex:1; justify-content:center; padding:8px 10px; font-size:11.5px; color:var(--text-main);">Abonar a ${esc(info.topDebt.name)}</button>`
        : '';

    banner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div style="display:flex; align-items:flex-start; gap:10px; min-width:0; flex:1;">
                <span class="drawer-icon-box" style="width:34px; height:34px; border-radius:10px; background:var(--positive-bg); color:var(--positive); flex-shrink:0; margin-top:1px;">
                    ${renderIcon('piggy', 17)}
                </span>
                <div style="min-width:0; flex:1;">
                    <strong style="display:block; font-size:13px; font-weight:800; color:var(--text-main);">Sobrante de ${esc(info.prevMonthCap)} disponible</strong>
                    <small style="display:block; font-size:11.5px; color:var(--text-muted); line-height:1.38; margin-top:2px;">
                        Cerraste con <b class="positive">${formatMoneyHtml(info.rawSurplus)}</b> a favor. Asigna <b style="color:var(--text-main);">${formatMoneyHtml(info.suggestedAmount)}</b> antes de que se diluya en gastos diarios.
                    </small>
                </div>
            </div>
            <button type="button" class="btn-dismiss-alert" data-surplus-action="dismiss" title="Ocultar aviso" aria-label="Ocultar aviso">${renderIcon('check', 13)}</button>
        </div>
        <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
            <button type="button" class="mini-action-btn" data-surplus-action="pocket" style="flex:1.2; justify-content:center; padding:8px 10px; font-size:11.5px; background:var(--positive-bg); color:var(--positive); border-color:color-mix(in srgb, var(--positive) 30%, transparent); font-weight:800;">
                ${pocketBtnText}
            </button>
            ${debtBtnHtml}
        </div>
    `;

    banner.onclick = (ev) => {
        const actBtn = ev.target.closest('[data-surplus-action]');
        if (!actBtn) return;
        const action = actBtn.getAttribute('data-surplus-action');
        if (action === 'dismiss') {
            dismissSmartAlert(info.alertDismissId);
            banner.remove();
            return;
        }
        if (action === 'pocket') {
            if (info.targetPocket) {
                openOmniModal({
                    type: 'transfer',
                    title: `Asignar sobrante de ${info.prevMonthCap}`,
                    account: getDefaultAccountId(true),
                    toAccount: info.targetPocket.id,
                    amount: info.suggestedAmount,
                    description: `Sobrante de ${info.prevMonthCap}`,
                    lockType: true,
                    hideRecurrence: true
                });
                pendingSurplusSourceMonth = info.prevMonthId;
            } else {
                document.getElementById('drawer-pockets')?.click();
            }
            return;
        }
        if (action === 'debt' && info.topDebt) {
            openOmniModal({
                type: 'transfer',
                title: `Abonar sobrante a ${info.topDebt.name}`,
                account: getDefaultAccountId(true),
                toAccount: info.topDebt.id,
                amount: Math.min(info.suggestedAmount, info.topDebt.bal),
                description: `Abono sobrante ${info.prevMonthCap}`,
                lockType: true,
                hideRecurrence: true,
                autoSelectBilled: true
            });
            pendingSurplusSourceMonth = info.prevMonthId;
        }
    };
};

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'transaction-form' && pendingSurplusSourceMonth) {
        const srcM = pendingSurplusSourceMonth;
        pendingSurplusSourceMonth = null;
        const lastTx = (financeData.transactions || [])[financeData.transactions.length - 1];
        if (lastTx && lastTx.type === 'transfer') {
            lastTx.surplusSourceMonth = srcM;
            localStorage.setItem('myFinances', JSON.stringify(financeData));
            updateDashboard();
        }
    }
}, false);

window.renderUpcoming7DaysWidget = (viewMonthId) => {
    const dashContainer = document.getElementById('dashboard-widgets-container');
    if (!dashContainer || typeof computeUpcoming7DaysCommitments !== 'function') return;

    let widget = document.getElementById('widget-upcoming-7d');
    if (!widget) {
        widget = document.createElement('section');
        widget.id = 'widget-upcoming-7d';
        widget.className = 'card bento-card dashboard-widget-card hidden';
        widget.setAttribute('data-widget-id', 'upcoming-7d');
        widget.style.cursor = 'default';
        const cashFlowWidget = dashContainer.querySelector('[data-widget-id="cash-flow"]');
        if (cashFlowWidget && cashFlowWidget.nextSibling) {
            dashContainer.insertBefore(widget, cashFlowWidget.nextSibling);
        } else {
            dashContainer.prepend(widget);
        }
        applyWidgetOrder();

        widget.addEventListener('click', (ev) => {
            if (isDashboardEditMode) return;
            const btn = ev.target.closest('[data-up7d-kind]');
            if (!btn) return;
            ev.stopPropagation();
            const kind = btn.getAttribute('data-up7d-kind');
            const refId = btn.getAttribute('data-up7d-id');
            if (!refId) return;

            if (kind === 'subscription' && typeof processSubscriptionPayment === 'function') {
                const sub = (financeData.subscriptions || []).find(s => String(s.id) === String(refId));
                if (!sub) return;
                const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount);
                const escS = window.escapeHtml || ((s) => String(s ?? ''));
                window.openBentoConfirmModal?.({
                    title: 'Confirmar pago recurrente',
                    subtitle: stripLeadingEmoji(sub.name),
                    message: `¿Registrar el pago de <b>${escS(stripLeadingEmoji(sub.name))}</b> por <b>${formatMoney(amtCop)}</b>?`,
                    confirmText: 'Registrar pago',
                    cancelText: 'Cancelar',
                    danger: false,
                    onConfirm: () => processSubscriptionPayment(sub.id)
                });
            } else if (kind === 'card' || kind === 'debt') {
                if (attemptCloseModals()) {
                    openAccountDetail(refId, 'home');
                    if (kind === 'debt') document.getElementById('open-pay-installment-btn')?.click();
                }
            } else if (kind === 'acc_mgmt_fee' && typeof chargeAccountMgmtFee === 'function') {
                const acc = (financeData.customAccounts || []).find(a => String(a.id) === String(refId));
                if (!acc) return;
                const cleanAcc = stripLeadingEmoji(acc.name);
                const escA2 = window.escapeHtml || ((s) => String(s ?? ''));
                const mTarget = btn.getAttribute('data-up7d-month') || getMonthId(currentDate);
                window.openBentoConfirmModal?.({
                    title: 'Descontar cuota de manejo',
                    subtitle: cleanAcc,
                    message: `¿Descontar <b>${formatMoney(round2(acc.mgmtFee || 0))}</b> de <b>${escA2(cleanAcc)}</b>?`,
                    confirmText: 'Descontar ahora',
                    cancelText: 'Cancelar',
                    danger: false,
                    onConfirm: () => {
                        const res = chargeAccountMgmtFee(acc.id, mTarget, { allowManualOverride: true });
                        if (res.ok) updateDashboard();
                    }
                });
            } else if (kind === 'pending_tx') {
                confirmPendingTx(refId, ev);
            }
        });
    }

    const currMonthId = getMonthId(currentDate);
    if (viewMonthId !== currMonthId) {
        widget.classList.add('hidden');
        return;
    }

    const data = computeUpcoming7DaysCommitments(currentDate);
    if (data.count === 0 && !isDashboardEditMode) {
        widget.classList.add('hidden');
        return;
    }

    widget.classList.remove('hidden');
    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;

    const existingEditBar = widget.querySelector('.widget-edit-controls');
    const rowsHtml = data.count === 0
        ? `<div style="font-size:12px; color:var(--text-muted); padding:6px 2px;">No tienes vencimientos en los próximos 7 días.</div>`
        : data.items.slice(0, 5).map(it => {
            const tagTone = it.diffDays < 0 ? 'danger' : (it.diffDays <= 1 ? 'warn' : 'neutral');
            const dayTag = it.diffDays < 0
                ? `Hace ${Math.abs(it.diffDays)}d`
                : (it.diffDays === 0 ? 'Hoy' : (it.diffDays === 1 ? 'Mañana' : `En ${it.diffDays}d`));
            return `
                <div class="upcoming-7d-row">
                    <span class="drawer-icon-box subtle-box" style="width:32px; height:32px; border-radius:10px; color:var(--accent); flex-shrink:0; margin-top:1px;">
                        ${renderIcon(it.icon, 15)}
                    </span>
                    <div class="upcoming-7d-main">
                        <div class="upcoming-7d-top">
                            <strong class="upcoming-7d-title">${esc(it.title)}</strong>
                            <strong class="negative privacy-sensitive" style="font-size:13px; white-space:nowrap; flex-shrink:0;">${formatMoneyHtml(it.amount)}</strong>
                        </div>
                        <div class="upcoming-7d-bottom">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; min-width:0;">
                                <span class="widget-badge ${tagTone}" style="font-size:9.5px; padding:1.5px 6px;">${dayTag}</span>
                                <small style="font-size:10.5px; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${esc(it.subtitle)}</small>
                            </div>
                            <button type="button" class="mini-action-btn" data-up7d-kind="${escA(it.kind)}" data-up7d-id="${escA(it.refId)}" data-up7d-month="${escA(it.monthId || '')}" style="padding:4px 10px; font-size:10.5px; font-weight:800; flex-shrink:0;">
                                ${esc(it.actionLabel)}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    const moreNote = data.count > 5
        ? `<small style="display:block; text-align:center; font-size:10.5px; color:var(--text-muted); margin-top:6px;">+${data.count - 5} compromiso(s) adicional(es) esta semana</small>`
        : '';

    widget.innerHTML = `
        <div class="widget-header" style="margin-bottom:8px;">
            <div style="display:flex; align-items:center; gap:8px;">
                <span class="drawer-icon-box accent-box" style="width:28px; height:28px; border-radius:8px;">${renderIcon('calendar', 15)}</span>
                <h3 style="font-size:14.5px; font-weight:800; margin:0;">Próximos 7 Días</h3>
            </div>
            <span class="widget-badge ${data.items.some(i => i.diffDays <= 1) ? 'warn' : 'neutral'}">
                ${data.count} • ${formatCompact(data.totalAmount)}
            </span>
        </div>
        <div style="display:flex; flex-direction:column;">${rowsHtml}</div>
        ${moreNote}
    `;
    if (existingEditBar) widget.prepend(existingEditBar);
};

// --- PLANTILLAS EN 1 TOQUE DENTRO DEL OMNI-MODAL ---
const renderTxTemplatesStrip = () => {
    const txForm = document.getElementById('transaction-form');
    if (!txForm) return;

    let wrap = document.getElementById('tx-templates-strip');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'tx-templates-strip';
        wrap.className = 'tx-templates-bar';
        const segEl = document.getElementById('tx-type-segmented');
        const segGroup = segEl?.closest('.form-row') || segEl?.closest('.form-group') || txForm.firstElementChild;
        if (segGroup) segGroup.insertAdjacentElement('afterend', wrap);
        else txForm.prepend(wrap);

        wrap.addEventListener('click', (ev) => {
            const delBtn = ev.target.closest('[data-del-tpl]');
            if (delBtn) {
                ev.preventDefault();
                ev.stopPropagation();
                const tplId = delBtn.getAttribute('data-del-tpl');
                financeData.templates = (financeData.templates || []).filter(t => String(t.id) !== String(tplId));
                localStorage.setItem('myFinances', JSON.stringify(financeData));
                renderTxTemplatesStrip();
                return;
            }

            const applyBtn = ev.target.closest('[data-apply-tpl]');
            if (applyBtn) {
                ev.preventDefault();
                const tplId = applyBtn.getAttribute('data-apply-tpl');
                const tpl = (financeData.templates || []).find(t => String(t.id) === String(tplId));
                if (!tpl) return;

                if (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP') {
                    activeTxCurrency = 'COP';
                    document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => {
                        b.classList.toggle('active', b.getAttribute('data-curr') === 'COP');
                    });
                    document.getElementById('tx-currency-preview')?.classList.add('hidden');
                }

                const accSel = document.getElementById('account');
                if (accSel && tpl.account && Array.from(accSel.options).some(o => o.value === tpl.account)) {
                    accSel.value = tpl.account;
                    accSel.dispatchEvent(new Event('change', { bubbles: true }));
                }

                if (tpl.type === 'transfer') {
                    const toSel = document.getElementById('to-account');
                    if (toSel && tpl.toAccount && Array.from(toSel.options).some(o => o.value === tpl.toAccount)) {
                        toSel.value = tpl.toAccount;
                        toSel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    const catSel = document.getElementById('trans-category');
                    const catVal = tpl.category ? `${tpl.category}::${tpl.subcategory || 'General'}` : '';
                    if (catSel && catVal && Array.from(catSel.options).some(o => o.value === catVal)) {
                        if (typeof txManualCategory !== 'undefined') txManualCategory = catVal;
                        catSel.value = catVal;
                        catSel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                const descInp = document.getElementById('description');
                if (descInp && tpl.description) descInp.value = tpl.description;

                const tagsInp = document.getElementById('trans-tags');
                if (tagsInp) {
                    tagsInp.value = Array.isArray(tpl.tags) && tpl.tags.length > 0 ? tpl.tags.map(tg => `#${tg}`).join(' ') : '';
                    renderTxModalTagSuggestions();
                }

                const amtInp = document.getElementById('amount');
                if (amtInp) {
                    amtInp.value = tpl.amount > 0 ? formatNumberInput(tpl.amount) : '';
                    amtInp.dispatchEvent(new Event('input', { bubbles: true }));
                }

                hasUnsavedChanges = true;
                return;
            }

            if (ev.target.closest('#btn-save-tx-template')) {
                ev.preventDefault();
                const curType = typeSelect?.value || 'expense';
                const desc = (document.getElementById('description')?.value || '').trim();
                const rawAmt = parseMoneyInput(document.getElementById('amount')?.value);
                const fxRate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
                    ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
                    : 1;
                const amtCop = round2(rawAmt * fxRate);
                const acc = document.getElementById('account')?.value || '';
                const toAcc = curType === 'transfer' ? (document.getElementById('to-account')?.value || '') : '';
                const [catPart, subPart] = curType !== 'transfer'
                    ? String(document.getElementById('trans-category')?.value || '').split('::')
                    : ['', ''];
                const rawTags = document.getElementById('trans-tags')?.value || '';
                const tags = extractTransactionTags(rawTags, desc);

                const tplLabel = desc || cleanCatName(subPart && subPart !== 'General' ? subPart : catPart) || 'Movimiento rápido';
                if (!desc && amtCop <= 0) {
                    alert('Escribe al menos una descripción o un monto antes de guardar la plantilla.');
                    return;
                }

                if (!Array.isArray(financeData.templates)) financeData.templates = [];
                const dupIdx = financeData.templates.findIndex(t =>
                    t.type === curType && String(t.label || t.name || '').toLowerCase() === tplLabel.toLowerCase()
                );

                const tplObj = {
                    id: dupIdx !== -1 ? financeData.templates[dupIdx].id : ('Tpl_' + Date.now()),
                    type: curType,
                    label: stripLeadingEmoji(tplLabel).slice(0, 40),
                    description: stripLeadingEmoji(desc || tplLabel).slice(0, 120),
                    amount: amtCop,
                    account: acc,
                    toAccount: toAcc,
                    category: catPart || '',
                    subcategory: subPart || 'General',
                    tags
                };

                if (dupIdx !== -1) financeData.templates[dupIdx] = tplObj;
                else {
                    financeData.templates.unshift(tplObj);
                    if (financeData.templates.length > 20) financeData.templates = financeData.templates.slice(0, 20);
                }

                localStorage.setItem('myFinances', JSON.stringify(financeData));
                renderTxTemplatesStrip();

                const toast = document.createElement('div');
                toast.className = 'sw-toast';
                toast.style.gap = '7px';
                const escT = window.escapeHtml || ((s) => String(s ?? ''));
                toast.innerHTML = `${renderIcon('check', 15)}<span>Plantilla "${escT(tplObj.label)}" guardada</span>`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2200);
            }
        });
    }

    const isEdit = !!(document.getElementById('edit-id')?.value);
    if (isEdit) {
        wrap.classList.add('hidden');
        return;
    }

    wrap.classList.remove('hidden');
    const curType = typeSelect?.value || 'expense';
    const list = (financeData.templates || []).filter(t => t.type === curType);
    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;

    const chipsHtml = list.map(t => `
        <div class="tx-template-chip">
            <button type="button" class="tx-template-apply" data-apply-tpl="${escA(t.id)}">
                <span>${esc(t.label || t.name || t.description || 'Plantilla')}</span>
                ${t.amount > 0 ? `<small>${formatCompact(t.amount)}</small>` : ''}
            </button>
            <button type="button" class="tx-template-del" data-del-tpl="${escA(t.id)}" aria-label="Eliminar plantilla">×</button>
        </div>
    `).join('');

    wrap.innerHTML = `
        <div class="tx-templates-scroll">
            ${chipsHtml}
            <button type="button" id="btn-save-tx-template" class="tx-template-save-btn">
                + Guardar plantilla
            </button>
        </div>
    `;
};

typeSelect?.addEventListener('change', () => setTimeout(renderTxTemplatesStrip, 10));
if (txModalEl) {
    new MutationObserver(() => {
        if (!txModalEl.classList.contains('hidden')) {
            setTimeout(renderTxTemplatesStrip, 20);
        }
    }).observe(txModalEl, { attributes: true, attributeFilter: ['class'] });
}

let isClearModeActive = false;
document.getElementById('btn-toggle-clear-mode')?.addEventListener('click', (e) => {
    isClearModeActive = !isClearModeActive;
    if (isClearModeActive && isBatchSelectMode) {
        isBatchSelectMode = false;
        selectedBatchIds.clear();
    }
    e.target.closest('button').classList.toggle('active', isClearModeActive);
    const clearBanner = document.getElementById('clear-mode-banner');
    if (clearBanner) clearBanner.classList.toggle('hidden', !isClearModeActive);
    updateDashboard(); 
});

// Mantener pulsado un movimiento (450ms) activa la selección múltiple al instante
let txLongPressTimer = null;
let txLongPressTriggered = false;

document.getElementById('transaction-list')?.addEventListener('touchstart', (e) => {
    const item = e.target.closest('.history-item[data-action="edit-tx"]');
    if (!item || isBatchSelectMode || isClearModeActive) return;
    const txId = item.getAttribute('data-id');
    if (!txId) return;

    txLongPressTriggered = false;
    txLongPressTimer = setTimeout(() => {
        txLongPressTriggered = true;
        setBatchSelectMode(true, txId);
    }, 450);
}, { passive: true });

['touchmove', 'touchend', 'touchcancel'].forEach(evt => {
    document.getElementById('transaction-list')?.addEventListener(evt, () => {
        if (txLongPressTimer) {
            clearTimeout(txLongPressTimer);
            txLongPressTimer = null;
        }
    }, { passive: true });
});

document.getElementById('transaction-list')?.addEventListener('click', (e) => {
    if (txLongPressTriggered) {
        txLongPressTriggered = false;
        return;
    }

    const isCheckbox = e.target.closest('.tx-batch-check');
    if (isCheckbox) {
        const id = String(isCheckbox.value);
        if (isCheckbox.checked) selectedBatchIds.add(id);
        else selectedBatchIds.delete(id);
        updateDashboard();
        return;
    }

    const confirmBtn = e.target.closest('.btn-confirm-pending[data-action="confirm-tx"]');
    if (confirmBtn && !isBatchSelectMode) {
        e.stopPropagation();
        const txId = confirmBtn.getAttribute('data-id');
        
        if (String(txId).startsWith('v_sub_')) {
            if (typeof processSubscriptionPayment === 'function') processSubscriptionPayment(txId.replace('v_sub_', ''));
            return;
        }
        if (String(txId).startsWith('v_debt_')) {
            if (typeof openAccountDetail === 'function') openAccountDetail(txId.replace('v_debt_', ''), 'home');
            document.getElementById('open-pay-installment-btn')?.click();
            return;
        }
        if (String(txId).startsWith('v_card_')) {
            if (typeof openAccountDetail === 'function') openAccountDetail(txId.replace('v_card_', ''), 'home');
            return;
        }
        if (String(txId).startsWith('v_accmgmt_') && typeof chargeAccountMgmtFee === 'function') {
            const accId = String(txId).replace('v_accmgmt_', '');
            const acc = (financeData.customAccounts || []).find(a => String(a.id) === accId);
            if (!acc) return;
            const cleanAcc = stripLeadingEmoji(acc.name);
            const escA3 = window.escapeHtml || ((s) => String(s ?? ''));
            const mTarget = getMonthId(viewDate);
            window.openBentoConfirmModal?.({
                title: 'Descontar cuota de manejo',
                subtitle: cleanAcc,
                message: `¿Descontar <b>${formatMoney(round2(acc.mgmtFee || 0))}</b> de <b>${escA3(cleanAcc)}</b>?`,
                confirmText: 'Descontar ahora',
                cancelText: 'Cancelar',
                danger: false,
                onConfirm: () => {
                    const res = chargeAccountMgmtFee(acc.id, mTarget, { allowManualOverride: true });
                    if (res.ok) updateDashboard();
                }
            });
            return;
        }
        if (String(txId).startsWith('v_budget_')) {
            const rawKey = String(txId).replace('v_budget_', '');
            const [catPart, subPart] = rawKey.includes('::') ? rawKey.split('::') : rawKey.split('_');
            const mIdx = viewDate.getMonth();
            const vYear = viewDate.getFullYear();
            const vMonthId = getMonthId(viewDate);
            const catObj = (financeData.categories.expense || []).find(c => c.name === catPart);
            let prefillAmt = '';
            let prefillDesc = subPart || catPart || '';
            if (catObj) {
                const subObj = subPart ? (catObj.subcategories || []).find(s => s.name === subPart) : null;
                const lim = getCategoryBudgetStatus(catObj, subObj, mIdx, vYear).currentLimit;
                const spent = financeData.transactions
                    .filter(t => !t.isDeleted && getTxMonthId(t) === vMonthId && t.type === 'expense' && t.category === catObj.name && (!subPart || t.subcategory === subPart) && !t.isAdjustment && isTxClosed(t))
                    .reduce((s, t) => s + round2(t.amount), 0);
                const rem = Math.max(0, round2(lim - spent));
                if (rem > 0) prefillAmt = rem;
            }
            if (typeof openOmniModal === 'function') {
                openOmniModal({
                    type: 'expense',
                    title: 'Pagar Gasto Fijo',
                    category: `${catPart}::${subPart || 'General'}`,
                    description: prefillDesc,
                    amount: prefillAmt
                });
            }
            return;
        }
        
        confirmPendingTx(txId, e);
        return;
    }

    const historyItem = e.target.closest('.history-item[data-action="edit-tx"]');
    if (historyItem) {
        const txId = String(historyItem.getAttribute('data-id'));
        
        if (isBatchSelectMode) {
            if (selectedBatchIds.has(txId)) selectedBatchIds.delete(txId);
            else selectedBatchIds.add(txId);
            updateDashboard();
            return;
        }

        if (txId.startsWith('v_')) {
            historyItem.querySelector('.btn-confirm-pending')?.click();
            return;
        }

        if (isClearModeActive) {
            const tx = financeData.transactions.find(t => String(t.id) === txId);
            if (tx) {
                tx.isCleared = !tx.isCleared;
                localStorage.setItem('myFinances', JSON.stringify(financeData));
                updateDashboard(); 
            }
        } else {
            if (typeof attemptCloseModals === 'function' && attemptCloseModals()) openEditModal(txId);
        }
    }
});

document.getElementById('history-search-input')?.addEventListener('input', (e) => {
    historySearchQuery = e.target.value.trim();
    updateDashboard();
});

document.querySelectorAll('.pill-btn[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pill-btn[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeHistoryFilter = btn.getAttribute('data-filter');
        updateDashboard();
    });
});
// ==========================================
// MÓDULO GMF (4x1000): ALERTA EN GASTOS/TRANSFERENCIAS Y ONBOARDING
// ==========================================
const renderTransactionGmfPreview = () => {
    const box = document.getElementById('tx-gmf-impact-box');
    if (!box) return;

    const editId = document.getElementById('edit-id')?.value;
    const type = document.getElementById('type')?.value || 'expense';
    const accountId = document.getElementById('account')?.value || '';
    const toAccountId = document.getElementById('to-account')?.value || '';
    const rawAmt = parseMoneyInput(document.getElementById('amount')?.value);

    // Convertir moneda si el usuario está registrando en USD/EUR
    const rate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
        ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
        : 1;
    const amountCop = round2(rawAmt * rate);

    if (editId || amountCop <= 0 || (type !== 'expense' && type !== 'transfer') || typeof calculateTransactionGmf !== 'function') {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const sameBankCheck = document.getElementById('tx-same-bank-transfer');
    const isSameBank = type === 'transfer' && !!sameBankCheck?.checked;

    const dateVal = document.getElementById('trans-date')?.value;
    const dateObj = dateVal ? new Date(`${dateVal}T12:00:00`) : new Date();

    const gmf = calculateTransactionGmf({
        accountId,
        amount: amountCop,
        type,
        toAccountId,
        isSameBank,
        dateObj
    });

    if (!gmf.applies) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const toAcc = type === 'transfer' ? getAccountObj(toAccountId) : null;
    const showSameBankOption = type === 'transfer' && toAcc && toAcc.category === 'asset' && toAcc.id !== 'Efectivo' && !String(toAcc.id).startsWith('CxC_');

    if (gmf.gmfAmount <= 0 && !showSameBankOption) {
        box.classList.add('hidden');
        box.innerHTML = '';
        return;
    }

    const totalDebit = round2(amountCop + gmf.gmfAmount);
    const reasonText = gmf.isExempt
        ? `Excede tu tope mensual exento de ${gmf.capUvt} UVT (${formatMoney(gmf.monthlyCapCop)}). Se grava el excedente de ${formatMoney(gmf.taxableAmount)}.`
        : `Esta cuenta no está marcada como exenta del 4x1000 (0,4%).`;

    const prevChecked = document.getElementById('tx-apply-gmf-check')?.checked !== false;

    box.classList.remove('hidden');
    box.innerHTML = `
        ${gmf.gmfAmount > 0 ? `
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; margin-bottom:6px;">
                <span style="display:inline-flex; align-items:center; gap:6px; font-weight:800; color:#d97706; font-size:12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <span>Impuesto 4x1000 (GMF):</span>
                </span>
                <strong class="negative" style="font-size:13px; white-space:nowrap;">+ ${formatMoney(gmf.gmfAmount)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:11.5px; margin-bottom:6px; padding-bottom:6px; border-bottom:1px dashed rgba(245, 158, 11, 0.3);">
                <span style="color:var(--text-muted);">Total real a debitar de la cuenta:</span>
                <strong style="color:var(--text-main);">${formatMoney(totalDebit)}</strong>
            </div>
            <small style="display:block; font-size:10.5px; color:var(--text-muted); line-height:1.35; margin-bottom:7px;">${reasonText}</small>
            <label style="display:flex; align-items:center; gap:7px; font-size:11px; font-weight:700; color:var(--text-main); cursor:pointer;">
                <input type="checkbox" id="tx-apply-gmf-check" ${prevChecked ? 'checked' : ''} style="width:15px; height:15px; accent-color:#d97706;">
                <span>Debitar y registrar el 4x1000 automáticamente</span>
            </label>
        ` : ''}
        ${showSameBankOption ? `
            <label style="display:flex; align-items:center; gap:7px; font-size:11px; font-weight:600; color:var(--text-muted); cursor:pointer; ${gmf.gmfAmount > 0 ? 'margin-top:7px; padding-top:7px; border-top:1px dashed rgba(245, 158, 11, 0.25);' : ''}">
                <input type="checkbox" id="tx-same-bank-transfer" ${isSameBank ? 'checked' : ''} style="width:15px; height:15px; accent-color:var(--accent);">
                <span>Mismo banco y mismo titular (Exenta de 4x1000)</span>
            </label>
        ` : ''}
    `;

    box.querySelector('#tx-same-bank-transfer')?.addEventListener('change', renderTransactionGmfPreview);
};

['amount', 'account', 'to-account', 'type', 'trans-date'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', renderTransactionGmfPreview);
        el.addEventListener('change', renderTransactionGmfPreview);
    }
});

document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderTransactionGmfPreview, 20));
});

const gmfTxModal = document.getElementById('transaction-modal');
if (gmfTxModal) {
    new MutationObserver(() => {
        if (!gmfTxModal.classList.contains('hidden')) {
            setTimeout(renderTransactionGmfPreview, 40);
        }
    }).observe(gmfTxModal, { attributes: true, attributeFilter: ['class'] });
}

// Registro automático del débito 4x1000 y marca de transferencia mismo banco
let pendingTxGmfPayload = null;

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'transaction-form') {
        pendingTxGmfPayload = null;
        const editId = document.getElementById('edit-id')?.value;
        const status = document.getElementById('trans-status')?.value || 'closed';
        const type = document.getElementById('type')?.value || 'expense';
        const applyCheck = document.getElementById('tx-apply-gmf-check');
        const isSameBank = type === 'transfer' && !!document.getElementById('tx-same-bank-transfer')?.checked;

        if (!editId && (type === 'expense' || type === 'transfer')) {
            const accountId = document.getElementById('account')?.value || '';
            const toAccountId = document.getElementById('to-account')?.value || '';
            const amountCop = parseMoneyInput(document.getElementById('amount')?.value);
            const dateVal = document.getElementById('trans-date')?.value;
            const timeVal = document.getElementById('trans-time')?.value || '12:00';
            const dateObj = dateVal ? new Date(`${dateVal}T${timeVal}`) : new Date();

            const gmf = (status === 'closed' && applyCheck?.checked && typeof calculateTransactionGmf === 'function')
                ? calculateTransactionGmf({ accountId, amount: amountCop, type, toAccountId, isSameBank, dateObj })
                : { gmfAmount: 0 };

            if (gmf.gmfAmount > 0 || isSameBank) {
                pendingTxGmfPayload = {
                    accountId,
                    type,
                    isSameBank,
                    gmfAmount: gmf.gmfAmount || 0,
                    desc: stripLeadingEmoji(document.getElementById('description')?.value || 'Movimiento').trim(),
                    dateObj,
                    beforeCount: financeData.transactions.length
                };
            }
        }
    }
}, true);

document.addEventListener('submit', (e) => {
    if (e.target && e.target.id === 'transaction-form' && pendingTxGmfPayload) {
        const payload = pendingTxGmfPayload;
        pendingTxGmfPayload = null;
        if (!document.getElementById('transaction-modal')?.classList.contains('hidden')) return;

        if (financeData.transactions.length > payload.beforeCount) {
            const createdSlice = financeData.transactions.slice(payload.beforeCount);
            const mainParent = createdSlice.find(t => !t.isAdjustment && !t.parentId && !t.linkedToTransfer) || createdSlice[createdSlice.length - 1];

            if (payload.isSameBank) {
                createdSlice.forEach(t => {
                    if (t.type === 'transfer' && t.account === payload.accountId) {
                        t.isSameBankTransfer = true;
                    }
                });
            }

            if (payload.gmfAmount > 0) {
                const taxCat = (financeData.categories?.expense || []).find(c => /impuesto|bancari|financiero/i.test(c.name));
                const catName = taxCat ? taxCat.name : 'Impuestos / 4x1000';
                const dObj = payload.dateObj;

                financeData.transactions.push({
                    id: dObj.getTime() + 777,
                    monthId: getMonthId(dObj),
                    type: 'expense',
                    status: 'closed',
                    account: payload.accountId,
                    category: catName,
                    subcategory: '4x1000 (GMF)',
                    description: `4x1000 (GMF): ${payload.desc}`,
                    amount: payload.gmfAmount,
                    date: `${dObj.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}, ${dObj.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`,
                    isAdjustment: false,
                    isGmfTax: true,
                    ...(mainParent?.id ? { parentId: mainParent.id } : {})
                });
            }

            localStorage.setItem('myFinances', JSON.stringify(financeData));
            updateDashboard();
        }
    }
}, false);

// ==========================================
// MODAL DE BIENVENIDA: CONFIGURACIÓN INICIAL 4x1000
// ==========================================
window.openGmfWelcomeModal = () => {
    if (document.body?.classList.contains('app-locked') || window.LumenSecurity?.isVaultLocked?.()) return;
    if (typeof hasAnyGmfConfiguredAccount === 'function' && hasAnyGmfConfiguredAccount()) return;

    const bankAssets = (financeData.customAccounts || []).filter(
        a => a.category === 'asset' && a.id !== 'Efectivo' && !String(a.id).startsWith('CxC_') && a.accountSubType !== 'cash'
    );
    if (bankAssets.length === 0) return;

    let modalEl = document.getElementById('gmf-welcome-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'gmf-welcome-modal';
        modalEl.className = 'modal hidden';
        modalEl.style.zIndex = '1450';
        document.body.appendChild(modalEl);
    }

    const uvt = round2((typeof getTaxParams === 'function' ? getTaxParams().uvt : 52374) || 52374);
    const cap350 = formatMoney(round2(350 * uvt));
    const cap65 = formatMoney(round2(65 * uvt));

    const escG = window.escapeHtml || ((s) => String(s ?? ''));
    const escGA = window.escapeAttr || escG;
    const rowsHtml = bankAssets.map((acc, idx) => {
        const defaultSub = acc.accountSubType || (/nequi|daviplata|dale|movii|rappipay|uala/i.test(acc.name) ? 'wallet' : 'savings');
        const safeName = escG(stripLeadingEmoji(acc.name));
        const safeId = escGA(acc.id);
        return `
            <div class="glass-sub-box" style="padding:10px 12px; margin-bottom:8px; border-color:var(--border-color);">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <strong style="font-size:13px; color:var(--text-main); min-width:0; flex:1;">${safeName}</strong>
                    <div style="flex-shrink:0; width:175px;">
                        <select class="gmf-welcome-subtype" data-acc-id="${safeId}" data-bento-compact="1" aria-label="Tipo • ${escGA(stripLeadingEmoji(acc.name))}">
                            <option value="savings" ${defaultSub === 'savings' ? 'selected' : ''}>Cuenta de Ahorros</option>
                            <option value="wallet" ${defaultSub === 'wallet' ? 'selected' : ''}>Billetera (65 UVT)</option>
                            <option value="checking" ${defaultSub === 'checking' ? 'selected' : ''}>Cuenta Corriente</option>
                            <option value="cash" ${defaultSub === 'cash' ? 'selected' : ''}>Efectivo</option>
                        </select>
                    </div>
                </div>
                <label class="gmf-welcome-radio-row" data-acc-id="${safeId}" style="display:flex; align-items:center; gap:8px; font-size:11.5px; color:var(--text-muted); cursor:pointer; margin-top:8px;">
                    <input type="radio" name="gmf-welcome-exempt-choice" value="${safeId}" ${idx === 0 && defaultSub === 'savings' ? 'checked' : ''} style="width:16px; height:16px; accent-color:var(--positive);">
                    <span>Marcar como mi cuenta exenta (350 UVT / mes)</span>
                </label>
                <div class="gmf-welcome-wallet-badge hidden" data-acc-id="${safeId}" style="margin-top:7px; font-size:11px; color:var(--positive); font-weight:600; display:flex; align-items:center; gap:5px;">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Exenta por ley hasta 65 UVT/mes sin gastar tu marca</span>
                </div>
            </div>
        `;
    }).join('');

    modalEl.innerHTML = `
        <div class="modal-content" style="max-width:450px; max-height:88dvh; display:flex; flex-direction:column; overflow:hidden; padding:0;">
            <div style="padding:18px 18px 12px 18px; border-bottom:1px solid var(--border-color); flex-shrink:0;">
                <span class="widget-badge" style="font-size:10px; margin-bottom:6px; display:inline-block;">Novedad en Lumen</span>
                <h2 style="margin:0; font-size:18px; font-weight:800;">Configura tu exención del 4x1000</h2>
                <small style="color:var(--text-muted); font-size:11.5px; display:block; margin-top:3px; line-height:1.35;">
                    Ahora calculamos automáticamente el impuesto GMF (0,4%) cuando pagas desde cuentas no exentas.
                </small>
            </div>

            <div style="flex:1; overflow-y:auto; padding:14px 18px 18px 18px; -webkit-overflow-scrolling:touch;">
                <details class="changelog-accordion" open style="width:100%; display:block; box-sizing:border-box; margin-bottom:14px; background:rgba(245, 158, 11, 0.07); border:1px solid rgba(245, 158, 11, 0.28); border-radius:14px; padding:11px 12px; box-shadow:none;">
                    <summary style="display:flex; justify-content:space-between; align-items:center; font-size:12px; font-weight:800; color:#d97706; cursor:pointer;">
                        <span style="display:inline-flex; align-items:center; gap:7px;">
                            <span style="width:22px; height:22px; border-radius:7px; background:rgba(245, 158, 11, 0.16); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                            </span>
                            <span>Reglas y cálculo del 4x1000 (GMF)</span>
                        </span>
                        <span style="font-size:11px; opacity:0.85;">▾</span>
                    </summary>

                    <div style="margin-top:10px; padding-top:10px; border-top:1px dashed rgba(245, 158, 11, 0.3); display:flex; flex-direction:column; gap:8px;">
                        <!-- Tarjeta de reglas legales -->
                        <div style="background:var(--card-inner-bg); border:1px solid var(--border-color); border-radius:11px; padding:10px 11px; display:flex; flex-direction:column; gap:9px; font-size:11.5px; color:var(--text-muted); line-height:1.4;">
                            <div style="display:flex; align-items:flex-start; gap:8px;">
                                <span style="width:18px; height:18px; border-radius:50%; background:rgba(245, 158, 11, 0.16); color:#d97706; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">1</span>
                                <div><strong style="color:var(--text-main);">Cuenta de Ahorros Exenta (350 UVT/mes):</strong> Puedes marcar <b>1 única cuenta</b> exenta hasta <b style="color:var(--text-main); white-space:nowrap;">${cap350}/mes</b>. Solo pagas 4x1000 sobre el dinero que supere ese tope.</div>
                            </div>
                            <div style="display:flex; align-items:flex-start; gap:8px; padding-top:8px; border-top:1px dashed var(--border-color);">
                                <span style="width:18px; height:18px; border-radius:50%; background:rgba(245, 158, 11, 0.16); color:#d97706; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">2</span>
                                <div><strong style="color:var(--text-main);">Billeteras Bajo Monto (65 UVT/mes):</strong> Cuentas como Nequi o DaviPlata tienen <b style="color:var(--text-main); white-space:nowrap;">${cap65}/mes</b> exentos por ley sin gastar tu marca de 350 UVT.</div>
                            </div>
                            <div style="display:flex; align-items:flex-start; gap:8px; padding-top:8px; border-top:1px dashed var(--border-color);">
                                <span style="width:18px; height:18px; border-radius:50%; background:rgba(245, 158, 11, 0.16); color:#d97706; font-size:10px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">3</span>
                                <div><strong style="color:var(--text-main);">Operaciones sin impuesto:</strong> Recibir dinero, usar <b>Efectivo</b> o transferir entre tus propias cuentas del <b>mismo banco</b> no genera 4x1000.</div>
                            </div>
                        </div>

                        <!-- Tarjeta de explicación de cálculo -->
                        <div style="background:var(--card-inner-bg); border:1px solid color-mix(in srgb, var(--accent) 28%, var(--border-color)); border-radius:11px; padding:10px 11px;">
                            <div style="margin-bottom:8px;">
                                <strong style="font-size:11.5px; color:var(--text-main); display:inline-flex; align-items:center; gap:6px;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="16" y1="14" x2="16" y2="18"/><path d="M16 10h.01"/><path d="M12 10h.01"/><path d="M8 10h.01"/><path d="M12 14h.01"/><path d="M8 14h.01"/><path d="M12 18h.01"/><path d="M8 18h.01"/></svg>
                                    <span>¿Cómo se calcula? <span style="white-space:nowrap;">(0,4% = $4 por cada $1.000)</span></span>
                                </strong>
                            </div>

                            <div style="display:flex; flex-direction:column; gap:5px; font-size:11px; color:var(--text-muted); margin-bottom:9px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                                    <span>Fórmula legal:</span>
                                    <b style="color:var(--text-main); white-space:nowrap;">Valor gravado × 0,004</b>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                                    <span>Ejemplo pago (cuenta no exenta):</span>
                                    <b style="color:var(--text-main); white-space:nowrap;">$ 1.000.000</b>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                                    <span>Impuesto 4x1000 (0,4%):</span>
                                    <b class="negative" style="white-space:nowrap;">+$ 4.000</b>
                                </div>
                            </div>

                            <div style="background:rgba(16, 185, 129, 0.1); border:1px dashed rgba(16, 185, 129, 0.35); border-radius:8px; padding:7px 10px; display:flex; flex-direction:column; gap:3px; font-size:11.5px;">
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                                    <span style="color:var(--text-main); font-weight:600;">Total debitado de tu cuenta:</span>
                                    <strong style="color:var(--text-main); font-size:12.5px; white-space:nowrap;">$ 1.004.000</strong>
                                </div>
                                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; font-size:10.5px; color:var(--text-muted);">
                                    <span>En cuenta exenta (dentro del tope UVT):</span>
                                    <b class="positive" style="white-space:nowrap;">$ 0 de impuesto</b>
                                </div>
                            </div>
                        </div>
                    </div>
                </details>

                ${rowsHtml}

                <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px;">
                    <button type="button" id="btn-save-gmf-welcome" class="btn btn-primary" style="width:100%;">Guardar mi cuenta exenta</button>
                    <button type="button" id="btn-none-gmf-welcome" class="btn btn-secondary" style="width:100%; font-size:12px;">Ninguna está exenta (todas pagan 4x1000)</button>
                    <button type="button" id="btn-later-gmf-welcome" style="background:none; border:none; color:var(--text-muted); font-size:11.5px; padding:6px; cursor:pointer;">Recordármelo después</button>
                </div>
            </div>
        </div>
    `;

    modalEl.querySelectorAll('.gmf-welcome-subtype').forEach(sel => {
        sel.addEventListener('change', () => {
            const cardBox = sel.closest('.glass-sub-box');
            const row = cardBox?.querySelector('.gmf-welcome-radio-row');
            const walletBadge = cardBox?.querySelector('.gmf-welcome-wallet-badge');
            const radio = row?.querySelector('input[type="radio"]');
            const isSavings = sel.value === 'savings';
            const isWallet = sel.value === 'wallet';

            if (row) row.classList.toggle('hidden', !isSavings);
            if (walletBadge) {
                walletBadge.classList.toggle('hidden', !isWallet);
                walletBadge.style.display = isWallet ? 'flex' : 'none';
            }
            if (!isSavings && radio) radio.checked = false;
        });
        sel.dispatchEvent(new Event('change'));
    });

    modalEl.querySelector('#btn-save-gmf-welcome')?.addEventListener('click', () => {
        const selectedExemptId = modalEl.querySelector('input[name="gmf-welcome-exempt-choice"]:checked')?.value || '';
        modalEl.querySelectorAll('.gmf-welcome-subtype').forEach(sel => {
            const accId = sel.getAttribute('data-acc-id');
            const acc = financeData.customAccounts.find(a => a.id === accId);
            if (acc) {
                acc.accountSubType = sel.value;
                acc.gmfExempt = (acc.id === selectedExemptId) && (sel.value === 'savings' || sel.value === 'wallet');
                acc.gmfReviewed = true;
            }
        });
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        modalEl.classList.add('hidden');
        if (typeof updateDashboard === 'function') updateDashboard();
    });

    modalEl.querySelector('#btn-none-gmf-welcome')?.addEventListener('click', () => {
        modalEl.querySelectorAll('.gmf-welcome-subtype').forEach(sel => {
            const accId = sel.getAttribute('data-acc-id');
            const acc = financeData.customAccounts.find(a => a.id === accId);
            if (acc) {
                acc.accountSubType = sel.value;
                acc.gmfExempt = false;
                acc.gmfReviewed = true;
            }
        });
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        modalEl.classList.add('hidden');
        if (typeof updateDashboard === 'function') updateDashboard();
    });

    modalEl.querySelector('#btn-later-gmf-welcome')?.addEventListener('click', () => {
        modalEl.classList.add('hidden');
    });

    modalEl.classList.remove('hidden');
};

// Verificar al iniciar la app (cuando ya esté desbloqueada / en sesión)
setTimeout(() => {
    const authOverlay = document.getElementById('auth-overlay') || document.getElementById('pin-overlay');
    const isLocked = authOverlay && !authOverlay.classList.contains('hidden');
    if (!isLocked) {
        window.openGmfWelcomeModal();
    } else if (authOverlay) {
        const unlockObs = new MutationObserver(() => {
            if (authOverlay.classList.contains('hidden')) {
                unlockObs.disconnect();
                setTimeout(() => window.openGmfWelcomeModal(), 300);
            }
        });
        unlockObs.observe(authOverlay, { attributes: true, attributeFilter: ['class'] });
    }
}, 500);

// --- SINCRONIZACION GOOGLE DRIVE (DESHABILITADA HONESTAMENTE EN MODO LOCAL-FIRST) ---
document.getElementById('pref-link-gdrive')?.addEventListener('change', (e) => {
    e.target.checked = false;
    const controls = document.getElementById('cloud-sync-controls');
    const nameEl = document.getElementById('cloud-account-name');
    const emailEl = document.getElementById('cloud-account-email');
    if (nameEl) {
        nameEl.innerText = 'Vincular Google Drive';
        nameEl.style.color = 'var(--text-main)';
    }
    if (emailEl) {
        emailEl.innerText = 'Disponible en una futura actualizacion';
    }
    controls?.classList.add('hidden');
    alert('La sincronizacion en la nube aun no esta disponible. Usa "Exportar Respaldo" para guardar una copia cifrada (.lumen) en tu dispositivo.');
});

document.getElementById('btn-cloud-backup')?.addEventListener('click', () => {
    alert('[Próximamente] Se subirá un archivo cifrado con todas tus finanzas a tu Google Drive personal.');
});

document.getElementById('btn-cloud-restore')?.addEventListener('click', () => {
    alert('[Próximamente] La app descargará y aplicará tu último respaldo desde Google Drive.');
});

const LUMEN_UPDATE_SLIDES = [
    {
        title: 'Mis Finanzas ahora es Lumen',
        desc: 'En física, un lumen mide la luz visible. Evolucionamos nuestro nombre porque manejar tu dinero no debe ser complejo ni oscuro: nuestra misión es darle total claridad a cada peso que ganas, ahorras e inviertes.',
        art: `
            <div style="background: var(--card-inner-bg); border: 1px solid var(--border-color); border-radius: 18px; padding: 18px 16px; display: flex; flex-direction: column; align-items: center; gap: 12px;">
                <div style="width: 68px; height: 68px; border-radius: 22px; background: linear-gradient(145deg, rgba(0,196,159,0.16), rgba(0,51,170,0.08)); border: 1px solid rgba(0,196,159,0.35); display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(0,196,159,0.22);">
                    <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="lumenUpdGrad" x1="15%" y1="10%" x2="85%" y2="90%">
                                <stop offset="0%" stop-color="#00C49F"/>
                                <stop offset="50%" stop-color="#0033AA"/>
                                <stop offset="100%" stop-color="#00C49F"/>
                            </linearGradient>
                        </defs>
                        <path d="M 48 74 L 48 24 A 10 10 0 0 0 28 24 L 28 54 A 12 12 0 0 0 40 66 L 76 66 A 10 10 0 0 1 76 86 L 60 86 A 12 12 0 0 1 48 74 Z" stroke="url(#lumenUpdGrad)" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-decoration: line-through;">Mis Finanzas</span>
                    <span style="font-size: 12px; color: #00C49F; font-weight: 800;">→</span>
                    <span style="font-size: 12px; font-weight: 800; color: #00C49F; background: rgba(0,196,159,0.12); padding: 3px 12px; border-radius: 99px;">Lumen</span>
                </div>
            </div>
        `
    },
    {
        title: 'Una identidad diseñada para enfocar',
        desc: 'Dejamos atrás el morado para adoptar una paleta fintech de alto contraste. Combinamos la calma del crecimiento financiero con la solidez institucional, manteniendo tu libertad de personalizar cada tono.',
        art: `
            <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
                <div style="background: var(--card-inner-bg); border: 1px solid var(--border-color); border-radius: 15px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                    <span style="width: 34px; height: 34px; border-radius: 10px; background: #00C49F; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,196,159,0.35);"></span>
                    <div>
                        <strong style="display: block; font-size: 12.5px; color: var(--text-main);">Verde Menta</strong>
                        <small style="font-size: 11px; color: var(--text-muted);">Representa liquidez, flujo activo y progreso.</small>
                    </div>
                </div>
                <div style="background: var(--card-inner-bg); border: 1px solid var(--border-color); border-radius: 15px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                    <span style="width: 34px; height: 34px; border-radius: 10px; background: #0033AA; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0,51,170,0.35);"></span>
                    <div>
                        <strong style="display: block; font-size: 12.5px; color: var(--text-main);">Azul Zafiro</strong>
                        <small style="font-size: 11px; color: var(--text-muted);">Aporta estructura, precisión y respaldo.</small>
                    </div>
                </div>
                <div style="text-align: center; margin-top: 2px;">
                    <small style="font-size: 10.5px; font-weight: 700; color: var(--text-muted);">Actívalo o cámbialo en Perfil → Color Principal</small>
                </div>
            </div>
        `
    },
    {
        title: 'Misma esencia, 100% privada',
        desc: 'Cambia nuestra piel, pero nuestra arquitectura sigue intacta. Tus cuentas, presupuestos y proyecciones permanecen guardados únicamente en tu teléfono, sin servidores externos ni rastreo.',
        art: `
            <div style="display: flex; flex-direction: column; gap: 8px; text-align: left;">
                <div style="background: var(--card-inner-bg); border: 1px solid var(--border-color); border-radius: 15px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(16, 185, 129, 0.14); color: #10b981; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                    </div>
                    <div>
                        <strong style="display: block; font-size: 12.5px; color: var(--text-main);">Tus registros están a salvo</strong>
                        <small style="font-size: 11px; color: var(--text-muted);">Todo tu historial migró automáticamente sin cambios.</small>
                    </div>
                </div>
                <div style="background: var(--card-inner-bg); border: 1px solid var(--border-color); border-radius: 15px; padding: 12px 14px; display: flex; align-items: center; gap: 12px;">
                    <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(6, 182, 212, 0.14); color: #06B6D4; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    </div>
                    <div>
                        <strong style="display: block; font-size: 12.5px; color: var(--text-main);">Motor Local-First</strong>
                        <small style="font-size: 11px; color: var(--text-muted);">Sigue operando instantáneamente y sin conexión.</small>
                    </div>
                </div>
            </div>
        `
    }
];

window.checkLumenRebrandModal = () => {
    const STORAGE_FLAG = 'lumenRebrandSeen_v1';
    
    // 1. Si ya lo vio antes, no hacer nada
    if (localStorage.getItem(STORAGE_FLAG) === 'true') return;

    // 2. Verificar si es un usuario existente (ya tiene perfil creado)
    // Si es usuario nuevo, verá el onboarding normal y marcamos este como visto para no duplicar
    const isExistingUser = Boolean(localStorage.getItem('myFinancesAuth') || localStorage.getItem('myFinances'));
    if (!isExistingUser) {
        localStorage.setItem(STORAGE_FLAG, 'true');
        return;
    }

    const modal = document.getElementById('lumen-update-modal');
    if (!modal) return;
    document.body.appendChild(modal);

    // Si la app tiene bloqueo por PIN activo, esperar a que se desbloquee
    if (document.body.classList.contains('app-locked')) {
        const observer = new MutationObserver(() => {
            if (!document.body.classList.contains('app-locked')) {
                observer.disconnect();
                setTimeout(window.checkLumenRebrandModal, 400);
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        return;
    }

    let currentIdx = 0;

    const closeModal = () => {
        localStorage.setItem(STORAGE_FLAG, 'true');
        modal.classList.add('hidden');
        // Encadenar el aviso de biometría si el dispositivo es compatible y no lo ha visto
        if (typeof window.checkWhatsNewBanner === 'function') {
            setTimeout(window.checkWhatsNewBanner, 350);
        }
    };

    const renderUpdateSlide = (idx) => {
        currentIdx = idx;
        const slide = LUMEN_UPDATE_SLIDES[currentIdx];
        const isLast = currentIdx === LUMEN_UPDATE_SLIDES.length - 1;

        const bodyEl = document.getElementById('lumen-upd-body');
        if (bodyEl) {
            bodyEl.classList.remove('onb-anim-enter');
            void bodyEl.offsetWidth;
            bodyEl.classList.add('onb-anim-enter');
        }

        document.getElementById('lumen-upd-pill').textContent = `NOVEDAD • ${currentIdx + 1} / ${LUMEN_UPDATE_SLIDES.length}`;
        document.getElementById('lumen-upd-art').innerHTML = slide.art;
        document.getElementById('lumen-upd-title').textContent = slide.title;
        document.getElementById('lumen-upd-desc').textContent = slide.desc;
        
        const nextBtn = document.getElementById('btn-lumen-upd-next');
        nextBtn.textContent = isLast ? 'Explorar Lumen' : 'Siguiente';
        // Forzar el degradado oficial de Lumen en el botón de este anuncio
        nextBtn.style.background = 'linear-gradient(135deg, #00C49F 0%, #0033AA 100%)';

        const dotsEl = document.getElementById('lumen-upd-dots');
        dotsEl.innerHTML = LUMEN_UPDATE_SLIDES.map((_, i) =>
            `<span style="width: ${i === currentIdx ? '20px' : '7px'}; height: 7px; border-radius: 6px; background: ${i === currentIdx ? '#00C49F' : 'var(--border-color)'}; transition: all 0.25s ease;"></span>`
        ).join('');
    };

    document.getElementById('btn-lumen-upd-next').onclick = () => {
        if (currentIdx < LUMEN_UPDATE_SLIDES.length - 1) {
            renderUpdateSlide(currentIdx + 1);
        } else {
            closeModal();
        }
    };

    document.getElementById('btn-lumen-upd-skip').onclick = closeModal;

    renderUpdateSlide(0);
    modal.classList.remove('hidden');
};

// Ejecutar verificación al cargar la app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(window.checkLumenRebrandModal, 600));
} else {
    setTimeout(window.checkLumenRebrandModal, 600);
}
// ==========================================
// FUNCIÓN DE MANTENIMIENTO Y RECÁLCULO
// ==========================================
document.getElementById('btn-recalculate-all')?.addEventListener('click', () => {
    if (typeof window.openBentoConfirmModal === 'function') {
        window.openBentoConfirmModal({
            title: 'Sincronizar y Recalcular',
            subtitle: 'Mantenimiento preventivo',
            message: 'Esta acción validará el historial de todas tus cuentas, corregirá decimales huérfanos y recalculará las proyecciones usando los parámetros actuales. ¿Continuar?',
            confirmText: 'Sí, recalcular',
            cancelText: 'Cancelar',
            danger: false,
            onConfirm: executeMasterRecalculation
        });
    } else if (confirm('Esto validará todas las cuentas y corregirá decimales. ¿Continuar?')) {
        executeMasterRecalculation();
    }
});

function executeMasterRecalculation() {
    try {
        if (!financeData || !financeData.transactions) {
            if (typeof window.openBentoAlertModal === 'function') {
                window.openBentoAlertModal('No hay datos para recalcular.', { title: 'Aviso' });
            }
            return;
        }

        let repairedCount = 0;

        // 1. LIMPIEZA DE DECIMALES EN TRANSACCIONES
        financeData.transactions.forEach(tx => {
            const oldAmount = tx.amount;
            tx.amount = round2(tx.amount || 0);
            if (tx.budgetedAmount) tx.budgetedAmount = round2(tx.budgetedAmount);
            if (tx.monthlyQuota) tx.monthlyQuota = round2(tx.monthlyQuota);
            if (tx.totalWithInterest) tx.totalWithInterest = round2(tx.totalWithInterest);
            if (tx.extraPrincipalPaid) tx.extraPrincipalPaid = round2(tx.extraPrincipalPaid);
            if (tx.amount !== oldAmount) repairedCount++;
        });

        // 2. PURGAR ÚNICAMENTE REGISTROS CORRUPTOS SIN AFECTAR TRANSFERENCIAS DE CUENTAS ACTIVAS
        const validAccountIds = new Set([
            ...(financeData.customAccounts || []).map(a => String(a.id)),
            ...(financeData.pockets || []).map(p => String(p.id)),
            'CxC_Gastos_Acompanante'
        ]);
        const originalLength = financeData.transactions.length;
        financeData.transactions = financeData.transactions.filter(tx => {
            if (!tx || !tx.account || tx.account === 'undefined' || tx.account === 'null') return false;
            const hasOrigin = validAccountIds.has(String(tx.account));
            if (tx.type === 'transfer') {
                const hasDest = Boolean(tx.toAccount && validAccountIds.has(String(tx.toAccount)));
                return hasOrigin || hasDest;
            }
            return hasOrigin;
        });
        repairedCount += (originalLength - financeData.transactions.length);

        // 3. ACTUALIZAR SALDOS DE CUENTAS / DEUDAS (BARRIDO DESDE EL DÍA 0)
        financeData.customAccounts.forEach(acc => {
            if (acc.category === 'debt' || acc.category === 'credit_card') {
                if (acc.debtOriginal) acc.debtOriginal = round2(acc.debtOriginal);
                if (acc.debtMonthlyPayment) acc.debtMonthlyPayment = round2(acc.debtMonthlyPayment);
                if (acc.rate) acc.rate = round2(acc.rate);
                if (acc.debtRate) acc.debtRate = round2(acc.debtRate);
                if (acc.creditLimit) acc.creditLimit = round2(acc.creditLimit);
            }
        });

        // 4. GUARDAR EN BÓVEDA Y REINICIAR DE FORMA TRANSACCIONAL
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        if (typeof window.openBentoAlertModal === 'function') {
            window.openBentoAlertModal(`¡Mantenimiento exitoso!\nSe revisó el historial y se ajustaron ${repairedCount} anomalías.`, { title: 'Sincronización Completa', buttonText: 'Entendido' });
        }
        
        setTimeout(async () => {
            await window.LumenSecurity?.flushVault?.();
            window.location.reload();
        }, 2200);

    } catch (error) {
        console.error('Error en recálculo:', error);
        if (typeof window.openBentoAlertModal === 'function') {
            window.openBentoAlertModal('Ocurrió un error al ejecutar el mantenimiento.', { title: 'Error' });
        }
    }
}

// ============================================================
// CONTROLADOR UI: MODAL DE CDT Y CDAT
// ============================================================
(function initCDTModule() {
    const STORAGE_KEY = 'lumen_cdts_v1';

    const loadCDTs = () => {
        try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
        catch (e) { return []; }
    };

    const saveCDTs = (list) => {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch (e) {}
    };

    const parseMoneyVal = (raw) => (typeof parseMoneyInput === 'function' ? parseMoneyInput(raw) : (parseFloat(String(raw || '').replace(/[^\d.-]/g, '')) || 0));
    const getLocalDateISO = () => new Date().toLocaleDateString('en-CA');

    // Convierte tasas como "11,5" o "11.5" -> 11.5
    const parseDecimalVal = (raw) => {
        if (typeof raw === 'number') return raw;
        const clean = String(raw || '').trim().replace(',', '.');
        return parseFloat(clean) || 0;
    };

    const fmtCOP = (val) => {
        const num = Number(val) || 0;
        if (typeof formatMoney === 'function') return formatMoney(num);
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(num);
    };

    const updateLivePreview = () => {
        if (typeof calculateCDTReturns !== 'function') return;

        const res = calculateCDTReturns({
            capital: parseMoneyVal(document.getElementById('cdt-capital')?.value),
            tasaEA: parseDecimalVal(document.getElementById('cdt-tasa')?.value),
            plazoDias: document.getElementById('cdt-plazo')?.value,
            baseDias: document.getElementById('cdt-base')?.value,
            retefuentePct: parseDecimalVal(document.getElementById('cdt-retefuente')?.value),
            periodicidad: document.getElementById('cdt-periodicidad')?.value
        });

        const brutoEl = document.getElementById('prev-cdt-bruto');
        const retEl = document.getElementById('prev-cdt-ret');
        const netoEl = document.getElementById('prev-cdt-neto');
        const totalEl = document.getElementById('prev-cdt-total');

        if (brutoEl) brutoEl.textContent = fmtCOP(res.rendimientoBruto);
        if (retEl) retEl.textContent = `-${fmtCOP(res.retefuente)}`;
        if (netoEl) netoEl.textContent = `+${fmtCOP(res.rendimientoNeto)}`;
        if (totalEl) totalEl.textContent = fmtCOP(res.totalAcumulado);
    };

    const renderCDTList = () => {
        const container = document.getElementById('cdt-list-container');
        if (!container) return;

        const list = loadCDTs();
        let totalCap = 0;
        let totalCausado = 0;
        let totalProyectado = 0;
        let totalWeightedRate = 0;
        let totalNextMonthEst = 0;
        let yieldsHtml = '';

        if (list.length === 0) {
            container.innerHTML = `<p style="text-align:center; font-size:12px; color:var(--text-muted); padding:14px 0;">Aún no tienes CDT ni CDAT registrados.</p>`;
        } else {
            const mappedHtml = list.map(item => {
                const status = typeof evaluateCDTStatus === 'function'
                    ? evaluateCDTStatus(item)
                    : { progresoPct: 0, diasRestantes: item.plazoDias, fechaVencimiento: '', estaVencido: false, rendimientoCausadoNeto: 0, proyeccionTotal: { rendimientoNeto: 0, totalAcumulado: item.capital } };

                if (item.estado !== 'liquidado') {
                    const cap = Number(item.capital) || 0;
                    totalCap += cap;
                    totalCausado += status.rendimientoCausadoNeto || 0;
                    totalProyectado += status.proyeccionTotal.rendimientoNeto || 0;
                    totalWeightedRate += cap * (Number(item.tasaEA) || 0);

                    // Estimar rendimientos a 30 días para "Estimado próx. mes"
                    if (typeof calculateCDTReturns === 'function' && !status.estaVencido) {
                        const next30 = calculateCDTReturns({ ...item, plazoDias: 30, periodicidad: 'vencimiento' });
                        totalNextMonthEst += next30.rendimientoNeto || 0;
                    }

                    const escItem = window.escapeHtml || ((s) => String(s ?? ''));
                yieldsHtml += `
                    <div style="background:var(--card-inner-bg); border:1px solid var(--border-color); border-radius:14px; padding:11px 12px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="display:block; font-size:12.5px; color:var(--text-main); margin-bottom:2px;">${escItem(item.entidad)}</strong>
                            <small style="font-size:10.5px; color:var(--text-muted); font-weight:600;">${escItem(item.tipo)} • ${status.progresoPct}% completado</small>
                        </div>
                        <strong style="color:var(--positive); font-size:13.5px; font-weight:800;">+${fmtCOP(status.rendimientoCausadoNeto)}</strong>
                    </div>
                `;
            }

            const esc = window.escapeHtml || ((s) => String(s ?? ''));
            const escA = window.escapeAttr || esc;
            const badgeStyle = item.tipo === 'CDT'
                ? 'background:rgba(99,102,241,0.14); color:#6366f1;'
                : 'background:rgba(14,165,233,0.14); color:#0ea5e9;';
            const tasaFormatted = esc(String(item.tasaEA).replace('.', ','));

            return `
                <div style="background:var(--card-inner-bg); border:1px solid var(--border-color); border-radius:14px; padding:11px 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                        <div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:10px; font-weight:800; padding:1px 7px; border-radius:99px; ${badgeStyle}">${esc(item.tipo)}</span>
                                <strong style="font-size:13px; color:var(--text-main);">${esc(item.entidad)}</strong>
                            </div>
                            <small style="font-size:11px; color:var(--text-muted);">${tasaFormatted}% E.A. • ${Number(item.plazoDias) || 0} días • Vence ${esc(status.fechaVencimiento)}</small>
                        </div>
                        <button type="button" data-del-cdt="${escA(item.id)}" style="background:transparent; border:none; color:var(--negative); font-size:11px; font-weight:700; cursor:pointer;">Eliminar</button>
                    </div>
                        <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                            <span style="color:var(--text-muted);">Capital: <b style="color:var(--text-main);">${fmtCOP(item.capital)}</b></span>
                            <span style="color:var(--positive); font-weight:800;">+${fmtCOP(status.proyeccionTotal.rendimientoNeto)} neto</span>
                        </div>
                        <div style="width:100%; height:6px; background:var(--bg-base); border-radius:99px; overflow:hidden; margin-bottom:4px;">
                            <div style="width:${status.progresoPct}%; height:100%; background:${status.estaVencido ? 'var(--positive)' : 'var(--accent)'}; border-radius:99px;"></div>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:10.5px; color:var(--text-muted);">
                            <span>Causado hoy: +${fmtCOP(status.rendimientoCausadoNeto)}</span>
                            <span>${status.estaVencido ? '¡Vencido!' : `Faltan ${status.diasRestantes} días (${status.progresoPct}%)`}</span>
                        </div>
                    </div>
                `;
            }).join('');
            container.innerHTML = mappedHtml;
        }

        // Llenar variables en el DOM principal
        const capEl = document.getElementById('cdt-total-capital');
        const netEl = document.getElementById('cdt-total-net-return');
        const projEl = document.getElementById('cdt-total-projected');
        if (capEl) capEl.textContent = fmtCOP(totalCap);
        if (netEl) netEl.textContent = `+${fmtCOP(totalCausado)}`;
        if (projEl) projEl.textContent = `+${fmtCOP(totalProyectado)}`;

        // Llenar variables en la vista de Rendimientos (Como en Bolsillos)
        const detEl = document.getElementById('cdt-yields-detail-total');
        const listEl = document.getElementById('cdt-yields-list');
        const avgRateEl = document.getElementById('cdt-avg-rate');
        const nextMonthEl = document.getElementById('cdt-next-month-est');
        
        const avgRate = totalCap > 0 ? (totalWeightedRate / totalCap).toFixed(2) : '0';
        
        if (detEl) detEl.textContent = `${fmtCOP(totalCausado)}`;
        if (avgRateEl) avgRateEl.textContent = `${avgRate.replace('.', ',')}% E.A.`;
        if (nextMonthEl) nextMonthEl.textContent = `+${fmtCOP(totalNextMonthEst)}`;
        if (listEl) listEl.innerHTML = yieldsHtml || '<p style="font-size:11px; color:var(--text-muted); text-align:center;">Aún no hay ganancias causadas.</p>';
        if (document.getElementById('cdt-chart-tooltip-val')) {
            document.getElementById('cdt-chart-tooltip-val').textContent = fmtCOP(totalCausado);
        }

        // Dibujar gráfica de barras con los últimos 6 meses reales
        const chartEl = document.getElementById('cdt-yields-chart');
        if (chartEl) {
            const refNow = typeof currentDate !== 'undefined' ? currentDate : new Date();
            const mNames = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(refNow.getFullYear(), refNow.getMonth() - i, 1);
                mNames.push(d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', ''));
            }
            const vals = [0, 0, 0, 0, 0, totalCausado];
            const maxV = Math.max(...vals, 1);

            chartEl.innerHTML = mNames.map((m, i) => {
                const h = Math.max(4, Math.round((vals[i] / maxV) * 60));
                const isLast = i === mNames.length - 1;
                return `
                    <div style="display:flex; flex-direction:column; align-items:center; gap:4px; flex:1;">
                        <div style="width:100%; max-width:24px; height:${h}px; background:${isLast ? 'var(--positive)' : 'color-mix(in srgb, var(--positive) 40%, transparent)'}; border-radius:4px 4px 0 0;"></div>
                        <span style="font-size:9px; font-weight:${isLast ? '800' : '600'}; color:${isLast ? 'var(--text-main)' : 'var(--text-muted)'}; text-transform:uppercase;">${m}</span>
                    </div>
                `;
            }).join('');
        }

        // Eventos para eliminar títulos con confirmación segura
        container.querySelectorAll('[data-del-cdt]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-del-cdt');
                const targetItem = loadCDTs().find(x => String(x.id) === String(id));
                const executeDel = () => {
                    saveCDTs(loadCDTs().filter(x => String(x.id) !== String(id)));
                    renderCDTList();
                    if (typeof updateLivePreview === 'function') updateLivePreview();
                    if (typeof updateDashboard === 'function') updateDashboard();
                };
                if (typeof window.openBentoConfirmModal === 'function') {
                    const escC = window.escapeHtml || ((s) => String(s ?? ''));
                    window.openBentoConfirmModal({
                        title: 'Eliminar título de Renta Fija',
                        subtitle: targetItem ? `${targetItem.tipo} • ${targetItem.entidad}` : 'CDT / CDAT',
                        message: `¿Confirmas que deseas eliminar este registro${targetItem ? ` de <b>${escC(targetItem.entidad)}</b>` : ''}? Recuerda registrar primero el ingreso en tu cuenta si ya venció.`,
                        confirmText: 'Sí, eliminar',
                        cancelText: 'Cancelar',
                        danger: true,
                        onConfirm: executeDel
                    });
                } else if (confirm('¿Eliminar este título CDT/CDAT?')) {
                    executeDel();
                }
            });
        });
    };

    const bindCDTEvents = () => {
        const modal = document.getElementById('cdt-modal');
        const openBtn = document.getElementById('drawer-cdt');
        const closeBtn = document.getElementById('close-cdt-modal-btn');
        const form = document.getElementById('cdt-form');
        const fechaInput = document.getElementById('cdt-fecha');

        if (!modal || modal.dataset.cdtBound === '1') return;
        modal.dataset.cdtBound = '1';

        if (fechaInput && !fechaInput.value) {
            fechaInput.value = getLocalDateISO();
        }

        openBtn?.addEventListener('click', () => {
            if (typeof closeSideDrawer === 'function') closeSideDrawer();
            if (typeof attemptCloseModals === 'function' && !attemptCloseModals()) return;
            
            document.getElementById('cdt-yields-view')?.classList.add('hidden');
            document.getElementById('cdt-main-view')?.classList.remove('hidden');
            
            modal.classList.remove('hidden');
            renderCDTList();
            if (typeof updateLivePreview === 'function') updateLivePreview();
        });

        closeBtn?.addEventListener('click', () => modal.classList.add('hidden'));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.add('hidden');
        });

        document.getElementById('btn-open-cdt-yields')?.addEventListener('click', () => {
            document.getElementById('cdt-main-view')?.classList.add('hidden');
            document.getElementById('cdt-yields-view')?.classList.remove('hidden');
            modal.querySelector('.modal-content')?.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById('btn-close-cdt-yields')?.addEventListener('click', () => {
            document.getElementById('cdt-yields-view')?.classList.add('hidden');
            document.getElementById('cdt-main-view')?.classList.remove('hidden');
        });

        // EVENTO DEL BOTÓN (?)
        document.getElementById('btn-help-cdt-yields')?.addEventListener('click', () => {
            alert('¿Cómo se calcula esto?\n\nEl "Ganancia total recibida" es el dinero que ya es tuyo matemáticamente a la fecha de hoy, basado en los días transcurridos desde que abriste cada título.\n\nLumen calcula el interés compuesto diario y le resta automáticamente la retención en la fuente (si aplica).');
        });

        document.querySelectorAll('.cdt-type-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                document.querySelectorAll('.cdt-type-pill').forEach(p => {
                    p.style.background = 'transparent';
                    p.style.color = 'var(--text-muted)';
                });
                pill.style.background = 'var(--accent)';
                pill.style.color = '#ffffff';
                const plazoEl = document.getElementById('cdt-plazo');
                if (pill.dataset.type === 'CDAT' && plazoEl && Number(plazoEl.value) === 90) plazoEl.value = 30;
                if (pill.dataset.type === 'CDT' && plazoEl && Number(plazoEl.value) < 30) plazoEl.value = 90;
                if (typeof updateLivePreview === 'function') updateLivePreview();
            });
        });

        document.querySelectorAll('.cdt-quick-days').forEach(btn => {
            btn.addEventListener('click', () => {
                const plazoEl = document.getElementById('cdt-plazo');
                if (plazoEl) plazoEl.value = btn.dataset.days;
                if (typeof updateLivePreview === 'function') updateLivePreview();
            });
        });

        ['input', 'change', 'keyup'].forEach(evt => {
            form?.addEventListener(evt, () => {
                if (typeof updateLivePreview === 'function') setTimeout(updateLivePreview, 0);
            });
        });

        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const capital = parseMoneyVal(document.getElementById('cdt-capital')?.value);
            const tasaEA = Math.max(0, Math.min(100, parseDecimalVal(document.getElementById('cdt-tasa')?.value)));
            const plazoDias = Math.max(1, Math.min(3650, Math.round(Number(document.getElementById('cdt-plazo')?.value) || 0)));
            const retefuentePct = Math.max(0, Math.min(50, parseDecimalVal(document.getElementById('cdt-retefuente')?.value)));

            if (capital <= 0) {
                alert('Ingresa un capital invertido mayor a $0.');
                return;
            }
            if (tasaEA <= 0) {
                alert('Ingresa una tasa Efectiva Anual (E.A.) válida.');
                return;
            }

            const tipo = document.querySelector('input[name="cdt-tipo"]:checked')?.value || 'CDT';
            const list = loadCDTs();
            list.unshift({
                id: 'cdt_' + Date.now(),
                tipo,
                entidad: (document.getElementById('cdt-entidad')?.value.trim() || 'Entidad').slice(0, 80),
                capital,
                tasaEA,
                plazoDias,
                baseDias: Number(document.getElementById('cdt-base')?.value) === 365 ? 365 : 360,
                retefuentePct,
                periodicidad: document.getElementById('cdt-periodicidad')?.value || 'vencimiento',
                fechaApertura: document.getElementById('cdt-fecha')?.value || getLocalDateISO(),
                estado: 'activo'
            });
            saveCDTs(list);
            form.reset();
            document.querySelectorAll('.cdt-type-pill').forEach(p => {
                const isDefault = p.dataset.type === 'CDT';
                p.style.background = isDefault ? 'var(--accent)' : 'transparent';
                p.style.color = isDefault ? '#ffffff' : 'var(--text-muted)';
            });
            if (fechaInput) fechaInput.value = getLocalDateISO();
            if (typeof updateLivePreview === 'function') updateLivePreview();
            renderCDTList();
            if (typeof updateDashboard === 'function') updateDashboard();
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindCDTEvents);
    } else {
        bindCDTEvents();
    }
})();

// ==========================================
// UI DEL ASISTENTE LOCAL LUMI (CON SUGERENCIAS CONTEXTUALES)
// ==========================================
let lastLumiContext = { key: 'home', at: 0 };

document.addEventListener('click', (e) => {
    const el = e.target.closest('#drawer-cards, #drawer-debts, #drawer-debt-planner, #drawer-salary, #menu-salary-btn, #drawer-tax, #menu-tax-params-btn, #drawer-budget, #nav-budget, #drawer-expenses, #drawer-cdt, #drawer-trip-mode');
    if (!el) return;
    const id = el.id;
    let ctx = 'home';
    if (id === 'drawer-cards') ctx = 'cards';
    else if (id === 'drawer-debts' || id === 'drawer-debt-planner') ctx = 'debts';
    else if (id === 'drawer-salary' || id === 'menu-salary-btn' || id === 'drawer-tax' || id === 'menu-tax-params-btn') ctx = 'salary';
    else if (id === 'drawer-budget' || id === 'nav-budget' || id === 'drawer-expenses') ctx = 'budget';
    else if (id === 'drawer-cdt') ctx = 'cdt';
    else if (id === 'drawer-trip-mode') ctx = 'trip';
    lastLumiContext = { key: ctx, at: Date.now() };
}, true);

const detectActiveLumiContext = () => {
    const isVis = (id) => {
        const el = document.getElementById(id);
        return !!(el && !el.classList.contains('hidden'));
    };
    if (isVis('cards-modal') || isVis('card-extra-info')) return 'cards';
    if (isVis('debts-modal') || isVis('debt-planner-modal') || isVis('debt-extra-info')) return 'debts';
    if (isVis('profile-salary-view') || isVis('profile-tax-params-view')) return 'salary';
    if (isVis('budget-modal') || isVis('expenses-modal')) return 'budget';
    if (isVis('cdt-modal')) return 'cdt';
    if (typeof financeData !== 'undefined' && financeData?.tripMode?.active) return 'trip';
    if (lastLumiContext.key !== 'home' && (Date.now() - lastLumiContext.at) < 120000) return lastLumiContext.key;
    return 'home';
};

const syncLumiContextualChips = () => {
    const ctx = detectActiveLumiContext();
    const hasActiveCdt = typeof getCDTPortfolioInsights === 'function' && getCDTPortfolioInsights().cantidadActivos > 0;
    const cdtDefaultQ = hasActiveCdt ? '¿Cómo van los rendimientos de mis CDTs?' : '¿Qué diferencia hay entre un CDT y CDAT?';

    const presets = {
        cards: {
            heading: 'Sugerencias para tus Tarjetas:',
            items: [
                { q: '¿Con qué tarjeta me conviene pagar hoy?', label: '¿Con qué tarjeta me conviene pagar hoy?' },
                { q: '¿Cuándo cortan mis tarjetas?', label: '¿Cuándo cortan y vencen mis tarjetas?' },
                { q: '¿Qué termino de pagar este mes?', label: '¿Qué cuotas termino de pagar este mes?' },
                { q: '¿Qué pasa si abono 500.000 a mi tarjeta?', label: '¿Qué pasa si abono $ 500.000 a mi tarjeta?' },
                { q: '¿Cuánto pago si difiero 600.000 a 6 cuotas?', label: '¿Cuánto pago si difiero $ 600.000 a 6 cuotas?' }
            ]
        },
        debts: {
            heading: 'Sugerencias para tus Deudas:',
            items: [
                { q: '¿Cómo hago mi plan de salida de deudas?', label: '¿Cómo hago mi plan de salida de deudas?' },
                { q: '¿Qué pasa si abono 1 millón a mi deuda?', label: '¿Qué pasa si abono $ 1 millón a mi deuda?' },
                { q: '¿Cómo está mi capacidad de endeudamiento?', label: '¿Cómo está mi capacidad de endeudamiento?' },
                { q: '¿Qué es el método avalancha?', label: '¿Qué es el método Avalancha?' },
                { q: '¿Qué termino de pagar este mes?', label: '¿Qué obligaciones termino de pagar este mes?' }
            ]
        },
        salary: {
            heading: 'Sugerencias de Nómina e Impuestos:',
            items: [
                { q: '¿Cómo va mi resumen de nómina?', label: '¿Cómo va mi resumen de nómina?' },
                { q: '¿Cuál es mi plan de pagos del mes?', label: '¿Cuál es mi plan de pagos del mes?' },
                { q: '¿Cuánto me descuentan de retefuente?', label: '¿Cuánto me descuentan de retefuente?' },
                { q: '¿Cuánto me llega de prima?', label: '¿Cuánto me llega de prima?' },
                { q: '¿Cómo evitar pagar el 4x1000?', label: '¿Cómo evitar pagar el 4x1000?' }
            ]
        },
        budget: {
            heading: 'Sugerencias para tu Presupuesto:',
            items: [
                { q: '¿Cómo voy con mi presupuesto?', label: '¿Cómo voy con mi presupuesto?' },
                { q: '¿En qué se me fue la plata este mes?', label: '¿En qué se me fue la plata este mes?' },
                { q: '¿Tengo gasto hormiga este mes?', label: '¿Tengo gasto hormiga este mes?' },
                { q: '¿Cómo voy comparado con el mes pasado?', label: '¿Cómo voy comparado con el mes pasado?' },
                { q: '¿Cómo voy a cerrar el mes?', label: '¿Cómo voy a cerrar el mes?' }
            ]
        },
        cdt: {
            heading: 'Sugerencias de Renta Fija (CDT / CDAT):',
            items: [
                { q: '¿Cómo van los rendimientos de mis CDTs?', label: '¿Cómo van los rendimientos de mis CDTs?' },
                { q: '¿Qué diferencia hay entre un CDT y CDAT?', label: '¿Qué diferencia hay entre un CDT y CDAT?' },
                { q: '¿Cómo liquidar un CDT vencido?', label: '¿Cómo liquidar un CDT vencido?' },
                { q: '¿Cuánto rinde un CDT de 5.000.000 al 10,5% a 180 días?', label: 'Simular CDT $ 5M al 10,5% a 180 días' },
                { q: '¿Cómo va mi patrimonio neto?', label: '¿Cómo va mi patrimonio neto?' }
            ]
        },
        trip: {
            heading: 'Sugerencias para tu Modo Viaje:',
            items: [
                { q: '¿Cómo va mi viaje activo?', label: '¿Cómo va el gasto de mi viaje activo?' },
                { q: '¿Con qué tarjeta me conviene pagar hoy?', label: '¿Con qué tarjeta me conviene pagar hoy?' },
                { q: '¿Me alcanza para comprar algo de 100.000?', label: '¿Me alcanza para un gusto de $ 100.000?' },
                { q: '¿Cuánto tengo ahorrado en bolsillos?', label: '¿Cuánto tengo ahorrado en bolsillos?' },
                { q: '¿Cómo va mi mapa de calor este mes?', label: '¿Cómo va mi mapa de calor este mes?' }
            ]
        },
        home: {
            heading: 'Prueba preguntarme:',
            items: [
                { q: '¿Me alcanza para comprar algo de 50.000?', label: '¿Me alcanza para comprar algo de $ 50.000?' },
                { q: '¿Con qué tarjeta me conviene pagar hoy?', label: '¿Con qué tarjeta me conviene pagar hoy?' },
                { q: cdtDefaultQ, label: cdtDefaultQ },
                { q: '¿En qué se me fue la plata este mes?', label: '¿En qué se me fue la plata este mes?' },
                { q: '¿Cómo va mi mapa de calor este mes?', label: '¿Cómo va mi mapa de calor este mes?' }
            ]
        }
    };

    const chosen = presets[ctx] || presets.home;
    const titleEl = document.querySelector('#lumen-suggestions-wrap .lumen-suggestions-title');
    if (titleEl) titleEl.textContent = chosen.heading;

    const btns = document.querySelectorAll('#lumen-suggestions-wrap .lumen-chip-btn');
    btns.forEach((btn, idx) => {
        const item = chosen.items[idx];
        if (!item) return;
        btn.setAttribute('data-q', item.q);
        const labelSpan = btn.querySelector('span:last-child');
        if (labelSpan) labelSpan.textContent = item.label;
    });
};

window.openLumenAssistant = () => {
    const box = document.getElementById('lumen-assistant-response');
    
    if (box) {
        let firstName = '';
        try {
            const rawAuth = JSON.parse(localStorage.getItem('myFinancesAuth') || 'null');
            if (rawAuth && rawAuth.name) {
                firstName = String(rawAuth.name).trim().split(/\s+/)[0];
            }
        } catch (e) {}
        
        const safeFirst = window.escapeHtml ? window.escapeHtml(firstName) : firstName;
        const hello = safeFirst ? `¡Hola, ${safeFirst}!` : '¡Hola!';
        
        box.innerHTML = `
            <strong style="display:block; font-size:15px; font-weight:800; color:var(--text-main); margin-bottom:6px; letter-spacing:-0.2px;">
                ${hello} Soy Lumi, tu copiloto financiero.
            </strong>
            <span style="color:var(--text-muted); display:block; font-size:13px; line-height:1.48;">
                Estoy aquí para ayudarte a tomar decisiones tranquilas con tu plata, sin enredos ni regaños. Puedes preguntarme si te alcanza para un gusto, qué tarjeta te conviene usar hoy, cómo va el mapa de calor de tus gastos o quién te debe plata.
            </span>
        `;
    }

    if (typeof syncLumiContextualChips === 'function') {
    syncLumiContextualChips();
}
    document.getElementById('lumen-suggestions-wrap')?.classList.remove('is-compact');

    document.getElementById('lumen-assistant-modal')?.classList.remove('hidden');
    setTimeout(() => document.getElementById('lumen-assistant-input')?.focus(), 150);
};
const lumiFabBtn = document.getElementById('btn-open-lumi');
if (lumiFabBtn && !lumiFabBtn.dataset.lumiBound) {
    lumiFabBtn.dataset.lumiBound = '1';
    lumiFabBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof window.openLumenAssistant === 'function') {
            window.openLumenAssistant();
        }
    });
}

let lumiReplyTimer = null;

document.getElementById('close-lumen-assistant-btn')?.addEventListener('click', () => {
    if (lumiReplyTimer) { clearTimeout(lumiReplyTimer); lumiReplyTimer = null; }
    document.getElementById('btn-open-lumi')?.classList.remove('lumi-thinking');
    document.getElementById('lumen-assistant-modal')?.classList.add('hidden');
    
    // Limpiar también lo que el usuario haya dejado escrito en la caja de texto
    const input = document.getElementById('lumen-assistant-input');
    if (input) input.value = '';
});

const renderAssistantReply = (question) => {
    if (typeof window.askLumi !== 'function') return;
    const res = window.askLumi(question);
    const box = document.getElementById('lumen-assistant-response');
    if (box) {
        box.innerHTML = `
            <strong style="display:block; color:var(--accent); font-size:13px; margin-bottom:5px;">${res.title}</strong>
            <div>${res.answer}</div>
        `;
    }
    document.getElementById('lumen-suggestions-wrap')?.classList.add('is-compact');
};

document.getElementById('lumen-assistant-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('lumen-assistant-input');
    const box = document.getElementById('lumen-assistant-response');
    const fabBtn = document.getElementById('btn-open-lumi');
    
    if (!input || !input.value.trim()) return;
    const question = input.value;
    input.value = ''; 

    if (lumiReplyTimer) clearTimeout(lumiReplyTimer);

    if (box) {
        box.innerHTML = `
            <div class="lumi-thinking" style="display:flex; align-items:center; gap:8px; color:var(--accent); font-weight:800; font-size:13px; padding:8px 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
                <span>Lumi está analizando tus datos...</span>
            </div>
        `;
    }
    
    if (fabBtn) fabBtn.classList.add('lumi-thinking');

    lumiReplyTimer = setTimeout(() => {
        lumiReplyTimer = null;
        if (fabBtn) fabBtn.classList.remove('lumi-thinking');
        renderAssistantReply(question);
    }, 800); 
});

document.querySelectorAll('.lumen-chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-q');
        const box = document.getElementById('lumen-assistant-response');
        if (!q || !box) return;

        if (lumiReplyTimer) clearTimeout(lumiReplyTimer);

        box.innerHTML = `
            <div class="lumi-thinking" style="display:flex; align-items:center; gap:8px; color:var(--accent); font-weight:800; font-size:13px; padding:8px 0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                </svg>
                <span>Lumi está analizando tus datos...</span>
            </div>
        `;

        lumiReplyTimer = setTimeout(() => {
            lumiReplyTimer = null;
            renderAssistantReply(q);
        }, 600);
    });
});

// (#btn-open-lumi gestionado centralmente en el Enrutador Global Unico)

// --- GUARDADO DE COLOR MODO VIAJE (BENTO GRID) ---
document.addEventListener('click', (e) => {
    const tripBtn = e.target.closest('.trip-color-btn');
    if (tripBtn) {
        // Evitamos que el evento suba y dispare otros cambios de color de la app
        e.stopPropagation(); 
        
        if (!financeData.preferences) financeData.preferences = {};
        financeData.preferences.tripTheme = tripBtn.getAttribute('data-trip-color');
        localStorage.setItem('myFinances', JSON.stringify(financeData));
        
        document.querySelectorAll('.trip-color-btn').forEach(b => b.classList.remove('active'));
        tripBtn.classList.add('active');
        
        // SOLO cambiar el color si el modo viaje está prendido AHORA MISMO
        if (financeData.tripMode && financeData.tripMode.active && typeof applyThemeUI === 'function') {
            applyThemeUI();
        }
    }
});
// --- RESET AUTOMÁTICO DE SCROLL AL ABRIR CUALQUIER MODAL O SUBVISTA ---
const resetModalScrollPosition = (rootEl) => {
    if (!rootEl) return;
    rootEl.scrollTop = 0;
    rootEl.querySelectorAll('.modal-content, .budget-scroll-body, .profile-body, .profile-menu-list, .bento-picker-scroll, [style*="overflow-y"]').forEach(sc => {
        sc.scrollTop = 0;
    });
};

const modalScrollObserver = new MutationObserver((mutations) => {
    mutations.forEach((m) => {
        const target = m.target;
        if (target && target.nodeType === 1 && !target.classList.contains('hidden')) {
            if (target.classList.contains('modal') || target.classList.contains('profile-body')) {
                resetModalScrollPosition(target);
                requestAnimationFrame(() => resetModalScrollPosition(target));
            }
        }
    });
});

document.querySelectorAll('.modal, .profile-body').forEach(el => {
    modalScrollObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
});
// ==========================================
// NOTIFICACIONES LOCALES NATIVAS (PANTALLA BLOQUEADA Y CENTRO DE NOTIF.)
// ==========================================
window.syncNativeLocalNotifications = async () => {
    if (!window.Capacitor?.isNativePlatform?.()) return;
    const LocalNotifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!LocalNotifications) return;

    try {
        // 1. Verificar o pedir permiso al usuario (Android 13+)
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display === 'prompt') {
            perm = await LocalNotifications.requestPermissions();
        }
        if (perm.display !== 'granted') return;

        // 2. Crear canal de alta prioridad (banner flotante + pantalla bloqueada)
        await LocalNotifications.createChannel({
            id: 'lumen_alerts_v1',
            name: 'Recordatorios Financieros',
            description: 'Alertas de tarjetas, pagos recurrentes y CDTs',
            importance: 4,
            visibility: 1
        }).catch(() => {});

        // 3. Limpiar notificaciones programadas previas para no duplicar
        const pendingList = await LocalNotifications.getPending();
        if (pendingList?.notifications?.length > 0) {
            await LocalNotifications.cancel({ notifications: pendingList.notifications });
        }

        const prefs = getNotificationPrefs();
        const hideAmounts = localStorage.getItem('myFinancesPrivacyMode') === 'true';
        const now = new Date();
        const currSnap = computeBalancesUpTo(getMonthId(now));
        const toSchedule = [];
        let notifId = 1001;

        const addReminder = (title, body, targetDate) => {
            const fireDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 8, 30, 0);
            if (fireDate <= now) return; // Solo programar fechas futuras
            toSchedule.push({
                id: notifId++,
                title,
                body,
                channelId: 'lumen_alerts_v1',
                schedule: { at: fireDate, allowWhileIdle: true },
                smallIcon: 'ic_launcher'
            });
        };

        // A. Tarjetas de Crédito y Préstamos con ciclo pendiente (aviso X días antes del pago)
        (financeData.customAccounts || []).filter(a => (a.category === 'credit_card' || (a.category === 'debt' && !a.payrollDeduction)) && a.paymentDay).forEach(acc => {
            const bal = round2(currSnap.bals[acc.id] || 0);
            const nextDue = typeof getNextUnpaidLiabilityCycle === 'function'
                ? getNextUnpaidLiabilityCycle(acc, bal, now, 0)
                : null;
            if (!nextDue || nextDue.amount <= 0) return;

            const alertDate = new Date(nextDue.dueDate.getFullYear(), nextDue.dueDate.getMonth(), nextDue.dueDate.getDate());
            alertDate.setDate(alertDate.getDate() - (prefs.daysBefore || 3));

            const cleanName = stripLeadingEmoji(acc.name);
            const isCard = acc.category === 'credit_card';
            const titleLabel = isCard
                ? (/^(tc\b|tarjeta\b)/i.test(cleanName) ? `Pago ${cleanName}` : `Pago Tarjeta ${cleanName}`)
                : `Cuota ${cleanName}`;
            const amtText = hideAmounts
                ? 'Revisa el detalle en Lumen.'
                : `${isCard ? 'Pago mín. estimado' : 'Cuota estimada'}: ${formatMoney(nextDue.amount)}.`;
            addReminder(titleLabel, `Vence el ${nextDue.dueDate.getDate()} de ${getShortMonthLabel(nextDue.dueDate).toLowerCase()}. ${amtText}`, alertDate);
        });

        // B. Pagos recurrentes activos
        (financeData.subscriptions || []).filter(s => s.status === 'active' && s.nextBillingDate).forEach(sub => {
            const [y, m, d] = sub.nextBillingDate.split('-').map(Number);
            const alertDate = new Date(y, m - 1, d - (sub.reminderDays || 2));
            const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount);
            const amtText = hideAmounts ? 'Cobro próximo programado.' : `Monto: ${formatMoney(amtCop)}.`;
            addReminder(`Pago recurrente: ${stripLeadingEmoji(sub.name)}`, `Se cobra el ${sub.nextBillingDate}. ${amtText}`, alertDate);
        });

        // B2. Cuota de manejo en cuentas bancarias (ahorros / corriente)
        if (typeof evaluateAccountMgmtFeeCycle === 'function') {
            const mNowId = getMonthId(now);
            const mNextId = getMonthId(new Date(now.getFullYear(), now.getMonth() + 1, 1));
            (financeData.customAccounts || []).filter(a => isAccountMgmtFeeEligible(a) && a.hasMgmtFee).forEach(acc => {
                [mNowId, mNextId].forEach(mId => {
                    const st = evaluateAccountMgmtFeeCycle(acc, mId, currSnap, now);
                    if (!st.enabled || st.status !== 'pending' || !st.dueDate) return;
                    const alertDate = new Date(st.dueDate.getFullYear(), st.dueDate.getMonth(), st.dueDate.getDate());
                    alertDate.setDate(alertDate.getDate() - (prefs.daysBefore || 2));
                    const amtText = hideAmounts ? 'Revisa el detalle en Lumen.' : `Valor: ${formatMoney(st.amount)}.`;
                    addReminder(`Cuota de manejo: ${stripLeadingEmoji(acc.name)}`, `Cobro programado el día ${st.day}. ${amtText}`, alertDate);
                });
            });
        }

        // C. Vencimientos de CDT / CDAT
        if (typeof getCDTPortfolioInsights === 'function') {
            const cdtInfo = getCDTPortfolioInsights(now);
            (cdtInfo.titulos || []).forEach(t => {
                if (!t.status.estaVencido && t.status.fechaVencimiento) {
                    const [vy, vm, vd] = t.status.fechaVencimiento.split('-').map(Number);
                    const matDate = new Date(vy, vm - 1, vd);
                    const amtText = hideAmounts ? 'Tu título cumple su plazo hoy.' : `Total neto a recibir: ${formatMoney(t.status.proyeccionTotal.totalAcumulado)}.`;
                    addReminder(`Vencimiento ${t.tipo} ${t.entidad}`, amtText, matDate);
                }
            });
        }

        if (toSchedule.length > 0) {
            await LocalNotifications.schedule({ notifications: toSchedule });
        }
    } catch (err) {
        console.warn('No se pudieron programar notificaciones locales:', err);
    }
};
// ============================================================================
// PLANIFICADOR INTELIGENTE POR QUINCENA (TIP DE LUMI 1Q VS 2Q EN MODALES)
// ============================================================================
(() => {
    if (document.getElementById('lumi-quincena-tip-styles')) return;
    const st = document.createElement('style');
    st.id = 'lumi-quincena-tip-styles';
    st.textContent = `
        .lumi-quincena-tip {
            background: color-mix(in srgb, var(--accent) 8%, var(--card-inner-bg));
            border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--border-color));
            border-left: 3.5px solid var(--accent);
            border-radius: 14px;
            padding: 10px 12px;
            margin-bottom: 14px;
            font-size: 11.5px;
            line-height: 1.42;
            color: var(--text-main);
        }
        .lumi-quincena-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            font-weight: 800;
            font-size: 12px;
            color: var(--accent);
            margin-bottom: 5px;
        }
        .lumi-quincena-badge {
            font-size: 10px;
            font-weight: 800;
            padding: 2px 8px;
            border-radius: 99px;
            background: color-mix(in srgb, var(--accent) 16%, transparent);
            color: var(--accent);
            white-space: nowrap;
        }
        .lumi-quincena-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
            margin-top: 8px;
        }
        .lumi-q-pill {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 10px;
            padding: 6px 9px;
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        .lumi-q-pill.recommended {
            border-color: color-mix(in srgb, var(--accent) 45%, var(--border-color));
            background: color-mix(in srgb, var(--accent) 5%, var(--card-bg));
        }
        .lumi-q-pill span {
            font-size: 10px;
            font-weight: 700;
            color: var(--text-muted);
        }
        .lumi-q-pill strong {
            font-size: 12px;
            font-weight: 800;
        }
    `;
    document.head.appendChild(st);
})();

window.getQuincenaPlanSummary = (extraAmount = 0, extraDay = null, splitBothQuincenas = false, options = {}) => {
    let salCfg = {};
    try { salCfg = JSON.parse(localStorage.getItem('myFinancesSalary') || '{}'); } catch {}

    const savedFreq = String(salCfg.frequency || '').toLowerCase().trim();
    const domFreq = String(document.getElementById('profile-pay-frequency')?.value || '').toLowerCase().trim();
    const activeFreq = savedFreq || domFreq;
    const isExplicitMonthly = activeFreq === 'monthly' || activeFreq === 'mensual' || salCfg.isBiweekly === false;
    const isExplicitBiweekly = activeFreq === 'biweekly' || activeFreq === 'quincenal' || activeFreq === 'semi-monthly' || salCfg.isBiweekly === true;

    const rawDays = String(salCfg.payDays || salCfg.paymentDays || '');
    const nums = (rawDays.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 31);
    const isDynamicSingleMode = ['antepenultimate', 'penultimate', 'last'].includes(String(salCfg.payDay || ''));
    const isMonthly = isExplicitMonthly || (!isExplicitBiweekly && (nums.length === 1 || (isDynamicSingleMode && !activeFreq)));

    const refNow = new Date();
    const currMonthIdPre = getMonthId(refNow);
    const targetEvalMId = options.targetMonthId || currMonthIdPre;
    const [evY, evM] = /^\d{4}-\d{2}$/.test(targetEvalMId)
        ? targetEvalMId.split('-').map(Number)
        : [refNow.getFullYear(), refNow.getMonth() + 1];

    const resolvedDays = typeof window.getResolvedSalaryPayDays === 'function'
        ? window.getResolvedSalaryPayDays({ ...salCfg, frequency: isMonthly ? 'monthly' : 'biweekly' }, evY, evM - 1)
        : (isMonthly ? [nums[0] || Number(salCfg.payDay) || 30] : [nums[0] || 15, nums[1] || 30]);

    const d1 = resolvedDays[0] || 15;
    const d2 = resolvedDays[1] || 30;
    const payDayMonthly = resolvedDays[0] || 30;

    let netMonthlyBase = 0;
    let baseQ1 = 0, baseQ2 = 0;
    if (typeof calculateLaborMetrics === 'function' && Object.keys(salCfg).length > 0) {
        const m = calculateLaborMetrics(salCfg, refNow);
        if (m && m.net > 0) {
            netMonthlyBase = round2(m.net);
            baseQ1 = round2(m.net1Q ?? (netMonthlyBase / 2));
            baseQ2 = round2(m.net2Q ?? (netMonthlyBase - baseQ1));
        }
    }
    if (!netMonthlyBase) {
        const payrollTxs = (financeData.transactions || [])
            .filter(t => !t.isDeleted && t.type === 'income' && /salario|n[oó]mina|quincena/i.test(`${t.category || ''} ${t.description || ''}`))
            .slice(-4);
        if (payrollTxs.length > 0) {
            const avg = round2(payrollTxs.reduce((s, t) => s + round2(t.amount || 0), 0) / payrollTxs.length);
            netMonthlyBase = isMonthly ? avg : round2(avg * 2);
            baseQ1 = round2(netMonthlyBase / 2);
            baseQ2 = round2(netMonthlyBase - baseQ1);
        }
    }

    const currMonthId = getMonthId(refNow);
    const evalMonthId = options.targetMonthId || currMonthId;
    const applyCurrentMonthContext = !!(options.deductCurrentAdvances && evalMonthId === currMonthId);

    let monthAdvances = 0;
    let adv1Q = 0, adv2Q = 0;
    if (applyCurrentMonthContext) {
        (financeData.transactions || []).forEach(t => {
            if (!t.isDeleted && getTxMonthId(t) === currMonthId && t.type === 'income' && stripLeadingEmoji(t.category || '') === 'Salario / Nómina' && t.subcategory === 'Anticipo' && t.status !== 'pending') {
                const amt = round2(t.amount || 0);
                monthAdvances = round2(monthAdvances + amt);
                const txDay = new Date(Number(t.id) || Date.now()).getDate();
                if (txDay <= d1) adv1Q = round2(adv1Q + amt);
                else adv2Q = round2(adv2Q + amt);
            }
        });
    }

    const effectiveMonthly = Math.max(0, round2(netMonthlyBase - monthAdvances));
    const rawQ1 = round2(baseQ1 - adv1Q);
    const rawQ2 = round2(baseQ2 - adv2Q);
    const q1Income = Math.max(0, rawQ1 < 0 ? 0 : (rawQ2 < 0 ? round2(rawQ1 + rawQ2) : rawQ1));
    const q2Income = Math.max(0, rawQ1 < 0 ? round2(rawQ2 + rawQ1) : rawQ2);

    const classifyDayToQuincena = (dayNum) => {
        const day = Math.max(1, Math.min(31, Number(dayNum) || 1));
        return (day >= d1 && day < d2) ? '1Q' : '2Q';
    };

    let q1Committed = 0;
    let q2Committed = 0;
    const currSnap = computeBalancesUpTo(currMonthId);

    const addCommitment = (day, amt) => {
        if (amt <= 0) return;
        if (classifyDayToQuincena(day) === '1Q') q1Committed = round2(q1Committed + amt);
        else q2Committed = round2(q2Committed + amt);
    };

    // 1. Suscripciones activas (excluye las ya pagadas este mes cuando se evalúa un gasto puntual del mes)
    (financeData.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
        if (applyCurrentMonthContext && typeof isRecurringPaidInMonth === 'function' && isRecurringPaidInMonth(sub, currMonthId)) {
            return;
        }
        const nextDate = String(sub.nextBillingDate || '');
        const isDueThisMonth = !nextDate || nextDate.startsWith(currMonthId) || sub.cycle === 'monthly' || sub.cycle === 'weekly';
        if (!isDueThisMonth) return;

        const day = nextDate ? Number(nextDate.split('-')[2]) : 1;
        const mult = sub.cycle === 'weekly' ? 4 : 1;
        const amtCop = typeof getRecurringAmountInCOP === 'function' ? getRecurringAmountInCOP(sub) : round2(sub.amount || 0);
        addCommitment(day, round2(amtCop * mult));
    });

    // 2. Gastos pendientes del mes actual (excluye el movimiento en edición para no duplicarlo)
    (financeData.transactions || []).filter(t => !t.isDeleted && (!options.excludeTxId || String(t.id) !== String(options.excludeTxId)) && t.type === 'expense' && t.status === 'pending' && getTxMonthId(t) === currMonthId).forEach(tx => {
        addCommitment(new Date(tx.id).getDate(), round2(tx.budgetedAmount || tx.amount || 0));
    });

    // 3. Cuotas de Tarjetas de Crédito
    const maxDaysRef = new Date(refNow.getFullYear(), refNow.getMonth() + 1, 0).getDate();
    (financeData.customAccounts || []).filter(a => a.category === 'credit_card' && a.paymentDay).forEach(c => {
        const bal = round2(currSnap.bals[c.id] || 0);
        if (bal > 0) {
            if (applyCurrentMonthContext && typeof getLiabilityDueCycleState === 'function') {
                const dueThisM = new Date(refNow.getFullYear(), refNow.getMonth(), Math.min(c.paymentDay, maxDaysRef), 12, 0, 0);
                const st = getLiabilityDueCycleState(c, bal, dueThisM, refNow);
                if (st.isPaid) return;
                addCommitment(c.paymentDay, round2(st.remainingQuota));
            } else {
                const est = calculateCardMinPaymentEstimate(c, bal);
                addCommitment(c.paymentDay, round2(est.totalMinPayment || 0));
            }
        }
    });

    // 4. Cuotas de Préstamos activos (no libranza)
    (financeData.customAccounts || []).filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
        const bal = round2(currSnap.bals[d.id] || 0);
        if (bal > 0) {
            const targetDay = Number(d.paymentDay) || d2;
            if (applyCurrentMonthContext && d.paymentDay && typeof getLiabilityDueCycleState === 'function') {
                const dueThisM = new Date(refNow.getFullYear(), refNow.getMonth(), Math.min(d.paymentDay, maxDaysRef), 12, 0, 0);
                const st = getLiabilityDueCycleState(d, bal, dueThisM, refNow);
                if (st.isPaid) return;
                addCommitment(targetDay, round2(st.remainingQuota));
            } else {
                const qInfo = typeof getDebtMonthlyQuotaBreakdown === 'function'
                    ? getDebtMonthlyQuotaBreakdown(d, bal)
                    : { totalQuota: round2(d.debtMonthlyPayment || 0) };
                addCommitment(targetDay, round2(qInfo.totalQuota || 0));
            }
        }
    });

    if (isMonthly) {
        const monthlyCommitted = round2(q1Committed + q2Committed + (extraAmount > 0 ? extraAmount : 0));
        return {
            isMonthly: true,
            payDayMonthly,
            baseMonthlyIncome: netMonthlyBase,
            monthAdvances,
            isStructuralPlan: !options.deductCurrentAdvances,
            monthlyIncome: effectiveMonthly,
            monthlyCommitted,
            monthlyFree: round2(effectiveMonthly - monthlyCommitted),
            targetQ: 'Mes',
            splitBothQuincenas: false
        };
    }

    const targetQ = extraDay ? classifyDayToQuincena(extraDay) : (q1Income - q1Committed >= q2Income - q2Committed ? '1Q' : '2Q');
    if (extraAmount > 0) {
        if (splitBothQuincenas) {
            const half = round2(extraAmount / 2);
            q1Committed = round2(q1Committed + half);
            q2Committed = round2(q2Committed + half);
        } else if (targetQ === '1Q') {
            q1Committed = round2(q1Committed + extraAmount);
        } else {
            q2Committed = round2(q2Committed + extraAmount);
        }
    }

    return {
        isMonthly: false,
        d1, d2,
        baseMonthlyIncome: netMonthlyBase,
        monthAdvances,
        isStructuralPlan: !options.deductCurrentAdvances,
        q1Income, q2Income, q1Committed, q2Committed,
        q1Free: round2(q1Income - q1Committed),
        q2Free: round2(q2Income - q2Committed),
        targetQ,
        splitBothQuincenas
    };
};

window.buildLumiQuincenaTipHTML = ({ plan, label = '', payDay = null, amount = 0, customNote = '' }) => {
    const sparkleSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`;
    const safeLabel = window.escapeHtml ? window.escapeHtml(stripLeadingEmoji(label)) : stripLeadingEmoji(label);
    const hasAdvanceApplied = (plan.monthAdvances || 0) > 0;

    // MODO NÓMINA MENSUAL
    if (plan.isMonthly) {
        const netLabelTitle = hasAdvanceApplied
            ? 'Neto por Recibir'
            : (plan.isStructuralPlan ? 'Neto Base Mes' : 'Neto Mensual');
        const netTermInText = hasAdvanceApplied ? 'neto restante a recibir' : 'neto mensual';

        let advice = customNote;
        if (!advice) {
            advice = payDay
                ? `Con fecha de pago el <b>día ${payDay}</b>, este compromiso se cubre con tu nómina mensual (día ${plan.payDayMonthly}).`
                : `Este presupuesto${amount > 0 ? ` (${formatMoney(amount)})` : ''} se integra directamente a tu flujo neto mensual.`;
        }
        if (hasAdvanceApplied) {
            advice += ` <span style="color:var(--text-muted);">(Base ${formatCompact(plan.baseMonthlyIncome)} − ${formatCompact(plan.monthAdvances)} anticipo).</span>`;
        }
        if ((plan.monthlyIncome > 0 || hasAdvanceApplied) && plan.monthlyFree < 0) {
            advice += ` <span style="color:var(--negative); font-weight:700;">Atención:</span> con este monto tus compromisos pendientes superan tu ${netTermInText} por <b>${formatMoney(Math.abs(plan.monthlyFree))}</b>.`;
        } else if (plan.monthlyIncome > 0 && payDay) {
            advice += ` Te queda un saldito libre proyectado de <b>${formatMoney(plan.monthlyFree)}</b>.`;
        }

        const pillsHtml = (plan.monthlyIncome > 0 || hasAdvanceApplied) ? `
            <div class="lumi-quincena-grid">
                <div class="lumi-q-pill">
                    <span>${netLabelTitle}</span>
                    <strong style="color:var(--text-main);">${formatMoney(plan.monthlyIncome)}</strong>
                </div>
                <div class="lumi-q-pill recommended">
                    <span>Neto Libre Mes</span>
                    <strong style="color:${plan.monthlyFree >= 0 ? 'var(--positive)' : 'var(--negative)'};">${formatMoney(plan.monthlyFree)}</strong>
                </div>
            </div>` : '';

        return `
            <div class="lumi-quincena-tip">
                <div class="lumi-quincena-header">
                    <span style="display:inline-flex; align-items:center; gap:5px;">${sparkleSvg} Tip de Lumi • Plan Mensual</span>
                    <span class="lumi-quincena-badge">Nómina Mensual</span>
                </div>
                <div>${safeLabel ? `<b>${safeLabel}:</b> ` : ''}${advice}</div>
                ${pillsHtml}
            </div>`;
    }

    // MODO NÓMINA QUINCENAL (1Q / 2Q)
    const is1Q = plan.targetQ === '1Q';
    const chosenFree = is1Q ? plan.q1Free : plan.q2Free;
    const otherFree = is1Q ? plan.q2Free : plan.q1Free;
    const otherQName = is1Q ? `2Q (día ${plan.d2})` : `1Q (día ${plan.d1})`;
    const badgeLabel = plan.splitBothQuincenas ? '1Q y 2Q' : `Usar ${plan.targetQ}`;

    let advice = customNote;
    if (!advice) {
        if (payDay) {
            advice = is1Q
                ? `Como el pago es el <b>día ${payDay}</b> (antes de fin de mes), cúbrelo con tu <b>1Q</b> para respetar la fecha límite.`
                : `Como el pago es el <b>día ${payDay}</b> (antes del pago del día ${plan.d1}), resérvalo desde tu <b>2Q</b> para no violar el corte.`;
        } else {
            advice = `Tu <b>${plan.targetQ}</b> tiene más holgura para asumir este presupuesto${amount > 0 ? ` (${formatMoney(amount)})` : ''}. Si prefieres equilibrar el mes, puedes dividirlo en <b>${formatMoney(round2(amount / 2))}</b> por quincena.`;
        }
    }
    if (hasAdvanceApplied) {
        advice += ` <span style="color:var(--text-muted);">(Incluye descuento de ${formatCompact(plan.monthAdvances)} en anticipos).</span>`;
    }

    if ((plan.q1Income > 0 || plan.q2Income > 0) && chosenFree < 0 && otherFree > Math.abs(chosenFree) && !plan.splitBothQuincenas) {
        advice += ` <span style="color:var(--negative); font-weight:700;">Atención:</span> esta quincena queda en déficit; si puedes elegir fecha, muévelo a la <b>${otherQName}</b>.`;
    } else if ((plan.q1Income > 0 || plan.q2Income > 0) && chosenFree >= 0 && payDay) {
        advice += ` Te queda un saldito libre proyectado de <b>${formatMoney(chosenFree)}</b>.`;
    }

    const pillsHtml = (plan.q1Income > 0 || plan.q2Income > 0 || hasAdvanceApplied) ? `
        <div class="lumi-quincena-grid">
            <div class="lumi-q-pill ${is1Q || plan.splitBothQuincenas ? 'recommended' : ''}">
                <span>1Q (Día ${plan.d1}) Libre</span>
                <strong style="color:${plan.q1Free >= 0 ? 'var(--positive)' : 'var(--negative)'};">${formatMoney(plan.q1Free)}</strong>
            </div>
            <div class="lumi-q-pill ${!is1Q || plan.splitBothQuincenas ? 'recommended' : ''}">
                <span>2Q (Día ${plan.d2}) Libre</span>
                <strong style="color:${plan.q2Free >= 0 ? 'var(--positive)' : 'var(--negative)'};">${formatMoney(plan.q2Free)}</strong>
            </div>
        </div>` : '';

    return `
        <div class="lumi-quincena-tip">
            <div class="lumi-quincena-header">
                <span style="display:inline-flex; align-items:center; gap:5px;">${sparkleSvg} Tip de Lumi • Plan Quincenal</span>
                <span class="lumi-quincena-badge">${badgeLabel}</span>
            </div>
            <div>${safeLabel ? `<b>${safeLabel}:</b> ` : ''}${advice}</div>
            ${pillsHtml}
        </div>`;
};

// 1B. Tip de Lumi en Transferencia hacia Tarjetas de Crédito o Préstamos (Auditado)
window.renderLumiDebtPaymentTipTx = () => {
    const box = document.getElementById('lumi-quincena-tip-tx');
    if (!box) return;

    const editId = document.getElementById('edit-id')?.value || '';
    const fromAccId = document.getElementById('account')?.value || '';
    const toAccId = document.getElementById('to-account')?.value || '';
    if (editId || !toAccId || String(fromAccId) === String(toAccId)) {
        box.innerHTML = '';
        return;
    }

    const toAcc = (financeData.customAccounts || []).find(a => String(a.id) === String(toAccId));
    if (!toAcc || (toAcc.category !== 'credit_card' && toAcc.category !== 'debt')) {
        box.innerHTML = '';
        return;
    }

    const dateVal = document.getElementById('trans-date')?.value || '';
    const refDate = /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? new Date(`${dateVal}T12:00:00`) : new Date(currentDate);
    const refMonthId = typeof getMonthId === 'function' ? getMonthId(refDate) : '';
    const liveSnap = (refMonthId && typeof computeBalancesUpTo === 'function')
        ? computeBalancesUpTo(refMonthId)
        : { bals: currentBalances || {} };
    const curBal = Math.max(0, round2(liveSnap.bals[toAcc.id] || 0));

    if (curBal <= 0.01) {
        box.innerHTML = '';
        return;
    }

    const payMode = document.getElementById('transfer-payment-mode')?.value || 'installments';
    const isExtraMode = payMode === 'extraordinary';
    const isLibranza = toAcc.category === 'debt' && !!toAcc.payrollDeduction;
    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    const escA = window.escapeAttr || esc;
    const cleanName = stripLeadingEmoji(toAcc.name || 'Deuda');
    const safeName = esc(cleanName);
    const fmtShortPay = (dt) => `${dt.getDate()} ${getShortMonthLabel(dt).toLowerCase()}.`;

    let badgeLabel = 'Ciclo actual';
    let isCyclePaid = false;
    let suggestedMin = 0;
    let minExtraCharges = 0;
    let totalPayoff = curBal;
    let totalExtraCharges = 0;
    let paidSoFar = 0;
    let dueCycleTxIds = [];
    let allPendingTxIds = [];
    const parts = [];

    if (toAcc.category === 'credit_card') {
        const activeCyc = typeof getCardActivePayCycle === 'function' ? getCardActivePayCycle(toAcc, refDate) : null;
        const payDt = activeCyc?.activePayDate || null;
        const cutRef = activeCyc?.activeCutDate || refDate;
        const est = typeof calculateCardMinPaymentEstimate === 'function'
            ? calculateCardMinPaymentEstimate(toAcc, curBal, cutRef)
            : { totalMinPayment: 0 };
        const cycSt = (payDt && typeof getLiabilityDueCycleState === 'function')
            ? getLiabilityDueCycleState(toAcc, curBal, payDt, refDate)
            : null;

        const allPending = typeof getPendingCardPurchases === 'function' ? getPendingCardPurchases(toAcc.id, refDate) : [];
        allPendingTxIds = allPending.map(p => String(p.tx.id));
        dueCycleTxIds = allPending.filter(p => p.isDueInActiveCycle !== false).map(p => String(p.tx.id));

        isCyclePaid = !!(cycSt && cycSt.isPaid);
        paidSoFar = cycSt ? round2(cycSt.paidAmount || 0) : 0;
        suggestedMin = cycSt ? round2(cycSt.remainingQuota || 0) : round2(est.totalMinPayment || 0);
        if (payDt) badgeLabel = isCyclePaid ? 'Ciclo al día' : `Pago ${fmtShortPay(payDt)}`;

        if (est.deferredQuota > 0) parts.push(`Diferidos: <b>${formatMoney(est.deferredQuota)}</b>`);
        if (est.initialQuotaApplied > 0) parts.push(`Cuota inicial: <b>${formatMoney(est.initialQuotaApplied)}</b>`);
        if (est.mgmtFeeAmt > 0) parts.push(`Manejo: <b>${formatMoney(est.mgmtFeeAmt)}</b>`);
        if (est.insuranceAmt > 0) parts.push(`Seguro: <b>${formatMoney(est.insuranceAmt)}</b>`);

        // Solo cargos aún no asentados + interés de deuda inicial (los intereses de diferidos los crea applyTransferAllocatedItems)
        const unchargedFees = round2((est.mgmtFeeAmt || 0) + (est.insuranceAmt || 0));
        const rawMinExtra = round2(unchargedFees + (est.initialInterestApplied || 0));
        if (paidSoFar <= 0 && rawMinExtra > 0 && rawMinExtra < suggestedMin) {
            minExtraCharges = rawMinExtra;
        }
        if (unchargedFees > 0 && !isExtraMode) {
            totalPayoff = round2(curBal + unchargedFees);
            totalExtraCharges = unchargedFees;
        }
    } else {
        const qInfo = typeof getDebtMonthlyQuotaBreakdown === 'function'
            ? getDebtMonthlyQuotaBreakdown(toAcc, curBal)
            : { totalQuota: round2(toAcc.debtMonthlyPayment || 0), baseInterest: 0, totalPrincipal: 0, totalInterest: 0, subPurchases: [] };
        const allPendingRev = Array.isArray(qInfo.subPurchases) ? qInfo.subPurchases : [];
        allPendingTxIds = allPendingRev.map(p => String(p.tx.id));
        dueCycleTxIds = allPendingRev.filter(p => p.isDueInActiveCycle !== false).map(p => String(p.tx.id));

        const nextDue = typeof getNextUnpaidLiabilityCycle === 'function'
            ? getNextUnpaidLiabilityCycle(toAcc, curBal, refDate, 5)
            : null;

        if (isLibranza) {
            badgeLabel = 'Libranza';
        } else if (nextDue) {
            suggestedMin = round2(nextDue.amount || 0);
            badgeLabel = `Pago ${fmtShortPay(nextDue.dueDate)}`;
        } else if (toAcc.paymentDay) {
            const maxD = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0).getDate();
            const dueThisM = new Date(refDate.getFullYear(), refDate.getMonth(), Math.min(toAcc.paymentDay, maxD), 12, 0, 0);
            const stThisM = typeof getLiabilityDueCycleState === 'function'
                ? getLiabilityDueCycleState(toAcc, curBal, dueThisM, refDate)
                : null;
            isCyclePaid = !!(stThisM && stThisM.isPaid);
            suggestedMin = isCyclePaid ? 0 : round2(qInfo.totalQuota || 0);
            badgeLabel = isCyclePaid ? 'Ciclo al día' : `Día ${toAcc.paymentDay}`;
        } else {
            suggestedMin = round2(qInfo.totalQuota || 0);
            badgeLabel = 'Cuota del mes';
        }

        if (qInfo.totalPrincipal > 0) parts.push(`Capital: <b>${formatMoney(qInfo.totalPrincipal)}</b>`);
        if (qInfo.totalInterest > 0) parts.push(`Interés: <b>${formatMoney(qInfo.totalInterest)}</b>`);

        // En préstamo fijo puro sin sub-compras, el interés del mes va a cargos extra para que el capital baje exacto
        if (toAcc.debtType !== 'revolving' && allPendingTxIds.length === 0 && qInfo.baseInterest > 0 && qInfo.baseInterest < suggestedMin) {
            minExtraCharges = round2(qInfo.baseInterest);
        }
    }

    const sparkleSvg = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/></svg>`;
    const currentTyped = parseMoneyInput(document.getElementById('amount')?.value || '0');
    const isMinApplied = suggestedMin > 0 && Math.abs(currentTyped - suggestedMin) < 0.5;
    const isTotalApplied = totalPayoff > 0 && Math.abs(currentTyped - totalPayoff) < 0.5;

    let bodyText = '';
    if (isExtraMode) {
        badgeLabel = 'Capital directo';
        bodyText = `Estás en <b>abono extraordinario</b> a <b>${safeName}</b>: el 100% reduce capital (saldo vigente: <b>${formatMoney(curBal)}</b>). Si quieres pagar la cuota del mes, cambia Modalidad a <i>Cuota(s) del mes</i>.`;
    } else if (isLibranza) {
        bodyText = `<b>${safeName}</b> tiene <b>libranza</b> (su cuota ya se descuenta al registrar tu nómina). Usa esta transferencia solo si vas a hacer un abono manual o liquidar tu saldo de <b>${formatMoney(curBal)}</b>.`;
    } else if (isCyclePaid) {
        bodyText = `El ciclo actual de <b>${safeName}</b> ya está al día. Si deseas abonar extra o liquidar, tu saldo vigente es de <b>${formatMoney(curBal)}</b>.`;
    } else if (suggestedMin > 0) {
        const labelTipo = toAcc.category === 'credit_card' ? 'pago mínimo estimado' : 'cuota estimada';
        const breakdownStr = parts.length > 0 ? `<div style="margin-top:4px; font-size:11px; color:var(--text-muted);">${parts.join(' • ')}</div>` : '';
        const partialStr = paidSoFar > 0 ? ` <span style="color:var(--text-muted);">(Ya abonaste ${formatCompact(paidSoFar)} en este ciclo).</span>` : '';
        bodyText = `Para <b>${safeName}</b>, Lumen calcula un ${labelTipo} de <b>${formatMoney(suggestedMin)}</b> este ciclo.${partialStr}${breakdownStr}`;
    } else {
        bodyText = `Saldo vigente de <b>${safeName}</b>: <b>${formatMoney(curBal)}</b>.`;
    }

    const showMinBtn = !isExtraMode && !isLibranza && !isCyclePaid && suggestedMin > 0;
    const minLabel = toAcc.category === 'credit_card' ? 'Usar Mínimo' : 'Usar Cuota Mes';
    const totalLabel = isExtraMode
        ? 'Liquidar Capital Total'
        : (totalExtraCharges > 0 ? 'Pago Total (+cargos)' : 'Pago Total Deuda');
    const gridStyle = showMinBtn ? '' : 'style="grid-template-columns:1fr;"';

    box.innerHTML = `
        <div class="lumi-quincena-tip">
            <div class="lumi-quincena-header">
                <span style="display:inline-flex; align-items:center; gap:5px;">${sparkleSvg} Tip de Lumi • Pago del Ciclo</span>
                <span class="lumi-quincena-badge">${esc(badgeLabel)}</span>
            </div>
            <div>${bodyText}</div>
            <div class="lumi-quincena-grid" ${gridStyle}>
                ${showMinBtn ? `
                <button type="button" class="lumi-q-pill ${isMinApplied ? '' : 'recommended'}" data-lumi-pay-kind="min" data-lumi-apply-amt="${suggestedMin}" data-lumi-apply-extra="${minExtraCharges}" data-lumi-apply-desc="Pago ${escA(cleanName)}" style="text-align:left; cursor:pointer; font-family:inherit; ${isMinApplied ? 'border-color:var(--positive);' : ''}">
                    <span>${isMinApplied ? '✓ Aplicado (Mín.)' : minLabel}</span>
                    <strong style="color:${isMinApplied ? 'var(--positive)' : 'var(--accent)'};">${formatMoney(suggestedMin)}</strong>
                </button>` : ''}
                <button type="button" class="lumi-q-pill" data-lumi-pay-kind="total" data-lumi-apply-amt="${totalPayoff}" data-lumi-apply-extra="${totalExtraCharges}" data-lumi-apply-desc="Pago total ${escA(cleanName)}" style="text-align:left; cursor:pointer; font-family:inherit; ${isTotalApplied ? 'border-color:var(--positive);' : ''}">
                    <span>${isTotalApplied ? '✓ Aplicado (Total)' : totalLabel}</span>
                    <strong style="color:${isTotalApplied ? 'var(--positive)' : 'var(--text-main)'};">${formatMoney(totalPayoff)}</strong>
                </button>
            </div>
        </div>
    `;

    box.querySelectorAll('[data-lumi-apply-amt]').forEach(btn => {
        btn.addEventListener('click', () => {
            const payKind = btn.getAttribute('data-lumi-pay-kind') || 'min';
            const targetAmt = round2(parseFloat(btn.getAttribute('data-lumi-apply-amt')) || 0);
            const targetExtra = round2(parseFloat(btn.getAttribute('data-lumi-apply-extra')) || 0);
            const suggestedDesc = btn.getAttribute('data-lumi-apply-desc') || '';

            if (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP') {
                activeTxCurrency = 'COP';
                document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-curr') === 'COP');
                });
                document.getElementById('tx-currency-preview')?.classList.add('hidden');
            }

            // Si es Pago Total con compras diferidas pendientes, pasar a extraordinario para cerrarlas todas a $0
            const payModeSel = document.getElementById('transfer-payment-mode');
            if (payKind === 'total' && allPendingTxIds.length > 0 && payModeSel && payModeSel.value !== 'extraordinary') {
                payModeSel.value = 'extraordinary';
                document.getElementById('extraordinary-strategy-group')?.classList.remove('hidden');
                if (typeof updateTransferAllocationUI === 'function') {
                    updateTransferAllocationUI({ preserveSelection: false, keepProvidedAmount: true });
                }
            }

            // Sincronizar checkboxes de compras diferidas/rotativas según el botón pulsado
            const targetIds = new Set(payKind === 'total' ? allPendingTxIds : dueCycleTxIds);
            const allocChecks = Array.from(document.querySelectorAll('#transfer-pending-items-list .transfer-alloc-check'));
            if (allocChecks.length > 0 && targetIds.size > 0) {
                allocChecks.forEach(cb => {
                    cb.checked = targetIds.has(String(cb.value));
                });
                const badgeEl = document.getElementById('transfer-alloc-badge');
                const checkedCount = allocChecks.filter(cb => cb.checked).length;
                if (badgeEl) badgeEl.innerText = `${checkedCount}/${allocChecks.length} selec.`;
            }

            const extraInp = document.getElementById('transfer-extra-charges');
            if (extraInp) {
                extraInp.value = (targetExtra > 0 && targetExtra < targetAmt) ? formatNumberInput(targetExtra) : '';
            }

            const amtInp = document.getElementById('amount');
            if (amtInp && targetAmt > 0) {
                amtInp.value = formatNumberInput(targetAmt);
                amtInp.dispatchEvent(new Event('input', { bubbles: true }));
            }

            const descInp = document.getElementById('description');
            if (descInp && !descInp.value.trim() && suggestedDesc) {
                descInp.value = suggestedDesc;
            }
            if (typeof syncTransferAllocationSummary === 'function') {
                syncTransferAllocationSummary(false);
            }
        });
    });
};

// 1. Tip en Nuevo Gasto y Transferencia a Deudas
window.renderLumiQuincenaTipTx = () => {
    const box = document.getElementById('lumi-quincena-tip-tx');
    if (!box) return;
    const typeVal = document.getElementById('type')?.value || 'expense';
    if (typeVal === 'transfer') {
        window.renderLumiDebtPaymentTipTx();
        return;
    }
    const dateVal = document.getElementById('trans-date')?.value || '';
    const accVal = document.getElementById('account')?.value || '';
    if (typeVal !== 'expense' || !dateVal || accVal === 'CxC_Gastos_Acompanante') {
        box.innerHTML = '';
        return;
    }

    const editId = document.getElementById('edit-id')?.value || '';
    const editingClosedTx = editId
        ? (financeData.transactions || []).find(t => String(t.id) === String(editId) && t.status !== 'pending')
        : null;

    const payDay = Number(dateVal.split('-')[2]) || 1;
    const rawAmt = parseMoneyInput(document.getElementById('amount')?.value || '0');
    const fxRate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
        ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
        : 1;
    const amountCop = round2(rawAmt * fxRate);
    const deltaAmount = editingClosedTx ? Math.max(0, round2(amountCop - round2(editingClosedTx.amount || 0))) : amountCop;

    const rawCat = document.getElementById('trans-category')?.value || '';
    const label = rawCat ? rawCat.split('::')[0] : '';
    const txMonthId = /^\d{4}-\d{2}-\d{2}$/.test(dateVal) ? getMonthId(new Date(`${dateVal}T12:00:00`)) : getMonthId(currentDate);
    const plan = window.getQuincenaPlanSummary(deltaAmount, payDay, false, {
        targetMonthId: txMonthId,
        deductCurrentAdvances: true,
        excludeTxId: editId || null
    });
    box.innerHTML = plan ? window.buildLumiQuincenaTipHTML({ plan, label, payDay, amount: amountCop }) : '';
};

document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(() => window.renderLumiQuincenaTipTx?.(), 30));
});
document.getElementById('account')?.addEventListener('change', () => window.renderLumiQuincenaTipTx?.());

// 2. Tip en Nueva Suscripción
window.renderLumiQuincenaTipSub = () => {
    const box = document.getElementById('lumi-quincena-tip-sub');
    if (!box) return;
    const dateVal = document.getElementById('new-sub-next-date')?.value || '';
    const rawAmt = parseMoneyInput(document.getElementById('new-sub-amount')?.value || '0');
    const curr = document.getElementById('new-sub-currency')?.value || 'COP';
    const amount = typeof getRecurringAmountInCOP === 'function'
        ? getRecurringAmountInCOP({ amount: rawAmt, currency: curr })
        : rawAmt;
    if (!dateVal && amount <= 0) { box.innerHTML = ''; return; }

    const payDay = dateVal ? (Number(dateVal.split('-')[2]) || 1) : null;
    const label = document.getElementById('new-sub-name')?.value?.trim() || 'Pago recurrente';
    const plan = window.getQuincenaPlanSummary(amount, payDay);
    box.innerHTML = plan ? window.buildLumiQuincenaTipHTML({ plan, label, payDay, amount }) : '';
};
document.getElementById('new-sub-currency')?.addEventListener('change', () => window.renderLumiQuincenaTipSub?.());

// 3. Tip en Nueva Categoría, Editar Categoría y Editar Subcategoría
window.renderLumiQuincenaTipCat = () => {
    const box = document.getElementById('lumi-quincena-tip-cat');
    if (box) {
        const amount = parseMoneyInput(document.getElementById('new-cat-limit')?.value || '0');
        const label = document.getElementById('new-cat-name')?.value?.trim() || 'Categoría';
        if (amount > 0) {
            const plan = window.getQuincenaPlanSummary(amount, null);
            box.innerHTML = plan ? window.buildLumiQuincenaTipHTML({ plan, label, payDay: null, amount }) : '';
        } else {
            box.innerHTML = '';
        }
    }

    const editCatBox = document.getElementById('lumi-quincena-tip-edit-cat');
    if (editCatBox) {
        const amount = parseMoneyInput(document.getElementById('cat-general-limit-input')?.value || '0');
        const label = document.getElementById('cat-edit-name-input')?.value?.trim() || 'Categoría';
        if (amount > 0) {
            const plan = window.getQuincenaPlanSummary(amount, null);
            editCatBox.innerHTML = plan ? window.buildLumiQuincenaTipHTML({ plan, label, payDay: null, amount }) : '';
        } else {
            editCatBox.innerHTML = '';
        }
    }

    const subcatBox = document.getElementById('lumi-quincena-tip-subcat');
    if (subcatBox) {
        const amount = parseMoneyInput(document.getElementById('subcat-general-limit-input')?.value || '0');
        const label = document.getElementById('subcat-edit-name-input')?.value?.trim() || 'Subcategoría';
        if (amount > 0) {
            const plan = window.getQuincenaPlanSummary(amount, null);
            subcatBox.innerHTML = plan ? window.buildLumiQuincenaTipHTML({ plan, label, payDay: null, amount }) : '';
        } else {
            subcatBox.innerHTML = '';
        }
    }
};

// 4. Tip en Nuevo Préstamo / Crédito
window.renderLumiQuincenaTipDebt = () => {
    const box = document.getElementById('lumi-quincena-tip-debt');
    if (!box) return;

    const orig = parseMoneyInput(document.getElementById('new-debt-original')?.value || '0');
    const curr = parseMoneyInput(document.getElementById('new-debt-current')?.value || '0');
    const principal = curr > 0 ? curr : orig;
    let quota = parseMoneyInput(document.getElementById('new-debt-monthly-payment')?.value || '0');

    if (quota <= 0 && principal > 0) {
        const quotes = Math.max(1, Number(document.getElementById('new-debt-total-quotes')?.value) || 12);
        const rate = parseMoneyInput(document.getElementById('new-debt-rate')?.value || '0');
        const rType = document.getElementById('new-debt-rate-type')?.value || 'monthly';
        const mRate = rate > 0 ? (rType === 'annual' ? Math.pow(1 + rate / 100, 1 / 12) - 1 : rate / 100) : 0;
        quota = mRate > 0 ? round2((principal * mRate) / (1 - Math.pow(1 + mRate, -quotes))) : round2(principal / quotes);
    }

    if (quota <= 0) { box.innerHTML = ''; return; }

    const isPayroll = !!document.getElementById('new-debt-payroll')?.checked;
    const payDay = Number(document.getElementById('new-debt-payment-day')?.value) || null;
    const label = document.getElementById('new-debt-name')?.value?.trim() || 'Nuevo Crédito';
    const plan = window.getQuincenaPlanSummary(quota, isPayroll ? null : payDay, isPayroll);

    if (!plan) { box.innerHTML = ''; return; }

    let customNote = '';
    if (plan.isMonthly) {
        customNote = isPayroll
            ? `Al ser <b>libranza</b>, descontará <b>${formatMoney(quota)}/mes</b> directamente de tu nómina mensual.`
            : `Una cuota estimada de <b>${formatMoney(quota)}/mes</b>${payDay ? ` (día de pago ${payDay})` : ''} se suma a tus compromisos del mes. Así queda tu neto libre proyectado:`;
    } else {
        customNote = isPayroll
            ? `Al ser <b>libranza</b>, descontará <b>${formatMoney(round2(quota / 2))}</b> en cada quincena (${formatMoney(quota)}/mes) directamente de tu nómina.`
            : `Una cuota estimada de <b>${formatMoney(quota)}/mes</b> encaja mejor en tu <b>${plan.targetQ}</b>${payDay ? ` (día de pago ${payDay})` : ''}. Así quedan tus salditos libres proyectados:`;
    }

    box.innerHTML = window.buildLumiQuincenaTipHTML({ plan, label, payDay: isPayroll ? null : payDay, amount: quota, customNote });
};

// 5. Tip en Nueva Tarjeta de Crédito
window.renderLumiQuincenaTipCard = () => {
    const box = document.getElementById('lumi-quincena-tip-card');
    if (!box) return;

    const payDay = Number(document.getElementById('new-card-payment')?.value) || 0;
    const debt = parseMoneyInput(document.getElementById('new-card-debt')?.value || '0');
    let initQuota = parseMoneyInput(document.getElementById('new-card-initial-quota')?.value || '0');
    const mgmtFee = document.getElementById('new-card-has-mgmt-fee')?.checked
        ? parseMoneyInput(document.getElementById('new-card-mgmt-fee')?.value || '0')
        : 0;

    if (!payDay && debt <= 0 && initQuota <= 0 && mgmtFee <= 0) { box.innerHTML = ''; return; }
    if (initQuota <= 0 && debt > 0) initQuota = round2(debt / 12);

    const monthlyEst = round2(initQuota + mgmtFee);
    const label = document.getElementById('new-card-name')?.value?.trim() || 'Nueva Tarjeta';
    const plan = window.getQuincenaPlanSummary(monthlyEst, payDay || null);
    if (!plan) { box.innerHTML = ''; return; }

    let customNote = '';
    if (plan.isMonthly) {
        customNote = payDay
            ? `Con fecha límite el <b>día ${payDay}</b>, el extracto de esta tarjeta se cubrirá dentro de tu presupuesto mensual${monthlyEst > 0 ? ` (compromiso est. ${formatMoney(monthlyEst)}/mes)` : ''}.`
            : `Así queda tu neto libre mensual disponible para respaldar esta tarjeta:`;
    } else {
        customNote = payDay
            ? `Con fecha límite el <b>día ${payDay}</b>, el extracto de esta tarjeta se cubrirá con tu <b>${plan.targetQ}</b>${monthlyEst > 0 ? ` (compromiso est. ${formatMoney(monthlyEst)}/mes)` : ''}.`
            : `Tu <b>${plan.targetQ}</b> tiene más margen disponible para respaldar esta tarjeta.`;
    }

    box.innerHTML = window.buildLumiQuincenaTipHTML({ plan, label, payDay: payDay || null, amount: monthlyEst, customNote });
};

const lumiTipTxModal = document.getElementById('transaction-modal');
if (lumiTipTxModal && !lumiTipTxModal.dataset.lumiTipObs) {
    lumiTipTxModal.dataset.lumiTipObs = '1';
    new MutationObserver(() => {
        if (!lumiTipTxModal.classList.contains('hidden')) {
            setTimeout(() => window.renderLumiQuincenaTipTx?.(), 60);
        }
    }).observe(lumiTipTxModal, { attributes: true, attributeFilter: ['class'] });
}

['input', 'change'].forEach(evt => {
    document.addEventListener(evt, (e) => {
        const id = e.target?.id;
        if (['type', 'to-account', 'transfer-payment-mode', 'trans-category', 'trans-date', 'amount', 'trans-recurrence'].includes(id)) window.renderLumiQuincenaTipTx();
        if (['new-sub-name', 'new-sub-amount', 'new-sub-next-date'].includes(id)) window.renderLumiQuincenaTipSub();
        if (['new-cat-name', 'new-cat-limit', 'cat-edit-name-input', 'cat-general-limit-input', 'subcat-edit-name-input', 'subcat-general-limit-input'].includes(id)) window.renderLumiQuincenaTipCat();
        if (['new-debt-name', 'new-debt-original', 'new-debt-current', 'new-debt-total-quotes', 'new-debt-rate', 'new-debt-rate-type', 'new-debt-monthly-payment', 'new-debt-payment-day', 'new-debt-payroll'].includes(id)) window.renderLumiQuincenaTipDebt();
        if (['new-card-name', 'new-card-debt', 'new-card-initial-quota', 'new-card-payment', 'new-card-has-mgmt-fee', 'new-card-mgmt-fee'].includes(id)) window.renderLumiQuincenaTipCard();
    });
});

document.addEventListener('click', (e) => {
    if (e.target.closest('#fab-btn, .tx-type-btn')) setTimeout(() => window.renderLumiQuincenaTipTx(), 120);
    if (e.target.closest('#drawer-budget, #nav-budget, summary')) setTimeout(() => {
        window.renderLumiQuincenaTipCat();
        window.renderLumiQuincenaTipSub();
        window.renderLumiQuincenaTipDebt();
        window.renderLumiQuincenaTipCard();
    }, 120);
});
// ============================================================================
// AUTO-SCROLL A MOVIMIENTOS AL PULSAR "FILTRAR" EN ALERTAS INTELIGENTES
// ============================================================================
document.addEventListener('click', (e) => {
    const alertBtn = e.target.closest('#ios-alerts-container button, .ios-alerts-container button');
    if (!alertBtn) return;

    const btnText = (alertBtn.textContent || '').trim().toLowerCase();
    if (!btnText.includes('filtrar')) return;

    setTimeout(() => {
        const pendingPill = document.querySelector('.filter-pills-row .pill-btn[data-filter="pending"]');
        if (pendingPill && !pendingPill.classList.contains('active')) {
            pendingPill.click();
        }

        requestAnimationFrame(() => {
            const targetEl = document.getElementById('history-section-title')
                || document.querySelector('[data-widget-id="history-list"]');
            if (!targetEl) return;

            const headerH = document.querySelector('header')?.offsetHeight || 95;

            // Detectar si el scroll está en un contenedor interno o en el documento
            let scrollParent = targetEl.parentElement;
            while (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
                const style = window.getComputedStyle(scrollParent);
                if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && scrollParent.scrollHeight > scrollParent.clientHeight) {
                    break;
                }
                scrollParent = scrollParent.parentElement;
            }

            if (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
                const parentRect = scrollParent.getBoundingClientRect();
                const targetRect = targetEl.getBoundingClientRect();
                const offsetTop = scrollParent.scrollTop + (targetRect.top - parentRect.top) - 16;
                scrollParent.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
            } else {
                const y = targetEl.getBoundingClientRect().top + window.pageYOffset - headerH - 12;
                window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                document.documentElement.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
                document.body.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
            }
        });
    }, 140);
}, true);
// (#toggle-privacy-btn sincroniza el banner de nómina directamente en su listener principal)
// ============================================================================
// BOTÓN FLOTANTE "↑ VOLVER ARRIBA" (COMPATIBLE iOS PWA + ANDROID CAPACITOR)
// ============================================================================
(() => {
    const oldBtn = document.getElementById('lumen-scroll-top-btn');
    if (oldBtn) oldBtn.remove();
    const oldStyle = document.getElementById('lumen-scroll-top-styles');
    if (oldStyle) oldStyle.remove();

    const st = document.createElement('style');
    st.id = 'lumen-scroll-top-styles';
    st.textContent = `
        #lumen-scroll-top-btn {
            position: fixed;
            top: calc(env(safe-area-inset-top, 0px) + 146px);
            left: 50%;
            transform: translate3d(-50%, -12px, 0);
            -webkit-transform: translate3d(-50%, -12px, 0);
            z-index: 1200;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 15px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.16);
            background-color: #080c14;
            color: #ffffff;
            font-family: inherit;
            font-size: 12.5px;
            font-weight: 800;
            letter-spacing: -0.1px;
            line-height: 1;
            box-shadow: 0 8px 22px rgba(8, 12, 20, 0.28);
            -webkit-backdrop-filter: blur(10px);
            backdrop-filter: blur(10px);
            cursor: pointer;
            opacity: 0;
            visibility: hidden;
            pointer-events: none;
            transition: opacity 0.22s ease, transform 0.22s ease, visibility 0.22s ease;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            -webkit-user-select: none;
        }
        #lumen-scroll-top-btn.is-visible {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
            transform: translate3d(-50%, 0, 0);
            -webkit-transform: translate3d(-50%, 0, 0);
        }
        #lumen-scroll-top-btn:active {
            transform: translate3d(-50%, 0, 0) scale(0.95);
            -webkit-transform: translate3d(-50%, 0, 0) scale(0.95);
        }
        html[data-color-mode="dark"] #lumen-scroll-top-btn,
        html[data-color-mode="black"] #lumen-scroll-top-btn {
            background-color: #f8fafc;
            color: #080c14;
            border-color: rgba(8, 12, 20, 0.14);
            box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
        }
    `;
    document.head.appendChild(st);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'lumen-scroll-top-btn';
    btn.setAttribute('aria-label', 'Volver arriba');
    btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="12" y1="19" x2="12" y2="5"></line>
            <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
        <span>Volver arriba</span>
    `;
    document.body.appendChild(btn);

    let lastScrollTarget = null;

    const getScrollY = (target = null) => {
        let maxTop = Math.max(
            window.scrollY || 0,
            window.pageYOffset || 0,
            document.documentElement.scrollTop || 0,
            document.body.scrollTop || 0
        );
        if (target && target !== document && target !== window && typeof target.scrollTop === 'number') {
            maxTop = Math.max(maxTop, target.scrollTop || 0);
        }
        if (lastScrollTarget && lastScrollTarget.isConnected) {
            maxTop = Math.max(maxTop, lastScrollTarget.scrollTop || 0);
        }
        return maxTop;
    };

    const getSafeHeaderBottom = () => {
        const availEl = document.getElementById('header-liquidity-trigger')
            || document.querySelector('header [id*="avail"], header [class*="avail"], header button');
        if (availEl) {
            const r = availEl.getBoundingClientRect();
            if (r.height > 0 && r.bottom > 40) {
                return Math.min(Math.round(r.bottom + 8), 220);
            }
        }
        const headerEl = document.querySelector('header');
        if (headerEl) {
            const rect = headerEl.getBoundingClientRect();
            if (rect.height > 0 && rect.height < 260 && rect.bottom > 40) {
                return Math.min(Math.round(rect.bottom + 10), 220);
            }
        }
        return 146;
    };

    const updateScrollTopBtn = (scrollEventTarget = null) => {
        if (scrollEventTarget && scrollEventTarget !== document && scrollEventTarget !== window && typeof scrollEventTarget.scrollTop === 'number') {
            lastScrollTarget = scrollEventTarget;
        }

        const blocked = document.body.classList.contains('drawer-open')
            || document.body.classList.contains('app-locked')
            || (typeof isAnyModalOpen === 'function' && isAnyModalOpen());

        if (blocked || getScrollY(scrollEventTarget) <= 320) {
            btn.classList.remove('is-visible');
            return;
        }

        btn.style.top = `${getSafeHeaderBottom()}px`;
        btn.classList.add('is-visible');
    };

    let scrollRaf = null;
    let pendingTarget = null;
    const onScroll = (e) => {
        if (e && e.target) pendingTarget = e.target;
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
            const t = pendingTarget;
            pendingTarget = null;
            scrollRaf = null;
            updateScrollTopBtn(t);
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    window.addEventListener('resize', () => updateScrollTopBtn(), { passive: true });
    document.addEventListener('click', () => setTimeout(() => updateScrollTopBtn(), 80));

    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (_) {
            window.scrollTo(0, 0);
        }
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        if (lastScrollTarget && lastScrollTarget.isConnected && typeof lastScrollTarget.scrollTo === 'function') {
            try {
                lastScrollTarget.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (_) {
                lastScrollTarget.scrollTop = 0;
            }
        } else if (lastScrollTarget && lastScrollTarget.isConnected) {
            lastScrollTarget.scrollTop = 0;
        }
        setTimeout(() => updateScrollTopBtn(), 350);
    });
})();
// ============================================================================
// REVELADO SUAVE AL TERMINAR CARGA INICIAL (EVITA PARPADEO FOUC)
// ============================================================================
(() => {
    const revealLumen = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                document.body?.classList.add('lumen-ready');
            });
        });
    };
    if (document.readyState === 'complete') revealLumen();
    else window.addEventListener('load', revealLumen, { once: true });
})();
// ============================================================
// FASE 4: REEMBOLSOS, DETECTOR DE DUPLICADOS Y EXTRACTOR SMS
// ============================================================
const openRefundHelpModal = () => {
    let modalEl = document.getElementById('refund-help-faq-modal');
    if (!modalEl) {
        modalEl = document.createElement('div');
        modalEl.id = 'refund-help-faq-modal';
        modalEl.className = 'modal hidden';
        modalEl.setAttribute('role', 'dialog');
        modalEl.setAttribute('aria-modal', 'true');
        modalEl.style.cssText = 'z-index: 2650; align-items: center; justify-content: center; padding: 16px;';
        modalEl.innerHTML = `
            <div class="modal-content" style="width: 100%; max-width: 410px; max-height: 86dvh; overflow-y: auto; margin: auto; border-radius: 26px; padding: 20px 18px; box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22); border: 1px solid var(--border-color); background: var(--modal-bg);">
                <div class="modal-header" style="margin-bottom: 12px;">
                    <h3 style="margin: 0; font-size: 17px; font-weight: 800; color: var(--text-main);">Preguntas frecuentes</h3>
                    <button type="button" id="close-refund-help-btn" class="mini-action-btn" style="color: var(--accent); font-weight: 700;">Cerrar</button>
                </div>

                <details class="changelog-accordion" open>
                    <summary><span>¿Para qué sirve marcar un ingreso como Reembolso / Devolución?</span><span>▾</span></summary>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.48;">
                        Cuando una tienda te devuelve plata por una compra cancelada, recibes un <b>cashback</b> o te reintegran un cobro errado, ese dinero <b>no es un ingreso nuevo</b> sino la recuperación de un gasto previo. Activarlo mantiene reales tanto tus ingresos como tus gastos del mes.
                    </p>
                </details>

                <details class="changelog-accordion">
                    <summary><span>¿Cómo afecta mi presupuesto con un ejemplo práctico?</span><span>▾</span></summary>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.48;">
                        Imagina que compraste ropa por <b>$ 200.000</b> en la categoría <b>Compras</b> y luego devolviste una prenda de <b>$ 80.000</b>. Al registrar los $ 80.000 activando este interruptor y eligiendo <b>Compras</b>:
                        <br>• Tu cuenta bancaria/tarjeta suma los <b>+$ 80.000</b> reales.
                        <br>• Tu gasto neto en <b>Compras</b> baja a <b>$ 120.000</b> y liberas esos $ 80.000 en tu presupuesto del mes.
                        <br>• Tus ingresos mensuales no se inflan artificialmente.
                    </p>
                </details>

                <details class="changelog-accordion">
                    <summary><span>¿Cómo impacta los topes de Renta DIAN (1.400 UVT)?</span><span>▾</span></summary>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.48;">
                        Al marcarlo como reembolso, Lumen <b>no lo suma</b> al acumulado de <b>Ingresos Brutos</b> (1.400 UVT) para no distorsionar tu proyección tributaria. Sin embargo, si el dinero entró a una cuenta bancaria, seguirá contándose en <b>Consignaciones bancarias</b>, tal como suelen reportarlo los bancos a la DIAN.
                    </p>
                </details>

                <details class="changelog-accordion">
                    <summary><span>¿Qué pasa si no elijo ninguna categoría de gasto?</span><span>▾</span></summary>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.48;">
                        Si dejas seleccionada la opción general, el movimiento se registrará como un ingreso normal y sí sumará a tus ingresos del mes. Para que compense el gasto y se excluya de ingresos, debes elegir la categoría de gasto correspondiente.
                    </p>
                </details>

                <details class="changelog-accordion" style="margin-bottom: 10px;">
                    <summary><span>¿Cuándo NO debo activar esta opción?</span><span>▾</span></summary>
                    <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 8px; line-height: 1.48;">
                        Déjalo apagado cuando recibas salario, bonos, ventas, honorarios, rendimientos de CDT/bolsillos o cuando alguien te pague una deuda registrada en <b>Me debe</b> (para esos cobros usa una <b>Transferencia</b> desde la cuenta <i>Me debe</i> hacia tu banco).
                    </p>
                </details>

                <div style="background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; padding: 9px 11px; border-radius: 8px; font-size: 10.5px; color: var(--text-muted); line-height: 1.42;">
                    <b>AVISO:</b> Esta clasificación es una herramienta de control personal. <b>NO</b> reemplaza el criterio de un contador ni la información exógena oficial de la DIAN.
                </div>
            </div>
        `;
        document.body.appendChild(modalEl);

        modalEl.addEventListener('click', (ev) => {
            if (ev.target === modalEl) modalEl.classList.add('hidden');
        });
        modalEl.querySelector('#close-refund-help-btn')?.addEventListener('click', () => {
            modalEl.classList.add('hidden');
        });
    }
    modalEl.classList.remove('hidden');
};

const syncRefundIncomeUI = () => {
    const txForm = document.getElementById('transaction-form');
    if (!txForm) return;

    let wrap = document.getElementById('tx-refund-income-box');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'tx-refund-income-box';
        wrap.className = 'glass-sub-box hidden';
        wrap.style.cssText = 'grid-column:1 / -1; width:100%; box-sizing:border-box; margin-bottom:12px; padding:11px 13px; border-color:color-mix(in srgb, var(--accent) 30%, var(--border-color));';
        const catAnchor = document.getElementById('trans-category')?.closest('.form-row, .form-group');
        if (catAnchor) catAnchor.insertAdjacentElement('afterend', wrap);
        else txForm.prepend(wrap);

        wrap.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; width:100%;">
                <div style="flex:1 1 auto; min-width:0;">
                    <div style="display:flex; align-items:center; gap:7px; margin-bottom:2px;">
                        <strong style="font-size:12.5px; line-height:1.25; color:var(--text-main);">Reembolso / Devolución</strong>
                        <button type="button" id="btn-refund-help-faq" class="mini-action-btn" aria-label="¿Cómo funcionan los reembolsos?" title="¿Cómo funciona?" style="width:24px; height:24px; min-height:24px; padding:0; border-radius:50%; font-size:12px; font-weight:800; color:var(--accent); flex-shrink:0; display:inline-flex; align-items:center; justify-content:center;">?</button>
                    </div>
                    <small style="display:block; font-size:10.5px; line-height:1.35; color:var(--text-muted);">Compensa el gasto de su categoría y no infla tus ingresos</small>
                </div>
                <label class="switch" style="margin:0; flex-shrink:0;">
                    <input type="checkbox" id="tx-is-refund-check">
                    <span class="slider"></span>
                </label>
            </div>
            <div id="tx-refund-fields" class="hidden" style="margin-top:10px; padding-top:10px; border-top:1px dashed var(--border-color);">
                <div class="form-group" style="margin-bottom:0;">
                    <label style="font-size:10.5px;">Categoría de gasto a compensar</label>
                    <select id="tx-refund-category-select" aria-label="Categoría de gasto a compensar"></select>
                </div>
            </div>
        `;

        wrap.querySelector('#btn-refund-help-faq')?.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openRefundHelpModal();
        });

        wrap.querySelector('#tx-is-refund-check')?.addEventListener('change', (e) => {
            document.getElementById('tx-refund-fields')?.classList.toggle('hidden', !e.target.checked);
        });
    }

    const curType = typeSelect?.value || 'expense';
    const isEdit = !!(document.getElementById('edit-id')?.value);
    if (curType !== 'income' || isEdit) {
        wrap.classList.add('hidden');
        const chk = document.getElementById('tx-is-refund-check');
        if (chk) chk.checked = false;
        document.getElementById('tx-refund-fields')?.classList.add('hidden');
        return;
    }

    wrap.classList.remove('hidden');
    const sel = document.getElementById('tx-refund-category-select');
    if (sel) {
        const esc = window.escapeHtml || ((s) => String(s ?? ''));
        const escA = window.escapeAttr || esc;
        const prevVal = sel.value;
        let opts = `<option value="">Solo ingreso general (sin descontar categoría)</option>`;
        const expCats = [...(financeData.categories?.expense || [])].filter(c => !c.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es'));
        expCats.forEach(cat => {
            const cLabel = esc(cleanCatName(cat.name));
            opts += `<option value="${escA(cat.name)}::General">${cLabel}</option>`;
            (cat.subcategories || []).filter(s => !s.isArchived).sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach(sub => {
                opts += `<option value="${escA(cat.name)}::${escA(sub.name)}">${cLabel} • ${esc(cleanCatName(sub.name))}</option>`;
            });
        });
        sel.innerHTML = opts;
        if (prevVal && Array.from(sel.options).some(o => o.value === prevVal)) sel.value = prevVal;
    }
};

const renderDuplicateTransactionAlert = () => {
    const anchor = document.getElementById('tx-unusual-expense-alert') || document.getElementById('tx-budget-variance-box');
    if (!anchor) return;

    let dupBox = document.getElementById('tx-duplicate-warning-box');
    if (!dupBox) {
        dupBox = document.createElement('div');
        dupBox.id = 'tx-duplicate-warning-box';
        dupBox.className = 'glass-sub-box hidden';
        dupBox.style.cssText = 'margin-bottom:10px; padding:9px 12px; border-color:color-mix(in srgb, var(--accent) 38%, transparent); background:var(--accent-soft); font-size:11.5px; line-height:1.38;';
        anchor.insertAdjacentElement('afterend', dupBox);
    }

    const txType = typeSelect?.value || 'expense';
    const accId = document.getElementById('account')?.value || '';
    const dateVal = document.getElementById('trans-date')?.value || '';
    const editId = document.getElementById('edit-id')?.value || null;
    const rawAmt = parseMoneyInput(document.getElementById('amount')?.value);
    const fxRate = (typeof activeTxCurrency !== 'undefined' && activeTxCurrency !== 'COP')
        ? ((financeData.exchangeRates && financeData.exchangeRates[activeTxCurrency]) || (activeTxCurrency === 'USD' ? 4150 : 4420))
        : 1;
    const amountCop = round2(rawAmt * fxRate);

    if (typeof findPossibleDuplicateTransaction !== 'function') {
        dupBox.classList.add('hidden');
        return;
    }

    const match = findPossibleDuplicateTransaction({
        type: txType,
        accountId: accId,
        amountCop,
        dateStr: dateVal,
        excludeTxId: editId
    });

    if (!match) {
        dupBox.classList.add('hidden');
        dupBox.innerHTML = '';
        return;
    }

    const esc = window.escapeHtml || ((s) => String(s ?? ''));
    dupBox.classList.remove('hidden');
    dupBox.innerHTML = `
        <div style="display:flex; align-items:flex-start; gap:8px;">
            <span style="color:var(--accent); display:inline-flex; flex-shrink:0; margin-top:1px;">${renderIcon('info', 14)}</span>
            <div style="min-width:0;">
                <strong style="display:block; color:var(--accent); font-size:11.5px;">Posible movimiento duplicado hoy</strong>
                <span style="color:var(--text-muted); font-size:11px;">Ya registraste <b style="color:var(--text-main);">${esc(match.description)}</b> por <b style="color:var(--text-main);">${formatMoney(match.amount)}</b> (${esc(match.date)}).</span>
            </div>
        </div>
    `;
};

const renderSmsImporterUI = () => {
    const txForm = document.getElementById('transaction-form');
    if (!txForm) return;

    let wrap = document.getElementById('tx-sms-importer-wrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'tx-sms-importer-wrap';
        wrap.style.cssText = 'margin-bottom:10px;';
        const descGroup = document.getElementById('description')?.closest('.form-group');
        if (descGroup) descGroup.insertAdjacentElement('beforebegin', wrap);
        else txForm.prepend(wrap);

        wrap.innerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:6px;">
                <button type="button" id="btn-toggle-sms-importer" class="mini-action-btn" style="font-size:11px; color:var(--accent); font-weight:700; gap:5px;">
                    ${renderIcon('receipt', 13)}
                    <span>Pegar SMS / Notificación</span>
                </button>
            </div>
            <div id="tx-sms-importer-panel" class="glass-sub-box hidden" style="padding:10px 12px; margin-bottom:4px;">
                <label style="font-size:10px; margin-bottom:4px;">Pega el texto del SMS o alerta bancaria (100% local)</label>
                <textarea id="tx-sms-raw-input" rows="2" placeholder="Ej. Bancolombia: Compra por $ 48.500 en EXITO COLOMBIA el 25/11/2026" style="width:100%; font-size:12px; padding:8px 10px; border-radius:10px; border:1px solid var(--border-color); background:var(--card-bg); color:var(--text-main); resize:vertical;"></textarea>
                <div style="display:flex; justify-content:flex-end; gap:6px; margin-top:7px;">
                    <button type="button" id="btn-parse-sms-text" class="mini-action-btn" style="background:var(--accent-soft); color:var(--accent); border-color:var(--accent-border); font-weight:800; font-size:11px; padding:5px 11px;">
                        Extraer datos
                    </button>
                </div>
            </div>
        `;

        wrap.querySelector('#btn-toggle-sms-importer')?.addEventListener('click', () => {
            const panel = document.getElementById('tx-sms-importer-panel');
            panel?.classList.toggle('hidden');
            if (panel && !panel.classList.contains('hidden')) {
                document.getElementById('tx-sms-raw-input')?.focus();
            }
        });

        wrap.querySelector('#btn-parse-sms-text')?.addEventListener('click', () => {
            if (typeof parseBankNotificationText !== 'function') return;
            const raw = document.getElementById('tx-sms-raw-input')?.value || '';
            const parsed = parseBankNotificationText(raw);
            if (!parsed.amount && !parsed.merchant) {
                alert('No se detectó un monto ni comercio claro en el texto.');
                return;
            }

            if (typeSelect && parsed.inferredType && typeSelect.value !== parsed.inferredType && !typeSelect.disabled) {
                typeSelect.value = parsed.inferredType;
                typeSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }

            if (parsed.currency && parsed.currency !== 'COP') {
                const currBtn = document.querySelector(`#tx-currency-pills .pill-btn[data-curr="${parsed.currency}"]`);
                currBtn?.click();
            }

            if (parsed.amount > 0) {
                const amtInp = document.getElementById('amount');
                if (amtInp) {
                    amtInp.value = parsed.currency && parsed.currency !== 'COP'
                        ? formatNumberInput(parsed.amount, 2)
                        : formatNumberInput(parsed.amount);
                    amtInp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            if (parsed.merchant) {
                const descInp = document.getElementById('description');
                if (descInp) {
                    descInp.value = parsed.merchant;
                    descInp.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }

            if (parsed.accountHint) {
                const accSel = document.getElementById('account');
                if (accSel) {
                    const found = Array.from(accSel.options).find(o => o.textContent.toLowerCase().includes(parsed.accountHint.toLowerCase()));
                    if (found) {
                        accSel.value = found.value;
                        accSel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }

            if (parsed.dateStr) {
                const dateInp = document.getElementById('trans-date');
                if (dateInp) {
                    dateInp.value = parsed.dateStr;
                    dateInp.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            const rawSmsEl = document.getElementById('tx-sms-raw-input');
            if (rawSmsEl) rawSmsEl.value = '';
            hasUnsavedChanges = true;
            renderDuplicateTransactionAlert();
            document.getElementById('tx-sms-importer-panel')?.classList.add('hidden');
        });
    }

    const isEdit = !!(document.getElementById('edit-id')?.value);
    const curType = typeSelect?.value || 'expense';
    wrap.classList.toggle('hidden', isEdit || curType === 'transfer');
};

['amount', 'account', 'type', 'trans-date'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderDuplicateTransactionAlert);
    el?.addEventListener('change', renderDuplicateTransactionAlert);
});
document.querySelectorAll('#tx-currency-pills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => setTimeout(renderDuplicateTransactionAlert, 30));
});
typeSelect?.addEventListener('change', () => {
    setTimeout(() => {
        syncRefundIncomeUI();
        renderSmsImporterUI();
        renderDuplicateTransactionAlert();
    }, 20);
});
if (txModalEl) {
    new MutationObserver(() => {
        if (!txModalEl.classList.contains('hidden')) {
            setTimeout(() => {
                syncRefundIncomeUI();
                renderSmsImporterUI();
                renderDuplicateTransactionAlert();
            }, 30);
        }
    }).observe(txModalEl, { attributes: true, attributeFilter: ['class'] });
}