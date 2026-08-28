/**
 * GLOBAL TRANSLATIONS — order intake automation
 *
 * Install this file in Extensions > Apps Script from the FORMULARIO spreadsheet.
 * The automation is intentionally OFF after installation. Use the CONTROL sheet
 * or the “Global Translations” menu to activate it.
 */

const GT = {
  CONTROL_SHEET: 'CONTROL',
  PROCESSED_LABEL: 'GT/AUTOMATION-PROCESSED',
  ACTIVE_LABEL_ROOT: '0. Work/0. 1 HOUR/0. DL IN PROGRESS',
  PAYMENT_WINDOW_HOURS: 24,
  HEADERS: [
    'Día', 'Fecha', 'Tipo', 'CONSECUTIVO', 'Nombre', 'País', 'Idioma',
    'Método Pago', 'Cantidad', 'Estado de pago', 'Referencia de pago',
    'Email cliente', 'ID pedido', 'Enlaces licencia'
  ]
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Global Translations — Pedidos')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getAppData() {
  const control = getOrCreateControlSheet_();
  const orders = listPendingOrders();
  const values = control.getRange('B2:B6').getValues().flat();
  return {
    active: values[0] === true,
    lastReview: values[2] ? formatDateTime_(values[2]) : '',
    lastCount: values[3] || 0,
    status: values[4] || '',
    account: Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '',
    pendingCount: orders.length,
    orders,
    inProgressFolders: getInProgressFolders()
  };
}

function listPendingOrders() {
  const messages = findUnprocessedWixOrders_(getOrCreateLabel_(GT.PROCESSED_LABEL));
  const sheet = SpreadsheetApp.getActive().getSheetByName('FORMULARIO');
  if (!sheet) throw new Error('No existe la pestaña FORMULARIO.');
  ensureOrderHeaders_(sheet);
  const headers = headerMap_(sheet);
  const first = nextConsecutive_(sheet, headers['CONSECUTIVO']);
  const start = Number(String(first).match(/B(\d+)/i)?.[1] || 1);
  return messages.map((message, index) => {
    const order = parseWixOrder_(message);
    if (!order) return null;
    const payment = findMatchingPayment_(order);
    return {
      messageId: message.getId(),
      fullName: order.fullName,
      email: order.email,
      country: order.country,
      language: order.language,
      service: order.service,
      amount: order.amount,
      type: order.type,
      subject: order.subject,
      bodySnippet: order.body,
      receivedAt: formatDateTime_(order.receivedAt),
      paymentStatus: payment ? `Pagado (${payment.method})` : 'Pendiente de pago',
      suggestedConsecutive: `B${start + index}`
    };
  }).filter(Boolean);
}

function processSelectedOrder(messageId, consecutive, fullName) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const message = GmailApp.getMessageById(messageId);
    if (!message) throw new Error('No se encontró el correo seleccionado.');
    const processedLabel = getOrCreateLabel_(GT.PROCESSED_LABEL);
    if (messageHasLabel_(message, processedLabel)) throw new Error('Este pedido ya fue procesado. Actualiza la lista.');
    if (!/^B\d+$/i.test(String(consecutive || ''))) throw new Error('El consecutivo debe tener el formato B####.');
    const order = parseWixOrder_(message);
    if (!order) throw new Error('No se pudieron leer el nombre y el email del pedido.');
    const payment = findMatchingPayment_(order);
    const sheet = SpreadsheetApp.getActive().getSheetByName('FORMULARIO');
    if (!sheet) throw new Error('No existe la pestaña FORMULARIO.');
    ensureOrderHeaders_(sheet);
    const headers = headerMap_(sheet);
    if (consecutiveExists_(sheet, headers['CONSECUTIVO'], String(consecutive).toUpperCase())) {
      throw new Error(`El consecutivo ${String(consecutive).toUpperCase()} ya existe en FORMULARIO.`);
    }
    const result = appendOrder_(sheet, order, payment, message, false, String(consecutive).toUpperCase());
    applyOrderLabels_(message, result.consecutive, fullName || order.fullName, order.country, processedLabel, payment && payment.message);
    if (order.type === 'RVA' && telegramEnabled_()) sendTelegramAlert_(order, result, payment);
    return { success: true, message: `${result.consecutive} — ${order.fullName}: pedido procesado.` };
  } finally {
    lock.releaseLock();
  }
}

function processSelectedOrders(items) {
  const results = [];
  (items || []).forEach(item => {
    try {
      results.push(processSelectedOrder(item.messageId, item.consecutive, item.fullName));
    } catch (error) {
      results.push({ success: false, message: `${item.consecutive || ''}: ${error.message}` });
    }
  });
  const failed = results.filter(result => !result.success);
  return {
    success: failed.length === 0,
    results,
    message: failed.length ? `${results.length - failed.length} procesado(s); ${failed.length} con error.` : `${results.length} pedido(s) procesado(s).`
  };
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Global Translations')
    .addItem('Instalar / actualizar panel', 'installGlobalTranslations')
    .addSeparator()
    .addItem('Activar automatización', 'activateAutomation')
    .addItem('Desactivar automatización', 'deactivateAutomation')
    .addItem('Procesar ahora', 'processOrdersNow')
    .addItem('Ejecutar prueba (sin cambios)', 'runDryTest')
    .addSeparator()
    .addItem('Configurar Telegram', 'configureTelegram')
    .addItem('Probar Telegram', 'testTelegram')
    .addToUi();
}

/** Run once, from the menu. */
function installGlobalTranslations() {
  const ss = SpreadsheetApp.getActive();
  const sheet = ss.getSheetByName('FORMULARIO');
  if (!sheet) throw new Error('No se encontró una pestaña llamada FORMULARIO.');
  ensureOrderHeaders_(sheet);
  const control = getOrCreateControlSheet_();
  ensureOneMinuteTrigger_();
  control.getRange('B2').setValue(false);
  control.getRange('B6').setValue('Instalado. La automatización está apagada.');
  SpreadsheetApp.getUi().alert('Listo. Revisa CONTROL y actívala solo cuando quieras.');
}

function activateAutomation() {
  getOrCreateControlSheet_().getRange('B2').setValue(true);
  ensureOneMinuteTrigger_();
  SpreadsheetApp.getActive().toast('Automatización activada.', 'Global Translations');
}

function deactivateAutomation() {
  getOrCreateControlSheet_().getRange('B2').setValue(false);
  SpreadsheetApp.getActive().toast('Automatización desactivada. El disparador seguirá existiendo, pero no procesará correos.', 'Global Translations');
}

function processOrdersNow() { processOrders_({ force: true, dryRun: false }); }
function runDryTest() { processOrders_({ force: true, dryRun: true }); }
function scheduledOrderCheck() { processOrders_({ force: false, dryRun: false }); }

function processOrders_(options) {
  const control = getOrCreateControlSheet_();
  const active = control.getRange('B2').getValue() === true;
  if (!active && !options.force) return;
  const started = new Date();
  let created = 0;
  let warnings = 0;
  try {
    const orderSheet = SpreadsheetApp.getActive().getSheetByName('FORMULARIO');
    if (!orderSheet) throw new Error('No existe la pestaña FORMULARIO.');
    ensureOrderHeaders_(orderSheet);
    const processedLabel = getOrCreateLabel_(GT.PROCESSED_LABEL);
    const messages = findUnprocessedWixOrders_(processedLabel);
    messages.forEach(message => {
      const order = parseWixOrder_(message);
      if (!order) return;
      const payment = findMatchingPayment_(order);
      const result = appendOrder_(orderSheet, order, payment, message, options.dryRun);
      if (result.warning) warnings++;
      if (!options.dryRun) {
        applyOrderLabels_(message, result.consecutive, order.fullName, order.country, processedLabel, payment && payment.message);
        if (order.type === 'RVA' && telegramEnabled_()) sendTelegramAlert_(order, result, payment);
      }
      created++;
    });
    control.getRange('B4').setValue(started);
    control.getRange('B5').setValue(created);
    control.getRange('B6').setValue(options.dryRun
      ? `Prueba finalizada: ${created} pedido(s). No se modificó Gmail ni FORMULARIO.`
      : `Correcto: ${created} pedido(s) procesado(s); ${warnings} para revisión.`);
  } catch (error) {
    control.getRange('B4').setValue(started);
    control.getRange('B6').setValue(`ERROR: ${error.message}`);
    throw error;
  }
}

function findUnprocessedWixOrders_(processedLabel) {
  // Wix's localized subject can vary, so this checks known sender/subject phrases.
  const query = 'in:inbox newer_than:14d -label:"' + GT.PROCESSED_LABEL + '" ' +
    '("Online order form NEW" OR "RVA TRANSLATIONS" OR "1 HOUR GLOBAL TRANSLATIONS" OR "1 HOUR GLOBALTRANS" OR from:(wixforms.com wix.com))';
  const threads = GmailApp.search(query, 0, 100);
  const messages = [];
  threads.forEach(thread => thread.getMessages().forEach(message => {
    if (!messageHasLabel_(message, processedLabel)) messages.push(message);
  }));
  return messages.filter(message => isWixOrder_(message));
}

function isWixOrder_(message) {
  const subject = message.getSubject().toUpperCase();
  const body = message.getPlainBody().toUpperCase();
  return subject.includes('RVA TRANSLATIONS') ||
    subject.includes('1 HOUR GLOBAL TRANSLATIONS') ||
    subject.includes('1 HOUR GLOBALTRANS') ||
    subject.includes('ONLINE ORDER FORM') ||
    (body.includes('FOTO 1') && body.includes('EMAIL'));
}

function parseWixOrder_(message) {
  const body = message.getPlainBody();
  const subject = message.getSubject();
  const firstName = fieldAfter_(body, ['Nombre', 'First name', 'Name']);
  const lastName = fieldAfter_(body, ['Apellido', 'Last name', 'Surname']);
  const email = firstEmail_(fieldAfter_(body, ['Email', 'E-mail']) || body);
  const country = fieldAfter_(body, ['Land des Führerscheins', 'Country of licence', 'Country of license', 'País de la licencia']);
  const language = fieldAfter_(body, ['Sprache des Führerscheins', 'Language of licence', 'Language of license', 'Idioma de la licencia']);
  const service = fieldAfter_(body, ['Select your service', 'Service selected', 'Servicio seleccionado']) || '';
  const amount = amountFromText_(service) || amountFromText_(body);
  const urls = extractUrls_(body);
  const type = /RVA TRANSLATIONS/i.test(subject) || /\bRVA\b/i.test(service) ? 'RVA' : 'Normal';
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (!fullName || !email) return null; // A malformed mail is left untouched for manual review.
  return { fullName, email, country, language, service, amount, urls, type, receivedAt: message.getDate(), subject, body };
}

function findMatchingPayment_(order) {
  const after = new Date(order.receivedAt.getTime() - GT.PAYMENT_WINDOW_HOURS * 3600000);
  const before = new Date(order.receivedAt.getTime() + GT.PAYMENT_WINDOW_HOURS * 3600000);
  const query = 'newer_than:3d (from:stripe.com OR from:paypal.com)';
  const candidates = [];
  GmailApp.search(query, 0, 100).forEach(thread => thread.getMessages().forEach(message => {
    const when = message.getDate();
    if (when < after || when > before) return;
    const text = message.getPlainBody();
    const method = /paypal/i.test(message.getFrom()) || /PAYPAL/i.test(message.getSubject()) ? 'PayPal' : 'Stripe';
    const payment = { message, method, email: firstEmail_(text), amount: amountFromText_(text), reference: paymentReference_(text, method) };
    if (payment.email && payment.email.toLowerCase() === order.email.toLowerCase() && sameAmount_(payment.amount, order.amount)) candidates.push(payment);
  }));
  if (candidates.length === 1) return candidates[0];
  return null;
}

function appendOrder_(sheet, order, payment, message, dryRun, providedConsecutive) {
  const headers = headerMap_(sheet);
  const consecutive = providedConsecutive || nextConsecutive_(sheet, headers['CONSECUTIVO']);
  const status = payment ? 'Pagado' : 'Pendiente de pago';
  const row = new Array(sheet.getLastColumn()).fill('');
  put_(row, headers, 'DÍA', Utilities.formatDate(order.receivedAt, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'EEEE'));
  put_(row, headers, 'FECHA', Utilities.formatDate(order.receivedAt, SpreadsheetApp.getActive().getSpreadsheetTimeZone(), 'd/MMM'));
  put_(row, headers, 'TIPO', order.type);
  put_(row, headers, 'CONSECUTIVO', consecutive);
  put_(row, headers, 'NOMBRE', order.fullName);
  put_(row, headers, 'PAÍS', order.country);
  put_(row, headers, 'IDIOMA', order.language);
  put_(row, headers, 'MÉTODO PAGO', payment ? payment.method : '');
  put_(row, headers, 'CANTIDAD', order.amount || '');
  put_(row, headers, 'ESTADO DE PAGO', status);
  put_(row, headers, 'REFERENCIA DE PAGO', payment ? payment.reference : '');
  put_(row, headers, 'EMAIL CLIENTE', order.email);
  put_(row, headers, 'ID PEDIDO', message.getId());
  put_(row, headers, 'ENLACES LICENCIA', order.urls.join('\n'));
  if (!dryRun) sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return { consecutive, status, warning: false };
}

function applyOrderLabels_(orderMessage, consecutive, fullName, country, processedLabel, paymentMessage) {
  const firstName = (fullName || '').split(/\s+/)[0];
  const safeName = firstName.replace(/[\\/]/g, ' ').replace(/\s+/g, ' ').trim();
  const safeCountry = (country || 'Unknown').replace(/[\\/]/g, ' ').trim();
  const active = getOrCreateLabel_(`${GT.ACTIVE_LABEL_ROOT}/${consecutive} ${safeCountry} ${safeName}`);
  orderMessage.getThread().addLabel(active);
  orderMessage.getThread().addLabel(processedLabel);
  orderMessage.getThread().moveToArchive();
  if (paymentMessage) {
    paymentMessage.getThread().addLabel(active);
    paymentMessage.getThread().moveToArchive();
  }
}

function ensureOrderHeaders_(sheet) {
  const last = Math.max(sheet.getLastColumn(), GT.HEADERS.length);
  const existing = sheet.getRange(1, 1, 1, last).getValues()[0];
  GT.HEADERS.forEach(header => {
    if (!existing.map(normalize_).includes(normalize_(header))) {
      const col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(header);
      existing.push(header);
    }
  });
}

function getOrCreateControlSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(GT.CONTROL_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(GT.CONTROL_SHEET);
    sheet.getRange('A1:B6').setValues([
      ['GLOBAL TRANSLATIONS — CONTROL', ''],
      ['Automatización activa', false],
      ['Modo prueba', false],
      ['Última revisión', ''],
      ['Pedidos procesados última revisión', ''],
      ['Estado / errores', '']
    ]);
    sheet.getRange('B2:B3').insertCheckboxes();
    sheet.setFrozenRows(1);
    sheet.getRange('A1:B1').setFontWeight('bold').setBackground('#f9a825');
    sheet.autoResizeColumns(1, 2);
  }
  return sheet;
}

function ensureOneMinuteTrigger_() {
  if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'scheduledOrderCheck')) {
    ScriptApp.newTrigger('scheduledOrderCheck').timeBased().everyMinutes(1).create();
  }
}

function configureTelegram() {
  const ui = SpreadsheetApp.getUi();
  const token = ui.prompt('Telegram', 'Pega el token del bot (se guarda de forma privada en el proyecto):', ui.ButtonSet.OK_CANCEL);
  if (token.getSelectedButton() !== ui.Button.OK) return;
  const chat = ui.prompt('Telegram', 'Pega tu chat ID:', ui.ButtonSet.OK_CANCEL);
  if (chat.getSelectedButton() !== ui.Button.OK) return;
  PropertiesService.getScriptProperties().setProperties({ TELEGRAM_TOKEN: token.getResponseText().trim(), TELEGRAM_CHAT_ID: chat.getResponseText().trim() });
  ui.alert('Telegram configurado. Usa “Probar Telegram” para verificarlo.');
}

function testTelegram() {
  if (!telegramEnabled_()) throw new Error('Primero configura Telegram desde el menú.');
  sendTelegramText_('✅ Global Translations: Telegram está conectado.');
}

function telegramEnabled_() {
  const p = PropertiesService.getScriptProperties();
  return !!p.getProperty('TELEGRAM_TOKEN') && !!p.getProperty('TELEGRAM_CHAT_ID');
}

function sendTelegramAlert_(order, result, payment) {
  const urgent = /20\s*(min|minute)/i.test(order.service) ? '🚨 RVA 20 MIN' : '⚡ NUEVO RVA';
  sendTelegramText_(`${urgent}\n${result.consecutive} — ${order.fullName}\n${order.country || 'País no indicado'} · ${order.language || 'Idioma no indicado'}\n${order.amount ? 'NZ$' + order.amount.toFixed(2) : 'Importe no detectado'} · ${payment ? payment.method : 'Pendiente de pago'}\n${order.service}`);
}

function sendTelegramText_(text) {
  const p = PropertiesService.getScriptProperties();
  const url = 'https://api.telegram.org/bot' + p.getProperty('TELEGRAM_TOKEN') + '/sendMessage';
  UrlFetchApp.fetch(url, { method: 'post', payload: { chat_id: p.getProperty('TELEGRAM_CHAT_ID'), text }, muteHttpExceptions: false });
}

function fieldAfter_(body, labels) {
  for (const label of labels) {
    const re = new RegExp('(?:^|\\n)\\s*' + escapeRegExp_(label) + '\\s*:\\s*\\n?\\s*([^\\n]+)', 'i');
    const m = body.match(re);
    if (m) return m[1].trim();
  }
  return '';
}
function extractUrls_(text) { return (text.match(/https?:\/\/[^\s)]+/g) || []).filter(u => /wixstatic|wix/i.test(u)); }
function firstEmail_(text) { const m = String(text || '').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m ? m[0] : ''; }
function amountFromText_(text) {
  const m = String(text || '').match(/(?:NZ\$|\$)\s*([\d,]+(?:\.\d{1,2})?)|\$\s*([\d,]+(?:\.\d{1,2})?)\s*NZD|([\d,]+(?:\.\d{1,2})?)\s*NZD/i);
  if (!m) return null;
  return Number((m[1] || m[2] || m[3]).replace(/,/g, ''));
}
function sameAmount_(a, b) { return a !== null && b !== null && Math.abs(a - b) < 0.01; }
function paymentReference_(text, method) { const m = String(text).match(/(?:transaction|payment|receipt)\s*(?:id|number|#)?\s*[:#]?\s*([A-Z0-9-]{6,})/i); return m ? `${method} ${m[1]}` : method; }
function normalize_(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase(); }
function headerMap_(sheet) { const h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]; const map = {}; h.forEach((v, i) => map[normalize_(v)] = i); return map; }
function put_(row, map, header, value) { const i = map[normalize_(header)]; if (i !== undefined) row[i] = value; }
function nextConsecutive_(sheet, col) {
  const values = sheet.getRange(2, col + 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
  const n = values.reduce((max, v) => Math.max(max, Number(String(v).match(/B(\d+)/i)?.[1] || 0)), 0) + 1;
  return 'B' + n;
}
function consecutiveExists_(sheet, col, consecutive) {
  const count = Math.max(sheet.getLastRow() - 1, 1);
  return sheet.getRange(2, col + 1, count, 1).getValues().flat()
    .some(value => String(value || '').trim().toUpperCase() === consecutive);
}
function getOrCreateLabel_(name) { return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name); }
function messageHasLabel_(message, label) { return message.getThread().getLabels().some(l => l.getName() === label.getName()); }
function escapeRegExp_(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function formatDateTime_(date) {
  if (!date) return '';
  return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

function getInProgressFolders() {
  const prefix = GT.ACTIVE_LABEL_ROOT + '/';
  const labels = GmailApp.getUserLabels();
  return labels
    .filter(label => label.getName().startsWith(prefix))
    .map(label => ({
      fullName: label.getName(),
      shortName: label.getName().substring(prefix.length)
    }));
}
