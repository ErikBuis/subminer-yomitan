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
const GLOSSARY_CONTENT_SELECTOR = '[data-sc-content="glossary"]';
/**
 * @typedef {object} MeaningGroup
 * @property {Element} meaning
 * @property {Map<Element, string[]>} glosses
 */

const BLOCK_SELECTOR = 'div,p,table,tr,td,th,details,summary,ul,ol,li';

/**
 * Flattens a selection inside dictionary definitions into a single line.
 * Glosses of the same meaning are joined with `separators.gloss` and separate meanings with `separators.sense`.
 * A gloss is the innermost list item around the text; its meaning is the next list item up,
 * which covers both simple glossaries (gloss-item inside definition-item) and structured content
 * (glossary list items nested inside sense list items).
 * @param {Selection} selection
 * @param {import('anki-note-builder').PopupSelectionSeparators} separators
 * @returns {?string} The flattened text, or `null` if the selection contains no definition text.
 */
export function getGlossarySelectionText(selection, separators) {
    /** @type {MeaningGroup[]} */
    const meanings = [];
    for (let i = 0; i < selection.rangeCount; ++i) {
        collectRangeText(selection.getRangeAt(i), meanings);
    }

    /** @type {string[]} */
    const meaningTexts = [];
    for (const {glosses} of meanings) {
        /** @type {string[]} */
        const glossTexts = [];
        for (const parts of glosses.values()) {
            const text = parts.join('').replace(/\s+/g, ' ').trim();
            if (text.length > 0) { glossTexts.push(text); }
        }
        if (glossTexts.length > 0) { meaningTexts.push(glossTexts.join(separators.gloss)); }
    }
    return meaningTexts.length > 0 ? meaningTexts.join(separators.sense) : null;
}

/**
 * @param {Range} range
 * @param {MeaningGroup[]} meanings
 */
function collectRangeText(range, meanings) {
    const root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) {
        addTextNode(/** @type {Text} */ (root), range, meanings);
        return;
    }
    const document = root.ownerDocument;
    if (document === null) { return; }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    /** @type {?Element|undefined} */
    let previousBlock = void 0;
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (!range.intersectsNode(node)) { continue; }
        if (node.nodeType === Node.TEXT_NODE) {
            // Entering or leaving a block element separates words without any whitespace text.
            const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? null;
            if (typeof previousBlock !== 'undefined' && block !== previousBlock) {
                addPart(node.parentElement, ' ', meanings);
            }
            previousBlock = block;
            addTextNode(/** @type {Text} */ (node), range, meanings);
        } else {
            const element = /** @type {Element} */ (node);
            // <br> and blocks without text (empty or image-only) separate words but contain no text node.
            if (element.tagName === 'BR' || (element.matches(BLOCK_SELECTOR) && (element.textContent ?? '').trim().length === 0)) {
                addPart(element.parentElement, ' ', meanings);
            }
        }
    }
}

/**
 * @param {Text} node
 * @param {Range} range
 * @param {MeaningGroup[]} meanings
 */
function addTextNode(node, range, meanings) {
    const start = node === range.startContainer ? range.startOffset : 0;
    const end = node === range.endContainer ? range.endOffset : node.length;
    const text = node.data.substring(start, end);
    if (text.length === 0) { return; }
    addPart(node.parentElement, text, meanings);
}

/**
 * @param {?Element} parent
 * @param {string} text
 * @param {MeaningGroup[]} meanings
 */
function addPart(parent, text, meanings) {
    if (parent === null || parent.closest(IGNORED_SELECTOR) !== null) { return; }
    const definitionItem = parent.closest('.definition-item');
    if (definitionItem === null) { return; }
    if (typeof parent.checkVisibility === 'function' && !parent.checkVisibility()) { return; }
    // checkVisibility() does not catch text placed directly inside a closed <details>.
    const details = parent.closest('details');
    if (details !== null && !details.hasAttribute('open') && parent.closest('summary')?.parentElement !== details) { return; }
    // Structured content that marks its glossaries (e.g. Jitendex) also holds labels, notes and
    // examples next to them; only the marked glossary text is a meaning.
    const entry = parent.closest('.gloss-item') ?? definitionItem;
    if (
        entry.querySelector(GLOSSARY_CONTENT_SELECTOR) !== null &&
        parent.closest(GLOSSARY_CONTENT_SELECTOR) === null
    ) {
        return;
    }

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

    // A meaning revisited after another one starts a new group, so the export keeps selection order.
    let group = meanings.length > 0 ? meanings[meanings.length - 1] : null;
    const isWhitespace = text.trim().length === 0;
    if (isWhitespace && (group === null || group.meaning !== meaning || !group.glosses.has(gloss))) {
        // Whitespace between list items only spaces words within a gloss; it must not split groups.
        return;
    }
    if (group === null || group.meaning !== meaning) {
        group = {meaning, glosses: new Map()};
        meanings.push(group);
    }
    const {glosses} = group;
    const parts = glosses.get(gloss);
    if (typeof parts === 'undefined') {
        glosses.set(gloss, [text]);
    } else {
        parts.push(text);
    }
}
