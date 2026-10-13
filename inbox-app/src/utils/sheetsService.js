/**
 * Helper service for Google Sheets API operations.
 */

/**
 * Ensures that the given tab in a Google Spreadsheet has at least requiredMinRows.
 * If current rowCount <= requiredMinRows, dynamically expands the sheet grid using appendDimension.
 * 
 * @param {string} spreadsheetId - The Google Drive ID of the spreadsheet.
 * @param {string} tabName - The name of the tab/sheet (e.g., '1HRGT', 'RVA').
 * @param {number} requiredMinRows - The minimum 1-indexed row number that must exist.
 * @param {string} token - Google OAuth access token.
 * @returns {Promise<boolean>} - True if the sheet has enough rows or was expanded successfully.
 */
export const ensureSheetRows = async (spreadsheetId, tabName, requiredMinRows, token) => {
  if (!spreadsheetId || !tabName || !token) return false;
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      console.warn("[Google Sheets] No se pudo obtener metadata de hojas:", metaRes.status);
      return false;
    }

    const metaData = await metaRes.json();
    const cleanTab = String(tabName).replace(/^['"]|['"]$/g, '').trim().toLowerCase();

    const sheetObj = (metaData.sheets || []).find(s => {
      const title = String(s.properties?.title || '').trim().toLowerCase();
      return title === cleanTab;
    });

    if (!sheetObj || !sheetObj.properties) {
      console.warn(`[Google Sheets] No se encontró la pestaña "${tabName}" en el archivo ${spreadsheetId}`);
      return false;
    }

    const currentRows = sheetObj.properties.gridProperties?.rowCount || 0;
    const sheetId = sheetObj.properties.sheetId;

    if (currentRows <= requiredMinRows) {
      // Add at least 100 rows, or enough to cover requiredMinRows + buffer
      const rowsToAdd = Math.max(100, (requiredMinRows - currentRows) + 50);
      console.log(`[Google Sheets] Ampliando límite de filas en "${tabName}" (actual: ${currentRows}, requerido: ${requiredMinRows}, agregando: ${rowsToAdd})...`);

      const appendRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          requests: [
            {
              appendDimension: {
                sheetId: sheetId,
                dimension: 'ROWS',
                length: rowsToAdd
              }
            }
          ]
        })
      });

      if (!appendRes.ok) {
        const errJson = await appendRes.json().catch(() => ({}));
        console.warn("[Google Sheets] Error al ejecutar appendDimension:", errJson);
        return false;
      }

      console.log(`[Google Sheets] Se agregaron exitosamente ${rowsToAdd} filas a "${tabName}".`);
      return true;
    }

    return true;
  } catch (err) {
    console.warn("[Google Sheets] Error en ensureSheetRows:", err);
    return false;
  }
};
