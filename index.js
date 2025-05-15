const { parse, unparse } = require("papaparse");
const fs = require("fs");

/**
 * Transform CSV data by defining new columns with custom transformations
 * @param {string|Buffer} inputCsv - The input CSV data or file path
 * @param {Object.<string, Function|boolean|string>} columnTransformers - Object mapping new column names to transformer functions
 * @param {Object} options - Additional options
 * @param {boolean} [options.isFilePath=false] - Whether inputCsv is a file path or CSV string
 * @param {Object} [options.parseOptions={}] - Options to pass to Papa Parse
 * @param {Object} [options.specialRowProcessors=[{condtion: function(row), finalData: function(row)}]
 * @returns {string} The transformed CSV as a string
 */
function transformCsv(inputCsv, columnTransformers, options = {}) {
  const { isFilePath = false, specialRowProcessors = [], parseOptions = {} } = options;

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

  // Transform the data using the provided column transformers
  const transformedData = parsedData.data.map((row) => {
    const newRow = {};

    //If there is a special processor and its condition matches the current row, use it instead
    for (const processor of specialRowProcessors) {
      if( typeof processor.condition === "function" && processor.condition(row))
        return processor.finalData(row);
    }

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

    return newRow;
  });

  // Convert back to CSV
  return unparse(transformedData);
}

/**
 * Transform a CSV file and write the result to a new file
 * @param {string} inputPath - Path to the input CSV file
 * @param {string} outputPath - Path where the output CSV will be written
 * @param {Object.<string, Function|string|boolean>} columnTransformers - Object mapping new column names to transformer functions
 * @param {Object} options - Additional options for Papa Parse
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
    parseOptions: options.parseOptions,
    specialRowProcessors: options.specialRowProcessors,
  });
  fs.writeFileSync(outputPath, result);
}

module.exports = {
  transformCsv,
  transformCsvFile,
};
