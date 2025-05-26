const { parse, unparse } = require("papaparse");
const fs = require("fs");

/**
 * Transform CSV data by defining new columns with custom transformations
 * @param {string|Buffer} inputCsv - The input CSV data or file path
 * @param {Object.<string, Function|boolean|string>} columnTransformers - Object mapping column names to transformers:
 *   - If a function, it will be called with the current row and should return the new value
 *   - If true, the value will be copied from the input row
 *   - If a string or other value, that value will be used directly
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.isFilePath=false] - Whether inputCsv is a file path or CSV string
 * @param {Object} [options.parseOptions={}] - Options to pass to Papa Parse
 * @param {Object[]} [options.specialRowProcessors=[]] - Special row processors that override normal transformation
 * @param {Function} options.specialRowProcessors.condition - Function that takes a row and returns true if this processor should be used
 * @param {Function} options.specialRowProcessors.finalData - Function that takes a row and returns the final row data
 * @param {boolean} options.isoColumns - All columns from the base file will be integrated with their values to the output before transformers are applied
 * @param {(String|RegExp)[]} options.removeColumns - Remove columns by names or patterns from final data
 * @returns {string} The transformed CSV as a string
 *
 * @example
 * // Basic usage with column transformers
 * const result = transformCsv(csvData, {
 *   "New Column": row => row["Old Column"].toUpperCase(),
 *   "Copy Column": true,
 *   "Static Column": "Static Value"
 * });
 *
 * @example
 * // Usage with special row processor
 * const result = transformCsv(csvData, columnTransformers, {
 *   specialRowProcessors: [{
 *     condition: row => row["Type"] === "special",
 *     finalData: row => ({
 *       "ID": row["ID"],
 *       "Status": "Processed"
 *     })
 *   }]
 * });
 */
function transformCsv(inputCsv, columnTransformers, options = {}) {
  const { isFilePath = false, specialRowProcessors = [], isoColumns = false, removeColumns= [], parseOptions = {} } = options;

  // Read from file if inputCsv is a file path
  const csvData = isFilePath ? fs.readFileSync(inputCsv, "utf8") : inputCsv;

  // Default Papa Parse options with some sensible defaults
  const parseOpts = {
    header: true,
    skipEmptyLines: true,
    ...parseOptions
  };

  // Parse the CSV data
  const parsedData = parse(csvData, parseOpts);

  if (parsedData.errors && parsedData.errors.length > 0) {
    console.warn("Parsing errors:", parsedData.errors);
  }

  const columnNames = new Set()
  // Transform the data using the provided column transformers
  const transformedData = parsedData.data.map((row) => {
    const newRow = {};

    //If there is a special processor and its condition matches the current row, use it instead
    for (const processor of specialRowProcessors) {
      let specialProcessedRow;
      if ((typeof processor.condition === "boolean" && processor.condition)
          || (typeof processor.condition === "function" && processor.condition(row))) {
        specialProcessedRow = processor.finalData(row);
        for (const key in specialProcessedRow)
          columnNames.add(key)
        return specialProcessedRow;
      }
    }

    if(isoColumns)
      Object.assign(newRow, row)

    // Apply each column transformer to the current row
    Object.entries(columnTransformers).forEach(
        ([newColumnName, transformerFn]) => {

          if(transformerFn === true)
            newRow[newColumnName] = row[newColumnName] ?? "";
          else if(typeof transformerFn !== "function")
            newRow[newColumnName] = transformerFn;
          else
            newRow[newColumnName] = transformerFn(row);
        },
    );

    for(const key in newRow)
      columnNames.add(key)

    return newRow;
  });

  for(const pattern of removeColumns) {
    if(typeof pattern === "string")
      columnNames.delete(pattern)
    else if(pattern instanceof RegExp)
      columnNames.forEach(value => {
        if(pattern.test(value))
          columnNames.delete(value)
      })
  }

  // Convert back to CSV
  return unparse(transformedData, {columns: [...columnNames]});
}

/**
 * Transform a CSV file and write the result to a new file
 * @param {string} inputPath - Path to the input CSV file
 * @param {string} outputPath - Path where the output CSV will be written
 * @param {Object.<string, Function|string|boolean>} columnTransformers - Object mapping new column names to transformer functions
 * @param {Object} [options={}]
 * @param {Object} [options.parseOptions={}] - Options to pass to Papa Parse
 * @param {Object[]} [options.specialRowProcessors=[]] - Special row processors that override normal transformation
 * @param {Function} options.specialRowProcessors.condition - Function that takes a row and returns true if this processor should be used
 * @param {Function} options.specialRowProcessors.finalData - Function that takes a row and returns the final row data
 * @param {boolean} options.isoColumns - All columns from the base file will be integrated with their values to the output before transformers are applied
 * @returns {void}
 */
function transformCsvFile(
    inputPath,
    outputPath,
    columnTransformers,
    options = {},
) {
  const result = transformCsv(inputPath, columnTransformers, {
    isFilePath: true,
    ...options
  });
  fs.writeFileSync(outputPath, result);
}

module.exports = {
  transformCsv,
  transformCsvFile,
};
