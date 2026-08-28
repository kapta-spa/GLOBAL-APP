const fs = require('fs');
let code = fs.readFileSync('countryPrompts.js', 'utf8');

const searchStr = 'Return valid JSON matching the schema.';
const index = code.indexOf(searchStr);

if (index !== -1) {
  const start = index - 58; // approx start of "If any field..."
  // Let's find the exact start of "If any field"
  const actualStart = code.lastIndexOf('If any field is missing', index);
  if (actualStart !== -1) {
    const prefix = code.slice(0, actualStart);
    const suffix = code.slice(index + searchStr.length);
    const newContent = `Respond ONLY with a valid JSON object matching the following schema:
{
  "surname": "...",
  "firstName": "...",
  "middleName": "...",
  "firstNames": "...",
  "fullName": "...",
  "dateOfBirth": "...",
  "placeOfBirth": "...",
  "blood": "...",
  "gender": "...",
  "address": "...",
  "issueDate": "...",
  "expiryDate": "...",
  "licenseNumber": "...",
  "authority": "...",
  "class": "...",
  "code": "...",
  "explicacionCodigos": "..."
}

If any field is missing or illegible, return an empty string ("").`;
    fs.writeFileSync('countryPrompts.js', prefix + newContent + suffix);
    console.log("Successfully replaced via index!");
  } else {
    console.log("Could not find 'If any field'");
  }
} else {
  console.log("Could not find search string");
}
