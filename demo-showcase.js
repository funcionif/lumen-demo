// ============================================================================
// LUMEN - MODO VITRINA / DEMO INTERACTIVA WEB (v2.2.5)
// Cargar SOLO en el sitio web de demostración, justo después de demo-data.js
// y ANTES de security.js y core.js. NUNCA incluir en la compilación Android.
// ============================================================================
(function initLumenWebShowcase() {
    'use strict';

    // CONFIGURACIÓN: Enlace oficial de tu app en Google Play
    const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.funcionif.lumen';
    const PLAY_STORE_CTA_TEXT = 'Obtener Lumen ($29.900)';

    // Escudo de seguridad: jamás se activa dentro de la app nativa Android/iOS (Capacitor)
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
        return;
    }

    const bundle = window.LUMEN_DEMO_BUNDLE;
    if (!bundle || typeof bundle !== 'object') {
        console.warn('[Lumen Demo] No se encontró window.LUMEN_DEMO_BUNDLE.');
        return;
    }

    window.LUMEN_IS_WEB_DEMO = true;

    // 1. SANDBOX 100% EN MEMORIA RAM (no persiste al recargar ni ensucia el navegador del visitante)
    const ramStore = new Map();

    const getCurrMonthId = () => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const seedRamStore = () => {
        ramStore.clear();
        const demoVersion = String(bundle.version || '2.2.3');
        const currMonthId = getCurrMonthId();

        const demoFinances = Object.assign({}, bundle.finances || {}, {
            tripMode: {
                active: false,
                name: '',
                tag: '',
                budget: 0,
                isolateBudget: true,
                linkedPocketId: null,
                isShared: false,
                companionName: ''
            }
        });
        ramStore.set('myFinances', JSON.stringify(demoFinances));
        if (bundle.salary) ramStore.set('myFinancesSalary', JSON.stringify(bundle.salary));
        if (bundle.taxParams) ramStore.set('myFinancesTaxParams', JSON.stringify(bundle.taxParams));
        if (Array.isArray(bundle.cdts)) ramStore.set('lumen_cdts_v1', JSON.stringify(bundle.cdts));

        ramStore.set('myFinancesAuth', JSON.stringify({
            name: (bundle.auth && bundle.auth.name) ? bundle.auth.name : 'Camila Demo',
            pinEnabled: false,
            vaultVersion: 0,
            pinLength: null,
            secretMode: null,
            biometricEnabled: false,
            biometricCredId: null
        }));

        ramStore.set('myFinancesTheme', bundle.theme || 'lumen');
        ramStore.set('myFinancesColorMode', bundle.colorMode || 'auto');

        // Aterrizar directo en el Dashboard sin popups ni banners de cierre/sobrante
        ramStore.set('myFinancesAutoRecapSeenMonth', currMonthId);
        ramStore.set('myFinancesRecapDismissedMonth', currMonthId);
        ramStore.set('myFinancesLastSeenVersion', demoVersion);
        ramStore.set('lumenRebrandSeen_v1', 'true');
        ramStore.set('myFinancesBioBannerSeen', 'true');
        ramStore.set('myFinancesCoachmarksDone', 'true');
        ramStore.set('lumiReleaseBannerSeen_v1', '1');
        ramStore.set('lumi_release_banner_seen_v1', '1');
    };

    seedRamStore();

    // Interceptar únicamente window.localStorage hacia ramStore
    try {
        const nativeLocal = window.localStorage;
        const proto = Storage.prototype;
        const origGet = proto.getItem;
        const origSet = proto.setItem;
        const origRem = proto.removeItem;
        const origClr = proto.clear;
        const origKey = proto.key;
        const origLenDesc = Object.getOwnPropertyDescriptor(proto, 'length');

        proto.getItem = function (k) {
            if (this === nativeLocal) {
                const keyStr = String(k);
                return ramStore.has(keyStr) ? ramStore.get(keyStr) : null;
            }
            return origGet.call(this, k);
        };

        proto.setItem = function (k, v) {
            if (this === nativeLocal) {
                ramStore.set(String(k), String(v));
                return;
            }
            return origSet.call(this, k, v);
        };

        proto.removeItem = function (k) {
            if (this === nativeLocal) {
                ramStore.delete(String(k));
                return;
            }
            return origRem.call(this, k);
        };

        proto.clear = function () {
            if (this === nativeLocal) {
                ramStore.clear();
                return;
            }
            return origClr.call(this);
        };

        proto.key = function (idx) {
            if (this === nativeLocal) {
                const keys = Array.from(ramStore.keys());
                return keys[idx] !== undefined ? keys[idx] : null;
            }
            return origKey.call(this, idx);
        };

        if (origLenDesc && origLenDesc.configurable) {
            Object.defineProperty(proto, 'length', {
                configurable: true,
                get: function () {
                    if (this === nativeLocal) return ramStore.size;
                    return origLenDesc.get ? origLenDesc.get.call(this) : 0;
                }
            });
        }
    } catch (err) {
        console.warn('[Lumen Demo] Fallback de sandbox:', err);
    }

    // 2. DESACTIVAR SERVICE WORKER EN LA DEMO (evita instalación como PWA gratuita offline)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations()
            .then((regs) => regs.forEach((r) => r.unregister().catch(() => {})))
            .catch(() => {});
    }

    // 3. HOOKS DE DEMO: ARCHIVO 2025 EN RAM + RETIRAR BANNERS DE SOBRANTE Y CIERRE
    const demoArchived2025 = Array.isArray(bundle.archivedTransactions) ? bundle.archivedTransactions : [];
    const applyDemoRuntimeHooks = () => {
        if (demoArchived2025.length > 0) {
            window.getArchivedTransactions = async (targetYear = null) => {
                if (!targetYear) return demoArchived2025.map((t) => ({ ...t }));
                const prefix = `${targetYear}-`;
                return demoArchived2025
                    .filter((t) => String(t.monthId || '').startsWith(prefix))
                    .map((t) => ({ ...t }));
            };
        }

        // Retirar "Sobrante de Octubre disponible" y "Cierre de Octubre listo" en la demo
        window.renderUnassignedSurplusBanner = () => {
            document.getElementById('unassigned-surplus-banner')?.remove();
        };
        document.getElementById('unassigned-surplus-banner')?.remove();
        document.getElementById('proactive-recap-banner')?.remove();
    };

    // 4. MODAL DE INVITACIÓN A GOOGLE PLAY PARA FUNCIONES EXCLUSIVAS DE LA APP NATIVA
    const openDemoPlayPrompt = (featureLabel) => {
        const title = 'Disponible en la App Lumen';
        const message = `Estás probando la demo web con datos ficticios que se reinician al recargar.<br><br>La función <b>${featureLabel}</b> y el guardado cifrado en tu teléfono están incluidos en la <b>App Lumen</b> (<b>un solo pago de por vida</b>, sin suscripciones ni mensualidades).`;

        if (typeof window.openBentoConfirmModal === 'function') {
            window.openBentoConfirmModal({
                title,
                subtitle: 'Modo Demo • Datos temporales de prueba',
                message,
                confirmText: PLAY_STORE_CTA_TEXT,
                cancelText: 'Seguir probando',
                danger: false,
                onConfirm: () => {
                    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
                }
            });
        } else {
            window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
        }
    };

    // 5. BARRA FIJA JUSTO DEBAJO DE LA CABECERA (z-index 890: siempre debajo de modales y menú lateral)
    const mountDemoShowcaseUI = () => {
        applyDemoRuntimeHooks();

        // Ocultar overlays promocionales secundarios que distraen en la demo
        ['lumi-release-banner-overlay', 'bio-update-modal', 'gmf-welcome-modal', 'lumen-update-modal'].forEach((id) => {
            document.getElementById(id)?.classList.add('hidden');
        });

        if (document.getElementById('lumen-demo-showcase-bar')) return;

        const styleEl = document.createElement('style');
        styleEl.id = 'lumen-demo-showcase-style';
        styleEl.textContent = `
            /* Reservar "Sobrante" y "Cierre de mes" como sorpresa de la app completa */
            #unassigned-surplus-banner,
            #proactive-recap-banner {
                display: none !important;
            }

            #lumen-demo-showcase-bar {
                position: fixed;
                top: var(--lumen-demo-top, 106px);
                left: 0;
                right: 0;
                z-index: 890;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
                border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                box-shadow: 0 6px 18px rgba(15, 23, 42, 0.16);
                font-family: inherit;
                box-sizing: border-box;
                padding: 8px 14px;
            }
            .lumen-demo-inner {
                width: 100%;
                max-width: 600px;
                margin: 0 auto;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
            }
            .lumen-demo-left {
                display: flex;
                align-items: center;
                gap: 8px;
                min-width: 0;
                flex: 1;
            }
            .lumen-demo-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #00C49F;
                box-shadow: 0 0 0 3px rgba(0, 196, 159, 0.25);
                flex-shrink: 0;
            }
            .lumen-demo-copy {
                display: flex;
                flex-direction: column;
                min-width: 0;
                line-height: 1.18;
            }
            .lumen-demo-title {
                font-size: 12px;
                font-weight: 800;
                color: #f8fafc;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lumen-demo-sub {
                font-size: 10.5px;
                font-weight: 500;
                color: #94a3b8;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .lumen-demo-actions {
                display: flex;
                align-items: center;
                gap: 6px;
                flex-shrink: 0;
            }
            #btn-lumen-demo-reset {
                background: rgba(255, 255, 255, 0.1);
                color: #e2e8f0;
                border: 1px solid rgba(255, 255, 255, 0.16);
                border-radius: 999px;
                padding: 5px 10px;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                white-space: nowrap;
            }
            #btn-lumen-demo-cta {
                background: linear-gradient(135deg, #00C49F 0%, #0ea5e9 100%);
                color: #ffffff;
                border: none;
                border-radius: 999px;
                padding: 6px 12px;
                font-size: 11.5px;
                font-weight: 800;
                text-decoration: none;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0, 196, 159, 0.3);
            }
            #lumen-demo-spacer {
                width: 100%;
                height: var(--lumen-demo-spacer-h, 52px);
                pointer-events: none;
                flex-shrink: 0;
            }
            /* Desplazar "Volver arriba" exactamente debajo de la barra fija de demo */
            #lumen-scroll-top-btn {
                margin-top: var(--lumen-demo-spacer-h, 52px);
            }
            body.app-locked #lumen-demo-showcase-bar {
                visibility: hidden !important;
                pointer-events: none !important;
            }
            #lumen-demo-drawer-card {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin: 8px 0 2px 0;
                padding: 9px 11px;
                border-radius: 14px;
                background: color-mix(in srgb, var(--accent) 8%, var(--card-inner-bg));
                border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border-color));
                box-sizing: border-box;
                width: 100%;
                flex-shrink: 0;
            }
            .lumen-demo-drawer-left {
                display: flex;
                align-items: center;
                gap: 7px;
                min-width: 0;
                flex: 1;
            }
            .lumen-demo-drawer-title {
                display: block;
                font-size: 11.5px;
                font-weight: 800;
                color: var(--text-main);
                line-height: 1.2;
            }
            .lumen-demo-drawer-sub {
                display: block;
                font-size: 10px;
                font-weight: 600;
                color: var(--text-muted);
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            #lumen-demo-profile-card {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                margin: 0 0 2px 0;
                padding: 11px 14px;
                border-radius: 16px;
                background: color-mix(in srgb, var(--accent) 8%, var(--card-inner-bg));
                border: 1px solid color-mix(in srgb, var(--accent) 22%, var(--border-color));
                box-sizing: border-box;
                width: 100%;
                flex-shrink: 0;
            }
            #btn-lumen-demo-drawer-cta,
            #btn-lumen-demo-profile-cta {
                background: color-mix(in srgb, var(--accent) 14%, var(--card-bg));
                color: var(--accent);
                border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
                border-radius: 999px;
                padding: 5px 10px;
                font-size: 11px;
                font-weight: 800;
                text-decoration: none;
                white-space: nowrap;
                flex-shrink: 0;
            }
        `;
        document.head.appendChild(styleEl);

        const bar = document.createElement('div');
        bar.id = 'lumen-demo-showcase-bar';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Barra fija de demostración interactiva');
        bar.innerHTML = `
            <div class="lumen-demo-inner">
                <div class="lumen-demo-left">
                    <span class="lumen-demo-dot"></span>
                    <div class="lumen-demo-copy">
                        <span class="lumen-demo-title">Modo Demo</span>
                        <span class="lumen-demo-sub">Datos ficticios 2026</span>
                    </div>
                </div>
                <div class="lumen-demo-actions">
                    <button type="button" id="btn-lumen-demo-reset" title="Restaurar datos de prueba">Reiniciar</button>
                    <a id="btn-lumen-demo-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">Obtener App</a>
                </div>
            </div>
        `;
        document.body.appendChild(bar);

        // Espaciador en el flujo normal para que la barra fija no tape las tarjetas de inicio
        const spacer = document.createElement('div');
        spacer.id = 'lumen-demo-spacer';
        spacer.setAttribute('aria-hidden', 'true');
        const headerEl = document.querySelector('header');
        if (headerEl && headerEl.parentNode) {
            headerEl.insertAdjacentElement('beforebegin', spacer);
        } else {
            document.body.prepend(spacer);
        }

        // Sincronizar posición exacta con el borde inferior real de .top-bar (iOS notch / Android / Desktop)
        const syncDemoBarMetrics = () => {
            const topBar = document.querySelector('.top-bar');
            if (topBar) {
                const rect = topBar.getBoundingClientRect();
                if (rect.height > 0) {
                    document.documentElement.style.setProperty('--lumen-demo-top', `${Math.round(rect.bottom)}px`);
                }
            }
            const barRect = bar.getBoundingClientRect();
            if (barRect.height > 0) {
                document.documentElement.style.setProperty('--lumen-demo-spacer-h', `${Math.round(barRect.height + 6)}px`);
            }
        };

        syncDemoBarMetrics();
        requestAnimationFrame(syncDemoBarMetrics);
        setTimeout(syncDemoBarMetrics, 150);
        setTimeout(syncDemoBarMetrics, 500);
        window.addEventListener('resize', syncDemoBarMetrics, { passive: true });
        window.addEventListener('orientationchange', () => setTimeout(syncDemoBarMetrics, 120), { passive: true });

        if (typeof ResizeObserver === 'function') {
            const ro = new ResizeObserver(syncDemoBarMetrics);
            const topBarEl = document.querySelector('.top-bar');
            if (topBarEl) ro.observe(topBarEl);
            ro.observe(bar);
        }

        const drawerScrollEl = document.querySelector('#side-drawer .drawer-scroll');
        if (drawerScrollEl && !document.getElementById('lumen-demo-drawer-card')) {
            const drawerCard = document.createElement('div');
            drawerCard.id = 'lumen-demo-drawer-card';
            drawerCard.innerHTML = `
                <div class="lumen-demo-drawer-left">
                    <span class="lumen-demo-dot"></span>
                    <div style="min-width:0;">
                        <span class="lumen-demo-drawer-title">Modo Demo</span>
                        <span class="lumen-demo-drawer-sub">Un solo pago de por vida</span>
                    </div>
                </div>
                <a id="btn-lumen-demo-drawer-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">Obtener App</a>
            `;
            drawerScrollEl.prepend(drawerCard);
        }

        const profileMainViewEl = document.getElementById('profile-main-view');
        if (profileMainViewEl && !document.getElementById('lumen-demo-profile-card')) {
            const profileCard = document.createElement('div');
            profileCard.id = 'lumen-demo-profile-card';
            profileCard.innerHTML = `
                <div class="lumen-demo-drawer-left">
                    <span class="lumen-demo-dot"></span>
                    <div style="min-width:0;">
                        <span class="lumen-demo-drawer-title">Perfil en Modo Demo</span>
                        <span class="lumen-demo-drawer-sub">Un solo pago de por vida</span>
                    </div>
                </div>
                <a id="btn-lumen-demo-profile-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">Obtener App</a>
            `;
            profileMainViewEl.prepend(profileCard);
        }

        document.getElementById('btn-lumen-demo-reset')?.addEventListener('click', () => {
            window.location.reload();
        });

        // Interceptar acciones de exportación, importación, PIN y borrado en fase de captura
        const blockedButtons = {
            '#btn-export-data': 'Exportar respaldos cifrados (.lumen)',
            '#btn-import-trigger': 'Importar respaldos personales',
            '#btn-import-csv-trigger': 'Importar extractos CSV',
            '#btn-export-accountant-csv': 'Paquete Contador DIAN (.lumen-csv)',
            '#btn-decrypt-accountant-csv': 'Desbloquear Paquete Contador',
            '#btn-archive-year': 'Cierre y archivado de año',
            '#btn-wipe-data': 'Reiniciar base de datos local',
            '#btn-lock-app-profile': 'Bloqueo con PIN y Biometría',
            '#btn-continue-trip-setup': 'Modo Viaje y Liquidación 50/50'
        };

        document.addEventListener('click', (e) => {
            if (e.target.closest('#drawer-share-app')) {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.getElementById('side-drawer')?.classList.add('closed');
                document.getElementById('side-drawer-backdrop')?.classList.add('hidden');

                const demoShareUrl = 'https://funcionif.github.io/lumen-demo/';
                const shareText = `Conoce *Lumen*, una app colombiana para manejar tus finanzas personales, tarjetas, nómina y 4x1000 de forma 100% privada (sin conectar claves bancarias).\n\nPrueba la demo interactiva aquí (sin registro):\n${demoShareUrl}\n\nDescarga la App Lumen en Google Play (un solo pago de por vida, sin suscripciones):\n${PLAY_STORE_URL}`;

                if (navigator.share) {
                    navigator.share({
                        title: 'Lumen • Finanzas Personales',
                        text: shareText
                    }).catch(() => {});
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(shareText)
                        .then(() => alert('Mensaje de invitación copiado al portapapeles.'))
                        .catch(() => {});
                }
                return;
            }

            for (const [selector, label] of Object.entries(blockedButtons)) {
                if (e.target.closest(selector)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    if (selector === '#btn-continue-trip-setup') {
                        document.getElementById('trip-mode-modal')?.classList.add('hidden');
                    }
                    openDemoPlayPrompt(label);
                    return;
                }
            }
        }, true);

        document.addEventListener('submit', (e) => {
            if (e.target && e.target.id === 'profile-pin-form') {
                e.preventDefault();
                e.stopImmediatePropagation();
                openDemoPlayPrompt('Bóveda cifrada AES-256 con PIN y Biometría');
            } else if (e.target && e.target.id === 'trip-mode-form') {
                e.preventDefault();
                e.stopImmediatePropagation();
                document.getElementById('trip-mode-modal')?.classList.add('hidden');
                openDemoPlayPrompt('Modo Viaje y Liquidación 50/50');
            }
        }, true);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            mountDemoShowcaseUI();
            setTimeout(applyDemoRuntimeHooks, 150);
            setTimeout(applyDemoRuntimeHooks, 500);
        });
    } else {
        mountDemoShowcaseUI();
        setTimeout(applyDemoRuntimeHooks, 150);
        setTimeout(applyDemoRuntimeHooks, 500);
    }
})();
