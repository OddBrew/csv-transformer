/**
 * Returns a processor that skips the current row if any of the given headers' value is empty
 * Considers pure whitespaces strings as empty values
 *
 * @param {String[]} headers
 * @returns {{condition: (function(*): *), finalData: *}}
 */
const skipIfAnyEmptyProcessor = (headers) => {
    return {
        condition: (row) => {
            return headers.some((h) => (row[h] === null || row[h].trim() === ''))
        },
        finalData: (row) => ({})
    }
}

module.exports = {
    skipIfAnyEmptyProcessor
}