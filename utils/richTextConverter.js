const jsdom = require('jsdom');
const { JSDOM } = jsdom;
/* HTML to Shopify Metafield & Metaobject Rich Text Schema Converter */

/**
 * Converts an HTML string to a Shopify Rich Text Schema object.
 *
 * @param {string} html - The HTML string to convert.
 * @returns {Object} The Shopify rich text schema object with type "root".
 */
export function convertHtmlToSchema(html) {
    const dom = new JSDOM(`<body>${html.trim()}</body>`)
    const body = dom.window.document.body

    return {
        type: 'root',
        children: parseChildren(body),
    }
}

/**
 * Parses child nodes of a given DOM element into schema children.
 * Unwraps a single wrapping <div class="rte"> if present (scoped output).
 *
 * @param {Element} el - The parent DOM element.
 * @returns {Array} Array of schema node objects.
 */
function parseChildren(el) {
    let nodes = Array.from(el.childNodes)

    // Unwrap scoped wrapper: <div class="rte"> or any single <div>
    if (nodes.length === 1 && nodes[0].nodeType === 1 && nodes[0].tagName === 'DIV') {
        nodes = Array.from(nodes[0].childNodes)
    }

    return nodes.flatMap(node => parseRootNode(node)).filter(Boolean)
}

/**
 * Parses a direct child of root. Paragraphs, headings, and lists are valid here.
 *
 * @param {Node} node
 * @returns {Object|Object[]|null}
 */
function parseRootNode(node) {
    if (node.nodeType === 3) {
        const value = node.textContent
        if (!value || !value.trim().length) return null
        // Bare text at root level — wrap in a paragraph
        return { type: 'paragraph', children: [{ type: 'text', value }] }
    }

    if (node.nodeType !== 1) return null

    const tag = node.tagName.toLowerCase()

    switch (tag) {
        case 'p':
            return buildParagraphNode(node)

        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6':
            return buildHeadingNode(node, parseInt(tag[1], 10))

        case 'ul':
            return buildListNode(node, 'unordered')

        case 'ol':
            return buildListNode(node, 'ordered')

        // Transparent containers — recurse at root level
        case 'span':
        case 'div':
            return Array.from(node.childNodes).flatMap(child => parseRootNode(child)).filter(Boolean)

        // <br> at root level — ignore
        case 'br':
            return null

        default:
            // Unknown tags at root: treat content as a paragraph
            return {
                type: 'paragraph',
                children: parseInlineContent(node),
            }
    }
}

/**
 * Parses children of a <ul> or <ol>. Only <li> nodes are valid here.
 *
 * @param {Node} node
 * @returns {Object|null}
 */
function parseListChildNode(node) {
    if (node.nodeType === 3) {
        const value = node.textContent
        if (!value || /^\\n+$/.test(value)) return null
        return null // bare text directly inside <ul>/<ol> — discard
    }

    if (node.nodeType !== 1) return null

    const tag = node.tagName.toLowerCase()
    if (tag === 'li') return buildListItemNode(node)

    return null // anything other than <li> inside a list — discard
}

// ---------------------------------------------------------------------------
// Block builders
// ---------------------------------------------------------------------------

function buildParagraphNode(el) {
    return {
        type: 'paragraph',
        children: parseInlineContent(el),
    }
}

function buildHeadingNode(el, level) {
    return {
        type: 'heading',
        level,
        children: parseInlineContent(el),
    }
}

function buildListNode(el, listType) {
    const items = Array.from(el.childNodes)
        .flatMap(child => parseListChildNode(child))
        .filter(Boolean)

    return {
        type: 'list',
        listType,
        children: items,
    }
}

function buildListItemNode(el) {
    return {
        type: 'list-item',
        children: parseInlineContent(el),
    }
}

function buildLinkNode(el) {
    return {
        type: 'link',
        url: el.getAttribute('href') || '',
        title: el.getAttribute('title') || undefined,
        target: el.getAttribute('target') || undefined,
        children: parseInlineContent(el),
    }
}

// ---------------------------------------------------------------------------
// Inline content parsing
// ---------------------------------------------------------------------------

/**
 * Parses all inline content inside a block element,
 * returning an array of text/link schema nodes.
 *
 * @param {Element} el
 * @returns {Array}
 */
function parseInlineContent(el) {
    const nodes = Array.from(el.childNodes)
        .flatMap(child => parseInlineNode(child, {}))
        .filter(Boolean)

    return nodes.length > 0 ? nodes : [{ type: 'text', value: '' }]
}

/**
 * Recursively parses an inline node, threading bold/italic state downward.
 *
 * @param {Node} node
 * @param {Object} marks - Current { bold, italic } state
 * @returns {Object|Object[]}
 */
function parseInlineNode(node, marks) {
    if (node.nodeType === 3) {
        const value = node.textContent
        if (!value || /^\\n+$/.test(value)) return null
        return buildTextNode(value, marks)
    }

    if (node.nodeType !== 1) return null

    const tag = node.tagName.toLowerCase()

    if (tag === 'br') return null

    // Block-level tags that cannot be nested — flatten to their inline text content
    if (tag === 'p' || tag === 'ul' || tag === 'ol' || tag === 'li') {
        return Array.from(node.childNodes)
            .flatMap(child => parseInlineNode(child, marks))
            .filter(Boolean)
    }

    if (tag === 'a') {
        return {
            type: 'link',
            url: node.getAttribute('href') || '',
            title: node.getAttribute('title') || undefined,
            target: node.getAttribute('target') || undefined,
            children: Array.from(node.childNodes)
                .flatMap(child => parseInlineNode(child, marks))
                .filter(Boolean),
        }
    }

    const newMarks = { ...marks }
    if (tag === 'strong' || tag === 'b') newMarks.bold = true
    if (tag === 'em' || tag === 'i') newMarks.italic = true

    return Array.from(node.childNodes)
        .flatMap(child => parseInlineNode(child, newMarks))
        .filter(Boolean)
}

/**
 * Wraps inline children of a block element with inherited marks.
 * Used when a <strong> or <em> wraps block-level content (uncommon but valid).
 */
function parseInlineChildren(el, extraMarks) {
    return Array.from(el.childNodes)
        .flatMap(child => parseInlineNode(child, extraMarks))
        .filter(Boolean)
}

/**
 * Builds a text schema node, setting bold/italic only when true.
 */
function buildTextNode(value, { bold, italic } = {}) {

    if(!value.trim().length)
        return null

    const node = { type: 'text', value }
    if (bold) node.bold = true
    if (italic) node.italic = true
    return node
}