// ==========================================
// INFO.JS - CENTRO DE AYUDA, LEGAL Y NOTAS DE VERSION (v2.2.3)
// Modulo independiente para mantener app.js ligero y limpio.
// ==========================================

const APP_VERSION = '2.2.3';

const getLumenLegalPlatform = () => {
    const capPlatform = window.Capacitor?.getPlatform?.();
    if (capPlatform === 'ios') return 'ios';
    if (capPlatform === 'android') return 'android';

    const ua = navigator.userAgent || '';
    const isIpadDesktopUA = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
    if (/iPhone|iPad|iPod/i.test(ua) || isIpadDesktopUA) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'web';
};

function openUniversalInfoModal(sectionKey) {
    const _plat = getLumenLegalPlatform();
    const _legalCtx = _plat === 'ios'
        ? {
            osName: 'iOS',
            deviceName: 'iPhone o iPad',
            storeName: 'Apple App Store',
            billingName: 'Apple (App Store)',
            storeTermsLabel: 'Acuerdo de Licencia de Usuario Final Estándar (EULA) de Apple y los Términos de los Servicios de Contenido Multimedia de Apple',
            storePrivacyLabel: 'Política de Privacidad de Apple',
            biometricLabel: 'Face ID, Touch ID o código del dispositivo a través de las API nativas de seguridad de iOS',
            packageExt: 'paquetes de instalación (.ipa)',
            uninstallPath: 'manteniendo pulsado el ícono de Lumen en tu dispositivo iOS o eliminando los datos del sitio web en Ajustes › Safari'
        }
        : (_plat === 'android'
            ? {
                osName: 'Android',
                deviceName: 'dispositivo Android',
                storeName: 'Google Play Store',
                billingName: 'Google Play Billing',
                storeTermsLabel: 'Términos de Servicio de Google Play',
                storePrivacyLabel: 'Política de Privacidad de Google',
                biometricLabel: 'huella dactilar, reconocimiento facial o PIN a través de las API nativas de seguridad de Android',
                packageExt: 'archivos de instalación (.apk / .aab)',
                uninstallPath: 'desinstalando Lumen en tu dispositivo Android o seleccionando "Borrar almacenamiento / Borrar datos" en los ajustes del sistema'
            }
            : {
                osName: 'Web / PWA',
                deviceName: 'dispositivo o navegador',
                storeName: 'la tienda oficial correspondiente o instalación PWA',
                billingName: 'la plataforma de distribución oficial aplicable',
                storeTermsLabel: 'términos aplicables de la plataforma de distribución correspondiente',
                storePrivacyLabel: 'políticas de privacidad del navegador o plataforma utilizada',
                biometricLabel: 'autenticación biométrica local (WebAuthn / Passkeys) gestionada de forma aislada por tu sistema operativo',
                packageExt: 'paquetes o copias no autorizadas de la aplicación',
                uninstallPath: 'borrando los datos del sitio en los ajustes de tu navegador o desinstalando la aplicación PWA'
            });
    let uModal = document.getElementById('universal-info-modal');

    // 1. Auto-generar el modal si no existe en el HTML
    if (!uModal) {
        uModal = document.createElement('div');
        uModal.id = 'universal-info-modal';
        uModal.className = 'modal hidden';
        uModal.setAttribute('role', 'dialog');
        uModal.setAttribute('aria-modal', 'true');
        document.body.appendChild(uModal);
    }

    // Garantizar estructura interna, cierre seguro y z-index superior (incluso sobre pantalla de bienvenida)
    uModal.style.zIndex = '2500';
    if (!document.getElementById('universal-info-title') || !document.getElementById('universal-info-body')) {
        uModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="universal-info-title">Información</h3>
                    <button type="button" class="btn-close-modal" aria-label="Cerrar">✕</button>
                </div>
                <div id="universal-info-body"></div>
            </div>
        `;
    }

    if (!uModal.dataset.infoEventsBound) {
        uModal.dataset.infoEventsBound = '1';
        let backdropPressed = false;
        uModal.addEventListener('pointerdown', (e) => {
            backdropPressed = (e.target === uModal);
        });
        uModal.addEventListener('click', (e) => {
            if (e.target === uModal) {
                e.stopPropagation();
                if (backdropPressed) uModal.classList.add('hidden');
                backdropPressed = false;
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !uModal.classList.contains('hidden')) {
                e.stopPropagation();
                uModal.classList.add('hidden');
            }
        });
    }

    const titleEl = document.getElementById('universal-info-title');
    const bodyEl = document.getElementById('universal-info-body');
    if (!titleEl || !bodyEl) return;

    // Calculo exacto del peso real en disco (incluye boveda cifrada lumen_vault_v1 cuando el PIN esta activo)
    let totalBytes = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        const val = Storage.prototype.getItem.call(localStorage, key) || localStorage.getItem(key) || '';
        totalBytes += (String(val).length + key.length) * 2;
    }
    const isVaultEncrypted = Boolean(localStorage.getItem('lumen_vault_v1'));
    const isVaultCurrentlyLocked = Boolean(window.LumenSecurity?.isVaultLocked?.());
    const storageKBNum = totalBytes / 1024;
    const storageKB = storageKBNum.toFixed(2);
    const storagePctNum = Math.min(100, (storageKBNum / 5120) * 100);
    const storagePct = storagePctNum.toFixed(1);
    const activeTxCount = (!isVaultCurrentlyLocked && typeof financeData !== 'undefined' && Array.isArray(financeData.transactions))
        ? financeData.transactions.filter(t => !t.isDeleted).length
        : 0;
    const txCountLabel = isVaultCurrentlyLocked ? 'Protegidos (Bóveda bloqueada)' : `${activeTxCount} activos`;
    const storageColor = storagePctNum > 80 ? 'var(--negative)' : (storagePctNum > 50 ? '#f59e0b' : 'var(--positive)');

    const diagText = `Lumen v${APP_VERSION} | Plataforma: ${_legalCtx.osName} | Boveda: ${isVaultEncrypted ? 'AES-256-GCM' : 'Sin PIN'} | Movimientos: ${isVaultCurrentlyLocked ? 'Bloqueados' : activeTxCount} | Pantalla: ${window.innerWidth}x${window.innerHeight}`;

    const contentMap = {
        storage: {
            title: 'Estado de Memoria',
            html: `
                <div class="glass-sub-box" style="font-size:12px; line-height:1.55;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <strong>Uso de Almacenamiento Local</strong>
                        <span style="color:${storageColor}; font-weight:800;">${storagePct}%</span>
                    </div>
                    <div class="pace-bar-track" style="height:8px; margin-bottom:12px; background:var(--hover-bg); border-radius:8px;">
                        <div class="pace-bar-fill" style="width:${storagePct}%; background-color:${storageColor}; height:100%; border-radius:8px; transition:width 0.5s ease;"></div>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--text-muted);">
                        <span>Espacio ocupado:</span> <strong>${storageKB} KB</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px; color:var(--text-muted);">
                        <span>Límite seguro (iOS/Android):</span> <strong>~5.120 KB (5 MB)</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between; margin-bottom:12px; color:var(--text-muted);">
                        <span>Estado de cifrado:</span> <strong style="color:${isVaultEncrypted ? 'var(--positive)' : 'var(--text-main)'};">${isVaultEncrypted ? 'Bóveda AES-256-GCM activa' : 'Sin PIN activo'}</strong>
                    </div>
                    
                    <div class="drawer-divider" style="margin:12px 0;"></div>
                    
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <span style="color:var(--text-muted);">Movimientos en memoria activa:</span> 
                        <strong style="color:var(--text-main);">${txCountLabel}</strong>
                    </div>
                    
                    <p style="margin-top:14px; font-size:11px; color:var(--text-muted); background:rgba(245, 158, 11, 0.08); padding:10px; border-radius:8px; border:1px solid rgba(245, 158, 11, 0.2);">
                        <b>Mantenimiento:</b> Al ser 100% Local-First, todos tus datos viven en tu dispositivo. Si te acercas al límite (más del 80%), ve a <b>Configuración > Copia de Seguridad</b> y utiliza el <b>Cierre de Año</b> para liberar espacio archivando años anteriores en IndexedDB.
                    </p>
                </div>
            `
        },
        bug: {
            title: 'Reportar un Problema',
            html: `
                <div class="glass-sub-box" style="font-size:12.5px; line-height:1.5;">
                    <p style="margin-bottom:10px; color:var(--text-muted);">
                        Si encontraste un error visual o de cálculo, copia el diagnóstico técnico de tu dispositivo (no incluye datos personales ni saldos) y envíalo junto con tu reporte.
                    </p>
                    <div id="bug-diag-text-box" style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:10px; padding:10px; font-size:11px; color:var(--text-muted); word-break:break-word; margin-bottom:12px;">${diagText}</div>
                    <button type="button" id="btn-copy-bug-diag" class="btn btn-primary" style="width:100%; padding:12px; border-radius:12px; font-weight:700;">
                        Copiar diagnóstico técnico
                    </button>
                </div>
            `
        },
        faq: {
            title: 'Guía Rápida y FAQ',
            html: `
                <div class="glass-sub-box" style="font-size:12px; line-height:1.58; margin-bottom:0;">
                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('lock', 16) : ''} 1. Arquitectura, Privacidad y Seguridad
                    </h4>
                    <p style="margin-bottom:8px;"><b>100% Local-First y Offline:</b> Todos tus datos financieros, configuraciones y saldos se guardan localmente en tu dispositivo (<code>localStorage</code> e <code>IndexedDB</code>). No existen servidores externos, telemetría ni rastreadores de terceros; la tipografía es local y el cortafuegos solo permite consultar TRM pública cuando tú lo solicitas.</p>
                    <p style="margin-bottom:8px;"><b>Modo Privacidad Global:</b> Toca el ícono del ojo en la barra superior para enmascarar al instante todos tus saldos, cuentas, tarjetas y gráficos con asteriscos (<code>****</code>) en espacios públicos.</p>
                    <p style="margin-bottom:8px;"><b>Bóveda Cifrada Real (AES-256-GCM + PBKDF2):</b> En <i>Mi Perfil › Seguridad y PIN</i> puedes activar un PIN numérico (4–6 dígitos), una <b>Clave Maestra alfanumérica</b> (8–64 caracteres) y <b>Biometría</b>. Al activarlo, tus cuentas, movimientos, nómina, parámetros UVT, CDTs y cierres anuales se cifran en disco con 210.000 iteraciones, la pantalla se cubre al minimizar y se bloquea automáticamente a los 30 segundos.</p>
                    <p style="margin-bottom:14px;"><b>Respaldos y Reportes Cifrados:</b> Exporta e importa copias de seguridad protegidas con contraseña en formato <code>.lumen</code> (retrocompatibles con <code>.json</code> anteriores) y reportes tributarios cifrados en formato <code>.lumen-csv</code>.</p>

                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('trending-up', 16) : ''} 2. Registro Inteligente y Captura Diaria
                    </h4>
                    <p style="margin-bottom:8px;"><b>Categorización Predictiva y Plantillas en 1 Toque:</b> Al escribir el comercio en <b>+</b>, Lumen infiere la categoría y sugiere tu cuenta más frecuente. Además, puedes guardar <b>Plantillas</b> de movimientos repetitivos para registrarlos en un toque y confirmar múltiples <b>Pendientes por lote</b>.</p>
                    <p style="margin-bottom:8px;"><b>Extractor Offline de SMS y Detector de Duplicados:</b> Pega notificaciones bancarias (Bancolombia, Nequi, Nu, Davivienda, Falabella, etc.) para extraer localmente monto, comercio y fecha. El formulario también avisa si ya existe un movimiento igual en cuenta y monto ese mismo día.</p>
                    <p style="margin-bottom:8px;"><b>Calculadora, Gasto Compartido y Split (Padre + Hijos):</b> Opera montos con la calculadora integrada, divide compras entre varias categorías o medios de pago (<b>Split</b>) y combínalo con <b>Gasto Compartido</b> para imputar solo tu parte al presupuesto y crear automáticamente la cuenta por cobrar (<code>CxC_</code>) con borrado y restauración en cascada desde la Papelera.</p>
                    <p style="margin-bottom:8px;"><b>Modo Reembolso / Devolución / Cashback:</b> En <i>Nuevo Ingreso</i>, activa este interruptor para compensar el gasto neto de su categoría original sin inflar tus ingresos del mes ni distorsionar el tope de 1.400 UVT de la DIAN.</p>
                    <p style="margin-bottom:8px;"><b>Ahorro de Vueltos y Redondeo Digital:</b> Redondea compras en efectivo o desde cuentas líquidas al siguiente múltiplo ($ 1.000, $ 5.000 o $ 10.000) y traslada el sobrante automáticamente a tu alcancía o bolsillo elegido.</p>
                    <p style="margin-bottom:14px;"><b>Recurrentes ↔ Presupuesto ↔ OmniModal:</b> Gestiona cobros fijos (mensuales, trimestrales o anuales, en COP, USD o EUR) vinculados en doble vía con subcategorías de Presupuesto (provisionando mes a mes o solo el mes del cobro). Incluye pre-llenado en 1 toque en <b>+</b>, actualización opcional de tarifa, aislamiento frente a Modo Viaje y reversión automática desde Papelera.</p>

                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('card', 16) : ''} 3. Tarjetas, Préstamos y Estrategia de Deudas
                    </h4>
                    <p style="margin-bottom:8px;"><b>Conciliación Inteligente (Tap-to-Clear):</b> Activa el botón de verificación (✓) en el historial para marcar los movimientos ya validados contra el extracto real de tu banco.</p>
                    <p style="margin-bottom:8px;"><b>Tarjetas de Crédito, Manejo y Seguros:</b> Controla fecha de corte, día de pago, tasas (% M.V. o % E.A.), cuota de manejo condicional o exonerada por metas de gasto/ingresos y seguro de vida deudores, sin duplicar cargos ya asentados en el ciclo.</p>
                    <p style="margin-bottom:8px;"><b>Múltiples Modalidades y Simulador de Abono Extra:</b> Administra préstamos fijos, cupos rotativos / BNPL (como Addi o Sistecrédito, incluyendo fianza) y créditos educativos. Desde el detalle de cada tarjeta o cupo simula si te conviene más <b>Reducir plazo o Reducir cuota</b> antes de abonar a capital.</p>
                    <p style="margin-bottom:14px;"><b>Planificador Avalancha / Bola de Nieve y Compra de Cartera:</b> Proyecta cascadas de pagos extra (incluso con primas legales) o entra a <i>Asesores Inteligentes › Compra de Cartera</i> para seleccionar tus deudas reales y validar si una oferta bancaria te ahorra intereses y cuota.</p>

                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('piggy', 16) : ''} 4. Presupuesto Vivo, Metas, CDT y Activos Fijos
                    </h4>
                    <p style="margin-bottom:8px;"><b>Presupuesto con Rollover y Rebalanceo en 1 Toque:</b> Define si el saldo no gastado de cada categoría inicia limpio, arrastra superávit (+) o arrastra superávit/déficit (+/-). Si una categoría se excede, usa <b>Cubrir sobregiro</b> para mover cupo libre desde otra categoría solo en ese mes sin subir tu presupuesto global.</p>
                    <p style="margin-bottom:8px;"><b>Bolsillos Inteligentes y Renta Fija (CDT / CDAT):</b> Calcula cuotas automáticas por meta o fecha (con opción de descuento por libranza desde nómina) y controla tus CDTs o CDATs en % E.A. con retención del 4%, avance diario y alertas de vencimiento.</p>
                    <p style="margin-bottom:8px;"><b>Hoja de Balance Histórica y Margen Diario:</b> Toca la píldora de fecha en la <i>Hoja de Balance</i> para reconstruir tu Patrimonio Neto y saldos a cualquier fecha exacta pasada. Debajo de <i>Libre Seguro Hoy</i> verás tu <b>margen diario disponible hasta la próxima nómina</b> y el bloque de compromisos próximos a 7 días.</p>
                    <p style="margin-bottom:14px;"><b>Activos Fijos, ROI y Agenda Anual:</b> Registra bienes (inmuebles, vehículos, tecnología), calcula su retorno real incluyendo mantenimientos y agenda obligaciones anuales (<b>SOAT, Tecnomecánica, Predial, Impuesto Vehicular, Seguro Todo Riesgo</b>) con pronto pago, vinculación a un bolsillo existente, sincronización con Recurrentes y pago directo desde el OmniModal.</p>

                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('briefcase', 16) : ''} 5. Nómina, 4x1000 y Tributación (Colombia)
                    </h4>
                    <p style="margin-bottom:8px;"><b>Liquidación Laboral, Anticipos y Pagos No Salariales:</b> Depura salud, pensión y FSP, registra anticipos de nómina y agrega conceptos no salariales con validación automática del tope del 40% (Ley 1393) y cálculo en tiempo real de prima, cesantías, intereses y vacaciones.</p>
                    <p style="margin-bottom:8px;"><b>Retefuente Art. 383 E.T. y Comparador Interanual:</b> Calcula Procedimiento 1 (topes anuales 790 / 1.340 UVT) o Procedimiento 2 (Porcentaje Fijo) y compara el impacto de cambios de UVT y SMMLV entre años (ej. 2026 vs. 2027).</p>
                    <p style="margin-bottom:8px;"><b>Control de 4x1000 (GMF):</b> Configura tu cuenta exenta (350 UVT/mes) y billeteras bajo monto (65 UVT/mes), con cálculo automático del 0,4% y alerta preventiva al alcanzar el 80% de tu tope mensual.</p>
                    <p style="margin-bottom:14px;"><b>Radar DIAN y Paquete para el Contador (.lumen-csv):</b> Monitorea topes de patrimonio (4.500 UVT), ingresos, tarjetas, compras y consignaciones (1.400 UVT) y exporta un paquete cifrado (desbloqueable a Excel desde Lumen) con tu resumen anual, GMF y saldos a 31 de diciembre. <i>Nota: Datos informativos basados en tus registros; no reemplazan certificados ni la exógena oficial de la DIAN.</i></p>

                    <h4 style="color:var(--accent); font-size:13px; margin:0 0 8px 0; border-bottom:1px solid var(--border-color); padding-bottom:4px; display:flex; align-items:center; gap:6px;">
                        ${typeof renderIcon === 'function' ? renderIcon('heart-pulse', 16) : ''} 6. Lumi, Análisis Integral y Memoria Histórica
                    </h4>
                    <p style="margin-bottom:8px;"><b>Lumi, tu Copiloto Contextual 100% Offline:</b> Adapta sus preguntas rápidas según la vista que tengas abierta para responder sobre tu <i>Libre Seguro Hoy</i>, carga fija, anticipos, qué tarjeta usar, gastos hormiga, abonos a capital o guías de uso sin salir de tu dispositivo.</p>
                    <p style="margin-bottom:8px;"><b>Semáforo de Salud Financiera y Gráficos SVG:</b> Puntaje de 0 a 100 en 4 pilares (flujo neto, liquidez, deuda y solvencia) junto a gráficos vectoriales nativos ligeros sin librerías externas pesadas.</p>
                    <p style="margin-bottom:0;"><b>Cierre de Año y Buscador en IndexedDB:</b> Consolida años anteriores para mantener ligero <code>localStorage</code> mientras mueves el detalle histórico (cifrado si tienes bóveda activa) a <code>IndexedDB</code>, con un <b>buscador en solo lectura</b> para consultar cualquier movimiento archivado sin descomprimirlo.</p>
                </div>
            `
        },
        terms: {
            title: 'Términos de Uso',
            html: `
                <div class="glass-sub-box" style="font-size:12px; line-height:1.58; margin-bottom:0;">
                    <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px 0;">
                        <b>Última actualización:</b> 25 de noviembre de 2026 • <b>Versión:</b> v${APP_VERSION}<br>
                        <b>Titular:</b> Función IF • Colombia •
                    </p>

                    <p style="margin-bottom:10px;">Al descargar, instalar o utilizar <b>Lumen</b> en ${_legalCtx.osName}, aceptas estos Términos y Condiciones de Uso.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">1. Objeto y licencia de uso</h4>
                    <p style="margin-bottom:8px;">Lumen es una aplicación de software diseñada para el registro, organización y simulación de finanzas personales. <b>Función IF</b> te otorga una licencia personal, mundial, no exclusiva, intransferible y revocable para instalar y usar la aplicación en tu ${_legalCtx.deviceName}, sujeta también a los ${_legalCtx.storeTermsLabel}.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">2. Alcance y actualizaciones</h4>
                    <p style="margin-bottom:8px;">La adquisición a través de ${_legalCtx.storeName} otorga acceso a las funcionalidades incluidas en esta versión sin suscripciones ocultas, junto con las actualizaciones de mantenimiento y corrección que publique el desarrollador. Función IF se reserva el derecho de publicar en el futuro productos independientes bajo nuevas licencias.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">3. Exención de asesoría financiera, contable y tributaria</h4>
                    <p style="margin-bottom:8px;"><b>Lumen es exclusivamente una herramienta tecnológica de apoyo organizativo y cálculo matemático.</b> Función IF no es una entidad bancaria, establecimiento de crédito, firma de inversión ni asesoría contable o tributaria.</p>
                    <p style="margin-bottom:8px;">Todos los cálculos (incluyendo amortizaciones, intereses, cuotas mínimas, compra de cartera, plan avalancha, CDT/CDAT, nómina, retención en la fuente, 4x1000 (GMF), respuestas del copiloto local <b>Lumi</b>, topes DIAN y el <b>Paquete para el Contador</b>) se construyen únicamente con base en la información registrada manualmente por el usuario y fórmulas matemáticas de referencia. <b>NO reemplazan tu realidad económica, los extractos oficiales de entidades financieras ni la información exógena oficial con la que la DIAN u otras entidades validan tus obligaciones.</b></p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">4. Custodia local, bóveda cifrada y respaldos</h4>
                    <p style="margin-bottom:8px;">Tu información financiera reside localmente en tu dispositivo. Tienes la responsabilidad exclusiva de realizar copias de seguridad periódicas (<code>.lumen</code>) y de custodiar tu PIN, Clave Maestra, código de recuperación y contraseñas de respaldo o de reportes cifrados (<code>.lumen-csv</code>). Al activar la bóveda cifrada (AES-256-GCM), Función IF no tiene forma técnica de recuperar tus datos si pierdes tus credenciales o el dispositivo.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">5. Pagos, reembolsos y propiedad intelectual</h4>
                    <p style="margin-bottom:8px;">Los pagos, impuestos aplicables y solicitudes de reembolso se gestionan exclusivamente mediante ${_legalCtx.billingName} bajo sus políticas vigentes. El código fuente, diseño, marca <b>Lumen</b>, textos, gráficos y arquitectura pertenecen exclusivamente a <b>Función IF</b>. Queda prohibido descompilar, modificar o redistribuir ${_legalCtx.packageExt} sin autorización.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">6. Limitación de responsabilidad y legislación</h4>
                    <p style="margin-bottom:0;">Lumen se ofrece <i>"tal cual"</i> y <i>"según disponibilidad"</i>. Estos términos se rigen por las leyes de la República de Colombia, incluyendo la Ley 1480 de 2011 (Estatuto del Consumidor).</p>
                </div>
            `
        },

        privacy: {
            title: 'Política de Privacidad',
            html: `
                <div class="glass-sub-box" style="font-size:12px; line-height:1.58; margin-bottom:0;">
                    <p style="font-size:11px; color:var(--text-muted); margin:0 0 12px 0;">
                        <b>Última actualización:</b> 25 de noviembre de 2026 • <b>Versión:</b> v${APP_VERSION}<br>
                        <b>Responsable:</b> Función IF • Colombia •
                    </p>

                    <p style="margin-bottom:10px;">En <b>Lumen</b> protegemos tu privacidad financiera conforme a las políticas de ${_legalCtx.storeName} y la normativa colombiana aplicable (Ley 1581 de 2012).</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">1. Arquitectura 100% Local-First (Sin servidores propios)</h4>
                    <p style="margin-bottom:8px;">Toda la información que registras (cuentas, saldos, movimientos, presupuestos, tarjetas, deudas, bolsillos, CDTs, activos fijos, nómina y parámetros tributarios) se almacena exclusivamente en tu ${_legalCtx.deviceName} (<code>localStorage</code> e <code>IndexedDB</code>). El copiloto <b>Lumi</b> y el lector de texto de alertas bancarias (SMS pegados manualmente) operan 100% de forma local: tus datos nunca se envían a servidores externos ni a modelos de IA en la nube.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">2. Cifrado en disco y biometría</h4>
                    <p style="margin-bottom:8px;">Si activas un PIN numérico o una Clave Maestra alfanumérica en contextos seguros (app nativa, PWA o HTTPS), Lumen cifra tu base local y archivo histórico con <b>AES-256-GCM + PBKDF2 (210.000 iteraciones)</b>, cubre la pantalla al minimizar y bloquea la sesión tras 30 segundos de inactividad. Si habilitas biometría, la verificación se realiza mediante ${_legalCtx.biometricLabel}; Lumen jamás lee ni almacena plantillas biométricas.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">3. Conexiones de red, facturación y cero rastreo</h4>
                    <p style="margin-bottom:8px;">Lumen no incluye publicidad, analítica, telemetría ni rastreadores, y sus fuentes tipográficas están auto-alojadas localmente. La aplicación únicamente realiza consultas puntuales de solo lectura (sin enviar datos personales ni credenciales) a APIs públicas de TRM cuando tú solicitas actualizar tasas de cambio.</p>
                    <p style="margin-bottom:8px;">Las compras y diagnósticos agregados de estabilidad son gestionados por ${_legalCtx.billingName} conforme a la ${_legalCtx.storePrivacyLabel}. Función IF nunca accede a los números de tus tarjetas ni credenciales bancarias.</p>

                    <h4 style="color:var(--accent); font-size:12.5px; margin:12px 0 6px 0;">4. Exportación cifrada, retención y eliminación</h4>
                    <p style="margin-bottom:8px;">Las copias de seguridad (<code>.lumen</code>) y reportes contables (<code>.lumen-csv</code>) pueden cifrarse con contraseña en tu dispositivo antes de descargarse. Una vez exportado cualquier archivo, su custodia fuera de Lumen es exclusiva del usuario.</p>
                    <p style="margin-bottom:0;">Puedes eliminar toda tu información en cualquier momento desde las opciones internas de reinicio de la app o ${_legalCtx.uninstallPath}. Esta app está dirigida a público adulto y no recopila datos de menores de 13 años.</p>
                </div>
            `
        },
        about: {
            title: 'Acerca y Novedades',
            html: `
                <div style="text-align:center; margin-bottom:14px;">
                    <div style="width:58px; height:58px; margin:0 auto 10px auto; border-radius:18px; background:linear-gradient(145deg, rgba(0,196,159,0.14), rgba(0,51,170,0.08)); border:1px solid rgba(0,196,159,0.32); display:flex; align-items:center; justify-content:center; box-shadow:0 8px 20px rgba(0,196,159,0.16);">
                        <svg width="36" height="36" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                            <defs>
                                <linearGradient id="lumenAboutGrad" x1="15%" y1="10%" x2="85%" y2="90%">
                                    <stop offset="0%" stop-color="#00C49F"/>
                                    <stop offset="50%" stop-color="#0033AA"/>
                                    <stop offset="100%" stop-color="#00C49F"/>
                                </linearGradient>
                            </defs>
                            <path d="M 48 74 L 48 24 A 10 10 0 0 0 28 24 L 28 54 A 12 12 0 0 0 40 66 L 76 66 A 10 10 0 0 1 76 86 L 60 86 A 12 12 0 0 1 48 74 Z" stroke="url(#lumenAboutGrad)" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <h3 style="font-size:18px; font-weight:800; color:var(--accent); margin:0;">Lumen • v${APP_VERSION}</h3>
                    <p style="font-size:12px; color:var(--text-muted); margin-top:3px;">Desarrollado por <b>Función IF</b> • © 2026</p>
                </div>

                <div class="glass-sub-box" style="text-align:center; padding:14px 16px;">
                    <p style="font-size:12.5px; font-weight:700; color:var(--text-main); margin:0 0 6px 0;">Claridad real sobre cada peso.</p>
                    <p style="font-size:11.5px; color:var(--text-muted); line-height:1.52; margin:0 0 12px 0;">
                        Tu espacio privado para organizar liquidez, presupuestos, deudas, ahorro e impuestos en Colombia, con la seguridad de una bóveda directamente en tu dispositivo.
                    </p>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:6px;">
                        <span style="font-size:10.5px; font-weight:700; color:var(--accent); background:var(--accent-soft); border:1px solid var(--accent-border); padding:3px 9px; border-radius:999px;">100% Local-First</span>
                        <span style="font-size:10.5px; font-weight:700; color:var(--text-main); background:var(--hover-bg); border:1px solid var(--border-color); padding:3px 9px; border-radius:999px;">Bóveda AES-256</span>
                        <span style="font-size:10.5px; font-weight:700; color:var(--text-main); background:var(--hover-bg); border:1px solid var(--border-color); padding:3px 9px; border-radius:999px;">Sin nube ni rastreo</span>
                    </div>
                </div>

                <h4 style="font-size:13px; font-weight:800; margin:14px 0 8px 0; text-align:left;">Historial de Versiones</h4>

                <details class="changelog-accordion" data-changelog-v223="1" open>
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('shield', 14) : ''} Versión 2.2.3 • Bóveda Cifrada y Presupuesto Vivo (Actual)</span><span>▾</span></summary>
                    <ul>
                        <li><b>Seguridad • Bóveda Cifrada Real (AES-256-GCM + PBKDF2):</b> Al activar PIN numérico (4–6 dígitos), Clave Maestra alfanumérica (8–64 caracteres) o Biometría, tus cuentas, movimientos, nómina, parámetros UVT, CDTs y cierres anuales en IndexedDB se cifran en disco con 210.000 iteraciones. Incluye cortina instantánea al minimizar, arranque Fail-Closed, auto-bloqueo real a los 30 segundos y bloqueo progresivo tras 4 intentos fallidos.</li>
                        <li><b>Seguridad • Respaldos y Reportes Cifrados (.lumen y .lumen-csv):</b> Exporta e importa copias de seguridad cifradas con contraseña (retrocompatibles con respaldos .json), borrado total seguro, tipografía Montserrat 100% local, CSP estricta y cortafuegos sin telemetría (solo consulta pública de TRM cuando lo solicitas).</li>
                        <li><b>Nuevo • Recurrentes ↔ Presupuesto ↔ OmniModal:</b> Renombramiento integral a <i>Recurrentes</i> con multimoneda (COP, USD, EUR), creación de subcategorías al vuelo, opción para provisionar mes a mes o cargar el mes del cobro, desglose <i>Fijo vs. Variable</i>, pre-llenado en 1 toque dentro de <b>+</b>, ajuste opcional de tarifa y reversión automática desde la Papelera.</li>
                        <li><b>Nuevo • Productividad y Captura Inteligente:</b> Plantillas frecuentes en 1 toque, confirmación de pendientes por lote, compromisos próximos 7 días, atajo de sobrante sin asignar, <b>Gasto Compartido + Split simultáneo</b> (Padre + Hijos), <b>Modo Reembolso / Devolución / Cashback</b> con guía de ayuda (<code>?</code>) que compensa el gasto sin inflar ingresos ni el tope DIAN, <b>extractor offline de SMS bancarios</b> y detector en vivo de posibles duplicados.</li>
                        <li><b>Nuevo • Presupuesto Vivo y Memoria Histórica:</b> Consulta tu <b>Hoja de Balance en cualquier fecha histórica</b> desde la píldora de fecha, revisa tu <b>margen diario hasta la próxima nómina</b> debajo de <i>Libre Seguro Hoy</i>, cubre sobregiros en 1 toque moviendo cupo libre entre categorías y busca en solo lectura dentro de tus años archivados en <b>IndexedDB</b> sin ocupar <code>localStorage</code>.</li>
                        <li><b>Nuevo • Estrategia Patrimonial y Tributaria Colombia:</b> Redondeo de ahorro en cuentas digitales, <b>Simulador Reducir plazo vs. cuota</b> en Tarjetas y Cupos Rotativos, <b>Simulador de Compra de Cartera</b> con tus deudas reales, <b>Agenda Anual en Activos Fijos</b> (SOAT, Tecnomecánica, Predial, Vehicular) vinculable a bolsillos existentes y recurrentes, comparador interanual de Nómina/DIAN y <b>Paquete para el Contador</b> cifrado (<code>.lumen-csv</code>) desbloqueable a Excel.</li>
                        <li><b>Mejora • Lumi Contextual y Alertas Preventivas:</b> Preguntas rápidas dinámicas según el módulo abierto, avisos de gasto inusualmente alto, alerta preventiva al alcanzar el 80% del tope mensual 4x1000 (350 / 65 UVT), recordatorios de respaldo y alertas de obligaciones anuales en Activos Fijos.</li>
                        <li><b>Correcciones • Integridad Contable, iOS y PWA:</b> Preservación de bolsillos y gastos 50/50 en <i>Sincronización y Recálculo</i>, eliminación de doble conteo en presupuestos y tarjetas (intereses compensatorios, cuota de manejo y seguro ya cobrados), motor salarial y DIAN unificado (bordes FSP, 790/1.340 UVT, primas y anticipos), fechas locales sin desfase UTC en CDTs y <code>.ics</code>, Service Worker atómico, ajustes de modales e inputs de 16px para iOS Safari y limpieza total de emojis en toda la app.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('trending-up', 14) : ''} Versión 2.2.2 • Bienvenido Lumi (BETA) y Renta Fija</span><span>▾</span></summary>
                    <ul>
                        <li><b>Nuevo • Lumi: Tu Copiloto Financiero 100% Offline:</b> Asistente inteligente local con más de 60 habilidades financieras que analiza tus datos reales sin conexión a internet. Consulta tu <i>Libre Seguro Hoy</i>, qué tarjeta te conviene usar según su fecha de corte, proyecciones de cierre de mes, detección de gastos hormiga, simulaciones de abonos a capital, rastreo de <code>#etiquetas</code> y guías paso a paso sobre el funcionamiento de Lumen.</li>
                        <li><b>Nuevo • Módulo de Renta Fija (CDT y CDAT):</b> Simula y controla tus certificados de depósito a término (CDT desde 30 días y CDAT desde 5 días) con conversión exacta de tasa Efectiva Anual (<code>% E.A.</code>), base comercial o calendario (360/365 días), retención en la fuente del 4%, avance diario, vista de ganancias causadas y alertas inteligentes de vencimiento.</li>
                        <li><b>Nuevo • Desbloqueo Automático por PIN:</b> Activa el interruptor en <i>Perfil > Seguridad y PIN</i> para entrar directamente a Lumen en el instante en que termines de digitar tu PIN correcto, sin necesidad de pulsar el botón de confirmación.</li>
                        <li><b>Mejora • Escudo de Modo Viaje Compartido (50/50):</b> Protección a nivel de sistema (<i>Kernel Shield</i>) al registrar gastos pagados por tu acompañante (<code>CxC_Gastos_Acompanante</code>) para evitar descontar saldos de tus cuentas personales y asegurar un cruce exacto 50/50 al finalizar el viaje.</li>
                        <li><b>Mejora • Selección Múltiple y Papelera en Cascada:</b> Mantén pulsado un movimiento en el historial (o toca <i>Seleccionar</i>) para eliminar registros en lote de forma segura. Además, los movimientos vinculados (intereses y libranzas) se envían y restauran en conjunto desde la Papelera.</li>
                        <li><b>Mejora • Soporte Integrado y Mantenimiento:</b> Lumi incorpora guías exactas para liquidar CDTs vencidos sin descuadrar rendimientos, recuperar registros borrados y ejecutar la herramienta de <i>Sincronización y Recálculo</i>.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('award', 14) : ''} Versión 2.2.1 • Lanzamiento Lumen</span><span>▾</span></summary>
                    <ul>
                        <li><b>Nueva Identidad • Evolución a Lumen:</b> Evolucionamos nuestro nombre e imagen visual con un nuevo isologo y una paleta fintech de alto contraste (Verde Menta y Azul Zafiro), acompañada de una pantalla de bienvenida para usuarios sin alterar tu información guardada.</li>
                        <li><b>Nuevo • Restauración Selectiva de Respaldos:</b> Al importar un archivo <code>.json</code>, una nueva hoja Bento analiza su contenido y te permite elegir exactamente qué módulos deseas restaurar (Cuentas, Movimientos, Presupuesto, etc.) conservando intactos tus datos actuales en los módulos no seleccionados.</li>
                        <li><b>Nuevo • Sincronización y Recálculo:</b> Añadimos una herramienta de mantenimiento en <i>Preferencias</i> que escanea todo tu historial, corrige desajustes matemáticos de decimales y limpia transacciones huérfanas de forma segura.</li>
                        <li><b>Mejora • Salud Financiera en Lenguaje Claro:</b> Tradujimos todos los diagnósticos y recomendaciones (Flujo, Liquidez, Deuda y Patrimonio) a un lenguaje cotidiano, directo y sin tecnicismos bancarios para que sepas exactamente qué paso dar.</li>
                        <li><b>Mejora • Rediseño de Cuentas y Plan de Deudas:</b> Renovamos la lista de liquidez con un diseño de tarjeta premium y saldos dinámicos (verde/rojo). Además, transformamos el cronograma de deudas en tarjetas verticales Bento, eliminando el scroll horizontal en móviles.</li>
                        <li><b>Mejora • Personalización Visual Unificada:</b> Ahora todos los botones principales, alertas y el degradado cristalino de la cabecera se sincronizan dinámicamente con el color principal que elijas en tu perfil.</li>
                        <li><b>Mejora • Ecosistema Bento y Cristal Acelerado:</b> Reemplazo de menús nativos y cuadros de diálogo por hojas inferiores deslizantes y modales Glassmorphism con buscador instantáneo, agrupación inteligente y desenfoque acelerado por hardware en iOS y Android.</li>
                        <li><b>Nuevo • Descubrimiento de Biometría:</b> Banner inteligente de bienvenida que detecta automáticamente si tu dispositivo soporta Face ID o Huella Dactilar, invitándote a activarlo con un solo toque.</li>
                        <li><b>Corrección • Proyecciones, Modales Móviles y CxC:</b> Colores dinámicos (verde/rojo) aplicados a la <i>Proyección Realista Híbrida</i>, límite de altura responsiva en la ventana de <i>Nuevo Movimiento</i> para evitar recortes en celulares, ajuste de etiquetas en <i>Modo Viaje</i>, cabeceras fijas al hacer scroll y ajuste contable en Cuentas por Cobrar.</li>
                        <li><b>Técnico • Sincronización PWA y Portapapeles:</b> Actualización del Service Worker a una estrategia <i>Network-First</i> para recibir mejoras al instante, sumado a un respaldo nativo para la copia segura del código de recuperación.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('layers', 14) : ''} Versión 2.2.0</span><span>▾</span></summary>
                    <ul>
                        <li><b>Nuevo • Recorrido Interactivo de Bienvenida (Coachmarks):</b> Tutorial guiado paso a paso con foco iluminado tras el registro inicial que presenta los 4 puntos clave de navegación y seguridad, con ajuste automático al teclado en iOS.</li>
                        <li><b>Nuevo • Control y Cálculo de 4x1000 (GMF):</b> Configura tus cuentas exentas o gravadas con el Gravamen a los Movimientos Financieros y visualiza el impacto real del impuesto en tus retiros y transferencias.</li>
                        <li><b>Nuevo • Modo Viaje y División Compartida 50/50:</b> Aísla el presupuesto de tus vacaciones con etiqueta automática (<code>#destino</code>), vincúlalo a un bolsillo de ahorro (con asistente para transferir o conservar el sobrante al volver) y activa el modo <b>Viaje Compartido 50/50</b> para registrar con un toque quién pagó cada gasto y generar la liquidación automática (cuenta por cobrar o deuda) al cerrar el viaje.</li>
                        <li><b>Nuevo • Resumen de Cierre de Mes (Recap) y Balance Anual Proactivo:</b> Carrusel interactivo en tarjetas Bento con logros desbloqueables, gráficas comparativas SVG, consejos estacionales personalizados para cada mes del año, alertas de alzas en suscripciones o gastos hormiga, diagnóstico de memoria local y activación inteligente solo cuando existe historial cerrado.</li>
                        <li><b>Nuevo • Gestor Múltiple de Pagos No Salariales y Primas Extralegales:</b> Activa el interruptor en <i>Nómina y Prestaciones</i> para agregar bonos, auxilios o primas extralegales con nombre personalizado, valor, mes específico de pago (o fijo mensual), control individual de <i>Base Retefuente</i>, validación automática del tope del 40% de la Ley 1393 y guía visual con ejemplos comparativos.</li>
                        <li><b>Nuevo • Contadores de Días Restantes en Cabecera:</b> Indicadores flotantes alineados sobre el selector de fechas que muestran en tiempo real cuántos días faltan para terminar el mes y el año en curso.</li>
                        <li><b>Mejorado • Diálogos de Confirmación:</b> Reemplazo de las alertas nativas del navegador por modales personalizados con iconografía vectorial, integrados al tema activo y compatibles con modo claro, oscuro y AMOLED.</li>
                        <li><b>Mejorado • Nueva Visual del Modal de Registro de Movimientos:</b> Interfaz renovada, más limpia y ergonómica con selector segmentado, conversión de Dólar (USD) y Euro (EUR) a COP en vivo, etiquetas rápidas (<code>#tags</code>), ahorro de vueltos, división de gastos y controles contextuales inteligentes.</li>
                        <li><b>Mejorado • Asesores Inteligentes y Simuladores Financieros:</b> Optimización del <i>Asesor de Tarjetas</i> (días de gracia, cupo y exoneración de cuota de manejo), <i>Simulador de Compra Inteligente</i> (equivalencia en horas/días de trabajo e impacto en tu punto más bajo de caja a 30 días), <i>Comparador de Créditos (Banco A vs. B)</i> y <i>Proyección de Efectivo Día por Día</i>.</li>
                        <li><b>Mejorado • Motor Laboral con Promedios CST y Retroactivos:</b> Cálculo de promedios salariales ponderados para Prima (Art. 306 CST) y Cesantías (Art. 253 CST), simulación de aumentos con retroactivo, sincronización mensual en presupuesto y proyección anual de Renta DIAN.</li>
                        <li><b>Mejorado • Navegación y Distribución en Cuentas y Liquidez:</b> Reinicio automático al listado principal al cerrar el modal, liberación de altura fija en el historial para aprovechar toda la pantalla y cálculo exacto al 100% en la barra de distribución excluyendo cuentas por cobrar (<code>CxC_</code>).</li>
                        <li><b>Corregido • Auditoría del Motor Financiero y Ciclos Personalizados:</b> Exclusión estricta de movimientos en la Papelera y gastos pagados por acompañantes en Modo Viaje en todos los cálculos (topes de 4x1000, extractos de tarjetas, cupos rotativos, topes DIAN, Salud Financiera y cierre de año), además de sincronizar el día de inicio de mes personalizado en <i>Libre Seguro Hoy</i>, mapa de calor y proyección de efectivo.</li>
                        <li><b>Corregido • Estabilidad Visual y Compatibilidad en Safari iOS:</b> Reparación de reglas globales de caja en CSS, aislamiento del desenfoque (<code>blur</code>) en bordes de modales en iPhone, eliminación del doble desplazamiento en presupuestos anuales, cabeceras ancladas con <code>position: sticky</code> y ajuste de saltos de línea en cifras monetarias.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('chart', 14) : ''} Versión 2.1.0</span><span>▾</span></summary>
                    <ul>
                        <li><b>Modo Viaje con Presupuesto Aislado:</b> Activa un tope exclusivo para vacaciones sin alterar tus categorías mensuales habituales, con guía interactiva, auto-etiquetado (<code>#destino</code>), filtro rápido de gastos y color de tema dedicado.</li>
                        <li><b>Cálculo y Conversión de Dólar (USD) y Euro (EUR) a COP:</b> Selector de divisa directo en el registro de movimientos con <b>cálculo en vivo a pesos colombianos</b>, constancia del valor original en la descripción, auto-etiquetado (<code>#usd</code> / <code>#eur</code>), tasas configurables y consulta de TRM oficial en tiempo real con respaldo 100% offline.</li>
                        <li><b>Asesor de Tarjetas (¿Con qué tarjeta pago hoy?):</b> Analiza días de gracia hasta la fecha de pago, cupo disponible, cuotas sin interés y metas de exoneración de cuota de manejo para recomendarte la mejor tarjeta en cada compra.</li>
                        <li><b>Simulador de Compra Inteligente:</b> Convierte cualquier precio en horas y días de trabajo según tu nómina, evalúa el impacto en tu <i>Libre Seguro Hoy</i>, el punto más bajo de caja a 30 días y el costo financiero si difieres a cuotas.</li>
                        <li><b>Simulador de Crédito y Comparador (Banco A vs. B):</b> Proyecta cuotas fijas con conversión automática <code>% E.A.</code> ↔ <code>% M.V.</code>, seguros, abonos extra a capital, cálculo de cupo máximo endeudable y comparativa real entre dos entidades financieras.</li>
                        <li><b>Proyección de Efectivo Día por Día:</b> Línea de tiempo interactiva desde <i>Libre Seguro Hoy</i> (fin de mes, 15, 30 y 60 días) con detalle desplegable por fecha y detección del punto más bajo de liquidez.</li>
                        <li><b>Calculadora de Ahorro (Interés Compuesto):</b> Proyecta el crecimiento de tu capital por edades, frecuencia de aporte y tasa E.A., con integración a tus bolsillos, gráfica SVG y tabla año por año.</li>
                        <li><b>Resumen y Cierre del Mes:</b> Carrusel guiado de 3 tarjetas Bento para revisar tu tasa de ahorro, detectar desviaciones de presupuesto y transferir excedentes directos a un bolsillo.</li>
                        <li><b>Detector de Gastos Hormiga y Alzas en Suscripciones:</b> Nueva tarjeta en Análisis con tope configurable, impacto anualizado (<code>×12</code>), ranking de compras pequeñas frecuentes y alertas de incrementos en servicios recurrentes.</li>
                        <li><b>Hoja de Balance Comparativa en Análisis:</b> Nueva tarjeta que contrasta el cierre del mes anterior contra el corte actual cuenta por cuenta, con barra de solvencia, variación neta y filtros (<i>Todos</i>, <i>Con cambios</i>, <i>Activos</i>, <i>Pasivos</i>).</li>
                        <li><b>Extractos y Proyección de Tarjetas de Crédito:</b> Selector de extractos mensuales (<code>-1</code> a <code>+4</code> meses), gráfica de barras interactiva, exoneración de cuota de manejo por compras o por ingresos en cuenta y botón para cargar cargos al saldo.</li>
                        <li><b>Cuentas Líquidas vs. Aisladas:</b> Opción en cada cuenta para excluirla del cálculo de <i>Libre Seguro Hoy</i> (ideal para CDTs o fondos intocables) sin sacarla de tu Patrimonio Neto.</li>
                        <li><b>Sistema de Etiquetas (#Tags) y Analítica de Proyectos:</b> Sugerencias rápidas de etiquetas al registrar, filtro instantáneo con total acumulado en historial y tarjeta de proyectos en Análisis.</li>
                        <li><b>Papelera de Reciclaje y Duplicación Rápida:</b> Borrado seguro reversible para restaurar movimientos eliminados y botón <i>Duplicar</i> para clonar transacciones frecuentes con fecha de hoy.</li>
                        <li><b>Ciclos de Fecha Personalizados:</b> Configura el día de corte de tu mes financiero (ej. día 5, 15 o 16) con indicador visible del rango activo en la cabecera.</li>
                        <li><b>Pendientes Virtuales (To-Do List Financiero):</b> Inyección automática en el filtro <i>Pendientes</i> de suscripciones próximas, cuotas de préstamos, pagos mínimos de tarjetas y gastos fijos por ejecutar.</li>
                        <li><b>Proyección de Declaración de Renta (Colombia):</b> Evaluación automática de topes DIAN en UVT (patrimonio, ingresos, consignaciones, tarjetas y compras) y simulación de Cédula General (Art. 241 E.T.).</li>
                        <li><b>Mapa de Calor Diario en Calendario:</b> Visualiza la intensidad de gasto diario en modo <i>Solo variable</i> o <i>Gasto total</i>, conteo de días sin gasto y promedio por día activo.</li>
                        <li><b>Cierre de Año en IndexedDB y Monitor de Memoria:</b> Escáner de almacenamiento local con alertas preventivas y archivo histórico por año sin perder el respaldo detallado.</li>
                        <li><b>Reportes Ejecutivos PDF y Modo Demo:</b> Generación de extracto mensual, soporte de deudas a favor y liquidación laboral imprimibles, además de datos de prueba en un toque para explorar la app.</li>
                        <li><b>Personalización Avanzada:</b> Formato de moneda configurable (símbolo, negativos y decimales), abreviación de cifras (<code>k</code>, <code>M</code>), modo pantalla Negro Puro (AMOLED) y modo rendimiento.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('sliders', 14) : ''} Versión 2.0.2</span><span>▾</span></summary>
                    <ul>
                        <li><b>Sistema de Etiquetas (#Tags):</b> Clasifica movimientos por proyecto o evento y consulta sus totales acumulados en Análisis.</li>
                        <li><b>Papelera de Reciclaje y Duplicación:</b> Recupera movimientos eliminados por error y clona registros frecuentes con fecha de hoy.</li>
                        <li><b>Ciclos de Fecha Personalizados:</b> Configura el día de corte de tu mes financiero (ej. día 15 o 16) para presupuestos y gráficos.</li>
                        <li><b>Reporte Ejecutivo PDF y Cierre de Año:</b> Generación de extracto mensual imprimible y compresión histórica en <code>IndexedDB</code>.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('calendar', 14) : ''} Versión 2.0.1</span><span>▾</span></summary>
                    <ul>
                        <li><b>Control Anual Rediseñado:</b> Nueva vista de balance anual con diseño vertical Bento UI, reemplazando la tabla horizontal para una mejor experiencia móvil sin scroll.</li>
                        <li><b>Formateador Ultracompacto:</b> Eliminación de decimales en el reporte anual para optimizar el espacio y mejorar la legibilidad de la cuadrícula.</li>
                        <li><b>Gestión de Deudas a Favor:</b> Nuevo selector de motivo en el registro de cobros (Préstamo vs Venta/Servicio) con vinculación directa al presupuesto de ingresos.</li>
                        <li><b>Correcciones (Bugfixes):</b> Solución al cálculo del presupuesto global en categorías que contienen subcategorías, y estabilización del scroll en el menú lateral.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('palette', 14) : ''} Versión 2.0.0</span><span>▾</span></summary>
                    <ul>
                        <li><b>Estética Fintech Editorial y Bento UI:</b> Superficies mate de alto contraste, tipografía tabular con decimales atenuados y derivación tonal dinámica (<code>color-mix</code>).</li>
                        <li><b>Formularios Plegables e Inteligentes:</b> Todos los formularios de creación ahora son desplegables para maximizar el espacio en pantalla y se cierran al guardar.</li>
                        <li><b>Iconografía Vectorial 100% Unificada:</b> Eliminación total de emojis residuales en categorías, reemplazados por íconos SVG planos y espaciado optimizado.</li>
                        <li><b>Presupuesto Adaptativo y Barra Global:</b> Los formularios mutan dinámicamente entre límites de gasto y metas de ingreso, incorporando una barra de progreso global.</li>
                        <li><b>Guía Contextual de Arrastre (Rollover):</b> Nuevo aviso explicativo dinámico que detalla el impacto del sobrante o déficit según el modo elegido.</li>
                        <li><b>Lógica Bancaria Avanzada (TC):</b> Cálculo inteligente de pagos mínimos, cuota de manejo (condicional) y seguro de deudores.</li>
                        <li><b>Ahorro de Monedas:</b> Redondeo inteligente del efectivo con contabilidad en doble partida.</li>
                        <li><b>Gestor Educativo:</b> Módulo de matrícula universitaria con plan de pagos, trámites extra y alertas a 7 días.</li>
                        <li><b>Gastos Compartidos y Deudas a Favor:</b> Divide cuentas pagadas por otros y gestiona cuentas por cobrar independientes de tu liquidez.</li>
                        <li><b>Presupuesto Restante Dinámico:</b> Auto-llenado del saldo disponible al registrar gastos y revisión de saldo en tiempo real.</li>
                        <li><b>Aumento de Sueldo y Retroactivos:</b> Simula incrementos salariales con impacto neto real y programa pagos retroactivos.</li>
                        <li><b>Ahorro Automático (Nómina):</b> Nueva opción "Descuento por nómina" en Bolsillos que abona a tus metas de ahorro automáticamente.</li>
                        <li><b>Bolsillos Ocultos:</b> Excluye metas de ahorro de la hoja de balance para proteger tu capital psicológico.</li>
                        <li><b>Suscripciones y Fijos:</b> Gestiona tus servicios recurrentes y recibe alertas tempranas para pagarlos con 1 solo toque.</li>
                        <li><b>Modo Privacidad Global:</b> Nuevo botón oculto en la cabecera ("Ojo"). Tapa al instante todos tus saldos reales con asteriscos.</li>
                        <li><b>Préstamos Fijos Flexibles:</b> Permiten registrar desembolsos adicionales manteniendo su base de amortización.</li>
                        <li><b>Analítica Suavizada y Personalizable:</b> Gráficos SVG rediseñados y reorganizables a tu gusto.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('diamond', 14) : ''} Versión 1.2.0</span><span>▾</span></summary>
                    <ul>
                        <li><b>Onboarding Mejorado:</b> Nueva experiencia de bienvenida en dos pasos, con firma visual de Función IF.</li>
                        <li><b>Cupos Rotativos Consolidados:</b> Registra múltiples compras por comercio dentro de un mismo cupo (Addi, Sistecrédito).</li>
                        <li><b>Bolsillos Inteligentes:</b> Cálculo automático de cuotas y fechas objetivo para tus metas de ahorro.</li>
                        <li><b>Fondo de Cesantías:</b> Nuevo sistema para acumular y separar tus cesantías año tras año.</li>
                        <li><b>Historial de Activos y ROI:</b> Lleva el registro de la valorización o depreciación de tu patrimonio.</li>
                        <li><b>Liquidación Completa:</b> Módulo mejorado de nómina con vacaciones compensadas y bonos ocasionales.</li>
                        <li><b>Bolsillos en Transferencias:</b> Transfiere dinero desde o hacia tus bolsillos de ahorro directamente.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('heart-pulse', 14) : ''} Versión 1.1.2</span><span>▾</span></summary>
                    <ul>
                        <li>Nuevo tablero visual con anillos SVG de Salud Financiera en 4 pilares y Metas de Ahorro.</li>
                        <li>Soporte para Cupos Rotativos / BNPL (Addi, Sistecrédito) con simulador de impacto en salud.</li>
                        <li>Descuento por libranza de préstamos integrado en el cálculo de nómina neta.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('calculator', 14) : ''} Versión 1.1.0</span><span>▾</span></summary>
                    <ul>
                        <li>Módulo completo de Nómina Colombia (Art. 383 E.T., Ley 1393, FSP, quincenas y simulador de bonos).</li>
                        <li>Planificador multi-deuda con métodos Avalancha y Bola de Nieve.</li>
                        <li>Calculadora matemática integrada sin uso de <code>eval()</code>.</li>
                    </ul>
                </details>

                <details class="changelog-accordion">
                    <summary><span>${typeof renderIcon === 'function' ? renderIcon('check', 14) : ''} Versión 1.0.0</span><span>▾</span></summary>
                    <ul>
                        <li>Lanzamiento inicial Local-First con bloqueo por PIN cifrado, Hoja de Balance y presupuestos.</li>
                    </ul>
                </details>
            `
        }
    };

    const selected = contentMap[sectionKey] || contentMap.about;
    titleEl.innerText = selected.title;
    bodyEl.innerHTML = selected.html;
    uModal.classList.remove('hidden');
}

const _baseOpenUniversalInfoModal = openUniversalInfoModal;

window.openUniversalInfoModal = (sectionKey) => {
    _baseOpenUniversalInfoModal(sectionKey);
    const uModal = document.getElementById('universal-info-modal');
    if (!uModal) return;

    // Asegura que cualquier enlace mailto: use protocolo seguro sin filtrar saldos ni cuentas
    uModal.querySelectorAll('a[href]').forEach((link) => {
        const href = String(link.getAttribute('href') || '').trim();
        if (!/^mailto:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(\?[a-zA-Z0-9_.%~&=-]*)?$/i.test(href) && !/^https:\/\/funcionif\.github\.io\//i.test(href)) {
            link.removeAttribute('href');
        }
    });
};

const replaceVersionInTextNodes = (rootEl) => {
    if (!rootEl) return;
    rootEl.childNodes.forEach((node) => {
        if (node.nodeType === 3 && /v2\.2\.\d+/i.test(node.nodeValue || '')) {
            node.nodeValue = node.nodeValue.replace(/v2\.2\.\d+/gi, `v${APP_VERSION}`);
        } else if (node.nodeType === 1) {
            replaceVersionInTextNodes(node);
        }
    });
};

const syncAllVersionBadges = () => {
    ['home-version-btn', 'profile-version-btn', 'drawer-version-btn'].forEach((id) => {
        replaceVersionInTextNodes(document.getElementById(id));
    });
    document.querySelectorAll('.version-footer-btn, #auth-overlay .auth-brand-bar span').forEach((el) => {
        replaceVersionInTextNodes(el);
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAllVersionBadges, { once: true });
} else {
    syncAllVersionBadges();
}

const checkWhatsNewBanner = () => {
    if (typeof authData === 'undefined' || !authData) return;
    if (document.body?.classList.contains('app-locked') || window.LumenSecurity?.isVaultLocked?.()) return;

    const triggerBioDiscoveryIfNeeded = () => {
        if (typeof window.checkWhatsNewBanner === 'function' && window.checkWhatsNewBanner !== checkWhatsNewBanner) {
            window.checkWhatsNewBanner();
        }
    };

    const lastSeen = localStorage.getItem('myFinancesLastSeenVersion');
    if (lastSeen === APP_VERSION) {
        triggerBioDiscoveryIfNeeded();
        return;
    }

    localStorage.setItem('myFinancesLastSeenVersion', APP_VERSION);

    let verToast = document.getElementById('lumen-version-whatsnew-toast');
    if (!verToast) {
        verToast = document.createElement('div');
        verToast.id = 'lumen-version-whatsnew-toast';
        verToast.className = 'sw-toast hidden';
        verToast.style.cursor = 'pointer';
        verToast.innerHTML = `${typeof renderIcon === 'function' ? renderIcon('award', 15) : ''}<span></span>`;
        document.body.appendChild(verToast);
        verToast.addEventListener('click', () => {
            verToast.classList.add('hidden');
            window.openUniversalInfoModal('about');
        });
    }

    const span = verToast.querySelector('span:last-child');
    if (span) span.textContent = `Nueva versión v${APP_VERSION} • Ver novedades`;
    verToast.classList.remove('hidden');

    setTimeout(() => {
        verToast.classList.add('hidden');
        triggerBioDiscoveryIfNeeded();
    }, 6500);
};