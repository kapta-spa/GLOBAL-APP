const fs = require('fs');
let code = fs.readFileSync('countryPrompts.js', 'utf8');

const indoIndex = code.lastIndexOf('indonesia');
console.log("indoIndex:", indoIndex);
if (indoIndex !== -1) {
  const searchStr = 'Return valid JSON matching the schema.';
  const index = code.indexOf(searchStr, indoIndex);
  console.log("searchStr index:", index);
  if (index !== -1) {
    const actualStart = code.lastIndexOf('If any field is missing', index);
    console.log("actualStart index:", actualStart);
    if (actualStart !== -1 && actualStart > indoIndex) {
      const prefix = code.slice(0, actualStart);
      const suffix = code.slice(index + searchStr.length);
      const newContent = `Respond ONLY with a valid JSON object matching the following schema:\\n{\\n  \\"surname\\": \\"...\\",\\n  \\"firstName\\": \\"...\\",\\n  \\"middleName\\": \\"...\\",\\n  \\"firstNames\\": \\"...\\",\\n  \\"fullName\\": \\"...\\",\\n  \\"dateOfBirth\\": \\"...\\",\\n  \\"placeOfBirth\\": \\"...\\",\\n  \\"blood\\": \\"...\\",\\n  \\"gender\\": \\"...\\",\\n  \\"address\\": \\"...\\",\\n  \\"issueDate\\": \\"...\\",\\n  \\"expiryDate\\": \\"...\\",\\n  \\"licenseNumber\\": \\"...\\",\\n  \\"authority\\": \\"...\\",\\n  \\"class\\": \\"...\\",\\n  \\"code\\": \\"...\\",\\n  \\"explicacionCodigos\\": \\"...\\"\\n}\\n\\nIf any field is missing or illegible, return an empty string (\\"\\").`;
      fs.writeFileSync('countryPrompts.js', prefix + newContent + suffix);
      console.log("Successfully replaced via index!");
    } else {
      console.log("Could not find 'If any field' after indonesia key");
    }
  } else {
    console.log("Could not find search string after indonesia key");
  }
} else {
  console.log("Could not find indonesia key");
}
