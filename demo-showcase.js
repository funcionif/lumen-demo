// ============================================================================
// LUMEN - MODO VITRINA / DEMO INTERACTIVA WEB (v2.2.3)
// Cargar SOLO en el sitio web de demostración, justo después de demo-data.js
// y ANTES de security.js y core.js. NUNCA incluir en la compilación Android.
// ============================================================================
(function initLumenWebShowcase() {
    'use strict';

    // CONFIGURACIÓN: Reemplaza esta URL por tu enlace oficial de Google Play cuando publiques
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

    const seedRamStore = () => {
        ramStore.clear();
        const demoVersion = String(bundle.version || '2.2.3');
        ramStore.set('myFinances', JSON.stringify(bundle.finances || {}));
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

        // Silenciar modales de onboarding/bienvenida para aterrizar directo en el Dashboard
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

    // 3. RESPONDER ARCHIVO HISTÓRICO 2025 DESDE RAM (para probar Buscador IndexedDB sin escribir en disco)
    const demoArchived2025 = Array.isArray(bundle.archivedTransactions) ? bundle.archivedTransactions : [];
    const bindArchivedDemoHook = () => {
        if (demoArchived2025.length === 0) return;
        window.getArchivedTransactions = async (targetYear = null) => {
            if (!targetYear) return demoArchived2025.map((t) => ({ ...t }));
            const prefix = `${targetYear}-`;
            return demoArchived2025
                .filter((t) => String(t.monthId || '').startsWith(prefix))
                .map((t) => ({ ...t }));
        };
    };

    // 4. MODAL DE INVITACIÓN A GOOGLE PLAY PARA FUNCIONES EXCLUSIVAS DE LA APP NATIVA
    const openDemoPlayPrompt = (featureLabel) => {
        const title = 'Disponible en Lumen Completo';
        const message = `Estás explorando el <b>Modo Demo Interactivo</b> con datos ficticios que se reinician al recargar.<br><br>La función <b>${featureLabel}</b> y el guardado cifrado permanente en tu teléfono están incluidos en <b>Lumen Vitalicio</b> (pago único, sin mensualidades).`;

        if (typeof window.openBentoConfirmModal === 'function') {
            window.openBentoConfirmModal({
                title,
                subtitle: 'Demo interactiva • Solo lectura temporal',
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

    // 5. BARRA SUPERIOR DISCRETA DE MODO DEMO + BLOQUEO DE EXPORTACIÓN/PIN/BORRADO
    const mountDemoShowcaseUI = () => {
        bindArchivedDemoHook();

        // Ocultar overlays promocionales secundarios que distraen en la demo
        ['lumi-release-banner-overlay', 'bio-update-modal', 'gmf-welcome-modal', 'lumen-update-modal'].forEach((id) => {
            document.getElementById(id)?.classList.add('hidden');
        });

        if (document.getElementById('lumen-demo-showcase-bar')) return;

        // Estilos encapsulados para la barra superior de vitrina
        const styleEl = document.createElement('style');
        styleEl.id = 'lumen-demo-showcase-style';
        styleEl.textContent = `
            #lumen-demo-showcase-bar {
                position: sticky;
                top: 0;
                z-index: 2500;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: calc(8px + env(safe-area-inset-top, 0px)) 14px 8px 14px;
                background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
                color: #f8fafc;
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 4px 16px rgba(15, 23, 42, 0.22);
                font-family: inherit;
            }
            .lumen-demo-left {
                display: flex;
                align-items: center;
                gap: 7px;
                min-width: 0;
            }
            .lumen-demo-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #00C49F;
                box-shadow: 0 0 0 3px rgba(0, 196, 159, 0.25);
                flex-shrink: 0;
            }
            .lumen-demo-text {
                font-size: 11.5px;
                font-weight: 700;
                color: #f1f5f9;
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
                padding: 5px 9px;
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
                box-shadow: 0 4px 12px rgba(0, 196, 159, 0.35);
            }
        `;
        document.head.appendChild(styleEl);

        const bar = document.createElement('div');
        bar.id = 'lumen-demo-showcase-bar';
        bar.setAttribute('role', 'region');
        bar.setAttribute('aria-label', 'Barra de demostración interactiva');
        bar.innerHTML = `
            <div class="lumen-demo-left">
                <span class="lumen-demo-dot"></span>
                <span class="lumen-demo-text">Demo interactiva (datos 2026)</span>
            </div>
            <div class="lumen-demo-actions">
                <button type="button" id="btn-lumen-demo-reset" title="Restaurar datos de prueba">Reiniciar</button>
                <a id="btn-lumen-demo-cta" href="${PLAY_STORE_URL}" target="_blank" rel="noopener noreferrer">Obtener App</a>
            </div>
        `;
        document.body.prepend(bar);

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
            '#btn-lock-app-profile': 'Bloqueo con PIN y Biometría'
        };

        document.addEventListener('click', (e) => {
            for (const [selector, label] of Object.entries(blockedButtons)) {
                if (e.target.closest(selector)) {
                    e.preventDefault();
                    e.stopImmediatePropagation();
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
            }
        }, true);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            mountDemoShowcaseUI();
            setTimeout(bindArchivedDemoHook, 250);
        });
    } else {
        mountDemoShowcaseUI();
        setTimeout(bindArchivedDemoHook, 250);
    }
})();
