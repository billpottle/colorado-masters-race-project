const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');

// Load and parse the CSV
const filePath = 'all-data.csv';
const outputPath = 'all-data-fixed.csv';

const raceData = [];

function parseDate(str) {
  const [month, day, year] = str.split('/');
  return new Date(`${year}-${month}-${day}`);
}

function isNumeric(val) {
  return /^\d+$/.test(val);
}

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (row) => {
    raceData.push(row);
  })
  .on('end', () => {
    console.log(`Loaded ${raceData.length} rows`);

    const ageMap = {};

    // Build reference map of name -> [{date, age}]
    raceData.forEach(row => {
      const name = row.Name.trim();
      const date = parseDate(row.Date);
      const age = row.Age.trim();

      if (isNumeric(age)) {
        if (!ageMap[name]) ageMap[name] = [];
        ageMap[name].push({ date, age: parseInt(age) });
      }
    });

    // Sort each person's entries by date
    Object.values(ageMap).forEach(entries =>
      entries.sort((a, b) => a.date - b.date)
    );

    let fixCount = 0;

    // Attempt to fix missing/non-numeric ages
    raceData.forEach(row => {
      const name = row.Name.trim();
      const date = parseDate(row.Date);
      const age = row.Age.trim();

      if (!isNumeric(age)) {
        const entries = ageMap[name];
        if (entries && entries.length > 0) {
          let inferredAge = null;

          // Look for closest date with known age
          for (const entry of entries) {
            const yearDiff = (date.getFullYear() - entry.date.getFullYear());
            const estAge = entry.age + yearDiff;
            if (inferredAge === null || Math.abs(yearDiff) < Math.abs(inferredAge.diff)) {
              inferredAge = { value: estAge, diff: yearDiff };
            }
          }

          if (inferredAge) {
            row.Age = inferredAge.value.toString();
            fixCount++;
            // Log the correction
            const refEntry = entries.find(entry => (entry.age + (date.getFullYear() - entry.date.getFullYear())) === inferredAge.value);
            const refAge = refEntry ? refEntry.age : entries[0].age;
            const refDate = refEntry ? refEntry.date : entries[0].date;
            const yearDiff = refEntry ? (date.getFullYear() - refDate.getFullYear()) : inferredAge.diff;
            console.log(`${name} was listed at ${inferredAge.value} for the race on ${row.Date} because we found that they were ${refAge} years old ${Math.abs(yearDiff)} year${Math.abs(yearDiff) !== 1 ? 's' : ''} ${yearDiff > 0 ? 'earlier' : 'later'} (${refDate.toLocaleDateString()})`);
          }
        }
      }
    });

    console.log(`Fixed ${fixCount} rows with missing/non-numeric age`);

    // Write to new CSV
    const headers = Object.keys(raceData[0]).map(h => ({ id: h, title: h }));
    const csvWriter = createCsvWriter({
      path: outputPath,
      header: headers
    });

    csvWriter.writeRecords(raceData).then(() => {
      console.log(`Wrote fixed data to ${outputPath}`);
    });
  });