'use strict';

/**
 * Shared CSV helpers (Issue #1544).
 *
 * Every CSV produced by the API must go through csvEscape so that cells are
 * both RFC 4180-safe and neutralised against spreadsheet formula injection
 * (CWE-1236).
 */

// Characters that make Excel / LibreOffice / Google Sheets treat a cell as a
// formula (or, for tab/CR, allow a formula to be smuggled past the check).
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;

/**
 * Escape a single CSV field value per RFC 4180.
 * Wraps in double-quotes when the value contains a comma, double-quote, CR or LF.
 * Internal double-quotes are doubled ("").
 * Leading formula-injection characters (=, +, -, @, tab, CR) are prefixed with
 * a single-quote so spreadsheet apps do not evaluate them as formulas.
 *
 * @param {*} value
 * @returns {string}
 */
function csvEscape(value) {
  let str = String(value ?? '');
  if (FORMULA_TRIGGER.test(str)) {
    str = `'${str}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Build one CSV row from an array of values.
 * @param {Array<*>} values
 * @returns {string}
 */
function csvRow(values) {
  return values.map(csvEscape).join(',');
}

module.exports = { csvEscape, csvRow, FORMULA_TRIGGER };
