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

const IGNORED_SELECTOR = '.definition-tag-list,.definition-disambiguation-list,.gloss-separator,.expansion-button';

/**
 * Flattens a selection inside dictionary definitions into a single line.
 * Glosses of the same meaning are joined with ", " and separate meanings with "; ".
 * A gloss is the innermost list item around the text; its meaning is the next list item up,
 * which covers both simple glossaries (gloss-item inside definition-item) and structured content
 * (glossary list items nested inside sense list items).
 * @param {Selection} selection
 * @returns {?string} The flattened text, or `null` if the selection contains no definition text.
 */
export function getGlossarySelectionText(selection) {
    /** @type {Map<Element, Map<Element, string[]>>} */
    const meanings = new Map();
    for (let i = 0; i < selection.rangeCount; ++i) {
        collectRangeText(selection.getRangeAt(i), meanings);
    }

    /** @type {string[]} */
    const meaningTexts = [];
    for (const glosses of meanings.values()) {
        /** @type {string[]} */
        const glossTexts = [];
        for (const parts of glosses.values()) {
            const text = parts.join('').replace(/\s+/g, ' ').trim();
            if (text.length > 0) { glossTexts.push(text); }
        }
        if (glossTexts.length > 0) { meaningTexts.push(glossTexts.join(', ')); }
    }
    return meaningTexts.length > 0 ? meaningTexts.join('; ') : null;
}

/**
 * @param {Range} range
 * @param {Map<Element, Map<Element, string[]>>} meanings
 */
function collectRangeText(range, meanings) {
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
        addTextNode(/** @type {Text} */ (root), range, meanings);
        return;
    }
    const document = root.ownerDocument;
    if (document === null) { return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (range.intersectsNode(node)) {
            addTextNode(/** @type {Text} */ (node), range, meanings);
        }
    }
}

/**
 * @param {Text} node
 * @param {Range} range
 * @param {Map<Element, Map<Element, string[]>>} meanings
 */
function addTextNode(node, range, meanings) {
    const parent = node.parentElement;
    if (parent === null || parent.closest(IGNORED_SELECTOR) !== null) { return; }
    const definitionItem = parent.closest('.definition-item');
    if (definitionItem === null) { return; }
    if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility()) { return; }

    /** @type {?Element} */
    let gloss = null;
    /** @type {?Element} */
    let meaning = null;
    for (let element = /** @type {?Element} */ (parent); element !== null; element = element.parentElement) {
        if (element.tagName === 'LI') {
            if (gloss === null) {
                gloss = element;
            } else {
                meaning = element;
                break;
            }
        }
        if (element === definitionItem) { break; }
    }
    if (gloss === null) { return; }
    if (meaning === null) { meaning = gloss; }

    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    const text = node.data.substring(start, end);
    if (text.length === 0) { return; }

    let glosses = meanings.get(meaning);
    if (typeof glosses === 'undefined') {
        glosses = new Map();
        meanings.set(meaning, glosses);
    }
    const parts = glosses.get(gloss);
    if (typeof parts === 'undefined') {
        glosses.set(gloss, [text]);
    } else {
        parts.push(text);
    }
}
