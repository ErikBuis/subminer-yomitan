/*
 * Copyright (C) 2026  Yomitan Authors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @typedef {object} FlatGlossaryOptions
 * @property {?string} dictionary Only definitions from this dictionary are used; `null` uses all of them.
 * @property {string} senseSeparator Put between meanings.
 * @property {string} glossSeparator Put between synonyms of one meaning.
 */

/**
 * Tags of definitions that list other spellings instead of meanings (JMdict's "forms" entries).
 */
const NON_MEANING_DEFINITION_TAGS = new Set(['forms']);

/**
 * Text inside these tags is not part of the meaning (ruby readings).
 */
const SKIPPED_TAGS = new Set(['rt', 'rp']);

const BLOCK_TAGS = new Set(['div', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'details', 'summary']);

/**
 * Writes a definition's meanings on one line, the same way "Join selected definitions on one line" writes a selection:
 * synonyms of one meaning are joined with `glossSeparator` and separate meanings with `senseSeparator`.
 * Structured content that marks its glossaries (`data.content` is "glossary", as in JMdict and Jitendex) only
 * contributes the marked glossary text, so notes, references, examples and forms tables are left out.
 * Definitions tagged "forms" are left out too.
 * @param {unknown} definition The `definition` of the Anki note data: a term, grouped term, merged term or kanji entry.
 * @param {FlatGlossaryOptions} options
 * @returns {string}
 */
export function getFlatGlossaryText(definition, {dictionary, senseSeparator, glossSeparator}) {
    /** @type {string[][]} */
    const senses = [];
    if (isObject(definition)) {
        if (definition.type === 'kanji') {
            if (Array.isArray(definition.glossary)) {
                for (const meaning of definition.glossary) {
                    if (typeof meaning === 'string') { addSense(senses, [meaning]); }
                }
            }
        } else if (Array.isArray(definition.definitions)) {
            for (const item of definition.definitions) {
                addDefinition(item, dictionary, senses, true);
            }
        } else {
            // A split term's tags are those of all of its definitions together, so they can't tell which one lists forms.
            addDefinition(definition, dictionary, senses, definition.type !== 'term');
        }
    }
    return senses.map((glosses) => glosses.join(glossSeparator)).join(senseSeparator);
}

/**
 * The `definition` note data of a split term ("term" type) lists the glossaries of all of its definitions as one array.
 * This gives the definitions one by one in the shape of a grouped term's `definitions` instead,
 * so that senses and "forms" definitions stay apart.
 * @param {unknown} dictionaryEntry The dictionary entry the note data was made from.
 * @returns {?{type: 'termGrouped', definitions: {dictionary: unknown, definitionTags: unknown, glossary: unknown}[]}}
 */
export function getSplitTermDefinitions(dictionaryEntry) {
    if (!isObject(dictionaryEntry) || dictionaryEntry.type !== 'term' || !Array.isArray(dictionaryEntry.definitions)) { return null; }
    const definitions = [];
    for (const item of dictionaryEntry.definitions) {
        if (!isObject(item)) { continue; }
        definitions.push({dictionary: item.dictionary, definitionTags: item.tags, glossary: item.entries});
    }
    return {type: 'termGrouped', definitions};
}

/**
 * @param {unknown} definition
 * @param {?string} dictionary
 * @param {string[][]} senses
 * @param {boolean} checkTags Whether a "forms" tag leaves the definition out.
 */
function addDefinition(definition, dictionary, senses, checkTags) {
    if (!isObject(definition) || !Array.isArray(definition.glossary)) { return; }
    if (dictionary !== null && definition.dictionary !== dictionary) { return; }
    if (checkTags && hasNonMeaningTag(definition.definitionTags)) { return; }

    /** @type {string[]} Plain string glosses of one definition are synonyms of the same meaning. */
    let plainGlosses = [];
    const flushPlainGlosses = () => {
        addSense(senses, plainGlosses);
        plainGlosses = [];
    };
    for (const glossary of definition.glossary) {
        if (typeof glossary === 'string') {
            plainGlosses.push(glossary);
        } else if (isObject(glossary)) {
            if (glossary.type === 'text' && typeof glossary.text === 'string') {
                plainGlosses.push(glossary.text);
            } else if (glossary.type === 'structured-content') {
                flushPlainGlosses();
                for (const glosses of getStructuredContentSenses(glossary.content)) {
                    addSense(senses, glosses);
                }
            }
        }
    }
    flushPlainGlosses();
}

/**
 * @param {unknown} tags
 * @returns {boolean}
 */
function hasNonMeaningTag(tags) {
    if (!Array.isArray(tags)) { return false; }
    for (const tag of /** @type {unknown[]} */ (tags)) {
        const name = isObject(tag) ? tag.name : tag;
        if (typeof name === 'string' && NON_MEANING_DEFINITION_TAGS.has(name)) { return true; }
    }
    return false;
}

/**
 * Each marked glossary is one meaning and its list items are the synonyms.
 * Content without any `data.content` markers is treated the same way as a single glossary.
 * Content with markers but without a glossary (such as a forms table) has no meanings.
 * @param {unknown} content
 * @returns {string[][]}
 */
function getStructuredContentSenses(content) {
    /** @type {unknown[]} */
    const glossaries = [];
    const marked = findGlossaries(content, glossaries);
    if (!marked) { glossaries.push(content); }
    return glossaries.map((glossary) => getGlosses(glossary));
}

/**
 * @param {unknown} content
 * @param {unknown[]} glossaries Receives the content of every element marked as a glossary.
 * @returns {boolean} Whether the content has any `data.content` markers.
 */
function findGlossaries(content, glossaries) {
    if (Array.isArray(content)) {
        let marked = false;
        for (const item of content) {
            if (findGlossaries(item, glossaries)) { marked = true; }
        }
        return marked;
    }
    if (!isObject(content)) { return false; }
    const marker = isObject(content.data) ? content.data.content : void 0;
    if (marker === 'glossary') {
        glossaries.push(content.content);
        return true;
    }
    const markedInside = findGlossaries(content.content, glossaries);
    return typeof marker === 'string' || markedInside;
}

/**
 * The outermost list items are the glosses; without list items the whole text is one gloss.
 * @param {unknown} content
 * @returns {string[]}
 */
function getGlosses(content) {
    /** @type {unknown[]} */
    const items = [];
    findListItems(content, items);
    const parts = items.length > 0 ? items : [content];
    /** @type {string[]} */
    const glosses = [];
    for (const part of parts) {
        const text = getText(part).replace(/\s+/g, ' ').trim();
        if (text.length > 0) { glosses.push(text); }
    }
    return glosses;
}

/**
 * @param {unknown} content
 * @param {unknown[]} items
 */
function findListItems(content, items) {
    if (Array.isArray(content)) {
        for (const item of content) { findListItems(item, items); }
        return;
    }
    if (!isObject(content)) { return; }
    if (content.tag === 'li') {
        items.push(content.content);
        return;
    }
    findListItems(content.content, items);
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function getText(content) {
    if (typeof content === 'string') { return content; }
    if (Array.isArray(content)) {
        return content.map((item) => getText(item)).join('');
    }
    if (!isObject(content)) { return ''; }
    const {tag} = content;
    if (tag === 'br') { return ' '; }
    if (typeof tag === 'string' && SKIPPED_TAGS.has(tag)) { return ''; }
    if (tag === 'img') { return ''; }
    const text = getText(content.content);
    // Neighbouring blocks have no whitespace text between them, so keep a word boundary around them.
    return (typeof tag === 'string' && BLOCK_TAGS.has(tag)) ? ` ${text} ` : text;
}

/**
 * @param {string[][]} senses
 * @param {string[]} glosses
 */
function addSense(senses, glosses) {
    /** @type {string[]} */
    const cleaned = [];
    for (const gloss of glosses) {
        const text = gloss.replace(/\s+/g, ' ').trim();
        if (text.length > 0) { cleaned.push(text); }
    }
    if (cleaned.length > 0) { senses.push(cleaned); }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
