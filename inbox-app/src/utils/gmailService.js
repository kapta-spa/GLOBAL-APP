export async function sendEmailWithPdf(token, toEmail, subject, htmlBody, pdfBlobsArray) {
  const boundary = 'foo_bar_baz_boundary';
  
  // Encode headers properly for UTF-8 Subject
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;

  let emailContent = '';
  emailContent += `To: ${toEmail}\r\n`;
  emailContent += `Subject: ${utf8Subject}\r\n`;
  emailContent += `MIME-Version: 1.0\r\n`;
  emailContent += `Content-Type: multipart/mixed; boundary=${boundary}\r\n\r\n`;
  
  emailContent += `--${boundary}\r\n`;
  emailContent += `Content-Type: text/html; charset=UTF-8\r\n\r\n`;
  emailContent += `${htmlBody}\r\n\r\n`;
  
  for (const pdfItem of pdfBlobsArray) {
    const arrayBuffer = await pdfItem.blob.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Attachment = btoa(binary);
    
    emailContent += `--${boundary}\r\n`;
    emailContent += `Content-Type: application/pdf; name="${pdfItem.name}.pdf"\r\n`;
    emailContent += `Content-Disposition: attachment; filename="${pdfItem.name}.pdf"\r\n`;
    emailContent += `Content-Transfer-Encoding: base64\r\n\r\n`;
    
    const chunkedBase64 = base64Attachment.match(/.{1,76}/g).join('\r\n');
    emailContent += `${chunkedBase64}\r\n\r\n`;
  }
  
  emailContent += `--${boundary}--`;

  // Convert to url-safe base64
  const encodedEmail = btoa(unescape(encodeURIComponent(emailContent)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedEmail })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error?.message || 'Failed to send email');
  }
  
  return response.json();
}
