import React, { useState, useEffect } from 'react';
import { 
  Zap, RefreshCw, CheckCircle2, AlertTriangle, Mail, CreditCard, 
  Tag, FileSpreadsheet, Globe, Check, AlertCircle, ArrowRight, 
  ExternalLink, Layers, ShieldCheck, Play
} from 'lucide-react';

const TRANSLATION_MAP = {
  'español': 'Spanish', 'espanol': 'Spanish', 'inglés': 'English', 'ingles': 'English',
  'francés': 'French', 'frances': 'French', 'alemán': 'German', 'aleman': 'German',
  'italiano': 'Italian', 'portugués': 'Portuguese', 'portugues': 'Portuguese',
  'japonés': 'Japanese', 'japones': 'Japanese', 'chino': 'Chinese', 'coreano': 'Korean',
  'ruso': 'Russian', 'árabe': 'Arabic', 'arabe': 'Arabic', 'holandés': 'Dutch', 'holandes': 'Dutch',
  'méxico': 'Mexico', 'mexico': 'Mexico', 'españa': 'Spain', 'espana': 'Spain',
  'francia': 'France', 'alemania': 'Germany', 'italia': 'Italy',
  'japón': 'Japan', 'japon': 'Japan', 'china': 'China', 'corea': 'Korea',
  'brasil': 'Brazil', 'rusia': 'Russia', 'suiza': 'Switzerland', 'suecia': 'Sweden',
  'holanda': 'Netherlands', 'países bajos': 'Netherlands', 'paises bajos': 'Netherlands',
  'bélgica': 'Belgium', 'belgica': 'Belgium', 'dinamarca': 'Denmark',
  'noruega': 'Norway', 'finlandia': 'Finland', 'polonia': 'Poland',
  'taiwán': 'Taiwan', 'taiwan': 'Taiwan'
};

const cleanExtracted = (text) => {
  if (!text) return '';
  let cleaned = text.split(/https?:\/\//i)[0];
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '');
  return cleaned.trim();
};

const translateToEnglish = (text) => {
  if (!text) return '';
  const lower = text.toLowerCase().trim();
  return TRANSLATION_MAP[lower] || text.trim();
};

const buildRegex = (keywords) => new RegExp(`(?:^|[\\s>])(?:${keywords})[\\s]*(?:[:：][\\s]*|[\\s]+)([^\\n<]+)`, 'i');

export default function AutoOrganizeTab({ token, sheetName, onRefreshTrigger, handleAuthError, onNavigateTab }) {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState({ current: 0, total: 0, statusText: '' });
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());
  const [statusMessage, setStatusMessage] = useState(null);
  const [sheetInfo, setSheetInfo] = useState({ id: null, name: sheetName });

  useEffect(() => {
    if (token) {
      scanInboxForOrders();
    }
  }, [token, sheetName]);

  const decodeBody = (payload, snippet) => {
    let bodyData = '';
    if (payload?.parts) {
      for (let part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyData = part.body.data;
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          bodyData = part.body.data;
        } else if (part.parts) {
          for (let subPart of part.parts) {
            if (subPart.mimeType === 'text/plain' && subPart.body?.data) {
              bodyData = subPart.body.data;
              break;
            }
          }
        }
      }
    } else if (payload?.body?.data) {
      bodyData = payload.body.data;
    }

    if (bodyData) {
      try {
        const decoded = decodeURIComponent(escape(atob(bodyData.replace(/-/g, '+').replace(/_/g, '/'))));
        return decoded.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').replace(/\r\n/g, '\n').replace(/\n+/g, '\n');
      } catch (e) {
        return snippet || '';
      }
    }
    return snippet || '';
  };

  const scanInboxForOrders = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      // 1. Fetch Order messages in Inbox
      const orderQuery = 'in:inbox ("Online order form NEW" OR "RVA TRANSLATIONS" OR "1 HOUR GLOBAL TRANSLATIONS" OR "1 HOUR GLOBALTRANS" OR "ONLINE ORDER FORM" OR from:wixforms.com OR from:wix.com OR "FOTO 1")';
      const orderRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(orderQuery)}&maxResults=30`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (orderRes.status === 401) handleAuthError(orderRes.status);
      const orderData = await orderRes.json();

      // 2. Fetch recent payment messages in Inbox or recent timeframe
      const paymentQuery = 'in:inbox (from:stripe.com OR from:paypal.com OR "Stripe" OR "PayPal" OR "receipt" OR "recibo")';
      const paymentRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(paymentQuery)}&maxResults=40`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const paymentData = await paymentRes.json();

      const rawOrders = orderData.messages || [];
      const rawPayments = paymentData.messages || [];

      // Download message details
      const [orderMessages, paymentMessages] = await Promise.all([
        Promise.all(rawOrders.map(async (m) => {
          const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return res.json();
        })),
        Promise.all(rawPayments.map(async (m) => {
          const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          return res.json();
        }))
      ]);

      // Parse payment messages
      const parsedPayments = paymentMessages.map(msg => {
        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const from = headers.find(h => h.name === 'From')?.value || '';
        const dateStr = headers.find(h => h.name === 'Date')?.value || '';
        const text = decodeBody(msg.payload, msg.snippet);
        const method = /paypal/i.test(from) || /PAYPAL/i.test(subject) ? 'PayPal' : 'Stripe';
        const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        const amountMatch = text.match(/(?:NZ\$|\$)\s*([\d,]+(?:\.\d{1,2})?)|\$\s*([\d,]+(?:\.\d{1,2})?)\s*NZD|([\d,]+(?:\.\d{1,2})?)\s*NZD/i);
        const amount = amountMatch ? Number((amountMatch[1] || amountMatch[2] || amountMatch[3]).replace(/,/g, '')) : null;

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject,
          from,
          date: dateStr ? new Date(dateStr) : new Date(),
          method,
          email: emailMatch ? emailMatch[0].toLowerCase() : '',
          amount,
          snippet: msg.snippet
        };
      });

      // 3. Connect to Google Sheet to check duplicates and find available DL numbers
      const cleanSheetName = (sheetName || 'July 2026').trim();
      const escapedName = cleanSheetName.replace(/'/g, "\\'");
      const driveQuery = `(name = '${escapedName}' or name contains '${escapedName}') and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`;
      const driveUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)`;
      
      const driveRes = await fetch(driveUrl, { headers: { Authorization: `Bearer ${token}` } });
      if (driveRes.status === 401) handleAuthError(driveRes.status);
      const driveData = await driveRes.json();

      let spreadsheetId = null;
      let sheet1HRValues = [];
      let sheetRVAValues = [];

      if (driveData.files && driveData.files.length > 0) {
        const exactMatch = driveData.files.find(f => f.name.trim().toLowerCase() === cleanSheetName.toLowerCase());
        spreadsheetId = exactMatch ? exactMatch.id : driveData.files[0].id;
        setSheetInfo({ id: spreadsheetId, name: cleanSheetName });

        // Fetch both tabs
        const [res1HR, resRVA] = await Promise.all([
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/1HRGT!E:K`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RVA!E:K`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (res1HR.ok) {
          const d1 = await res1HR.json();
          sheet1HRValues = d1.values || [];
        }
        if (resRVA.ok) {
          const d2 = await resRVA.json();
          sheetRVAValues = d2.values || [];
        }
      }

      // Collect existing client names in Sheet for duplicate detection
      const existing1HRClients = [];
      sheet1HRValues.forEach((row, idx) => {
        // E: DL (row[0]), G: CLIENT (row[2])
        if (row[2] && row[2].trim() && row[2].trim().toLowerCase() !== 'nombre' && row[2].trim().toLowerCase() !== 'client') {
          existing1HRClients.push({ name: row[2].trim().toLowerCase(), rowIdx: idx + 1, tab: '1HRGT', original: row[2].trim() });
        }
      });

      const existingRVAClients = [];
      sheetRVAValues.forEach((row, idx) => {
        // E: DL (row[0]), F: CLIENT (row[1])
        if (row[1] && row[1].trim() && row[1].trim().toLowerCase() !== 'nombre' && row[1].trim().toLowerCase() !== 'client') {
          existingRVAClients.push({ name: row[1].trim().toLowerCase(), rowIdx: idx + 1, tab: 'RVA', original: row[1].trim() });
        }
      });

      // Find initial free consecutive rows
      let lastFilled1HRIdx = -1;
      for (let i = 0; i < sheet1HRValues.length; i++) {
        const row = sheet1HRValues[i];
        if (row[2] && row[2].trim() !== '' && !['nombre', 'client', 'cliente'].includes(row[2].trim().toLowerCase())) {
          lastFilled1HRIdx = i;
        }
      }

      let lastFilledRVAIdx = -1;
      for (let i = 0; i < sheetRVAValues.length; i++) {
        const row = sheetRVAValues[i];
        if (row[1] && row[1].trim() !== '' && !['nombre', 'client', 'cliente'].includes(row[1].trim().toLowerCase())) {
          lastFilledRVAIdx = i;
        }
      }

      // Collect available consecutive rows pool
      let pool1HR = [];
      for (let i = lastFilled1HRIdx + 1; i < sheet1HRValues.length; i++) {
        const row = sheet1HRValues[i];
        if (row[0] && row[0].trim() !== '') {
          pool1HR.push({ rowIdx: i + 1, dl: row[0].trim() });
        }
      }

      // Find highest DL in 1HRGT to extend pool if needed
      let maxDL1HR = 0;
      sheet1HRValues.forEach(row => {
        const m = String(row[0] || '').match(/B(\d+)/i);
        if (m) maxDL1HR = Math.max(maxDL1HR, parseInt(m[1], 10));
      });
      if (maxDL1HR === 0) maxDL1HR = 5000;

      if (pool1HR.length < 30) {
        let nextRow = sheet1HRValues.length + 1;
        let nextDLNum = maxDL1HR + 1;
        if (pool1HR.length > 0) {
          const lastInPool = pool1HR[pool1HR.length - 1];
          nextRow = lastInPool.rowIdx + 1;
          const m = String(lastInPool.dl).match(/B(\d+)/i);
          if (m) nextDLNum = parseInt(m[1], 10) + 1;
        }
        while (pool1HR.length < 30) {
          pool1HR.push({ rowIdx: nextRow++, dl: `B${nextDLNum++}` });
        }
      }

      let poolRVA = [];
      for (let i = lastFilledRVAIdx + 1; i < sheetRVAValues.length; i++) {
        const row = sheetRVAValues[i];
        if (row[0] && row[0].trim() !== '') {
          poolRVA.push({ rowIdx: i + 1, dl: row[0].trim() });
        }
      }

      // Find highest DL in RVA to extend pool if needed
      let maxDLRVA = 0;
      sheetRVAValues.forEach(row => {
        const m = String(row[0] || '').match(/B(\d+)/i);
        if (m) maxDLRVA = Math.max(maxDLRVA, parseInt(m[1], 10));
      });
      if (maxDLRVA === 0) maxDLRVA = 5000;

      if (poolRVA.length < 30) {
        let nextRow = sheetRVAValues.length + 1;
        let nextDLNum = maxDLRVA + 1;
        if (poolRVA.length > 0) {
          const lastInPool = poolRVA[poolRVA.length - 1];
          nextRow = lastInPool.rowIdx + 1;
          const m = String(lastInPool.dl).match(/B(\d+)/i);
          if (m) nextDLNum = parseInt(m[1], 10) + 1;
        }
        while (poolRVA.length < 30) {
          poolRVA.push({ rowIdx: nextRow++, dl: `B${nextDLNum++}` });
        }
      }

      // 4. Parse Orders and match with sequential DLs and Payments
      const parsedOrders = [];
      let pointer1HR = 0;
      let pointerRVA = 0;

      for (const msg of orderMessages) {
        const headers = msg.payload?.headers || [];
        const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
        const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
        const dateStr = headers.find(h => h.name === 'Date')?.value || '';
        const receivedAt = dateStr ? new Date(dateStr) : new Date();
        const text = decodeBody(msg.payload, msg.snippet);

        const nombreMatch = text.match(buildRegex('Nombre|First Name|Name|Vorname|名前|氏名'));
        const apellidoMatch = text.match(buildRegex('Apellido|Last Name|Surname|Nachname|苗字'));
        const countryMatch = text.match(buildRegex('Land des[^:]*|Country[^:]*|País|Pais|国|発行国'));
        const languageMatch = text.match(buildRegex('Sprache des[^:]*|Language[^:]*|Idioma|言語'));
        const priceMatch = text.match(/-\s*\$(\d+)/) || text.match(/Price.*\$(\d+)/i) || text.match(/\$(\d+)/);
        const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

        const nombre = cleanExtracted(nombreMatch ? nombreMatch[1] : '');
        const apellido = cleanExtracted(apellidoMatch ? apellidoMatch[1] : '');
        const fullName = `${nombre} ${apellido}`.trim() || cleanExtracted(nombreMatch ? nombreMatch[1] : '');
        const country = translateToEnglish(cleanExtracted(countryMatch ? countryMatch[1] : ''));
        const language = translateToEnglish(cleanExtracted(languageMatch ? languageMatch[1] : ''));
        const customerEmail = emailMatch ? emailMatch[0].toLowerCase() : '';
        const rawPriceNum = priceMatch ? priceMatch[1] : '65';
        const price = `$${rawPriceNum}`;

        const isRVA = /RVA/i.test(subject) || /RVA/i.test(text);
        const tab = isRVA ? 'RVA' : '1HRGT';

        // Check if price implies multiple licenses
        let licensesCount = 1;
        if (['110', '130', '150'].includes(rawPriceNum)) {
          licensesCount = 2;
        }

        // Match with payment message
        let matchedPayment = null;
        if (customerEmail) {
          matchedPayment = parsedPayments.find(p => p.email === customerEmail);
        }
        if (!matchedPayment && fullName) {
          const firstName = fullName.split(' ')[0].toLowerCase();
          matchedPayment = parsedPayments.find(p => p.snippet.toLowerCase().includes(firstName) || p.subject.toLowerCase().includes(firstName));
        }

        const paymentMethod = matchedPayment ? matchedPayment.method : 'Stripe';
        const paymentStatus = matchedPayment ? `Pagado (${matchedPayment.method})` : 'Pendiente de pago';

        // Check duplicate in Sheet
        let isDuplicate = false;
        let duplicateInfo = null;
        if (fullName) {
          const searchName = fullName.toLowerCase();
          const dup1 = existing1HRClients.find(c => c.name === searchName || (c.name.length > 5 && (c.name.includes(searchName) || searchName.includes(c.name))));
          const dup2 = existingRVAClients.find(c => c.name === searchName || (c.name.length > 5 && (c.name.includes(searchName) || searchName.includes(c.name))));
          if (dup1) {
            isDuplicate = true;
            duplicateInfo = `Ya registrado en ${dup1.tab} (Fila ${dup1.rowIdx}: ${dup1.original})`;
          } else if (dup2) {
            isDuplicate = true;
            duplicateInfo = `Ya registrado en ${dup2.tab} (Fila ${dup2.rowIdx}: ${dup2.original})`;
          }
        }

        // Allocate DLs from pool
        let allocatedDLs = [];
        let startRowIdx = -1;
        if (tab === '1HRGT') {
          if (pointer1HR + licensesCount <= pool1HR.length) {
            startRowIdx = pool1HR[pointer1HR].rowIdx;
            for (let k = 0; k < licensesCount; k++) {
              allocatedDLs.push(pool1HR[pointer1HR + k].dl);
            }
            pointer1HR += licensesCount;
          }
        } else {
          if (pointerRVA + licensesCount <= poolRVA.length) {
            startRowIdx = poolRVA[pointerRVA].rowIdx;
            for (let k = 0; k < licensesCount; k++) {
              allocatedDLs.push(poolRVA[pointerRVA + k].dl);
            }
            pointerRVA += licensesCount;
          }
        }

        // Format proposed label
        let proposedLabel = '';
        if (allocatedDLs.length > 0) {
          const mainDL = allocatedDLs[0];
          if (allocatedDLs.length === 1) {
            proposedLabel = `${mainDL} ${fullName}`.trim();
          } else {
            let t1 = mainDL.startsWith('B') ? mainDL : `B${mainDL}`;
            let t2 = allocatedDLs[1];
            if (t2.startsWith('B')) t2 = t2.substring(1);
            proposedLabel = `${t1}, ${t2} ${fullName}`.trim();
          }
        } else {
          proposedLabel = `[Sin DL libre] ${fullName}`.trim();
        }

        // Only include if it has at least a customer name or looks like an order
        if (fullName || nombreMatch || priceMatch) {
          parsedOrders.push({
            id: msg.id,
            threadId: msg.threadId,
            fullName: fullName || 'Cliente Desconocido',
            nombre,
            apellido,
            customerEmail,
            country: country || 'Unknown',
            language: language || 'Unknown',
            price,
            licensesCount,
            tab,
            receivedAt: receivedAt.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            subject,
            snippet: msg.snippet,
            paymentMethod,
            paymentStatus,
            paymentMessageId: matchedPayment?.id || null,
            paymentSubject: matchedPayment?.subject || null,
            isDuplicate,
            duplicateInfo,
            startRowIdx,
            allocatedDLs,
            proposedLabel,
            spreadsheetId
          });
        }
      }

      setCandidates(parsedOrders);
      // Select all candidate orders by default
      const initialSelected = new Set(parsedOrders.map(o => o.id));
      setSelectedOrderIds(initialSelected);

    } catch (err) {
      console.error('Error scanning inbox orders', err);
      setStatusMessage({ type: 'error', text: `Error al escanear inbox: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectOrder = (id) => {
    setSelectedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === candidates.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(candidates.map(c => c.id)));
    }
  };

  const handleProcessOrders = async (ordersToProcess = null) => {
    const list = ordersToProcess || candidates.filter(c => selectedOrderIds.has(c.id));
    if (list.length === 0) {
      alert("Por favor selecciona al menos un pedido para organizar.");
      return;
    }

    setProcessing(true);
    let successCount = 0;
    let errorsCount = 0;

    for (let i = 0; i < list.length; i++) {
      const order = list[i];
      setProcessingProgress({
        current: i + 1,
        total: list.length,
        statusText: `Organizando pedido ${i + 1}/${list.length}: ${order.fullName} (${order.allocatedDLs.join(', ')})...`
      });

      try {
        // Step 1: Write to Google Sheets
        if (order.spreadsheetId && order.startRowIdx > 0) {
          const sheetUpdates = [];
          for (let k = 0; k < order.licensesCount; k++) {
            const currentRow = order.startRowIdx + k;
            const currentPrice = k === 0 ? order.price : '$0';

            if (order.tab === '1HRGT') {
              sheetUpdates.push({
                range: `${order.tab}!F${currentRow}:K${currentRow}`,
                values: [["JC", order.fullName, order.country, order.language, order.paymentMethod, currentPrice]]
              });
            } else {
              sheetUpdates.push({
                range: `${order.tab}!F${currentRow}:J${currentRow}`,
                values: [[order.fullName, order.country, order.language, order.paymentMethod, currentPrice]]
              });
            }
          }

          const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${order.spreadsheetId}/values:batchUpdate`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              valueInputOption: 'USER_ENTERED',
              data: sheetUpdates
            })
          });

          if (!updateRes.ok) {
            throw new Error(`Error escribiendo en Sheets (${updateRes.status})`);
          }
        }

        // Step 2: Create Gmail Label under 0. Work/0. 1 HOUR/0. DL IN PROGRESS/
        const fullLabelName = `0. Work/0. 1 HOUR/0. DL IN PROGRESS/${order.proposedLabel}`;
        let labelId = null;

        const createLabelRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: fullLabelName,
            labelListVisibility: 'labelShow',
            messageListVisibility: 'show'
          })
        });

        if (createLabelRes.ok) {
          const labelData = await createLabelRes.json();
          labelId = labelData.id;
        } else if (createLabelRes.status === 409) {
          // Label already exists, find its ID
          const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const listData = await listRes.json();
          const found = listData.labels?.find(l => l.name === fullLabelName);
          if (found) labelId = found.id;
        }

        if (!labelId) {
          throw new Error("No se pudo crear ni encontrar la etiqueta en Gmail.");
        }

        // Step 3: Apply Label & Remove from INBOX for Order email (and payment email if paired)
        const messagesToModify = [order.id];
        if (order.paymentMessageId) {
          messagesToModify.push(order.paymentMessageId);
        }

        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ids: messagesToModify,
            addLabelIds: [labelId],
            removeLabelIds: ['INBOX']
          })
        });

        successCount++;
      } catch (err) {
        console.error(`Error processing order ${order.fullName}`, err);
        errorsCount++;
      }
    }

    setProcessing(false);
    setStatusMessage({
      type: errorsCount === 0 ? 'success' : 'warning',
      text: errorsCount === 0 
        ? `¡Éxito! Se organizaron ${successCount} pedido(s) al Sheet y Gmail con sus etiquetas.`
        : `Se procesaron ${successCount} pedido(s), pero ${errorsCount} tuvieron errores.`
    });

    // Re-scan inbox
    await scanInboxForOrders();
    if (onRefreshTrigger) onRefreshTrigger();
  };

  return (
    <div className="auto-organize-container" style={{ padding: '16px', paddingBottom: '100px' }}>
      {/* Top Banner / Summary */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid var(--border-color)',
        marginBottom: '20px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <div style={{ backgroundColor: '#f59e0b', padding: '6px', borderRadius: '8px', display: 'flex' }}>
                <Zap size={20} color="#0f172a" />
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
                Organizar Inbox Automático
              </h2>
            </div>
            <p style={{ color: '#94a3b8', fontSize: '0.875rem', margin: 0 }}>
              Detecta clientes en el Inbox, los empareja con sus pagos, asigna su DL consecutivo en Sheets y crea su etiqueta en Gmail.
            </p>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: '#cbd5e1' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <FileSpreadsheet size={15} color="#10b981" />
                Hoja activa: <strong style={{ color: '#6ee7b7' }}>{sheetInfo.name}</strong>
              </span>
              <span style={{ color: '#64748b' }}>•</span>
              <span><strong>{candidates.length}</strong> pedidos detectados</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className="btn-secondary"
              onClick={scanInboxForOrders}
              disabled={loading || processing}
              style={{ padding: '8px 14px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Volver a escanear el Inbox"
            >
              <RefreshCw size={15} className={loading ? 'spinning' : ''} />
              Escanear
            </button>
            <button
              className="btn-primary"
              onClick={() => handleProcessOrders()}
              disabled={loading || processing || selectedOrderIds.size === 0}
              style={{ 
                backgroundColor: (selectedOrderIds.size === 0 || loading || processing) ? '#334155' : '#10b981', 
                color: (selectedOrderIds.size === 0 || loading || processing) ? '#94a3b8' : '#ffffff',
                padding: '10px 18px', 
                fontWeight: 'bold', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                border: (selectedOrderIds.size === 0 || loading || processing) ? '1px solid #475569' : 'none',
                boxShadow: (selectedOrderIds.size === 0 || loading || processing) ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.4)',
                cursor: (selectedOrderIds.size === 0 || loading || processing) ? 'not-allowed' : 'pointer'
              }}
            >
              <Play 
                size={16} 
                fill={(selectedOrderIds.size === 0 || loading || processing) ? '#94a3b8' : '#ffffff'} 
                color={(selectedOrderIds.size === 0 || loading || processing) ? '#94a3b8' : '#ffffff'} 
              />
              <span style={{ color: (selectedOrderIds.size === 0 || loading || processing) ? '#94a3b8' : '#ffffff' }}>
                Iniciar Organización ({selectedOrderIds.size})
              </span>
            </button>
          </div>
        </div>

        {/* Selection bar */}
        {candidates.length > 0 && (
          <div style={{ 
            marginTop: '16px', 
            paddingTop: '12px', 
            borderTop: '1px solid rgba(255,255,255,0.1)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            fontSize: '0.85rem'
          }}>
            <button 
              onClick={toggleSelectAll} 
              style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontWeight: '500' }}
            >
              {selectedOrderIds.size === candidates.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
            </button>
            <span style={{ color: '#94a3b8' }}>
              {selectedOrderIds.size} de {candidates.length} seleccionados
            </span>
          </div>
        )}
      </div>

      {/* Status Message Alert */}
      {statusMessage && (
        <div style={{
          backgroundColor: statusMessage.type === 'success' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          border: `1px solid ${statusMessage.type === 'success' ? '#10b981' : '#ef4444'}`,
          borderRadius: '12px',
          padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: statusMessage.type === 'success' ? '#6ee7b7' : '#fca5a5',
          fontSize: '0.9rem'
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="loader-container" style={{ padding: '60px 20px' }}>
          <svg className="spinner" width="44" height="44" viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" />
          </svg>
          <p style={{ marginTop: '12px', fontWeight: '500' }}>Escaneando Inbox y consultando Google Sheets...</p>
        </div>
      ) : candidates.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '60px 20px', 
          backgroundColor: 'var(--surface-color)', 
          borderRadius: '16px',
          border: '1px solid var(--border-color)'
        }}>
          <ShieldCheck size={54} color="#10b981" style={{ margin: '0 auto 16px', opacity: 0.8 }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>¡Inbox limpio y al día!</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '400px', margin: '0 auto 20px' }}>
            No se encontraron correos nuevos de pedidos pendientes en tu Inbox.
          </p>
          <button 
            className="btn-secondary" 
            onClick={scanInboxForOrders}
            style={{ margin: '0 auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={15} /> Volver a comprobar
          </button>
        </div>
      ) : (
        /* Candidates List / Cards */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {candidates.map((order) => {
            const isSelected = selectedOrderIds.has(order.id);
            return (
              <div 
                key={order.id}
                style={{
                  backgroundColor: 'var(--surface-color)',
                  borderRadius: '14px',
                  border: isSelected ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                  padding: '16px',
                  boxShadow: isSelected ? '0 0 12px rgba(59, 130, 246, 0.15)' : 'none',
                  transition: 'all 0.2s ease',
                  position: 'relative'
                }}
              >
                {/* Card Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div 
                    className="checkbox-container"
                    onClick={() => toggleSelectOrder(order.id)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'var(--accent-color)' : 'transparent',
                      borderColor: isSelected ? 'var(--accent-color)' : 'var(--border-color)'
                    }}
                  >
                    {isSelected && <Check size={16} color="white" />}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ 
                        backgroundColor: order.tab === 'RVA' ? '#7c3aed' : '#2563eb', 
                        color: 'white', 
                        fontSize: '0.75rem', 
                        padding: '2px 8px', 
                        borderRadius: '4px', 
                        fontWeight: 'bold' 
                      }}>
                        {order.tab}
                      </span>
                      
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 'bold', margin: 0, color: '#f8fafc' }}>
                        {order.fullName}
                      </h3>

                      {order.allocatedDLs.length > 0 && (
                        <span style={{ 
                          backgroundColor: '#065f46', 
                          color: '#6ee7b7', 
                          fontSize: '0.8rem', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontWeight: '600' 
                        }}>
                          {order.allocatedDLs.join(', ')}
                        </span>
                      )}

                      {order.isDuplicate && (
                        <span style={{ 
                          backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                          color: '#f87171', 
                          border: '1px solid #ef4444',
                          fontSize: '0.75rem', 
                          padding: '2px 8px', 
                          borderRadius: '4px', 
                          fontWeight: 'bold',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <AlertTriangle size={12} /> {order.duplicateInfo || 'Duplicado en Sheet'}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                      Recibido: {order.receivedAt} {order.customerEmail && `• ${order.customerEmail}`}
                    </div>
                  </div>

                  {/* Individual Action Button */}
                  <button
                    className="btn-secondary"
                    onClick={() => handleProcessOrders([order])}
                    disabled={processing}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
                    title="Organizar solo este pedido"
                  >
                    Organizar este
                  </button>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '10px',
                  backgroundColor: 'rgba(15, 23, 42, 0.5)',
                  padding: '12px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px' }}>🌍 País / Idioma</div>
                    <strong style={{ color: '#f1f5f9' }}>{order.country} · {order.language}</strong>
                  </div>

                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px' }}>💰 Precio & Licencias</div>
                    <strong style={{ color: '#38bdf8' }}>{order.price}</strong> 
                    <span style={{ color: '#94a3b8', marginLeft: '4px' }}>
                      ({order.licensesCount} {order.licensesCount === 1 ? 'Licencia' : 'Licencias'})
                    </span>
                  </div>

                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px' }}>💳 Método / Pago</div>
                    <span style={{ 
                      color: order.paymentMessageId ? '#4ade80' : '#fbbf24',
                      fontWeight: '600'
                    }}>
                      {order.paymentStatus}
                    </span>
                  </div>

                  <div>
                    <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginBottom: '2px' }}>🏷️ Etiqueta Gmail</div>
                    <span style={{ color: '#cbd5e1', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                      {order.proposedLabel}
                    </span>
                  </div>
                </div>

                {/* Paired Emails Info */}
                <div style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} color="#60a5fa" />
                    <span style={{ color: '#64748b' }}>Pedido:</span>
                    <span style={{ color: '#cbd5e1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {order.subject}
                    </span>
                  </div>
                  {order.paymentSubject && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={13} color="#10b981" />
                      <span style={{ color: '#64748b' }}>Pago:</span>
                      <span style={{ color: '#a7f3d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {order.paymentSubject}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Processing Overlay Modal */}
      {processing && (
        <div className="processing-overlay">
          <div style={{
            backgroundColor: '#1e293b',
            padding: '30px',
            borderRadius: '16px',
            textAlign: 'center',
            maxWidth: '450px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <svg className="spinner" width="48" height="48" viewBox="0 0 50 50" style={{ margin: '0 auto 16px' }}>
              <circle cx="25" cy="25" r="20" fill="none" />
            </svg>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: '#f8fafc' }}>
              Organizando Inbox...
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '16px' }}>
              {processingProgress.statusText || 'Procesando pedidos en Google Sheets y Gmail...'}
            </p>
            
            {/* Progress bar */}
            <div style={{ width: '100%', height: '8px', backgroundColor: '#334155', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                backgroundColor: '#10b981',
                width: `${processingProgress.total > 0 ? (processingProgress.current / processingProgress.total) * 100 : 0}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#cbd5e1' }}>
              {processingProgress.current} de {processingProgress.total} pedidos
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
