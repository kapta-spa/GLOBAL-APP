/**
 * Converts a Word (.docx) document blob to a PDF blob natively using Google Drive API.
 * 
 * 1. Uploads the DOCX to Google Drive and converts it into a Google Doc.
 * 2. Exports the Google Doc as a PDF.
 * 3. Deletes the temporary file from Google Drive.
 * 
 * @param {Blob} docxBlob The Word document blob
 * @param {string} fileName The name of the file
 * @param {string} token The Google OAuth access token
 * @returns {Promise<Blob>} The converted PDF blob
 */
export async function convertDocxToPdf(docxBlob, fileName = 'document.docx', token) {
  if (!token) {
    throw new Error('No se encontró el token de autenticación de Google. Por favor vuelve a iniciar sesión.');
  }

  let fileId = null;

  try {
    const metadata = {
      name: fileName.replace(/\.docx$/i, ''),
      mimeType: 'application/vnd.google-apps.document'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const docxArrayBuffer = await docxBlob.arrayBuffer();

    const multipartRequestBody = new Blob([
      delimiter,
      'Content-Type: application/json; charset=UTF-8\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      'Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document\r\n\r\n',
      docxArrayBuffer,
      closeDelimiter
    ], { type: `multipart/related; boundary=${boundary}` });

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!uploadRes.ok) {
      let errDetail = await uploadRes.text();
      try {
        const parsed = JSON.parse(errDetail);
        errDetail = parsed.error?.message || errDetail;
      } catch (e) {
        // use raw text
      }
      throw new Error(`Error al subir a Google Drive: ${errDetail}`);
    }

    const uploadData = await uploadRes.json();
    fileId = uploadData.id;

    const exportRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/pdf`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!exportRes.ok) {
      let errDetail = await exportRes.text();
      try {
        const parsed = JSON.parse(errDetail);
        errDetail = parsed.error?.message || errDetail;
      } catch (e) {
        // use raw text
      }
      throw new Error(`Error al exportar PDF desde Google Drive: ${errDetail}`);
    }

    const pdfBlob = await exportRes.blob();
    return pdfBlob;

  } finally {
    if (fileId) {
      try {
        await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (deleteErr) {
        console.warn('No se pudo eliminar el archivo temporal de Drive:', deleteErr);
      }
    }
  }
}
