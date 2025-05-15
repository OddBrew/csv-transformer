const imgRowProcessor = {
    condition: (row) => (row["Image Position"] >= 2),
    finalData: (row) => {
        return {
            "Handle": row["Handle"],
            "Image Src": row["Image Src"],
            "Image Command": "MERGE",
            "Image Position": row["Image Position"],
            "Image Alt Text": row["Image Alt Text"],
        }
    }
}

module.exports = {
    imgRowProcessor
}