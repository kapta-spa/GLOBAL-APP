export const IGNORED_SYSTEM_EMAILS = [
  'info@globaltranslations.co.nz',
  'globaltranslations.co.nz',
  'nuramajzoub1@gmail.com',
  'wix.com',
  'wixforms.com',
  'no-reply',
  'noreply',
  'support@wix.com',
  'stripe.com',
  'paypal.com',
  'google.com',
  'mailer-daemon',
  'notifications@',
  'notification@'
];

export function isValidCustomerEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const lower = email.trim().toLowerCase();
  if (!lower.includes('@') || !lower.includes('.')) return false;
  return !IGNORED_SYSTEM_EMAILS.some(ignored => lower.includes(ignored));
}

export function extractClientEmailFromMessage(msgData, emailText = '') {
  const headers = msgData?.payload?.headers || [];

  // 1. Reply-To header is the most reliable for Wix order forms
  const replyTo = headers.find(h => h.name?.toLowerCase() === 'reply-to')?.value || '';
  if (replyTo) {
    const match = replyTo.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match && isValidCustomerEmail(match[0])) {
      return match[0].toLowerCase();
    }
  }

  // 2. Specific field label in email body text
  if (emailText) {
    const labeledMatch = emailText.match(/(?:Email|E-mail|Correo|Email address|E-mail address|Email cliente|Customer Email)\s*[:：\-]?\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (labeledMatch && isValidCustomerEmail(labeledMatch[1])) {
      return labeledMatch[1].toLowerCase();
    }

    // 3. Scan all email addresses in body, taking the first valid non-system email
    const allMatches = emailText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
    for (const em of allMatches) {
      if (isValidCustomerEmail(em)) {
        return em.toLowerCase();
      }
    }
  }

  // 4. From header (if sent directly by customer)
  const from = headers.find(h => h.name?.toLowerCase() === 'from')?.value || '';
  if (from) {
    const match = from.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (match && isValidCustomerEmail(match[0])) {
      return match[0].toLowerCase();
    }
  }

  return '';
}

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
    if (response.status === 401) {
      throw new Error("Tu sesión de Google ha expirado. Por favor vuelve a iniciar sesión con un clic.");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to send email (${response.status})`);
  }
  
  return response.json();
}

