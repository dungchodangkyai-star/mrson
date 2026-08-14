
const csvText = ', '\;

function parseCsvText(text) {
  if (!text) return [];
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === ') {
        if (nextChar === ') {
          currentCell += ';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += char;
      }
    } else {
      if (char === ') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '') {
        if (nextChar === '
') {
          i++;
        }
        currentRow.push(currentCell);
        if (currentRow.some(c => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else if (char === '
') {
        currentRow.push(currentCell);
        if (currentRow.some(c => c.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    if (currentRow.some(c => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

const rows = parseCsvText(csvText);
console.log('Parsed rows count:', rows.length);
console.log('Row 0:', rows[0].slice(0, 3));
console.log('Row 4:', rows[4].slice(0, 3));
console.log('Row 6 (Project 1):', rows[6].slice(0, 2));
