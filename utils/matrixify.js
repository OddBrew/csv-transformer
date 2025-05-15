function toArrayString(value, splitter="") {
    if(typeof value === "string" && splitter)
        value = value.split(splitter)

    value = value.filter(v => v)

    if(!value || !value.length)
        return ''

    return `["${value.join("\",\"")}"]`
}

function toSimpleRichText(value) {
    return JSON.stringify({
        type: "root",
        children: [
            {
                type: "paragraph",
                children: [
                    {
                        type: "text",
                        value: value
                    }
                ]
            }
        ]
    })
}


module.exports = {
    toArrayString,
    toSimpleRichText,
}