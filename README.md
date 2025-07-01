    # CSV Transformer

A flexible Node.js library for transforming CSV data with custom column transformations, special row processors, and advanced filtering capabilities.

# Features

- **Column Transformations**: Define custom transformations for columns using functions, static values, or copying existing columns
- **Special Row Processors**: Handle specific rows with custom logic that overrides normal transformations
- **ISO Column Support**: Preserve all original columns while adding new ones
- **Column Removal**: Remove columns by name or regex patterns
- **File I/O Support**: Work with CSV strings or files directly
- **Error Handling**: Built-in parsing error detection and warnings

# Installation

```bash
npm install csv-transformer
```

# Dependencies

- [Papa Parse](https://www.papaparse.com/): For robust CSV parsing and generation

## Usage

## Basic Column Transformation

```javascript
const { transformCsv } = require('csv-transformer');

const csvData = `Name,Age,City
John,25,New York
Jane,30,Los Angeles`;

const result = transformCsv(csvData, {
  "Full Name": row => row["Name"].toUpperCase(),
  "Age Group": row => row["Age"] > 25 ? "Senior" : "Junior",
  "Location": true, // Copy the "Location" column as-is
  "Status": "Active" // Static value for all rows
});

console.log(result);
```

## Working with Files

```javascript
const { transformCsvFile } = require('csv-transformer');

transformCsvFile(
  'input.csv',
  'output.csv',
  {
    "Processed Name": row => row["Name"].toLowerCase(),
    "Timestamp": () => new Date().toISOString()
  }
);
```

## Special Row Processors

Handle specific rows with custom logic. Warning: when working with `isoColumns: true`, columns are not kept for rows treated this way. `finalData` is, well, the final data of the row.

```javascript
const { transformCsv } = require('csv-transformer');
const { skipIfAnyEmptyProcessor } = require('csv-transformer/generic');

const result = transformCsv(csvData, columnTransformers, {
  specialRowProcessors: [
    // Skip rows where Name or Email is empty
    skipIfAnyEmptyProcessor(["Name", "Email"]),
    
    // Custom processor for special cases
    {
      condition: row => row["Type"] === "premium",
      finalData: row => ({
        "ID": row["ID"],
        "Status": "VIP",
        "Priority": "High"
      })
    }
  ]
});
```

## ISO Columns Mode

Allows starting the new file from all the data in the base file. Useful when only a few columns must be changed. Column transformers and special row processors will override the data kept this way.

```javascript
const result = transformCsv(csvData, {
  "New Column": row => "New Value", //Add a column to data
  "Already existing column": row => "New value" //Change the value of a column transferred with isoColumns
}, {
  isoColumns: true // All original columns will be preserved, headers and values
});
```

## Column Removal

Remove unwanted columns from the output:

```javascript
const result = transformCsv(csvData, columnTransformers, {
  removeColumns: [
    "Temporary Column", // Remove by exact name
    /^temp_/, // Remove columns starting with "temp_"
    /.*_old$/ // Remove columns ending with "_old"
  ]
});
```

# API Reference

## `transformCsv(inputCsv, columnTransformers, options)`

Transform CSV data with custom column transformations.

| Parameter            | Type           | Description                                                                                                                                                                                                                              |
|----------------------|----------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `inputCsv`           | string\|Buffer | The input CSV data or file path                                                                                                                                                                                                          |
| `columnTransformers` | Object         | Mapping of column names to transformers:<br/>• **Function**: Called with `(row, lastRow)` and should return the new value<br/>• **`true`**: Copy the column value from input<br/>• **Any other value**: Use as static value for all rows |
| `options`            | Object         | Configuration options (see options table below)                                                                                                                                                                                          |

**Returns:** Transformed CSV as a string

## `transformCsvFile(inputPath, outputPath, columnTransformers, options)`

Transform a CSV file and write the result to a new file.

| Parameter            | Type   | Description                                             |
|----------------------|--------|---------------------------------------------------------|
| `inputPath`          | string | Path to input CSV file                                  |
| `outputPath`         | string | Path for output CSV file                                |
| `columnTransformers` | Object | Same as `transformCsv`                                  |
| `options`            | Object | Same options as `transformCsv` (excluding `isFilePath`) |

## Options Parameter:

| Option                 | Type    | Default | Description                                                                                                                      |
|------------------------|---------|---------|----------------------------------------------------------------------------------------------------------------------------------|
| `isFilePath`           | boolean | `false` | Whether inputCsv is a file path. `true` by default when calling `transformCsvFile`                                               |
| `parseOptions`         | Object  | `{}`    | Options passed to Papa Parse, see [Papa Parse docs](https://www.papaparse.com/docs#config) for full list of options and defaults |
| `specialRowProcessors` | Array   | `[]`    | Array of special row processors                                                                                                  |
| `isoColumns`           | boolean | `false` | Preserve all original columns                                                                                                    |
| `removeColumns`        | Array   | `[]`    | Column names or regex patterns to remove in the output CSV                                                                       |

### Column Transformers Structure

The `columnTransformers` object maps new column names to transformation rules. Each key becomes a column in the output CSV.

```javascript
const columnTransformers = {
  "New Column Name": transformationRule
}
```

**Transformation Rule Types:**

| Type               | Description                       | Example                            |
|--------------------|-----------------------------------|------------------------------------|
| **Function**       | `(row, lastRow) => value`         | `row => row["Name"].toUpperCase()` |
| **Boolean `true`** | Copy column value from input      | `"Name": true`                     |
| **Static Value**   | Any non-function value used as-is | `"Status": "Active"`               |

### Special Row Processors Structure

Special row processors override normal column transformation for specific rows. They are evaluated in order and the first matching processor is used.

```javascript
const specialRowProcessor = {
  condition: (row, lastRow) => boolean, // When to apply this processor
  finalData: (row, lastRow) => object   // What data to output for this row
}
```

#### Condition Functions

The `condition` function determines when to apply the special processor:

```javascript
const processors = [
  {
    // Skip empty rows
    condition: (row) => !row["Name"] || !row["Email"],
    finalData: () => ({}) // Empty object skips the row
  },
  
  {
    // Handle header rows
    condition: (row) => row["Type"] === "HEADER",
    finalData: (row) => ({
      "Section": row["Name"],
      "Type": "Section Header",
      "Content": row["Description"]
    })
  },
  
  {
    // Process summary rows differently
    condition: (row) => row["Name"]?.startsWith("TOTAL:"),
    finalData: (row) => ({
      "Summary Type": "Total",
      "Amount": row["Amount"],
      "Description": row["Name"].replace("TOTAL:", "").trim()
    })
  },
  
  {
    // Use previous row data for calculations
    condition: (row, lastRow) => {
      return row["Type"] === "DIFF" && lastRow;
    },
    finalData: (row, lastRow) => ({
      "Current": row["Value"],
      "Previous": lastRow["Value"] || 0,
      "Difference": (parseFloat(row["Value"]) - parseFloat(lastRow["Value"] || 0)).toFixed(2)
    })
  }
];
```

## Built-in Processors

### `skipIfAnyEmptyProcessor(headers)`

Skip rows where any of the specified headers have empty values.

```javascript
const { skipIfAnyEmptyProcessor } = require('csv-transformer/generic');

const processor = skipIfAnyEmptyProcessor(["Name", "Email", "Phone"]);
const result = transformCsv(csvData, columnTransformers, {
    specialRowProcessors: [skipIfAnyEmptyProcessor]})
```

### Image Row Processor (Matrixify)

Special processor for handling image data in Matrixify format (Shopify product data import):

```javascript
const { imgRowProcessor } = require('csv-transformer/processors/matrixify');

// Handles rows where Image Position >= 2
const result = transformCsv(csvData, columnTransformers, {
    specialRowProcessors: [imgRowProcessor]})
```

## Utility Functions

### Array and Rich Text Utilities - Matrixify

```javascript
const { toArrayString, toSimpleRichText } = require('csv-transformer/utils/matrixify');

// Convert to array string format
const arrayStr = toArrayString(["item1", "item2", "item3"]);
// Result: ["item1","item2","item3"]

// Convert to simple rich text JSON
const richText = toSimpleRichText("Hello World");
// Result: JSON string with rich text structure
```

## Examples

### Data Cleaning and Transformation

```javascript
const { transformCsv } = require('csv-transformer');
const { skipIfAnyEmptyProcessor } = require('csv-transformer/generic');

const result = transformCsv(csvData, {
  "Clean Name": row => row["Name"].trim().toLowerCase(),
  "Full Address": row => `${row["Street"]}, ${row["City"]}, ${row["State"]}`,
  "Is Adult": row => parseInt(row["Age"]) >= 18 ? "Yes" : "No"
}, {
  specialRowProcessors: [
    skipIfAnyEmptyProcessor(["Name", "Email"]), // Skip incomplete records
  ],
  removeColumns: [/temp_.*/, "internal_id"], // Remove temporary and internal columns
  parseOptions: {
    skipEmptyLines: true,
    header: true
  }
});
```

### E-commerce Data Processing

```javascript
const { transformCsv } = require('csv-transformer');

const result = transformCsv(productData, {
  "SKU": true,
  "Product Title": row => row["Name"]?.toUpperCase() || "",
  "Price": row => `${parseFloat(row["Cost"]).toFixed(2)}`,
  "In Stock": row => parseInt(row["Quantity"]) > 0 ? "Yes" : "No",
  "Category Path": row => row["Categories"]?.split(";").join(" > ") || ""
}, {
  isoColumns: true, // Keep all original product data
  specialRowProcessors: [
    {
      condition: row => row["Status"] === "discontinued",
      finalData: row => ({
        "SKU": row["SKU"],
        "Status": "DISCONTINUED",
        "Available": "No"
      })
    }
  ]
});
```

## Error Handling

The library includes built-in error handling for CSV parsing issues:

```javascript
// Parsing errors are automatically logged to console.warn
// The transformation will continue with available data
```

## License

ISC

## Contributing

Feel free to submit issues and enhancement requests!