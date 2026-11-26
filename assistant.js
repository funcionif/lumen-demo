// ============================================================
// LUMI - TU COPILOTO LOCAL (assistant.js) - EDICIÓN OMNISCIENTE
// Personalidad: Amigo Experto y Empático | 100% Offline | Cero Emojis
// Incluye System Prompt embebido y guías de uso local-first.
// ============================================================

const LUMI_SYSTEM_PROMPT = `
Eres Lumi, el asistente financiero inteligente y nativo de "Lumen • Función IF".
Tu misión es ayudar al usuario a tomar decisiones tranquilas, claras y rentables con su dinero en Colombia, explicando sus números sin enredos técnicos ni regaños, y guiándolo con precisión dentro de la aplicación.

ARQUITECTURA TÉCNICA DE LUMEN (LOCAL-FIRST):
- 100% Privado y Sin Conexión: Lumen no usa servidores externos ni nube. Todos los datos (cuentas, movimientos, nómina, CDTs, PIN) se almacenan exclusivamente en el navegador/dispositivo del usuario (localStorage e IndexedDB para años archivados).
- Si el usuario borra la caché/datos del navegador, desinstala la PWA o cambia de dispositivo sin exportar un respaldo, perderá su información.

REGLAS DE ORO Y FLUJOS EXACTOS DE LA APLICACIÓN (QUÉ HACER Y QUÉ NO HACER):

1. Liquidación de CDT y CDAT vencidos (Regla estricta):
- NUNCA recomiendes hacer una "Transferencia" desde un CDT vencido hacia una cuenta de ahorros, porque los intereses ganados quedarían por fuera como ingreso real.
- Paso a paso correcto: 1) Tocar el botón "+" -> "Nuevo Ingreso", elegir la cuenta destino real y registrar el valor TOTAL recibido (Capital + Rendimientos netos) bajo la categoría "Rendimientos". 2) Abrir "Menú lateral > Mi Dinero > Ahorro > CDT y CDAT" y presionar "Eliminar" en el título vencido.

2. Recuperar Movimientos Eliminados (Papelera y Borrado en Cascada):
- Al eliminar un movimiento no se borra de inmediato: va a "Menú lateral > Sistema y Ayuda > Papelera".
- Si borra un movimiento padre (como un pago de tarjeta con intereses o nómina con libranzas), sus registros hijos vinculados también van a la papelera y se restauran juntos con un clic en "Restaurar".

3. Descuadre de Saldos vs. Ajuste Individual vs. Conciliación:
- Recálculo global del sistema: "Avatar Perfil > Seguridad y PIN > Sincronización y Recálculo > Realizar Mantenimiento" (limpia decimales, purga registros huérfanos y reconstruye saldos).
- Ajuste de una cuenta puntual: "Menú lateral > Cuentas" (o tocar la cuenta en Hoja de Balance) -> "Ajustar saldo real". Crea un ajuste que no distorsiona ingresos/gastos del mes.
- Conciliación con extracto bancario ("Tap to Clear"): En "Movimientos del Mes", tocar el ícono de verificación (✓) para ir marcando movimientos revisados.

4. Seguridad, PIN, Biometría y Auto-Desbloqueo:
- Ruta: "Avatar Perfil > Seguridad y PIN".
- Auto-desbloqueo: Una vez activado, entrará automáticamente a la app sin requerir hacer clic en el botón "Desbloquear" si el PIN escrito coincide.

5. Escudo Modo Viaje (Acompañante 50/50):
- Si el usuario reporta que su acompañante pagó un gasto del viaje, se asigna automáticamente la cuenta fantasma "CxC_Gastos_Acompanante". Esto evita descontar saldo real y permite hacer el cruce de cuentas 50/50 ("Liquidación") al final.

TONO Y PERSONALIDAD:
Sé cálido, directo y muy claro. No uses jerga técnica compleja a menos que sea necesario. Eres un experto financiero y de software, pero hablas como un amigo cercano y organizado. Usa listas cortas y viñetas para explicar los pasos. NUNCA inventes funciones que no estén en estas reglas y NUNCA uses emojis, apóyate en el texto en negrita y etiquetas (SVGs) nativas.
`;

(function () {
    const normalizeText = (str) => {
        return String(str || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[¿?¡!.,;:()]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const esc = (v) => (typeof window.escapeHtml === 'function'
        ? window.escapeHtml(v)
        : String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

    const cleanRawLabel = (str) => {
        if (typeof stripLeadingEmoji === 'function') return stripLeadingEmoji(str);
        return String(str || '').replace(/^[\s\uFE0F\u200D\p{Extended_Pictographic}]+/gu, '').trim();
    };

    const cleanLabel = (str) => esc(cleanRawLabel(str));

    const r2 = (v) => (typeof round2 === 'function' ? round2(v) : Math.round((Number(v) || 0) * 100) / 100);
    const fmt = (v) => {
        const rawFormatted = typeof formatMoney === 'function' ? formatMoney(v) : `$ ${v}`;
        return `<span class="privacy-sensitive">${esc(rawFormatted)}</span>`;
    };
    const isRefundTx = (t) => Boolean(t && ((typeof isTxRefundAdjustment === 'function' && isTxRefundAdjustment(t)) || t.isRefund));
    const safeParseLocal = (key, fallback = null) => {
        try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
    };

    const SVG = {
        ok: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
        warn: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        info: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
        card: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>`,
        flame: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
        chart: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:-2px; margin-right:5px;"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>`,
        tip: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0; margin-top:1px; color:var(--accent);"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>`
    };

    const renderTip = (text) => `
        <div style="margin-top:12px; padding:9px 12px; border-radius:12px; background:color-mix(in srgb, var(--accent) 11%, transparent); border:1px solid color-mix(in srgb, var(--accent) 25%, transparent); display:flex; align-items:flex-start; gap:8px; color:color-mix(in srgb, var(--accent) 75%, var(--text-main)); font-size:11.5px; font-weight:600; line-height:1.45;">
            ${SVG.tip}
            <span>${text}</span>
        </div>
    `;

    const getUserFirstName = () => {
        try {
            const rawAuth = typeof authData !== 'undefined' && authData
                ? authData
                : JSON.parse(localStorage.getItem('myFinancesAuth') || 'null');
            if (rawAuth && rawAuth.name) return String(rawAuth.name).trim().split(/\s+/)[0];
        } catch (e) {}
        return '';
    };

    const getLiveSnapshot = (monthId) => {
        if (typeof computeBalancesUpTo === 'function') return computeBalancesUpTo(monthId);
        return { bals: typeof currentBalances !== 'undefined' ? currentBalances : {}, assetsTotal: 0, liabilitiesTotal: 0 };
    };

    const parseTokenAsCOP = (tokenStr) => {
        const s = String(tokenStr || '').trim();
        if (!s) return 0;
        if (typeof parseMoneyInput === 'function') {
            return Math.max(0, r2(parseMoneyInput(s)));
        }
        if (/^\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(s)) {
            return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
        }
        if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) {
            return parseFloat(s.replace(/,/g, '')) || 0;
        }
        return parseFloat(s.replace(',', '.')) || 0;
    };

    const extractAmountFromText = (rawText) => {
        const cleanStr = String(rawText || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\b4\s*x\s*1000\b/g, ' ')
            .replace(/\b50\s*[\/ ]\s*30\s*[\/ ]\s*20\b/g, ' ')
            .replace(/\b[12]q\b/g, ' ')
            .replace(/#\S+/g, ' ')
            .replace(/\$/g, '')
            .replace(/\b(un|una)\s+(millon|millones|mil)\b/g, '1 $2');

        const unitMatch = cleanStr.match(/(\d+(?:[.,]\d+)?)\s*(k|mil|m|millon|millones)\b/i);
        if (unitMatch) {
            const unit = unitMatch[2].toLowerCase();
            const mult = (unit === 'm' || unit.startsWith('millon')) ? 1000000 : 1000;
            return r2((parseFloat(unitMatch[1].replace(',', '.')) || 0) * mult);
        }

        const strippedUnits = cleanStr
            .replace(/\b\d+(?:[.,]\d+)?\s*(?:%|cuotas?|dias?|mes(?:es)?|anos?)\b/g, ' ');
        const numMatch = strippedUnits.match(/\d{1,3}(?:[.,]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?/g);
        if (!numMatch) return 0;
        const parsedNums = numMatch.map(parseTokenAsCOP).filter((n) => n > 0);
        return parsedNums.length > 0 ? Math.max(...parsedNums) : 0;
    };

    const getGreetingHtml = () => {
        const firstName = esc(getUserFirstName());
        return `
            <strong style="display:block; font-size:15px; font-weight:800; color:var(--text-main); margin-bottom:6px; letter-spacing:-0.2px;">
                ¡Hola${firstName ? `, ${firstName}` : ''}! Soy Lumi, tu copiloto financiero.
            </strong>
            <span style="color:var(--text-muted); display:block; font-size:13px; line-height:1.48;">
                Estoy aquí para ayudarte a tomar decisiones tranquilas con tu plata, sin enredos ni regaños. Puedes preguntarme si te alcanza para un gusto, qué tarjeta te conviene usar hoy, cómo vas a cerrar el mes o cómo hacer cosas específicas en la app.
            </span>
        `;
    };

    document.addEventListener('DOMContentLoaded', () => {
        const respBox = document.getElementById('lumen-assistant-response');
        if (respBox && !respBox.innerHTML.trim()) respBox.innerHTML = getGreetingHtml();
    });

    // ============================================================
    // HABILIDAD LUMI: DETECCIÓN, CONSULTA Y SIMULACIÓN DE CDT / CDAT
    // ============================================================
    function handleLumiCDTIntent(rawText) {
        const q = String(rawText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (!/\b(cdt|cdat|renta fija|certificado de deposito|certificados de deposito|rendimiento|rendimientos)\b/.test(q)) return null;

        const fmtCOP = (n) => `<span class="privacy-sensitive">${esc(new Intl.NumberFormat('es-CO', {
            style: 'currency', currency: 'COP', maximumFractionDigits: 0
        }).format(Math.round(Number(n) || 0)))}</span>`;

        if (/\b(liquidar|vencio|vencido|pasar|transferir|cuenta principal|retirar)\b/.test(q)) {
            return {
                title: 'Cómo liquidar tu CDT vencido',
                answer: `<span style="color:var(--info);">${SVG.info}</span> Para que tus saldos cuadren perfecto (incluyendo la ganancia que te dio el banco), <b>NO uses el botón de Transferencia</b>. Sigue este paso a paso:<br><br>1. Ve a "Nuevo Ingreso".<br>2. Elige tu cuenta real (ej. Nu o Bancolombia) y pon el valor <b>TOTAL</b> que te llegó (Capital + Intereses).<br>3. Usa la categoría "Rendimientos" o "Inversiones".<br>4. Abre el menú <b>CDT y CDAT</b> y elimina el registro del CDT vencido (o ajústalo a $0).${renderTip('Hacerlo así garantiza que Lumen registre la ganancia real del mes y libere ese dinero en tu disponible diario.')}`
            };
        }

        if (/\b(abrir|abre|ir a|mostrar|ver|simulador|modal|registrar|crear|nuevo)\b/.test(q) && !/\d{5,}/.test(q)) {
            return {
                title: 'Simulador de Renta Fija',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Puedes abrir el módulo de <b>CDT y CDAT</b> en <b>Menú lateral › Mi Dinero › Ahorro › CDT y CDAT</b>.<br><br>Allí simulas tasas Efectivas Anuales (E.A.), el descuento de retención en la fuente (4%) y el avance diario de tus títulos.`
            };
        }

        if (/\b(diferencia|cual conviene|mejor|que es|endos|vender|explica)\b/.test(q)) {
            return {
                title: '¿CDT o CDAT?',
                answer: `Ambos son ahorros a plazo fijo con tasa garantizada, pero cambian en liquidez y plazo:<br><br>• <b>CDT (Desde 30 días):</b> Si tienes una emergencia, <b>puedes cederlo o venderlo</b> a otra persona antes del vencimiento para recuperar tu dinero.<br>• <b>CDAT (Desde 5 días):</b> Versión 100% digital para plazos cortos y montos bajos, pero <b>no se puede ceder ni vender</b>; tu dinero queda quieto hasta cumplir el plazo.${renderTip('Usa CDAT para excedentes de pocos días y CDT si buscas tasas a varios meses con opción de respaldo.')}`
            };
        }

        const simCapital = extractAmountFromText(rawText);
        const rateMatch = q.match(/(\d+(?:[.,]\d+)?)\s*%/);
        const daysMatch = q.match(/(\d+)\s*dias?/);

        if (simCapital >= 10000 && (rateMatch || daysMatch) && typeof calculateCDTReturns === 'function') {
            const capital = simCapital;
            const tasaEA = rateMatch ? parseFloat(rateMatch[1].replace(',', '.')) : 10.5;
            const plazoDias = daysMatch ? Math.max(1, parseInt(daysMatch[1], 10)) : 90;

            const sim = calculateCDTReturns({ capital, tasaEA, plazoDias, baseDias: 360, retefuentePct: 4 });
            return {
                title: 'Simulación rápida de Renta Fija',
                answer: `Simulación a <b>${plazoDias} días</b> con tasa del <b>${esc(String(tasaEA).replace('.', ','))}% E.A.</b> sobre <b>${fmtCOP(capital)}</b>:<br><br>• Rendimiento bruto: <b>${fmtCOP(sim.rendimientoBruto)}</b><br>• Retención en la fuente (4%): <b style="color:var(--negative);">-${fmtCOP(sim.retefuente)}</b><br>• <b>Ganancia neta:</b> <b style="color:var(--positive);">+${fmtCOP(sim.rendimientoNeto)}</b><br>• <b>Total a recibir:</b> <b style="color:var(--text-main);">${fmtCOP(sim.totalAcumulado)}</b>${renderTip('Para guardarlo en tu portafolio, abre Menú lateral › Ahorro › CDT y CDAT.')}`
            };
        }

        if (typeof getCDTPortfolioInsights === 'function') {
            const info = getCDTPortfolioInsights();
            if (info.cantidadActivos === 0) {
                return {
                    title: 'Sin CDTs activos',
                    answer: `Aún no tienes <b>CDT ni CDAT</b> registrados. Este dinero suma a tu Patrimonio Neto sin comprometer tu Disponible diario.${renderTip('Abre el módulo de CDT y CDAT en el menú lateral para simular cuánto te rendiría tu dinero.')}`
                };
            }

            const detalle = info.titulos.map(t =>
                `• <b>${esc(t.tipo)} ${esc(t.entidad)}:</b> ${fmtCOP(t.capital)} al ${esc(String(t.tasaEA).replace('.', ','))}% E.A. (${t.status.estaVencido ? '¡Vencido!' : `vence ${esc(t.status.fechaVencimiento)}, faltan ${Number(t.status.diasRestantes) || 0}d`}) → <b style="color:var(--positive);">+${fmtCOP(t.status.proyeccionTotal.rendimientoNeto)}</b> netos.`
            ).join('<br>');

            return {
                title: 'Tu Portafolio de Renta Fija',
                answer: `Tienes <b>${info.cantidadActivos} título${info.cantidadActivos === 1 ? '' : 's'} activo${info.cantidadActivos === 1 ? '' : 's'}</b> por un capital de <b>${fmtCOP(info.capitalTotal)}</b> (rendimiento causado a hoy: <b style="color:var(--positive);">+${fmtCOP(info.rendimientoCausadoTotal)}</b>):<br><br>${detalle}`
            };
        }

        return null;
    }

    window.askLumi = function (rawQuestion) {
        const raw = String(rawQuestion || '').trim();
        const q = normalizeText(raw);
        const data = typeof financeData !== 'undefined' ? financeData : JSON.parse(localStorage.getItem('myFinances') || 'null');
        const firstName = esc(getUserFirstName());
        const nameTag = firstName ? `${firstName}, ` : '';

        const isGreeting = !q || /^(hola|buenos dias|buenas tardes|buenas noches|hey|saludos)\b/.test(q);
        const isCapabilitiesQuery = /\b(que puedes hacer|que sabes hacer|en que me puedes ayudar|en que me ayudas|para que sirves|que haces|tus funciones|tus habilidades|como funcionas|como te uso|quien eres|ayuda)\b/.test(q);

        if (isCapabilitiesQuery) {
            return {
                title: firstName ? `${firstName}, esto es todo lo que puedo hacer por ti` : 'Esto es todo lo que puedo hacer por ti',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Analizo tus datos reales de Lumen 100% sin conexión para ayudarte con:<br><br>` +
                    `• <b>Tu día a día:</b> Darte tu briefing del día, calcular tu <i>Libre Seguro Hoy</i>, proyectar cómo vas a cerrar el mes o decirte si te alcanza para una compra.<br>` +
                    `• <b>Tarjetas y deudas:</b> Decirte qué tarjeta te conviene usar hoy según su fecha de corte, simular compras a cuotas, calcular abonos extra a capital o armar tu plan Avalancha / Bola de Nieve.<br>` +
                    `• <b>Ahorro e inversión:</b> Revisar tus bolsillos, medir tu colchón de emergencia y simular o consultar tus <b>CDT y CDAT</b>.<br>` +
                    `• <b>Nómina e impuestos (Colombia):</b> Proyectar tu prima, cesantías, retefuente, simular un bono y guiarte con la exención del <b>4x1000</b>.<br>` +
                    `• <b>Diagnósticos y rastreo:</b> Detectar gastos hormiga, revisar tus suscripciones, comparar este mes contra el anterior o sumar los movimientos de cualquier <b>#etiqueta</b>.<br>` +
                    `• <b>Soporte en Lumen:</b> Guiarte paso a paso para liquidar un CDT vencido, recuperar algo de la Papelera, recalcular saldos o manejar el Modo Viaje.` +
                    renderTip('Escribe tu pregunta con tus propias palabras o toca cualquiera de las sugerencias de abajo.')
            };
        }

        if (isGreeting) {
            return {
                title: firstName ? `Hola de nuevo, ${firstName}` : 'Hola, soy Lumi',
                answer: `Soy tu copiloto financiero dentro de Lumen. Traduzco tus números a explicaciones claras para que tomes buenas decisiones sin enredos.<br><br>Puedes preguntarme cosas como:<br>• <i>"¿Qué puedes hacer?"</i><br>• <i>"Dame mi briefing del día"</i><br>• <i>"¿Cómo voy a cerrar el mes?"</i><br>• <i>"¿Qué pasa si abono 1 millón a mi tarjeta?"</i><br>• <i>"¿Tengo gasto hormiga?"</i>`
            };
        }

        if (!data || !Array.isArray(data.customAccounts)) {
            return {
                title: 'Aún estamos empezando',
                answer: 'Todavía no tienes cuentas creadas en Lumen. Registra tu primera cuenta o saldo inicial en el inicio y empezamos a analizar tus números juntos.'
            };
        }

        const now = typeof currentDate !== 'undefined' ? new Date(currentDate) : new Date();
        const monthId = typeof getMonthId === 'function' ? getMonthId(now) : now.toISOString().slice(0, 7);
        const snap = getLiveSnapshot(monthId);
        const balances = snap.bals || {};
        const extAmt = extractAmountFromText(raw);

        // ==========================================
        // BLOQUE 0: REGLAS Y SOPORTE DE LUMEN
        // ==========================================

        if (q.includes('descuadre') || q.includes('no cuadran') || q.includes('suma mal') || q.includes('saldos mal') || q.includes('matematica') || q.includes('recalcular')) {
            return {
                title: 'Cómo reparar tus saldos',
                answer: `<span style="color:var(--info);">${SVG.info}</span> Si notas que tus saldos están desajustados por un error temporal, puedes reconstruirlos usando la herramienta de mantenimiento. Sigue estos pasos:<br><br>1. Toca el avatar o inicial arriba a la derecha (Mi Perfil).<br>2. Entra a <b>Seguridad y PIN</b>.<br>3. Busca el bloque azul <b>Sincronización y Recálculo</b>.<br>4. Presiona <b>Realizar Mantenimiento</b>.<br><br>Eso forzará a Lumen a leer todo tu historial y corregir las cuentas.`
            };
        }

        if (/\b(papelera|borre por error|restaurar movimiento)\b/.test(q) || /\b(recuperar|elimine|borre)\b/.test(q) && /\b(movimiento|gasto|ingreso|registro|transaccion|error)\b/.test(q)) {
            return {
                title: 'Recuperar movimientos eliminados',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> No te preocupes, no tienes que volver a registrar eso a mano. Lumen tiene una papelera.<br><br>1. Abre el <b>Menú principal</b> (las tres rayitas arriba a la izquierda).<br>2. Baja hasta Sistema y Ayuda, y toca <b>Papelera</b>.<br>3. Busca el movimiento que borraste y presiona "Restaurar".`
            };
        }

        if (q.includes('donde se guarda') || q.includes('privacidad') || q.includes('copia de seguridad') || q.includes('backup') || q.includes('cambiar de celular') || q.includes('otro dispositivo')) {
            return {
                title: 'Privacidad y Copias de Seguridad',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Lumen es 100% <b>Local-First</b>. No usa servidores externos ni nubes; todo vive únicamente en la memoria interna de este dispositivo.<br><br><span style="color:var(--negative);">${SVG.warn}</span> <b>Importante:</b> Si cambias de teléfono o borras los datos del sitio/app sin respaldo, <b>perderás tu información</b>.<br><br>Ve a <b>Perfil > Copia de Seguridad</b> y exporta tu archivo cifrado <code>.lumen</code> para llevar tus datos protegidos.`
            };
        }

        if (/\b(pin|huella|face id|touch id|biometria|clave maestra|desbloqueo automatico)\b/.test(q)) {
            return {
                title: 'Seguridad, Bóveda Cifrada y Biometría',
                answer: `Protege Lumen desde <b>Perfil > Seguridad y PIN</b>:<br><br>• <b>PIN o Clave Maestra:</b> Cifra tus datos locales con AES-256-GCM.<br>• <b>Desbloqueo Automático:</b> Entra al instante al completar tu PIN.<br>• <b>Biometría:</b> Integra Face ID, Touch ID o huella nativa de tu dispositivo.`
            };
        }

        // 0. Habilidad Dedicada: CDT / CDAT
        const cdtResponse = handleLumiCDTIntent(raw);
        if (cdtResponse) return cdtResponse;

        // ==========================================
        // BLOQUE 1: RASTREADOR DE ETIQUETAS (#TAGS) Y BRIEFING
        // ==========================================

        const tagMatch = raw.match(/#([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/);
        if (tagMatch) {
            const tag = tagMatch[1].toLowerCase();
            const safeTag = esc(tag);
            const taggedTxs = (data.transactions || []).filter(t =>
                !t.isDeleted &&
                (String(t.description || '').toLowerCase().includes(`#${tag}`) ||
                 (Array.isArray(t.tags) && t.tags.some(tg => String(tg).toLowerCase().replace(/^#/, '') === tag)))
            );

            if (taggedTxs.length === 0) {
                return {
                    title: `Sin registros para #${safeTag}`,
                    answer: `No encontré movimientos etiquetados con <b>#${safeTag}</b> en tu historial.${renderTip(`Cuando registres un gasto o ingreso, escribe #${safeTag} en la descripción para que yo pueda agrupar todos los costos de ese proyecto o evento.`)}`
                };
            }

            let totExp = 0, totInc = 0;
            taggedTxs.forEach(t => {
                if (t.type === 'expense') totExp = r2(totExp + r2(t.amount));
                if (t.type === 'income') totInc = r2(totInc + r2(t.amount));
            });

            const netCost = r2(totExp - totInc);
            return {
                title: `Balance de etiqueta #${safeTag}`,
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Encontré <b>${taggedTxs.length} movimiento(s)</b> marcados con <b>#${safeTag}</b>:<br><br>• <b>Total que ha salido:</b> <strong style="color:var(--negative);">${fmt(totExp)}</strong><br>• <b>Ingresos o devoluciones:</b> <strong style="color:var(--positive);">${fmt(totInc)}</strong><br>• <b>Costo real neto:</b> <b>${fmt(netCost)}</b>${renderTip('El costo neto resta cualquier dinero que te hayan devuelto o aportado bajo esta misma etiqueta.')}`
            };
        }

        if (q.includes('briefing') || q.includes('resumen del dia') || q.includes('panorama general') || q.includes('estado general')) {
            let liquid = 0;
            data.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_') && !a.excludeFromLiquidity).forEach(a => { liquid = r2(liquid + r2(balances[a.id] || 0)); });
            const safe = typeof computeSafeToSpendToday === 'function' ? computeSafeToSpendToday(monthId, snap) : null;
            const safeVal = safe ? safe.safeToSpend : liquid;
            const pending = (data.transactions || []).filter(t => !t.isDeleted && t.monthId === monthId && t.status === 'pending');
            const totPend = r2(pending.reduce((s, t) => s + r2(t.budgetedAmount || t.amount), 0));
            const hm = typeof computeCalendarHeatmapData === 'function' ? computeCalendarHeatmapData(now, 'variable') : null;

            return {
                title: `Tu resumen financiero de hoy`,
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> ${nameTag}aquí tienes una foto clara de cómo están tus cuentas hoy:<br><br>• <b>Plata disponible en cuentas:</b> <b>${fmt(liquid)}</b><br>• <b>Plata libre segura para gastar hoy:</b> <strong style="color:${safeVal >= 0 ? 'var(--positive)' : 'var(--negative)'};">${fmt(safeVal)}</strong><br>• <b>Recibos o pagos pendientes del mes:</b> ${pending.length} (suman ${fmt(totPend)})<br>• <b>Días sin gastos variables este mes:</b> ${hm ? `${hm.zeroSpendDays} días` : 'N/A'}${renderTip('La "plata libre segura" ya descuenta tus pagos pendientes y presupuestos, para que gastes sin descuadrarte.')}`
            };
        }

        // ==========================================
        // BLOQUE 2: SIMULADORES Y PROYECCIONES
        // ==========================================

        if (
            (q.includes('abono') || q.includes('pago extra') || q.includes('abonar') || q.includes('abonaria') || q.includes('pago adicional') || q.includes('inyecto')) &&
            (extAmt > 0 || q.includes('deuda') || q.includes('tarjeta') || q.includes('tc') || q.includes('credito'))
        ) {
            if (!extAmt) {
                return {
                    title: 'Dime el valor del abono',
                    answer: 'Cuéntame cuánto dinero extra quieres abonar (por ejemplo: <i>"¿Qué pasa si abono 1 millón a mi tarjeta?"</i>) y te muestro cuánto tiempo e intereses te ahorras.'
                };
            }

            let debts = data.customAccounts.filter(a => (a.category === 'debt' || a.category === 'credit_card') && r2(balances[a.id] || 0) > 0);
            if (debts.length === 0) {
                return { title: 'Sin deudas activas', answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Excelente noticia! No tienes saldos pendientes en tarjetas ni préstamos para abonar.` };
            }

            const ignoreWords = new Set(['tc', 'de', 'la', 'el', 'banco', 'tarjeta', 'credito', 'cuenta', 'prestamo']);
            const namedMatch = debts.find(a => {
                const words = normalizeText(cleanLabel(a.name)).split(/\s+/).filter(w => w.length >= 2 && !ignoreWords.has(w));
                return words.some(w => q.includes(w));
            });

            if (namedMatch) {
                debts = [namedMatch];
            } else if ((q.includes('tarjeta') || q.includes('tc')) && !q.includes('deuda')) {
                const onlyCards = debts.filter(a => a.category === 'credit_card');
                if (onlyCards.length > 0) debts = onlyCards;
            }

            const target = debts.sort((a, b) => (parseFloat(b.debtRate || b.rate || 0) - parseFloat(a.debtRate || a.rate || 0)))[0];
            const bal = r2(balances[target.id]);
            const newBal = r2(bal - extAmt);

            if (newBal <= 0) {
                return {
                    title: '¡Liquidas la deuda por completo!',
                    answer: `<span style="color:var(--positive);">${SVG.ok}</span> Con ese abono de <b>${fmt(extAmt)}</b> apagas por completo el saldo de <b>${cleanLabel(target.name)}</b> (que estaba en ${fmt(bal)}) y todavía te sobran <strong style="color:var(--positive);">${fmt(Math.abs(newBal))}</strong>.${renderTip('Al dejarla en ceros, liberas esa cuota mensual para usarla en tus ahorros o en otra meta.')}`
                };
            }

            const rawRate = parseFloat(target.debtRate || target.rate || 0);
            const isEffectiveAnnual = String(target.debtRateType || target.rateType || '').toUpperCase() === 'EA' || rawRate > 10;
            const monthlyRate = (rawRate > 0 && isEffectiveAnnual)
                ? Math.pow(1 + rawRate / 100, 1 / 12) - 1
                : (rawRate > 0 ? rawRate / 100 : 0.021);

            const estObj = typeof calculateCardMinPaymentEstimate === 'function'
                ? calculateCardMinPaymentEstimate(target, bal, now)
                : null;
            const basePay = Math.max(
                r2(estObj?.totalMinPayment || target.debtMonthlyPayment || 0),
                r2(bal * monthlyRate + bal * 0.04)
            );

            const runPayoff = (principal, extraMonthly) => {
                let p = principal, months = 0, totalInt = 0;
                while (p > 0.5 && months < 120) {
                    const interest = r2(p * monthlyRate);
                    totalInt = r2(totalInt + interest);
                    const pay = Math.min(p + interest, basePay + extraMonthly);
                    p = r2(p + interest - pay);
                    months++;
                }
                return { months, totalInt };
            };

            const currentPlan = runPayoff(bal, 0);
            const oneTimePlan = runPayoff(newBal, 0);
            const recurringPlan = runPayoff(newBal, extAmt);

            const monthsSaved = Math.max(0, currentPlan.months - oneTimePlan.months);
            const interestSaved = Math.max(0, r2(currentPlan.totalInt - oneTimePlan.totalInt));

            return {
                title: `Plan de Abono: ${cleanLabel(target.name)}`,
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> ${nameTag}si inyectas <b>${fmt(extAmt)}</b> directos a capital hoy en <b>${cleanLabel(target.name)}</b> (la que más intereses te cobra):<br><br>• <b>Tu saldo baja al instante:</b> Pasa de ${fmt(bal)} a <strong style="color:var(--positive);">${fmt(newBal)}</strong>.<br>• <b>Si haces este abono una sola vez:</b> Terminas de pagar <b>${monthsSaved} mes(es) antes</b> (${oneTimePlan.months} vs. ${currentPlan.months} meses) y te ahorras aprox. <strong style="color:var(--positive);">${fmt(interestSaved)}</strong> en intereses.<br>• <b>Si repites este abono todos los meses:</b> Sales por completo de esta deuda en apenas <b>${recurringPlan.months} mes(es)</b>.${renderTip('Al pagar en el banco, pide "abono a capital con reducción de plazo": así mantienes tu cuota y eliminas meses llenos de intereses.')}`
            };
        }

        if ((q.includes('cuotas') || q.includes('diferir') || q.includes('difiero')) && (q.includes('comprar') || q.includes('compro') || q.includes('pagar') || q.includes('pago') || extAmt > 0)) {
            if (!extAmt) return { title: 'Dime el monto de la compra', answer: 'Cuéntame cuánto vale lo que quieres comprar (ej. <i>"¿Cuánto pago si difiero 600.000 a 6 cuotas?"</i>) y hacemos las cuentas.' };
            const qMatch = raw.match(/(\d+)\s*cuotas?/i);
            const months = qMatch ? Math.max(1, parseInt(qMatch[1], 10)) : 6;
            const monthlyRate = 0.022;
            const quota = months === 1
                ? extAmt
                : r2((extAmt * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months)));
            const totalPaid = r2(quota * months);
            const interestPaid = r2(totalPaid - extAmt);

            if (months === 1) {
                return {
                    title: 'Compra a 1 cuota (sin intereses)',
                    answer: `<span style="color:var(--positive);">${SVG.ok}</span> Si lo pasas a <b>1 sola cuota</b> y pagas el total antes de la fecha límite, pagas exactamente <b>${fmt(extAmt)}</b> sin regalarle un peso en intereses al banco.`
                };
            }
            return {
                title: `Simulación a ${months} cuotas`,
                answer: `<span style="color:var(--warning);">${SVG.card}</span> Si difieres <b>${fmt(extAmt)}</b> a <b>${months} cuotas</b> (calculado con una tasa promedio del 2,2% mensual):<br><br>• <b>Pagarías cada mes:</b> <b>${fmt(quota)}</b> aprox.<br>• <b>Total real al terminar:</b> ${fmt(totalPaid)}<br>• <b>Costo extra por financiar:</b> <strong style="color:var(--negative);">${fmt(interestPaid)}</strong> de más sobre el precio original.${renderTip('Si puedes pagarlo a 1 cuota o aprovechar una promoción sin interés, te quedas con esos intereses en tu bolsillo.')}`
            };
        }

        if (q.includes('cerrar el mes') || q.includes('cierro el mes') || q.includes('fin de mes') || q.includes('proyeccion del mes') || q.includes('terminar el mes')) {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const elapsed = Math.max(1, now.getDate());
            const remainingDays = Math.max(0, daysInMonth - elapsed);

            let inc = 0, exp = 0, pend = 0;
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.isTripIsolated || t.monthId !== monthId) return;
                if (t.status === 'pending') {
                    if (t.type === 'expense') pend = r2(pend + r2(t.budgetedAmount || t.amount));
                } else if (isRefundTx(t)) {
                    exp = r2(exp - r2(t.amount));
                } else {
                    if (t.type === 'income') inc = r2(inc + r2(t.amount));
                    if (t.type === 'expense') exp = r2(exp + r2(t.amount));
                }
            });
            exp = Math.max(0, exp);
            const dailyBurn = exp / elapsed;
            const projectedVarSpend = r2(dailyBurn * remainingDays);
            const projectedTotalExp = r2(exp + pend + projectedVarSpend);
            const projectedNet = r2(inc - projectedTotalExp);

            const closingMsg = projectedNet >= 0
                ? `Si mantienes este paso, lograrías cerrar el mes con un saldo a favor de <strong style="color:var(--positive);">${fmt(projectedNet)}</strong>.`
                : `Si sigues gastando a este mismo ritmo, podrías terminar el mes con un faltante de <strong style="color:var(--negative);">${fmt(Math.abs(projectedNet))}</strong>.`;

            return {
                title: 'Proyección de cierre de mes',
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> Hoy llevas un ritmo promedio de <b>${fmt(r2(dailyBurn))} por día</b>. Si sigues así durante los <b>${remainingDays} días</b> que faltan:<br><br>• <b>Lo que ya gastaste:</b> ${fmt(exp)}<br>• <b>Recibos pendientes por pagar:</b> ${fmt(pend)}<br>• <b>Lo que gastarías los días restantes:</b> ${fmt(projectedVarSpend)}<br><br>${closingMsg}${renderTip('Bajar un poco los gastos variables esta semana mejora de inmediato este resultado final.')}`
            };
        }

        if ((q.includes('bono') || q.includes('bonificacion')) && (q.includes('recibo') || q.includes('simular') || q.includes('llega') || q.includes('queda') || extAmt > 0)) {
            if (!extAmt) return { title: 'Falta el monto', answer: 'Cuéntame de cuánto es el bono (ej. <i>"Si recibo un bono de 2 millones"</i>) para calcular cuánto te llega libre.' };
            const salaryConf = JSON.parse(localStorage.getItem('myFinancesSalary') || 'null');
            if (!salaryConf || typeof simulateExtraBonus !== 'function') return { title: 'Falta configurar tu nómina', answer: 'Configura tu salario en <b>Perfil > Mi Salario y Proyecciones</b> para calcular los descuentos exactos de un bono.' };
            const res = simulateExtraBonus(salaryConf, extAmt, 'non_salary');
            return {
                title: 'Simulador de Bono Extra',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Si recibes un bono no salarial de <b>${fmt(extAmt)}</b>, te llegarían libres a tu cuenta <strong style="color:var(--positive);">${fmt(res.netBonus)}</strong> (se descontarían ${fmt(res.totalDeductions)}).${renderTip('En Colombia, cuando los bonos no salariales superan el 40% de tu ingreso total del mes, la ley exige aportar salud y pensión sobre ese excedente.')}`
            };
        }

        if (q.includes('me alcanza') || q.includes('puedo comprar') || q.includes('puedo gastar') || q.includes('me puedo gastar')) {
            if (!extAmt) return { title: 'Dime el valor para hacer cuentas', answer: 'Cuéntame cuánto cuesta lo que quieres comprar (ej. <i>"¿Me alcanza para 80 mil?"</i>) y reviso tu plata libre real.' };
            let liquid = 0;
            data.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_') && !a.excludeFromLiquidity).forEach(a => { liquid = r2(liquid + r2(balances[a.id] || 0)); });
            if (liquid <= 0) {
                return {
                    title: 'Hoy toca cuidar la caja',
                    answer: `<span style="color:var(--negative);">${SVG.warn}</span> ${nameTag}tus cuentas líquidas suman <b>${fmt(liquid)}</b>. Hoy no es buen momento para sacar <b>${fmt(extAmt)}</b> de tu bolsillo; mejor espera tu próximo ingreso.`
                };
            }
            if (liquid - extAmt < 0) {
                return {
                    title: 'Todavía no nos alcanza',
                    answer: `<span style="color:var(--negative);">${SVG.warn}</span> Ese gusto cuesta <b>${fmt(extAmt)}</b> y hoy tienes <b>${fmt(liquid)}</b> disponibles en tus cuentas. Te faltarían <strong style="color:var(--negative);">${fmt(Math.abs(liquid - extAmt))}</strong>.`
                };
            }
            const safeInfo = typeof computeSafeToSpendToday === 'function' ? computeSafeToSpendToday(monthId, snap) : null;
            if (safeInfo && extAmt > safeInfo.safeToSpend && safeInfo.safeToSpend >= 0) {
                return {
                    title: 'Alcanza, pero aprieta el mes',
                    answer: `<span style="color:var(--warning);">${SVG.info}</span> En tus cuentas tienes <b>${fmt(liquid)}</b>, así que el dinero está; pero si apartamos tus recibos pendientes y presupuestos del mes, tu <b>plata libre segura</b> hoy es de <b>${fmt(safeInfo.safeToSpend)}</b>.${renderTip('Puedes comprarlo sin quedar en rojo, pero tendrás que recortar otro gasto esta semana para compensar.')}`
                };
            }
            return {
                title: 'Luz verde para ese gusto',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Vas con tranquilidad! Tienes <b>${fmt(liquid)}</b> disponibles y, después de pagar esos <b>${fmt(extAmt)}</b>, todavía te quedan <strong style="color:var(--positive);">${fmt(liquid - extAmt)}</strong> en tus cuentas. Disfrútalo sin culpa.`
            };
        }

        // ==========================================
        // BLOQUE 3: NÓMINA, IMPUESTOS Y 4X1000
        // ==========================================

        if (q.includes('quincena') || q.includes('1q') || q.includes('2q') || q.includes('saldito') || (q.includes('plan') && (q.includes('quincenal') || q.includes('pagos del mes')))) {
            const salaryConf = JSON.parse(localStorage.getItem('myFinancesSalary') || 'null');
            const cfgValues = salaryConf ? Object.values(salaryConf).map(v => String(v || '').toLowerCase().trim()) : [];
            const isExplicitMonthly = cfgValues.some(v => v === 'monthly' || v === 'mensual') || salaryConf?.isBiweekly === false;
            const isExplicitBiweekly = cfgValues.some(v => v === 'biweekly' || v === 'quincenal' || v === 'semi-monthly') || salaryConf?.isBiweekly === true;

            let netMonthly = 0;
            let d1 = 15, d2 = 30, payDayMonthly = 30;
            const rawDays = String(salaryConf?.payDays || salaryConf?.paymentDays || '');
            const nums = (rawDays.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 31);
            const isMonthly = isExplicitMonthly || (!isExplicitBiweekly && nums.length === 1);

            if (nums.length >= 2) { d1 = Math.min(nums[0], nums[1]); d2 = Math.max(nums[0], nums[1]); }
            if (nums.length === 1) payDayMonthly = nums[0];

            const pStatusChat = (salaryConf && typeof getPayrollMonthStatus === 'function')
                ? getPayrollMonthStatus(monthId, salaryConf)
                : null;
            if (pStatusChat && pStatusChat.hasSalary) {
                netMonthly = pStatusChat.netAfterAdvances;
            } else if (salaryConf && typeof calculateLaborMetrics === 'function') {
                const m = calculateLaborMetrics(salaryConf, now);
                netMonthly = r2(m?.net || 0);
            }

            if (netMonthly <= 0) {
                const payrollTxs = (data.transactions || [])
                    .filter(t => !t.isDeleted && t.type === 'income' && /salario|n[oó]mina|quincena/i.test(`${t.category || ''} ${t.description || ''}`))
                    .slice(-2);
                if (payrollTxs.length > 0) {
                    const avgTx = r2(payrollTxs.reduce((s, t) => s + r2(t.amount || 0), 0) / payrollTxs.length);
                    netMonthly = isMonthly ? avgTx : r2(avgTx * 2);
                }
            }

            const classifyToQ = (dayNum) => {
                const day = Math.max(1, Math.min(31, Number(dayNum) || 1));
                return (day >= d1 && day < d2) ? '1Q' : '2Q';
            };

            const q1Items = [], q2Items = [], allItems = [];
            let q1Sum = 0, q2Sum = 0;

            const pushItem = (targetQ, label, day, amt) => {
                if (amt <= 0) return;
                const entry = `• <b>${cleanLabel(label)}</b> (día ${day}): ${fmt(amt)}`;
                allItems.push({ day, entry });
                if (targetQ === '1Q') { q1Items.push(entry); q1Sum = r2(q1Sum + amt); }
                else { q2Items.push(entry); q2Sum = r2(q2Sum + amt); }
            };

            (data.subscriptions || []).filter(s => s.status === 'active').forEach(sub => {
                const nextDate = String(sub.nextBillingDate || '');
                const isDueThisMonth = !nextDate || nextDate.startsWith(monthId) || sub.cycle === 'monthly' || sub.cycle === 'weekly';
                if (!isDueThisMonth) return;
                const day = nextDate ? Number(nextDate.split('-')[2]) : 1;
                const rawAmt = typeof getRecurringAmountInCOP === 'function'
                    ? getRecurringAmountInCOP(sub)
                    : r2(sub.amount || 0);
                const subAmt = sub.cycle === 'weekly' ? r2(rawAmt * 4) : rawAmt;
                pushItem(classifyToQ(day), sub.name, day, subAmt);
            });

            (data.transactions || []).filter(t => !t.isDeleted && t.type === 'expense' && t.status === 'pending' && t.monthId === monthId).forEach(tx => {
                const day = new Date(tx.id).getDate();
                pushItem(classifyToQ(day), tx.description || tx.category || 'Pago programado', day, r2(tx.budgetedAmount || tx.amount || 0));
            });

            data.customAccounts.filter(a => a.category === 'credit_card' && a.paymentDay).forEach(c => {
                const bal = r2(balances[c.id] || 0);
                if (bal > 0) {
                    const est = typeof calculateCardMinPaymentEstimate === 'function' ? calculateCardMinPaymentEstimate(c, bal, now) : { totalMinPayment: 0 };
                    pushItem(classifyToQ(c.paymentDay), `TC ${cleanLabel(c.name)}`, c.paymentDay, r2(est.totalMinPayment || 0));
                }
            });

            data.customAccounts.filter(a => a.category === 'debt' && !a.payrollDeduction).forEach(d => {
                const bal = r2(balances[d.id] || 0);
                if (bal > 0) {
                    const qInfo = typeof getDebtMonthlyQuotaBreakdown === 'function' ? getDebtMonthlyQuotaBreakdown(d, bal) : { totalQuota: r2(d.debtMonthlyPayment || 0) };
                    const payDay = Number(d.paymentDay) || d2;
                    pushItem(classifyToQ(payDay), d.name, payDay, r2(qInfo.totalQuota || 0));
                }
            });

            if (isMonthly) {
                const totalMonthSum = r2(q1Sum + q2Sum);
                const monthFree = r2(netMonthly - totalMonthSum);
                const sortedList = allItems.sort((a, b) => a.day - b.day).map(i => i.entry).join('<br>') || '• Sin pagos fijos programados este mes.';
                const tipText = netMonthly <= 0
                    ? 'Configura tu salario en Perfil > Nómina y Liquidación para calcular tu neto libre mensual.'
                    : (monthFree < 0
                        ? `Tus compromisos superan tu ingreso neto mensual por ${fmt(Math.abs(monthFree))}. Revisa qué pagos variables puedes recortar.`
                        : `Aparta ${fmt(totalMonthSum)} para tus compromisos del mes y mantén intactos tus ${fmt(monthFree)} de saldito libre.`);

                return {
                    title: 'Tu Plan de Pagos Mensual',
                    answer: `<span style="color:var(--chart);">${SVG.chart}</span> ${nameTag}como tienes configurada tu nómina <b>mensual</b> (día ${payDayMonthly}), aquí tienes el resumen completo sin dividir en quincenas:<br><br>` +
                        `${netMonthly > 0 ? `<b>Ingreso neto mensual:</b> ${fmt(netMonthly)}<br><br>` : ''}` +
                        `<b>Compromisos del mes:</b><br>${sortedList}<br><br>` +
                        `Total compromisos: <b>${fmt(totalMonthSum)}</b>` +
                        `${netMonthly > 0 ? `<br>Saldito libre del mes: <strong style="color:${monthFree >= 0 ? 'var(--positive)' : 'var(--negative)'};">${fmt(monthFree)}</strong>` : ''}` +
                        renderTip(tipText)
                };
            }

            const q1Income = r2(netMonthly / 2);
            const q2Income = r2(netMonthly / 2);
            const q1Free = r2(q1Income - q1Sum);
            const q2Free = r2(q2Income - q2Sum);
            const q1Block = q1Items.length > 0 ? q1Items.join('<br>') : '• Sin pagos fijos programados en esta quincena.';
            const q2Block = q2Items.length > 0 ? q2Items.join('<br>') : '• Sin pagos fijos programados en esta quincena.';

            let tipText = 'Este reparto protege tus fechas de corte y evita recargos por mora.';
            if (netMonthly <= 0) {
                tipText = 'Configura tu salario en Perfil > Nómina y Liquidación para calcular exactamente cuánto saldito libre te queda en cada quincena.';
            } else if (q1Free < 0 || q2Free < 0) {
                tipText = 'Una de tus quincenas queda apretada; mueve los pagos flexibles (como suscripciones o abonos) hacia la quincena con mayor saldo libre.';
            } else {
                tipText = `Aparta ${fmt(q1Sum)} en tu 1Q y ${fmt(q2Sum)} en tu 2Q: así cubres todo el mes sin tocar tu saldito libre.`;
            }

            return {
                title: 'Tu Plan de Pagos por Quincena (1Q / 2Q)',
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> ${nameTag}así te recomiendo distribuir tus compromisos para mantener saldito libre y cuidar tus fechas de corte:<br><br>` +
                    `<b>Quincena 1 (1Q • Día ${d1}):</b>${q1Income > 0 ? ` Ingreso est. ${fmt(q1Income)}` : ''}<br>${q1Block}<br>` +
                    `Total compromisos 1Q: <b>${fmt(q1Sum)}</b>${q1Income > 0 ? ` • Saldito libre: <strong style="color:${q1Free >= 0 ? 'var(--positive)' : 'var(--negative)'};">${fmt(q1Free)}</strong>` : ''}<br><br>` +
                    `<b>Quincena 2 (2Q • Día ${d2}):</b>${q2Income > 0 ? ` Ingreso est. ${fmt(q2Income)}` : ''}<br>${q2Block}<br>` +
                    `Total compromisos 2Q: <b>${fmt(q2Sum)}</b>${q2Income > 0 ? ` • Saldito libre: <strong style="color:${q2Free >= 0 ? 'var(--positive)' : 'var(--negative)'};">${fmt(q2Free)}</strong>` : ''}` +
                    renderTip(tipText)
            };
        }

        if (q.includes('retefuente') || q.includes('retencion') || q.includes('renta exenta') || q.includes('impuesto')) {
            const salaryConf = safeParseLocal('myFinancesSalary', null);
            if (!salaryConf || typeof calculateLaborMetrics !== 'function') return { title: 'Nómina sin configurar', answer: 'Configura tu salario en <b>Perfil > Mi Salario y Proyecciones</b> para calcular tu retención.' };
            const m = calculateLaborMetrics(salaryConf, now);
            return {
                title: 'Análisis de Retefuente',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Según tu salario configurado, cada mes te descuentan aprox. <strong style="color:var(--negative);">${fmt(m.ret || 0)}</strong> por Retención en la Fuente (un adelanto de tu impuesto de renta).<br><br>Por ley, el <b>25% de tu ingreso</b> ya es Renta Exenta (hasta el tope anual de 790 UVT).${renderTip('Puedes bajar ese descuento mensual ahorrando en una cuenta AFC (para vivienda) o en un Fondo Voluntario de Pensión (FPV).')}`
            };
        }

        if (/\b(prima|primas|prima de junio|prima de diciembre|prima de mitad de ano)\b/.test(q)) {
            const salaryConf = safeParseLocal('myFinancesSalary', null);
            if (!salaryConf || typeof calculateLaborMetrics !== 'function') return { title: 'Sin datos de nómina', answer: 'Configura tu sueldo en <b>Perfil > Mi Salario y Proyecciones</b>.' };
            const m = calculateLaborMetrics(salaryConf, now);
            const isJun = now.getMonth() <= 5;
            const primaVal = isJun ? m.halfPrimaJunNeta : m.halfPrimaDecNeta;
            return {
                title: `Proyección Prima de ${isJun ? 'Junio' : 'Diciembre'}`,
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> Tu próxima prima (el pago extra semestral de ley) te llegará libre por aproximadamente <strong style="color:var(--positive);">${fmt(primaVal)}</strong>.${renderTip('Una regla sencilla para aprovecharla: usa la mitad para bajar deudas o subir tus ahorros, y disfruta la otra mitad sin culpa.')}`
            };
        }

        if (/\bvacaciones\b/.test(q) && !/\b(modo viaje|viaje|acompanante)\b/.test(q)) {
            const salaryConf = safeParseLocal('myFinancesSalary', null);
            if (salaryConf && typeof calculateLaborMetrics === 'function') {
                const m = calculateLaborMetrics(salaryConf, now);
                return {
                    title: 'Tus Vacaciones Acumuladas',
                    answer: `<span style="color:var(--positive);">${SVG.ok}</span> Según tu fecha de inicio y salario configurado:<br><br>• <b>Días pendientes disponibles:</b> <b>${r2(m.vacDaysPending || 0)} días hábiles</b><br>• <b>Equivalente en liquidación hoy:</b> <strong style="color:var(--positive);">${fmt(m.liqVacaciones || 0)}</strong>${renderTip('En Colombia causas 15 días hábiles de vacaciones por cada año trabajado (calculados sobre tu salario básico).')}`
                };
            }
        }

        if (q.includes('cesantias') || q.includes('intereses de cesantias')) {
            const salaryConf = safeParseLocal('myFinancesSalary', null);
            if (!salaryConf || typeof calculateLaborMetrics !== 'function') return { title: 'Sin datos de nómina', answer: 'Configura tu sueldo en <b>Perfil > Mi Salario y Proyecciones</b>.' };
            const m = calculateLaborMetrics(salaryConf, now);
            const annualCes = r2(m.projCesantiasBase || m.cesantiasBase || 0);
            const annualInt = r2(annualCes * 0.12);
            return {
                title: 'Tus Cesantías e Intereses',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Al año completo tu empresa consigna a tu fondo aprox. <b>${fmt(annualCes)}</b> (acumulado a hoy: <b>${fmt(m.liqCesantias || 0)}</b>).<br><br>Además, en enero te deben pagar directamente unos <b>${fmt(annualInt)}</b> por intereses de cesantías (12% anual).`
            };
        }

        if (q.includes('nomina') || q.includes('sueldo') || q.includes('salario') || q.includes('cuanto gano') || q.includes('liquidar') || q.includes('liquidación') || q.includes('liquidacion')) {
            const salaryConf = safeParseLocal('myFinancesSalary', null);
            if (!salaryConf || typeof calculateLaborMetrics !== 'function') return { title: 'Sin datos de nómina', answer: 'Configura tu salario en <b>Perfil > Mi Salario y Proyecciones</b>.' };
            const m = calculateLaborMetrics(salaryConf, now);
            const pSt = typeof getPayrollMonthStatus === 'function' ? getPayrollMonthStatus(monthId, salaryConf, m) : null;
            const totalDevengado = r2((m.basic || 0) + (m.nonSalary || 0) + (m.effectiveTransport || 0));
            const totalDeductions = Math.max(0, r2(totalDevengado - (m.net || 0)));
            const advLine = (pSt && pSt.advancesTotal > 0)
                ? `<br>• <b>Anticipos de este mes:</b> <span style="color:var(--negative);">-${fmt(pSt.advancesTotal)}</span> → <b>Restante por recibir:</b> <strong style="color:var(--positive);">${fmt(pSt.netAfterAdvances)}</strong>`
                : '';
            return {
                title: 'Tu Resumen de Nómina',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> • <b>Total devengado (antes de descuentos):</b> ${fmt(totalDevengado)}<br>• <b>Descuentos de ley y libranzas:</b> -${fmt(totalDeductions)}<br>• <b>Salario neto base mensual:</b> <strong style="color:var(--positive);">${fmt(m.net)}</strong>${advLine}${renderTip('Organiza siempre tu presupuesto mensual usando tu salario neto, nunca el bruto.')}`
            };
        }

        if (q.includes('4x1000') || q.includes('4 x 1000') || q.includes('gravamen') || q.includes('gmf')) {
            const bankAccs = data.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_'));
            return {
                title: 'Cómo evitar pagar el 4x1000',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> El 4x1000 te cobra $4 por cada $1.000 que mueves (es decir, $4.000 por cada millón). Actualmente tienes <b>${bankAccs.length} cuenta(s)</b> registradas.<br><br>En Colombia puedes marcar <b>una cuenta bancaria principal</b> como exenta hasta 350 UVT (más de $18 millones al mes), y billeteras como Nequi o DaviPlata tienen su propia exención hasta 65 UVT (unos $3,4 millones al mes).${renderTip('Concentra tus pagos grandes y transferencias en tu cuenta exenta para no regalar ese 0,4%.')}`
            };
        }

        // ==========================================
        // BLOQUE 4: AHORROS, INVERSIONES, FONDO EMERGENCIA Y LIQUIDEZ
        // ==========================================

        if (q.includes('fondo de emergencia') || q.includes('emergencia') || q.includes('supervivencia') || q.includes('cuantos meses puedo vivir')) {
            let liquid = 0;
            data.customAccounts.filter(a => a.category === 'asset' && !a.id.startsWith('CxC_') && !a.excludeFromLiquidity).forEach(a => { liquid = r2(liquid + r2(balances[a.id] || 0)); });
            const pocketSum = r2((data.pockets || []).reduce((s, p) => s + r2((p.principal || 0) + (p.yields || 0)), 0));
            const totalReserve = r2(Math.max(0, liquid) + pocketSum);

            let monthExp = 0;
            (data.transactions || []).forEach(t => {
                if (!t.isDeleted && !t.isAdjustment && t.monthId === monthId && t.type === 'expense') monthExp = r2(monthExp + r2(t.amount));
            });

            if (monthExp <= 0) {
                return { title: 'Tu Fondo de Emergencia', answer: `Hoy tienes <b>${fmt(totalReserve)}</b> disponibles entre tus cuentas positivas y bolsillos. Registra tus gastos del mes para calcular cuántos meses de tranquilidad te cubre ese respaldo.` };
            }

            const monthsCovered = (totalReserve / monthExp).toFixed(1);
            return {
                title: 'Tu Colchón de Emergencia',
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> Si hoy dejaras de recibir ingresos, con tus <b>${fmt(totalReserve)}</b> actuales (cuentas + bolsillos) y tu ritmo de gasto de ${fmt(monthExp)}/mes, podrías cubrir tus gastos durante <b>${monthsCovered} meses</b>.${renderTip('Un buen colchón de emergencia cubre entre 3 y 6 meses de gastos básicos, evitando que tengas que endeudarte ante un imprevisto.')}`
            };
        }

        if (q.includes('donde tengo mi plata') || q.includes('mis cuentas') || q.includes('en cada cuenta') || q.includes('liquidez')) {
            const assets = data.customAccounts
                .filter(a => a.category === 'asset' && !a.id.startsWith('CxC_'))
                .map(a => ({ name: cleanLabel(a.name), bal: r2(balances[a.id] || 0) }))
                .sort((a, b) => b.bal - a.bal);

            if (assets.length === 0) return { title: 'Sin cuentas', answer: 'No tienes cuentas de activo registradas.' };

            const list = assets.map(a => `• <b>${a.name}</b>: <strong style="color:${a.bal >= 0 ? 'var(--positive)' : 'var(--negative)'};">${fmt(a.bal)}</strong>`).join('<br>');
            const overdraft = assets.find(a => a.bal < 0);
            const warnNote = overdraft
                ? renderTip(`Ojo: Tu cuenta ${overdraft.name} tiene saldo negativo (${fmt(overdraft.bal)}), lo que resta plata disponible al total de tu billetera.`)
                : renderTip('Esta es tu plata líquida: dinero que tienes a la mano para usar o transferir de inmediato.');

            return { title: 'Dónde está tu plata hoy', answer: `<span style="color:var(--accent);">${SVG.info}</span> Así está repartido tu dinero entre tus cuentas:<br><br>${list}${warnNote}` };
        }

        if (q.includes('bolsillo') || q.includes('ahorr') || q.includes('metas') || q.includes('alcancia') || q.includes('guardado')) {
            const pockets = data.pockets || [];
            let cdtInfo = { cantidadActivos: 0, capitalTotal: 0, rendimientoCausadoTotal: 0 };
            if (typeof getCDTPortfolioInsights === 'function') cdtInfo = getCDTPortfolioInsights();

            let totalPockets = 0, pocketList = '';
            pockets.forEach(p => {
                const s = r2((p.principal || 0) + (p.yields || 0));
                if (s > 0) {
                    totalPockets = r2(totalPockets + s);
                    const goal = r2(p.goal || p.goalAmount || 0);
                    const goalText = goal > 0 ? ` de ${fmt(goal)} (${Math.min(100, Math.round((s / goal) * 100))}%)` : '';
                    pocketList += `• <b>${cleanLabel(p.name)}</b>: ${fmt(s)}${goalText}<br>`;
                }
            });

            let totalInv = cdtInfo.capitalTotal + cdtInfo.rendimientoCausadoTotal;
            const grandTotal = r2(totalPockets + totalInv);

            if (grandTotal === 0) {
                return {
                    title: 'Ahorros en $0',
                    answer: `Tus bolsillos e inversiones están en <b>$ 0,00</b> en este momento.${renderTip('Separar aunque sea un monto pequeño apenas recibes ingresos evita que te lo gastes sin darte cuenta.')}`
                };
            }

            let answerHtml = `<span style="color:var(--positive);">${SVG.ok}</span> ${nameTag}llevas <strong style="color:var(--positive);">${fmt(grandTotal)}</strong> guardados en total`;
            if (totalPockets > 0) answerHtml += `:<br><br><b>En tus bolsillos (${fmt(totalPockets)}):</b><br>${pocketList}`;
            else answerHtml += `.`;
            if (totalInv > 0) answerHtml += `<br><b>En inversiones / CDTs:</b> ${fmt(totalInv)} adicionales generando rendimientos.`;
            answerHtml += renderTip('El dinero en bolsillos está protegido: Lumen no lo cuenta como plata de bolsillo para gastos diarios.');

            return { title: 'Tus Ahorros Protegidos', answer: answerHtml };
        }

        // ==========================================
        // BLOQUE 5: DEUDAS, TARJETAS, BNPL Y COBROS
        // ==========================================

        if (q.includes('addi') || q.includes('sistecredito') || q.includes('bnpl') || q.includes('microcredito')) {
            const bnplAccs = data.customAccounts.filter(a => /addi|sistecredito|kueski|su\+|lulo/i.test(a.name));
            const bnplTxs = (data.transactions || []).filter(t => !t.isDeleted && t.monthId === monthId && /addi|sistecredito/i.test(`${t.description} ${t.category} ${t.account}`));

            let msg = '';
            if (bnplAccs.length > 0) {
                msg += bnplAccs.map(a => `• <b>${cleanLabel(a.name)}</b>: Saldo pendiente de <b>${fmt(Math.abs(r2(balances[a.id] || 0)))}</b>`).join('<br>') + '<br><br>';
            }
            if (bnplTxs.length > 0) {
                const sumTx = r2(bnplTxs.reduce((s, t) => s + r2(t.amount), 0));
                msg += `Este mes registras <b>${bnplTxs.length} movimiento(s)</b> asociados por <b>${fmt(sumTx)}</b>.`;
            }
            if (!msg) return { title: 'Sin registros Addi / Sistecredito', answer: 'No encontré cuentas ni compras activas con Addi o Sistecredito este mes.' };
            return {
                title: 'Radar de compras a cuotas sin tarjeta',
                answer: `<span style="color:var(--accent);">${SVG.card}</span> ${msg}${renderTip('Aunque estas plataformas dividen compras pequeñas, juntar varias al tiempo puede apretar tu flujo quincenal.')}`
            };
        }

        if (q.includes('cuando corta') || q.includes('proximo corte') || q.includes('fecha de pago') || q.includes('cuando pago tarjeta') || q.includes('vencimiento')) {
            const cards = data.customAccounts.filter(a => a.category === 'credit_card');
            if (cards.length === 0) return { title: 'Sin tarjetas', answer: 'No tienes tarjetas de crédito registradas.' };

            const todayDay = now.getDate();
            const list = cards.map(c => {
                const cut = Number(c.cutoffDay) || 1;
                const pay = Number(c.paymentDay || c.payDay) || 15;
                const daysToCut = cut >= todayDay ? cut - todayDay : (30 - todayDay + cut);
                return `• <b>${cleanLabel(c.name)}</b>: Corta el día <b>${cut}</b> (en ~${daysToCut} días) y tu fecha límite de pago es el <b>${pay}</b>.`;
            }).join('<br>');

            return {
                title: 'Calendario de Cortes y Pagos',
                answer: `<span style="color:var(--accent);">${SVG.card}</span> Estas son las fechas clave de tus tarjetas:<br><br>${list}<br><br><b>¿Qué significa cada fecha?</b> El <b>corte</b> es el día que el banco cierra la cuenta del mes; la <b>fecha de pago</b> es tu plazo máximo para pagar sin mora.${renderTip('Si compras justo al día siguiente del corte, ganas hasta 45 días para pagar sin intereses (a 1 cuota).')}`
            };
        }

        if (q.includes('termino de pagar') || q.includes('termino pagar') || q.includes('ultima cuota') || q.includes('liquido este mes') || q.includes('libero este mes')) {
            const cards = data.customAccounts.filter(a => a.category === 'credit_card');
            const debts = data.customAccounts.filter(a => a.category === 'debt');
            const fullFinishing = [], lastQuotas = [], debtsFinishing = [];

            cards.forEach(c => {
                const bal = r2(balances[c.id] || 0);
                if (bal <= 0) return;
                const pend = typeof getPendingCardPurchases === 'function' ? getPendingCardPurchases(c.id) : [];
                const est = typeof calculateCardMinPaymentEstimate === 'function' ? calculateCardMinPaymentEstimate(c, bal, now) : { deferredQuota: 0, initialQuotaApplied: 0 };
                if (bal <= r2(est.deferredQuota + est.initialQuotaApplied) + 1) {
                    fullFinishing.push(`• <b>${cleanLabel(c.name)}</b>: queda completamente en ceros pagando <b>${fmt(bal)}</b>.`);
                } else {
                    const last = pend.filter(p => p.remainingInstallments === 1);
                    if (last.length > 0) {
                        const sumL = r2(last.reduce((s, p) => s + p.nextQuota, 0));
                        lastQuotas.push(`• <b>${cleanLabel(c.name)}</b>: terminas ${last.length} compra(s) por <b>${fmt(sumL)}</b>.`);
                    }
                }
            });

            debts.forEach(d => {
                const bal = r2(balances[d.id] || 0);
                if (bal > 0 && d.debtType !== 'revolving' && Math.max(0, (d.debtTotalQuotes || 1) - (d.debtPaidQuotes || 0)) === 1) {
                    debtsFinishing.push(`• <b>${cleanLabel(d.name)}</b>: última cuota por <b>${fmt(bal)}</b>.`);
                }
            });

            if (fullFinishing.length === 0 && lastQuotas.length === 0 && debtsFinishing.length === 0) {
                return {
                    title: 'Ninguna obligación cierra en $0 este mes',
                    answer: `<span style="color:var(--accent);">${SVG.card}</span> ${nameTag}revisé tus cuotas activas y ninguna termina por completo este mes con el pago normal.`
                };
            }

            let parts = [];
            if (fullFinishing.length > 0) parts.push(`<b>Tarjetas que dejas en $0:</b><br>${fullFinishing.join('<br>')}`);
            if (lastQuotas.length > 0) parts.push(`<b>Compras en su última cuota:</b><br>${lastQuotas.join('<br>')}`);
            if (debtsFinishing.length > 0) parts.push(`<b>Créditos en su última cuota:</b><br>${debtsFinishing.join('<br>')}`);

            return {
                title: 'Lo que terminas de pagar este mes',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Buenas noticias! Al pagar estas cuotas este mes, liberas ese dinero para los meses siguientes:<br><br>${parts.join('<br><br>')}`
            };
        }

        if (q.includes('con que tarjeta') || q.includes('tarjeta me conviene') || q.includes('mejor tarjeta') || ((q.includes('que tarjeta') || q.includes('cual tarjeta')) && (q.includes('pago') || q.includes('pagar') || q.includes('usar') || q.includes('comprar')))) {
            if (typeof evaluateBestCreditCardForPurchase === 'function') {
                const evalRes = evaluateBestCreditCardForPurchase(extAmt, 1, now);
                if (!evalRes.bestCard) return { title: 'Sin tarjetas', answer: 'No tienes tarjetas de crédito registradas.' };
                const best = evalRes.bestCard;
                if (!best.hasEnoughCredit && extAmt > 0) {
                    return {
                        title: 'Cupo insuficiente',
                        answer: `<span style="color:var(--negative);">${SVG.warn}</span> Ninguna tarjeta cubre <b>${fmt(extAmt)}</b>. La de mayor cupo libre es <b>${cleanLabel(best.name)}</b> (${fmt(best.available)}).`
                    };
                }

                const detailBullets = (best.reasons || [])
                    .map(r => `• ${esc(String(r || '').replace(/\(corte en (\d+)d\)/i, '(tu próximo corte es en $1 días)'))}`)
                    .join('<br>');
                const cupoLine = (typeof best.available === 'number' && best.available > 0)
                    ? `<br>• <b>Cupo libre:</b> Tienes <strong style="color:var(--positive);">${fmt(best.available)}</strong> disponibles.`
                    : '';

                const safeBestName = cleanLabel(best.name);
                const safePayDate = esc(best.payDateStr);
                return {
                    title: `Mejor opción hoy: ${safeBestName}`,
                    answer: `<span style="color:var(--accent);">${SVG.card}</span> ${nameTag}si vas a pagar con tarjeta hoy${extAmt > 0 ? ` por <b>${fmt(extAmt)}</b>` : ''}, tu mejor jugada es <b>${safeBestName}</b> porque es la que más tiempo te da antes de tener que pagarla:<br><br>${detailBullets}${cupoLine}<br><br><b>¿Por qué te conviene?</b> Como su fecha de corte aún está lejos, lo que compres hoy no entra en el cobro inmediato, sino hasta el extracto del próximo ciclo (${safePayDate}).${renderTip(`Si la pasas a 1 sola cuota y pagas antes del ${safePayDate}, usas el dinero del banco sin pagar un solo peso de interés.`)}`
                };
            }
        }

        if (q.includes('plan de salida') || q.includes('salir de deuda') || q.includes('estrategia') || q.includes('pagar mis deudas') || q.includes('avalancha') || q.includes('bola de nieve')) {
            const debts = data.customAccounts.filter(a => (a.category === 'debt' || a.category === 'credit_card') && r2(balances[a.id] || 0) > 0);
            if (debts.length === 0) return { title: '¡Libre de deudas!', answer: `<span style="color:var(--positive);">${SVG.ok}</span> No tienes saldos pendientes en tarjetas ni créditos. ¡Disfruta esa tranquilidad!` };
            const totalDebt = r2(debts.reduce((s, d) => s + Math.abs(r2(balances[d.id] || 0)), 0));
            const avalanche = [...debts].sort((a, b) => parseFloat(b.debtRate || b.rate || 0) - parseFloat(a.debtRate || a.rate || 0))[0];
            const snowball = [...debts].sort((a, b) => Math.abs(r2(balances[a.id] || 0)) - Math.abs(r2(balances[b.id] || 0)))[0];

            return {
                title: 'Tu Plan Estratégico de Deudas',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Tienes <b>${fmt(totalDebt)}</b> en deuda total. Te propongo dos caminos probados para salir de ellas (pagando el mínimo en todas y poniendo cualquier extra en una sola):<br><br>• <b>Camino 1 — Avalancha (Ahorras más plata):</b> Ataca primero <b>${cleanLabel(avalanche.name)}</b> porque es la que más intereses te cobra.<br>• <b>Camino 2 — Bola de Nieve (Ves resultados rápido):</b> Liquida primero <b>${cleanLabel(snowball.name)}</b> porque tiene el saldo más pequeño (${fmt(Math.abs(r2(balances[snowball.id] || 0)))}).${renderTip('Abre Plan Salida de Deudas en el menú lateral para simular cuánto abonar y ver tu fecha exacta de libertad.')}`
            };
        }

        if (q.includes('me debe') || q.includes('por cobrar') || q.includes('me deben')) {
            const cxc = data.customAccounts.filter(a => a.id.startsWith('CxC_') && r2(balances[a.id] || 0) > 0);
            if (cxc.length === 0) return { title: 'A paz y salvo', answer: `<span style="color:var(--positive);">${SVG.ok}</span> Nadie te debe plata registrada en Lumen.` };
            let t = 0, l = '';
            cxc.forEach(a => { const b = r2(balances[a.id] || 0); t = r2(t + b); l += `• <b>${cleanLabel(a.name).replace(/^Me debe:\s*/i, '')}</b>: ${fmt(b)}<br>`; });
            return {
                title: 'Plata tuya por cobrar',
                answer: `<span style="color:var(--positive);">${SVG.info}</span> Tienes <strong style="color:var(--positive);">${fmt(t)}</strong> pendientes por recuperar:<br><br>${l}${renderTip('Ese dinero ya salió de tu bolsillo, pero no está disponible hasta que te lo paguen. Un recordatorio amable hoy puede darte liquidez extra.')}`
            };
        }

        // ==========================================
        // BLOQUE 6: DIAGNÓSTICOS DE GASTOS, PATRIMONIO Y COMPORTAMIENTO
        // ==========================================

        if (q.includes('hormiga') || q.includes('gastos pequenos') || q.includes('gastos chiquitos')) {
            const antThreshold = 25000;
            const antTxs = (data.transactions || []).filter(t =>
                !t.isDeleted && !t.isAdjustment && !t.isTripIsolated &&
                t.monthId === monthId && t.type === 'expense' && t.status !== 'pending' &&
                r2(t.amount) > 0 && r2(t.amount) <= antThreshold
            );

            if (antTxs.length === 0) {
                return { title: 'Cero gasto hormiga', answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Excelente control! No tienes compras pequeñas (de ${fmt(antThreshold)} o menos) registradas este mes.` };
            }

            const totalAnt = r2(antTxs.reduce((s, t) => s + r2(t.amount), 0));
            return {
                title: 'Radar de Gasto Hormiga',
                answer: `<span style="color:var(--warning);">${SVG.warn}</span> Los gastos hormiga son compras pequeñas del día a día (cafés, snacks, domicilios cortos) que parecen inofensivas pero suman bastante.<br><br>Este mes llevas <b>${antTxs.length} compras</b> de ${fmt(antThreshold)} o menos, que juntas ya suman <strong style="color:var(--negative);">${fmt(totalAnt)}</strong>.${renderTip(`Si recortas a la mitad esos antojos diarios, liberarías ${fmt(r2(totalAnt / 2))} al mes para tus metas.`)}`
            };
        }

        if (q.includes('mes pasado') || q.includes('mes anterior') || q.includes('compare') || q.includes('comparado')) {
            const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const prevMonthId = typeof getMonthId === 'function' ? getMonthId(prevDate) : prevDate.toISOString().slice(0, 7);
            const cutoffDay = now.getDate();

            let currSpent = 0, prevSpent = 0;
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.isTripIsolated || t.type !== 'expense' || t.status === 'pending') return;
                const txDay = new Date(t.id).getDate();
                if (t.monthId === monthId && txDay <= cutoffDay) currSpent = r2(currSpent + r2(t.amount));
                if (t.monthId === prevMonthId && txDay <= cutoffDay) prevSpent = r2(prevSpent + r2(t.amount));
            });

            const diff = r2(currSpent - prevSpent);
            if (prevSpent === 0) {
                return { title: 'Sin historial previo', answer: `No hay gastos registrados en los primeros ${cutoffDay} días del mes anterior para hacer una comparación justa.` };
            }

            const statusText = diff <= 0
                ? `<span style="color:var(--positive);">${SVG.ok}</span> ¡Vas por buen camino! Has gastado <b>${fmt(Math.abs(diff))} menos</b> que a esta misma fecha del mes pasado.`
                : `<span style="color:var(--warning);">${SVG.warn}</span> Este mes llevas <b>${fmt(diff)} más</b> gastados que a esta misma fecha del mes pasado.`;

            return {
                title: `Comparativo al día ${cutoffDay} del mes`,
                answer: `${statusText}<br><br>• <b>Este mes (del 1 al ${cutoffDay}):</b> ${fmt(currSpent)}<br>• <b>Mes pasado (del 1 al ${cutoffDay}):</b> ${fmt(prevSpent)}${renderTip('Comparar exactamente los mismos días del mes evita engañarnos por diferencias de calendario.')}`
            };
        }

        if (q.includes('50 30 20') || q.includes('50/30/20') || q.includes('regla') || q.includes('distribucion de gastos')) {
            const fixedIds = new Set();
            (data.categories?.expense || []).forEach(c => { if (c.isFixed) fixedIds.add(cleanLabel(c.name)); });

            let needs = 0, wants = 0, total = 0;
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.isTripIsolated || t.monthId !== monthId || t.type !== 'expense' || t.status === 'pending') return;
                const amt = r2(t.amount);
                total = r2(total + amt);
                if (fixedIds.has(cleanLabel(t.category || ''))) needs = r2(needs + amt);
                else wants = r2(wants + amt);
            });

            if (total === 0) return { title: 'Sin gastos aún', answer: 'Registra tus gastos del mes para mostrarte cómo se reparten según la regla 50/30/20.' };

            const pNeeds = Math.round((needs / total) * 100);
            const pWants = 100 - pNeeds;
            return {
                title: 'Tu Proporción de Gasto (Regla 50/30/20)',
                answer: `<span style="color:var(--chart);">${SVG.chart}</span> Esta regla sugiere dividir tus ingresos así: 50% en necesidades básicas, 30% en gustos y 20% en ahorro/deudas.<br><br>De lo que has gastado este mes (<b>${fmt(total)}</b>):<br>• <b>Gastos fijos / esenciales:</b> ${pNeeds}% (${fmt(needs)})<br>• <b>Gastos variables / gustos:</b> ${pWants}% (${fmt(wants)})${renderTip('Si tus gastos fijos pesan demasiado, queda poco margen para ahorrar con holgura.')}`
            };
        }

        if (q.includes('dia de la semana') || q.includes('que dia gasto mas') || q.includes('fines de semana')) {
            const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const totals = [0, 0, 0, 0, 0, 0, 0];

            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.isTripIsolated || t.monthId !== monthId || t.type !== 'expense' || t.status === 'pending') return;
                const d = new Date(t.id).getDay();
                totals[d] = r2(totals[d] + r2(t.amount));
            });

            const maxVal = Math.max(...totals);
            if (maxVal === 0) return { title: 'Sin datos', answer: 'Aún no hay gastos registrados este mes.' };
            const peakIdx = totals.indexOf(maxVal);

            return {
                title: 'Tu día más gastador de la semana',
                answer: `<span style="color:var(--accent);">${SVG.flame}</span> Revisando tus hábitos de este mes, los <b>${dayNames[peakIdx]}</b> son el día en que más dinero sale de tu cuenta: suman <strong style="color:var(--negative);">${fmt(maxVal)}</strong>.${renderTip('Saber cuál es tu día más vulnerable te permite ponerte un tope antes de salir ese día.')}`
            };
        }

        if (q.includes('comercios') || q.includes('donde compro') || q.includes('mas veces') || q.includes('repetitivos')) {
            const byDesc = {};
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.monthId !== monthId || t.type !== 'expense' || t.status === 'pending') return;
                const key = cleanLabel(t.description || t.category || 'Varios');
                if (!byDesc[key]) byDesc[key] = { count: 0, sum: 0 };
                byDesc[key].count += 1;
                byDesc[key].sum = r2(byDesc[key].sum + r2(t.amount));
            });

            const top3 = Object.entries(byDesc).sort((a, b) => b[1].sum - a[1].sum).slice(0, 3);
            if (top3.length === 0) return { title: 'Sin movimientos', answer: 'No hay gastos registrados este mes.' };

            const list = top3.map(([name, info]) => `• <b>${name}</b>: ${info.count} vez/veces (${fmt(info.sum)})`).join('<br>');
            return {
                title: 'Tus 3 destinos principales del mes',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Estos son los 3 conceptos o comercios donde más se ha concentrado tu dinero:<br><br>${list}${renderTip('Identificar tus compras más repetitivas es la forma más rápida de encontrar dónde ahorrar sin sacrificar calidad de vida.')}`
            };
        }

        if (q.includes('tasa de ahorro') || q.includes('porcentaje de ahorro') || q.includes('cuanto ahorro al mes')) {
            let inc = 0, exp = 0;
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.isAdjustment || t.isTripIsolated || t.monthId !== monthId || t.status === 'pending') return;
                if (isRefundTx(t)) { exp = r2(exp - r2(t.amount)); return; }
                if (t.type === 'income') inc = r2(inc + r2(t.amount));
                if (t.type === 'expense') exp = r2(exp + r2(t.amount));
            });
            exp = Math.max(0, exp);
            if (inc <= 0) return { title: 'Sin ingresos registrados', answer: 'Registra tus ingresos de este mes para calcular qué porcentaje logras conservar.' };
            const saved = r2(inc - exp);
            const rate = Math.round((saved / inc) * 100);
            return {
                title: 'Tu Tasa de Ahorro del Mes',
                answer: `<span style="color:${rate >= 20 ? 'var(--positive)' : 'var(--warning)'};">${SVG.chart}</span> La tasa de ahorro mide cuántos pesos de cada $100 que ganas se quedan contigo.<br><br>Este mes estás reteniendo el <b>${rate}%</b> de tus ingresos (<b>${fmt(saved)}</b> libres de ${fmt(inc)} que entraron).${renderTip(rate >= 20 ? '¡Excelente! Estás por encima del 20% recomendado para construir tranquilidad financiera.' : 'Intenta acercarte poco a poco al 20% automatizando un pequeño traslado a tus bolsillos apenas te paguen.')}`
            };
        }

        // ==========================================
        // BLOQUE 7: PATRIMONIO, VIAJES, PRESUPUESTO Y BUSCADOR
        // ==========================================

        if (q.includes('patrimonio') || q.includes('balance') || q.includes('riqueza') || q.includes('activos y pasivos')) {
            const cdtVal = typeof getCDTPortfolioInsights === 'function' ? r2(getCDTPortfolioInsights(now).valorActualTotal || 0) : 0;
            const visibleFA = snap.visibleFixedAssetsTotal !== undefined ? snap.visibleFixedAssetsTotal : (snap.fixedAssetsTotal || 0);
            const assets = r2((snap.assetsTotal || 0) + (snap.cxcTotal || 0) + visibleFA + (snap.pocketsTotal || 0) + cdtVal);
            const liab = r2(snap.liabilitiesTotal || 0);
            const nw = r2(assets - liab);
            const explainNote = nw >= 0
                ? 'Como es positivo, lo que posees supera lo que debes.'
                : 'Que hoy sea negativo es normal si tienes créditos o tarjetas grandes; cada cuota que pagas lo va subiendo.';
            return {
                title: 'Tu Hoja de Balance (Patrimonio Neto)',
                answer: `<span style="color:var(--accent);">${SVG.chart}</span> Si hoy vendieras todo lo que tienes y pagaras todas tus deudas, el resultado sería tu Patrimonio Neto: <b>${fmt(nw)}</b>.<br><br>• <b>Activos (cuentas, bolsillos, bienes${cdtVal > 0 ? ' y CDTs' : ''}):</b> <span style="color:var(--positive);">${fmt(assets)}</span><br>• <b>Pasivos (tarjetas y créditos):</b> <span style="color:var(--negative);">${fmt(liab)}</span><br><br>${explainNote}`
            };
        }

        if (q.includes('activos fijos') || q.includes('mis bienes') || q.includes('carro') || q.includes('casa')) {
            const fa = (data.fixedAssets || []).filter(f => f.status === 'active');
            if (fa.length === 0) return { title: 'Sin bienes registrados', answer: 'No tienes activos fijos (como vehículo, vivienda o equipos de valor) registrados en Lumen.' };
            let val = 0, purch = 0;
            fa.forEach(a => { val = r2(val + r2(a.currentValue || 0)); purch = r2(purch + r2(a.purchaseValue || 0)); });
            const diff = r2(val - purch);
            const diffLabel = diff >= 0 ? `una valorización de +${fmt(diff)}` : `una depreciación por uso de ${fmt(diff)}`;
            return {
                title: 'Tus Activos Fijos',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> Tus <b>${fa.length} bienes</b> tienen un valor comercial estimado hoy de <b>${fmt(val)}</b> (presentan ${diffLabel} frente a su valor de compra).`
            };
        }

        if (q.includes('recurrente') || q.includes('suscripcion') || q.includes('gastos fijos') || q.includes('pagos fijos') || q.includes('netflix') || q.includes('spotify') || q.includes('icloud')) {
            const subs = (data.subscriptions || []).filter(s => s.status === 'active');
            if (subs.length === 0) return { title: 'Sin pagos recurrentes activos', answer: 'No tienes pagos recurrentes ni gastos fijos activos en Lumen. Puedes crearlos desde el menú <b>Recurrentes</b> o vinculando una subcategoría en <b>Presupuesto</b>.' };

            let m = 0;
            let unlinkedNonMonthly = 0;
            const mismatchedSubcats = [];

            subs.forEach(s => {
                const eq = typeof getRecurringMonthlyEquiv === 'function' ? getRecurringMonthlyEquiv(s) : r2(s.amount);
                m = r2(m + eq);
                const c = s.cycle || 'monthly';
                const sSub = s.subcategory || 'General';
                if (c !== 'monthly' && c !== 'weekly' && !s.reserveInBudget) {
                    unlinkedNonMonthly++;
                }
                if (s.category && sSub !== 'General') {
                    const catObj = (data.categories?.expense || []).find(cat => cat.name === s.category);
                    const subObj = catObj?.subcategories?.find(sub => sub.name === sSub);
                    if (subObj && (subObj.limit || 0) > 0 && Math.abs((subObj.limit || 0) - eq) > 500 && c === 'monthly') {
                        mismatchedSubcats.push(cleanLabel(sSub));
                    }
                }
            });

            let netIncomeRef = 0;
            const sal = safeParseLocal('myFinancesSalary', null);
            if (sal && Number(sal.basicSalary) > 0 && typeof calculateLaborMetrics === 'function') {
                netIncomeRef = r2(calculateLaborMetrics(sal, now).net || 0);
            }
            if (netIncomeRef <= 0) {
                const currMid = typeof getMonthId === 'function' ? getMonthId(new Date()) : '';
                (data.transactions || []).forEach(t => {
                    if (!t.isDeleted && t.type === 'income' && !t.isAdjustment && t.monthId === currMid) {
                        netIncomeRef = r2(netIncomeRef + r2(t.amount));
                    }
                });
            }

            const ratioLine = netIncomeRef > 0
                ? `<br><br>Representan el <b>${((m / netIncomeRef) * 100).toFixed(1)}%</b> de tu ingreso neto mensual${(m / netIncomeRef) > 0.35 ? ' <span style="color:var(--negative); font-weight:700;">(carga fija alta, ideal mantenerla bajo el 35%)</span>' : ' <span style="color:var(--positive); font-weight:700;">(nivel saludable)</span>'}.`
                : '';

            let alertsExtra = '';
            if (mismatchedSubcats.length > 0) {
                alertsExtra += `<br><br>Detecté <b>${mismatchedSubcats.length} subcategoría(s)</b> con límite distinto al valor de su recurrente (${mismatchedSubcats.slice(0, 3).join(', ')}). Activa <i>Sincronizar con Presupuesto</i> para alinearlas.`;
            }
            if (unlinkedNonMonthly > 0) {
                alertsExtra += `<br><br>Tienes <b>${unlinkedNonMonthly} cobro(s) anual/trimestral</b> sin provisionar mes a mes en Presupuesto.`;
            }

            return {
                title: 'Diagnóstico de Pagos Recurrentes',
                answer: `<span style="color:var(--warning);">${SVG.warn}</span> Tienes <b>${subs.length} pagos recurrentes activos</b> que equivalen a <strong style="color:var(--negative);">${fmt(m)} al mes</strong> (<b>${fmt(r2(m * 12))}</b> al año).${ratioLine}${alertsExtra}${renderTip('Vincula cada pago recurrente a su subcategoría de Presupuesto para evitar doble conteo en tu Libre Seguro Hoy y registrar el pago desde cualquiera de los dos lados.')}`
            };
        }

        if (q.includes('falta pagar') || q.includes('pendientes') || q.includes('por pagar')) {
            const pend = (data.transactions || []).filter(t => !t.isDeleted && t.monthId === monthId && t.status === 'pending');
            if (pend.length === 0) return { title: 'Todo al día', answer: `<span style="color:var(--positive);">${SVG.ok}</span> No tienes recibos ni pagos pendientes registrados este mes.` };
            let tp = 0;
            const list = pend.slice(0, 4).map(t => { const v = r2(t.budgetedAmount || t.amount); tp = r2(tp + v); return `• <b>${cleanLabel(t.description || t.category)}</b>: ${fmt(v)}`; }).join('<br>');
            return {
                title: 'Radar de Pagos Pendientes',
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Aún te faltan <b>${pend.length} compromiso(s)</b> por pagar este mes, que suman <strong style="color:var(--negative);">${fmt(tp)}</strong>:<br><br>${list}${renderTip('Ten presente este valor antes de hacer compras grandes: es dinero que ya tiene dueño.')}`
            };
        }

        if (q.includes('en que se me fue') || q.includes('fugas') || q.includes('mas gaste') || q.includes('gaste mas')) {
            const txs = (data.transactions || []).filter(t => t.monthId === monthId && t.type === 'expense' && !t.isDeleted && !t.isAdjustment && !t.isTripIsolated && t.status !== 'pending');
            if (txs.length === 0) return { title: 'Mes en ceros', answer: 'Aún no tienes gastos reales registrados este mes.' };
            const byCat = {}; let tot = 0;
            txs.forEach(t => { const c = cleanLabel(t.category || 'Otros'); const a = r2(t.amount); byCat[c] = r2((byCat[c] || 0) + a); tot = r2(tot + a); });
            const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
            const top = sorted[0];
            const second = sorted[1];
            const secondLine = second ? `<br>• <b>Segundo lugar:</b> <b>${second[0]}</b> con ${fmt(second[1])} (${Math.round((second[1] / tot) * 100)}%).` : '';
            return {
                title: 'En qué se te ha ido el mes',
                answer: `<span style="color:var(--negative);">${SVG.warn}</span> De los <b>${fmt(tot)}</b> que llevas gastados este mes, tu mayor salida ha sido:<br><br>• <b>Primer lugar:</b> <b>${top[0]}</b> con <strong style="color:var(--negative);">${fmt(top[1])}</strong> (${Math.round((top[1] / tot) * 100)}% de tus gastos).${secondLine}${renderTip(`Bajarle un 15% o 20% a ${top[0]} en lo que queda del mes te dará un respiro inmediato.`)}`
            };
        }

        if (q.includes('como voy') || q.includes('velocidad') || q.includes('presupuesto') || q.includes('cuanto me queda')) {
            const mIdx = now.getMonth();
            const yr = now.getFullYear();
            const daysInMonth = new Date(yr, mIdx + 1, 0).getDate();
            const monthElapsedPct = Math.round((now.getDate() / daysInMonth) * 100);

            let totalLim = 0, totalSpent = 0;
            const categoryLimits = {};
            const categorySpent = {};

            (data.categories?.expense || []).forEach(c => {
                if (typeof getCategoryLimitForMonth === 'function') {
                    const lim = getCategoryLimitForMonth(c, mIdx, yr);
                    totalLim = r2(totalLim + lim);
                    if (lim > 0) categoryLimits[cleanLabel(c.name)] = lim;
                }
            });

            (data.transactions || []).forEach(t => {
                if (!t.isDeleted && !t.isTripIsolated && t.monthId === monthId && t.type === 'expense' && !t.isAdjustment && t.status !== 'pending') {
                    const amt = r2(t.amount);
                    totalSpent = r2(totalSpent + amt);
                    const catName = cleanLabel(t.category || 'Otros');
                    categorySpent[catName] = r2((categorySpent[catName] || 0) + amt);
                }
            });

            if (totalLim <= 0) {
                return {
                    title: 'Sin topes definidos',
                    answer: `<span style="color:var(--info);">${SVG.info}</span> Llevas gastados <b>${fmt(totalSpent)}</b> en el mes (vamos al <b>${monthElapsedPct}%</b> del calendario). Define límites en la pestaña de Presupuesto para que pueda medir tu velocidad.`
                };
            }

            const rem = r2(totalLim - totalSpent);
            const pctUsed = Math.round((totalSpent / totalLim) * 100);

            let worstOffender = null;
            let maxOverspend = 0;
            for (const cat in categorySpent) {
                if (categoryLimits[cat]) {
                    const over = categorySpent[cat] - categoryLimits[cat];
                    if (over > maxOverspend) {
                        maxOverspend = over;
                        worstOffender = cat;
                    }
                }
            }

            if (rem < 0) {
                const offenderText = worstOffender ? ` Gran parte de esta desviación vino de <b>${worstOffender}</b>, donde superaste el límite por ${fmt(maxOverspend)}.` : '';
                return {
                    title: 'Presupuesto superado',
                    answer: `<span style="color:var(--negative);">${SVG.warn}</span> ${nameTag}te pasaste por <strong style="color:var(--negative);">${fmt(Math.abs(rem))}</strong> sobre tu plan global de <b>${fmt(totalLim)}</b> (ya gastaste el ${pctUsed}% y apenas vamos por el ${monthElapsedPct}% del mes).<br><br>${offenderText}${renderTip('Para no afectar tu flujo de caja, recorta en salidas y domicilios esta semana y evalúa si ese presupuesto necesita ajustarse el próximo mes.')}`
                };
            }

            if (pctUsed > monthElapsedPct + 10) {
                return {
                    title: 'Tu ritmo de gasto va alto',
                    answer: `<span style="color:var(--warning);">${SVG.warn}</span> Vamos al <b>${monthElapsedPct}%</b> del mes, pero ya te consumiste el <b>${pctUsed}%</b> de tu presupuesto (gastaste <b>${fmt(totalSpent)}</b> de ${fmt(totalLim)}).<br><br>Todavía te quedan <strong style="color:var(--positive);">${fmt(rem)}</strong> disponibles, pero toca bajar el ritmo si quieres llegar con holgura a fin de mes.`
                };
            }

            return {
                title: 'Presupuesto bajo control',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Vas a excelente ritmo! Vamos al <b>${monthElapsedPct}%</b> del mes y has consumido el <b>${pctUsed}%</b> de tu presupuesto (<b>${fmt(totalSpent)}</b> de ${fmt(totalLim)}).<br><br>Te quedan <strong style="color:var(--positive);">${fmt(rem)}</strong> disponibles para cerrar el mes con tranquilidad.`
            };
        }

        if (q.includes('mapa de calor') || q.includes('ritmo') || q.includes('peor dia') || q.includes('dias sin gastar')) {
            if (typeof computeCalendarHeatmapData === 'function') {
                const hm = computeCalendarHeatmapData(now, 'variable');
                const activeDays = hm.days.filter(d => d.daySpend > 0).sort((a, b) => b.daySpend - a.daySpend);
                if (activeDays.length === 0) {
                    return {
                        title: 'Mapa de calor en verde',
                        answer: `<span style="color:var(--positive);">${SVG.ok}</span> ¡Racha impecable! Llevas <b>${hm.zeroSpendDays} días</b> en este mes sin hacer gastos variables.`
                    };
                }
                const worst = activeDays[0];
                return {
                    title: 'Tu Mapa de Calor del Mes',
                    answer: `<span style="color:var(--accent);">${SVG.flame}</span> El mapa de calor mide qué días abres la billetera y qué días logras dejarla quieta:<br><br>• <b>Días de cero gasto variable:</b> <strong style="color:var(--positive);">${hm.zeroSpendDays} días</strong><br>• <b>Promedio cuando compras:</b> ${fmt(hm.avgDailySpend)} por día activo<br>• <b>Tu día más intenso:</b> El <b>${worst.day}</b> del mes, con <strong style="color:var(--negative);">${fmt(worst.daySpend)}</strong>${renderTip('Sumar 2 o 3 días seguidos de cero gasto a la semana es el hábito más efectivo para hacer rendir el sueldo.')}`
                };
            }
        }

        if (q.includes('viaje') || q.includes('vacaciones') || q.includes('acompanante')) {
            const trip = data.tripMode || {};
            if (!trip.active) {
                return {
                    title: 'Modo Viaje Inactivo',
                    answer: `No tienes un viaje activo en este momento.${renderTip('Cuando salgas de vacaciones, activa el Modo Viaje en el menú lateral para que esos gastos no descuadren tus estadísticas normales de casa.')}`
                };
            }
            let spent = 0, owed = 0;
            (data.transactions || []).forEach(t => {
                if (!t.isDeleted && t.isTripIsolated && t.status !== 'pending') {
                    spent = r2(spent + r2(t.amount));
                    if (t.isSharedExpense) owed = r2(owed + r2(t.sharedOwedAmount || 0));
                }
            });
            const sharedNote = trip.isShared ? `<br>• <b>Te debe ${cleanLabel(trip.companionName || 'tu acompañante')}:</b> <strong style="color:var(--positive);">${fmt(owed)}</strong>` : '';
            return {
                title: `Viaje: ${cleanLabel(trip.name || 'Activo')}`,
                answer: `<span style="color:var(--accent);">${SVG.info}</span> Tus gastos de viaje están aislados del presupuesto mensual:<br><br>• <b>Gastado en el viaje:</b> ${fmt(spent)}${trip.budget > 0 ? ` de ${fmt(trip.budget)}` : ''}${sharedNote}`
            };
        }

        if (q.includes('ingresos este mes') || q.includes('cuanto ha entrado') || q.includes('ganancias')) {
            let inc = 0, exp = 0;
            (data.transactions || []).forEach(t => {
                if (t.isDeleted || t.monthId !== monthId || t.isAdjustment || t.status === 'pending') return;
                if (isRefundTx(t)) { exp = Math.max(0, r2(exp - r2(t.amount))); return; }
                if (t.type === 'income') inc = r2(inc + r2(t.amount));
                if (t.type === 'expense') exp = r2(exp + r2(t.amount));
            });
            const remainingInc = r2(inc - exp);
            return {
                title: 'Ingresos del Mes',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> Este mes han entrado <strong style="color:var(--positive);">${fmt(inc)}</strong> a tus cuentas.<br><br>Descontando lo que ya gastaste (${fmt(exp)}), te quedan <b>${fmt(remainingInc)}</b> de los ingresos de este mes.`
            };
        }

        if (q.includes('tarjeta') || q.includes('corte') || q.includes('cupo')) {
            const cards = data.customAccounts.filter(a => a.category === 'credit_card');
            if (cards.length === 0) return { title: 'Sin tarjetas', answer: 'No tienes tarjetas de crédito registradas.' };
            const ans = cards.map(c => {
                const bal = r2(balances[c.id] || 0);
                return bal > 0
                    ? `• <b>${cleanLabel(c.name)}</b>: Debes <strong style="color:var(--negative);">${fmt(bal)}</strong> (corta el día ${c.cutoffDay}).`
                    : `• <b>${cleanLabel(c.name)}</b>: En ceros (corta el día ${c.cutoffDay}).`;
            }).join('<br>');
            return {
                title: 'Panorama de tus Tarjetas',
                answer: `<span style="color:var(--accent);">${SVG.card}</span> Así están tus tarjetas de crédito hoy:<br><br>${ans}${renderTip('Si pagas el total del extracto antes de la fecha límite, evitas los intereses rotativos (los más caros del mercado).')}`
            };
        }

        if (q.includes('salud financiera') || q.includes('capacidad') || q.includes('endeudarme') || q.includes('puedo endeudar') || q.includes('calificacion')) {
            if (typeof calculateBorrowingCapacity !== 'function') {
                return {
                    title: 'Salud Financiera',
                    answer: `Para medir exactamente qué porcentaje de tu sueldo va a deudas, configura tu salario en <b>Perfil > Mi Salario y Proyecciones</b>.${renderTip('La regla saludable es que tus cuotas de deuda mensuales no superen el 30% de lo que ganas libre.')}`
                };
            }
            const cap = calculateBorrowingCapacity(monthId);
            if (!cap || cap.baseIncome <= 0) {
                return {
                    title: 'Salud Financiera',
                    answer: `Para medir exactamente qué porcentaje de tu ingreso va a deudas, configura tu salario en <b>Perfil > Mi Salario y Proyecciones</b> o registra tus ingresos del mes.${renderTip('La regla saludable es que tus cuotas de deuda mensuales no superen el 30% de lo que ganas libre.')}`
                };
            }
            const usagePct = Math.round(cap.usedPct || 0);
            const healthy = usagePct <= (cap.maxPct || 30);
            return {
                title: 'Tu Capacidad de Endeudamiento',
                answer: `<span style="color:${healthy ? 'var(--positive)' : 'var(--warning)'};">${SVG.chart}</span> De tu ingreso base mensual (${fmt(cap.baseIncome)}), tus cuotas actuales de deuda comprometen aprox. <b>${fmt(cap.committedMonthly)}</b> (el <b>${usagePct}%</b>).<br><br>${healthy ? `Estás dentro del rango saludable (menos del ${cap.maxPct || 30}%).` : `Ya superaste el tope saludable del ${cap.maxPct || 30}% de tu ingreso.`}${renderTip(healthy ? 'Aunque tienes margen, endéudate solo si la cuota cabe cómoda en tu presupuesto.' : 'Evita adquirir nuevos créditos hasta bajar el saldo de tus tarjetas actuales.')}`
            };
        }

        // 40-44. Educación y Guías Paso a Paso
        if (q.includes('que es avalancha') || q.includes('metodo avalancha')) {
            return {
                title: '¿Qué es el Método Avalancha?',
                answer: `Es la estrategia matemática más barata para salir de deudas:<br><br>1. Pagas el mínimo obligatorio en todas tus deudas.<br>2. Todo el dinero extra que consigas lo abonas a la deuda con la <b>tasa de interés más alta</b>.<br>3. Cuando la apagas, pasas todo ese dinero a la segunda más cara.${renderTip('Es ideal si quieres pagarle la menor cantidad posible de intereses a los bancos.')}`
            };
        }
        if (q.includes('que es bola de nieve') || q.includes('metodo bola')) {
            return {
                title: '¿Qué es el Método Bola de Nieve?',
                answer: `Es una estrategia pensada para darte motivación rápida:<br><br>1. Ordenas tus deudas de la <b>más pequeña a la más grande</b> (sin mirar intereses).<br>2. Atacas con todo la deuda más chiquita para cancelarla pronto.<br>3. Al eliminarla, sumas esa cuota liberada a la siguiente deuda.${renderTip('Ver cómo desaparecen deudas rápido te da impulso y libera flujo de caja mensual.')}`
            };
        }
        if (q.includes('como creo un bolsillo') || q.includes('crear bolsillo')) {
            return {
                title: 'Paso a paso: Crear un Bolsillo',
                answer: `1. Abre el menú lateral principal.<br>2. Entra a <b>Bolsillos de Ahorro</b>.<br>3. Toca <b>+ Crear mi primer bolsillo</b>, ponle un nombre (ej. <i>Emergencias</i>) y una meta opcional.<br>4. Abona dinero desde tus cuentas cuando quieras protegerlo.${renderTip('La plata que metas en un bolsillo no sumará en tu disponible para gastar hoy.')}`
            };
        }
        if (q.includes('que es patrimonio neto') || q.includes('formula patrimonio')) {
            return {
                title: '¿Qué es el Patrimonio Neto?',
                answer: `Es el termómetro real de tu riqueza: <b>Todo lo que tienes (cuentas, ahorros, inversiones, bienes) MENOS todo lo que debes (tarjetas y créditos).</b><br><br>Ganar un buen sueldo no siempre significa tener patrimonio si todo se va en deudas; el patrimonio crece cuando ahorras o pagas capital de tus créditos.`
            };
        }
        if (q.includes('libre seguro') || q.includes('safe to spend')) {
            const safe = typeof computeSafeToSpendToday === 'function' ? computeSafeToSpendToday(monthId, snap) : null;
            return {
                title: '¿Qué es Libre Seguro Hoy?',
                answer: `<span style="color:var(--positive);">${SVG.ok}</span> Es la cifra más honesta de tu bolsillo${safe ? `: hoy es <b>${fmt(safe.safeToSpend)}</b>` : ''}.<br><br>Toma el dinero real de tus cuentas y le resta tus recibos pendientes del mes y lo que falta de tu presupuesto, para mostrarte cuánto puedes gastar hoy sin descuadrarte.`
            };
        }

        // 45-49. Buscador Forense Avanzado
        if (extAmt > 0 || q.length > 3) {
            let found = (data.transactions || []).filter(t => !t.isDeleted && !t.isAdjustment);
            found = extAmt > 0
                ? found.filter(t => Math.abs(r2(t.amount) - extAmt) <= 1000)
                : found.filter(t => normalizeText(t.description || '').includes(q) || normalizeText(t.category || '').includes(q));

            if (found.length > 0) {
                found.sort((a, b) => b.id - a.id);
                const recent = found[0];
                const totalFound = r2(found.reduce((s, t) => s + r2(t.amount), 0));
                const typeLabel = recent.type === 'income' ? 'un ingreso' : 'un gasto';
                const msg = extAmt > 0
                    ? `Encontré ${typeLabel} cercano a <b>${fmt(extAmt)}</b> el <b>${recent.date}</b> en <b>${cleanLabel(recent.category)}</b> ("${cleanLabel(recent.description)}") por <b>${fmt(recent.amount)}</b>.`
                    : `El último registro sobre "<b>${cleanLabel(raw)}</b>" fue ${typeLabel} el <b>${recent.date}</b> por <b>${fmt(recent.amount)}</b> en <b>${cleanLabel(recent.category)}</b>.`;
                const multiNote = found.length > 1 ? renderTip(`En total encontré ${found.length} movimientos coincidentes en tu historial que suman ${fmt(totalFound)}.`) : '';
                return { title: 'Esto encontré en tu historial', answer: `<span style="color:var(--accent);">${SVG.info}</span> ${msg}${multiNote}` };
            }
        }

        // FALLBACK
        return {
            title: 'No encontré ese dato exacto',
            answer: `No vi movimientos o conceptos exactos con ese nombre. Prueba preguntándome:<br><br>• <i>"Dame mi briefing del día"</i><br>• <i>"¿Cómo voy a cerrar el mes?"</i><br>• <i>"¿Qué pasa si abono 1 millón a mi tarjeta?"</i><br>• <i>"¿Tengo gasto hormiga?"</i><br>• <i>"¿Cuánto tengo ahorrado?"</i>`
        };
    };
// Blindaje Anti-XSS y guarda de sesion sobre todas las respuestas de Lumi
    const rawAskLumi = window.askLumi;
    const ALLOWED_LUMI_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'SMALL', 'SPAN', 'DIV', 'P', 'BR', 'UL', 'OL', 'LI']);
    const ALLOWED_LUMI_SVG_TAGS = new Set(['SVG', 'PATH', 'CIRCLE', 'LINE', 'POLYLINE', 'RECT', 'POLYGON']);
    const ALLOWED_LUMI_SVG_ATTRS = new Set(['width', 'height', 'viewbox', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'd', 'cx', 'cy', 'r', 'x', 'y', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'aria-hidden']);

    const DROP_LUMI_CONTENT_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'MATH', 'TEMPLATE', 'FOREIGNOBJECT', 'ANIMATE', 'SET']);
    const UNSAFE_LUMI_STYLE_RE = /(?:\\|\/\*|url\s*\(|@import|expression\s*\(|javascript:|vbscript:|data:|behavior:|-moz-binding|position\s*:\s*(?:fixed|absolute|sticky)|z-index\s*:|inset\s*:)/i;
    const BLOCKED_LUMI_CLASS_RE = /(?:^|\s)(?:auth-overlay|modal-overlay|modal|hidden|app-bg-shield|lumen-ready|side-drawer|bottom-nav|fab-btn|fab-menu|btn-danger|delete-[^\s]*|remove-[^\s]*)(?:\s|$)/i;

    const escapeLumiFallback = (val) => {
        if (typeof esc === 'function') return esc(val);
        return String(val ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
};

    const sanitizeLumiFragment = (rawHtml) => {
        if (!rawHtml) return '';
        if (typeof DOMParser === 'undefined') {
            return escapeLumiFallback(rawHtml);
        }
        const doc = new DOMParser().parseFromString(`<div>${String(rawHtml)}</div>`, 'text/html');
        const root = doc.body.firstElementChild;
        if (!root) return '';

        const cleanElement = (el) => {
            const children = Array.from(el.childNodes);
            for (const node of children) {
                if (node.nodeType === 8) {
                    node.remove();
                    continue;
                }
                if (node.nodeType === 1) {
                    const tag = node.tagName.toUpperCase();
                    if (DROP_LUMI_CONTENT_TAGS.has(tag)) {
                        node.remove();
                        continue;
                    }
                    const isSvgTag = ALLOWED_LUMI_SVG_TAGS.has(tag);
                    if (!ALLOWED_LUMI_TAGS.has(tag) && !isSvgTag) {
                        const textReplacement = doc.createTextNode(node.textContent || '');
                        node.replaceWith(textReplacement);
                        continue;
                    }
                    const attrs = Array.from(node.attributes);
                    for (const attr of attrs) {
                        const name = attr.name.toLowerCase();
                        const val = String(attr.value || '');
                        if (name === 'style' && val.length <= 400 && !UNSAFE_LUMI_STYLE_RE.test(val)) {
                            continue;
                        }
                        if (name === 'class' && val.length <= 120 && !BLOCKED_LUMI_CLASS_RE.test(val)) {
                            continue;
                        }
                        if (isSvgTag && ALLOWED_LUMI_SVG_ATTRS.has(name) && val.length <= 400 && !/[<>]/.test(val)) {
                            continue;
                        }
                        node.removeAttribute(attr.name);
                    }
                    cleanElement(node);
                }
            }
        };

        cleanElement(root);
        return root.innerHTML;
    };

    if (typeof rawAskLumi === 'function') {
        window.askLumi = function (rawQuestion) {
            if (window.LumenSecurity?.isVaultLocked?.()) {
                return {
                    title: 'Boveda bloqueada',
                    answer: 'Desbloquea Lumen con tu PIN o huella para consultar tus cifras financieras.'
                };
            }
            const safeInput = String(rawQuestion || '').replace(/[<>]/g, '').slice(0, 500);
            const result = rawAskLumi(safeInput) || { title: 'Lumi', answer: '' };
            return {
                title: sanitizeLumiFragment(result.title),
                answer: sanitizeLumiFragment(result.answer)
            };
        };
    }
})();

// ============================================================
// BANNER UNICO DE LANZAMIENTO: BIENVENIDA A LUMI (USUARIOS ACTUALES)
// ============================================================
(function initLumiReleaseBanner() {
    const STORAGE_KEY = 'lumen_release_lumi_v1';

    const markAsSeen = () => {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch (e) {}
    };

    const closeBanner = () => {
        markAsSeen();
        const el = document.getElementById('lumi-release-banner-overlay');
        if (el) el.remove();
    };

    const showBanner = () => {
        if (document.getElementById('lumi-release-banner-overlay')) return;

        const overlay = document.createElement('div');
        overlay.id = 'lumi-release-banner-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9998;
            background: rgba(15, 23, 42, 0.55);
            backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px);
            display: flex; align-items: center; justify-content: center;
            padding: 18px; animation: fadeIn 0.25s ease;
        `;

        overlay.innerHTML = `
            <div style="width:100%; max-width:370px; background:var(--card-bg); border:1px solid var(--border-color); border-radius:26px; padding:22px 20px 20px; box-shadow:0 20px 45px rgba(0,0,0,0.22); text-align:center; position:relative;">
                
                <!-- Píldora superior -->
                <div style="display:flex; justify-content:center; align-items:center; gap:6px; margin-bottom:14px;">
                    <span style="font-size:10px; font-weight:800; letter-spacing:0.6px; text-transform:uppercase; color:var(--accent); background:color-mix(in srgb, var(--accent) 13%, transparent); padding:3px 10px; border-radius:99px;">
                        Nuevo en Lumen
                    </span>
                    <span style="font-size:9.5px; font-weight:800; letter-spacing:0.4px; color:var(--positive); background:color-mix(in srgb, var(--positive) 14%, transparent); padding:3px 9px; border-radius:99px;">
                        100% Sin conexión
                    </span>
                </div>

                <!-- Tarjeta visual de Lumi -->
                <div style="background:var(--hover-bg); border:1px solid var(--border-color); border-radius:16px; padding:12px 14px; margin-bottom:16px; display:flex; align-items:center; justify-content:space-between; text-align:left;">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="width:36px; height:36px; border-radius:11px; background:linear-gradient(135deg, #06B6D4 0%, #8B5CF6 100%); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 6px 14px rgba(139, 92, 246, 0.28);">
                            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M10 3.5L11.65 8.35L16.5 10L11.65 11.65L10 16.5L8.35 11.65L3.5 10L8.35 8.35L10 3.5Z" fill="#ffffff" fill-opacity="0.2"/>
                                <path d="M18.5 14.5L19.15 16.35L21 17L19.15 17.65L18.5 19.5L17.85 17.65L16 17L17.85 16.35L18.5 14.5Z" fill="#ffffff"/>
                                <circle cx="17.5" cy="5.5" r="1.1" fill="#ffffff" stroke="none"/>
                            </svg>
                        </span>
                        <div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <strong style="font-size:14px; font-weight:800; color:var(--text-main);">Lumi</strong>
                                <span style="font-size:9px; font-weight:800; letter-spacing:0.4px; color:var(--accent); background:color-mix(in srgb, var(--accent) 14%, transparent); border:1px solid color-mix(in srgb, var(--accent) 26%, transparent); padding:1px 6px; border-radius:99px;">BETA</span>
                            </div>
                            <small style="display:block; font-size:11px; color:var(--text-muted); font-weight:600;">Tu copiloto financiero local</small>
                        </div>
                    </div>
                </div>

                <!-- Título y descripción -->
                <h2 style="font-size:20px; font-weight:800; color:var(--text-main); margin:0 0 8px; line-height:1.22; letter-spacing:-0.3px;">
                    ¡Conoce a Lumi, tu copiloto!
                </h2>
                <p style="font-size:12.5px; color:var(--text-muted); line-height:1.48; margin:0 0 14px;">
                    Analiza tus números al instante, <b>100% sin conexión</b> y sin que tu información salga de tu dispositivo.
                </p>

                <!-- 3 beneficios rápidos -->
                <div style="display:flex; flex-direction:column; gap:8px; text-align:left; margin-bottom:18px;">
                    <div style="display:flex; align-items:flex-start; gap:9px; font-size:12px; color:var(--text-main); line-height:1.38;">
                        <span style="width:22px; height:22px; border-radius:7px; background:color-mix(in srgb, var(--positive) 14%, transparent); color:var(--positive); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </span>
                        <span><b>Decisiones sin enredos:</b> Pregúntale si te alcanza para un gusto o cómo vas a cerrar el mes.</span>
                    </div>
                    <div style="display:flex; align-items:flex-start; gap:9px; font-size:12px; color:var(--text-main); line-height:1.38;">
                        <span style="width:22px; height:22px; border-radius:7px; background:color-mix(in srgb, var(--accent) 14%, transparent); color:var(--accent); display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; margin-top:1px;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                        </span>
                        <span><b>Tarjetas y deudas:</b> Descubre qué tarjeta te conviene hoy o simula abonos a capital.</span>
                    </div>
                </div>

                <!-- Botones de acción -->
                <button type="button" id="btn-try-lumi-release" class="btn btn-primary" style="width:100%; padding:13px; font-size:13.5px; font-weight:800; margin-bottom:8px;">
                    Probar Lumi ahora
                </button>
                <button type="button" id="btn-dismiss-lumi-release" style="width:100%; background:transparent; border:none; color:var(--text-muted); font-size:12.5px; font-weight:700; padding:6px; cursor:pointer;">
                    Entendido, lo veo luego
                </button>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById('btn-try-lumi-release')?.addEventListener('click', () => {
            closeBanner();
            if (typeof window.openLumenAssistant === 'function') {
                window.openLumenAssistant();
            }
        });

        document.getElementById('btn-dismiss-lumi-release')?.addEventListener('click', closeBanner);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeBanner();
        });
    };

    window.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem(STORAGE_KEY) === '1') return;
        if (window.LumenSecurity?.isVaultLocked?.()) return;

        const hasUser = Boolean(localStorage.getItem('myFinancesAuth'));
        const authOverlay = document.getElementById('auth-overlay');
        const isOnboardingOpen = authOverlay && !authOverlay.classList.contains('hidden');

        if (!hasUser || isOnboardingOpen) {
            markAsSeen();
            return;
        }

        setTimeout(showBanner, 750);
    });
})();