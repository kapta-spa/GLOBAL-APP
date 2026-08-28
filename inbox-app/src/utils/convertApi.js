const CONVERT_API_SECRET = '5ZmVHRpsVla2ENnPmxKSD0DliiCO9ubz';

/**
 * Converts a Word document blob to a PDF blob using ConvertAPI.
 * @param {Blob} docxBlob The word document blob
 * @param {string} fileName The name of the file
 * @returns {Promise<Blob>} The converted PDF blob
 */
export async function convertDocxToPdf(docxBlob, fileName = 'document.docx') {
  const formData = new FormData();
  formData.append('File', docxBlob, fileName);
  formData.append('StoreFile', 'true');

  const response = await fetch(`https://v2.convertapi.com/convert/docx/to/pdf?Secret=${CONVERT_API_SECRET}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorText = await response.text();
    try {
      const errorJson = JSON.parse(errorText);
      errorText = errorJson.Message || errorText;
    } catch(e) {
      // Ignore parse error
    }
    throw new Error(`ConvertAPI Error: ${errorText}`);
  }

  const result = await response.json();
  
  if (result.Files && result.Files.length > 0) {
    const fileObj = result.Files[0];
    
    // Si la API devuelve una URL, la descargamos como Blob
    if (fileObj.Url) {
      const fileRes = await fetch(fileObj.Url);
      return await fileRes.blob();
    } 
    // Si devuelve FileData (Base64), lo decodificamos
    else if (fileObj.FileData) {
      const base64Data = fileObj.FileData.replace(/[\n\r]/g, '');
      const binary = window.atob(base64Data);
      const array = new Uint8Array(binary.length);
      for(let i = 0; i < binary.length; i++) {
          array[i] = binary.charCodeAt(i);
      }
      return new Blob([array], { type: 'application/pdf' });
    } else {
      throw new Error("No URL or FileData in ConvertAPI response");
    }
  } else {
    throw new Error("No file returned from ConvertAPI");
  }
}
