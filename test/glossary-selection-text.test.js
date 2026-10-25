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

import {describe, expect} from 'vitest';
import {getGlossarySelectionText} from '../ext/js/dom/glossary-selection-text.js';
import {createDomTest} from './fixtures/dom-test.js';

const test = createDomTest();

const separators = {sense: '; ', gloss: ', '};

/**
 * @param {string[]} glosses
 * @returns {string}
 */
function simpleDefinition(glosses) {
    const items = glosses.map((gloss) => `<li class="gloss-item"><span class="gloss-separator"> </span><span class="gloss-content">${gloss}</span></li>`);
    return `<li class="definition-item"><div class="definition-item-inner"><button class="expansion-button"></button><div class="definition-item-content"><div class="definition-tag-list tag-list"><span class="tag">noun</span><span class="tag">JMdict</span></div><div class="definition-disambiguation-list"></div><ul class="gloss-list">${items.join('')}</ul></div></div></li>`;
}

/**
 * @param {Document} document
 * @param {string} html
 */
function setBody(document, html) {
    // eslint-disable-next-line no-unsanitized/property
    document.body.innerHTML = html;
}

/**
 * @param {Document} document
 * @param {Node} startNode
 * @param {number} startOffset
 * @param {Node} endNode
 * @param {number} endOffset
 * @returns {Selection}
 */
function select(document, startNode, startOffset, endNode, endOffset) {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = /** @type {Selection} */ (document.getSelection());
    selection.removeAllRanges();
    selection.addRange(range);
    return selection;
}

/**
 * @param {Document} document
 * @param {string} text
 * @returns {Text}
 * @throws {Error}
 */
function findText(document, text) {
    const walker = document.createTreeWalker(document.body, 4);
    for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        if (/** @type {Text} */ (node).data === text) { return /** @type {Text} */ (node); }
    }
    throw new Error(`Text not found: ${text}`);
}

describe('getGlossarySelectionText', () => {
    test('joins meanings with semicolons and synonyms with commas', ({window}) => {
        const {document} = window;
        setBody(document, `<div class="entry"><span class="headword">放課</span><ol class="definition-list">${simpleDefinition(['dismissal of class (at the end of the day)'])}${simpleDefinition(['recess (at school)', 'break'])}</ol></div>`);
        const start = findText(document, 'dismissal of class (at the end of the day)');
        const end = findText(document, 'break');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('dismissal of class (at the end of the day); recess (at school), break');
    });

    test('keeps partial selections and skips tags inside the range', ({window}) => {
        const {document} = window;
        setBody(document, `<ol class="definition-list">${simpleDefinition(['alpha one', 'alpha two'])}${simpleDefinition(['beta one', 'beta two'])}</ol>`);
        const start = findText(document, 'alpha two');
        const end = findText(document, 'beta one');
        const selection = select(document, start, 6, end, 4);
        expect(getGlossarySelectionText(selection, separators)).toBe('two; beta');
    });

    test('handles a selection inside a single text node', ({window}) => {
        const {document} = window;
        setBody(document, `<ol class="definition-list">${simpleDefinition(['recess (at school)'])}</ol>`);
        const node = findText(document, 'recess (at school)');
        const selection = select(document, node, 0, node, 6);
        expect(getGlossarySelectionText(selection, separators)).toBe('recess');
    });

    test('groups structured content glosses by their sense', ({window}) => {
        const {document} = window;
        const sense = (/** @type {string[]} */ glosses) => `<li class="gloss-sc-li"><ul class="gloss-sc-ul" data-sc-content="glossary">${glosses.map((gloss) => `<li class="gloss-sc-li">${gloss}</li>`).join('\n')}</ul></li>`;
        setBody(document, `<ol class="definition-list"><li class="definition-item"><div class="definition-item-content"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content"><span class="structured-content"><ol class="gloss-sc-ol">${sense(['to eat'])}\n${sense(['to live on', 'to subsist on'])}</ol></span></span></li></ul></div></li></ol>`);
        const start = findText(document, 'to eat');
        const end = findText(document, 'to subsist on');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('to eat; to live on, to subsist on');
    });

    test('keeps word boundaries at line breaks of multiline glosses', ({window}) => {
        const {document} = window;
        setBody(document, '<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content">first line<br>second line</span></li><li class="gloss-item"><span class="gloss-content">other</span></li></ul></li></ol>');
        const start = findText(document, 'first line');
        const end = findText(document, 'other');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('first line second line, other');
    });

    test('skips labels next to marked structured content glossaries', ({window}) => {
        const {document} = window;
        const sense = (/** @type {string} */ label, /** @type {string[]} */ glosses) => `<li class="gloss-sc-li" data-sc-content="sense"><span class="gloss-sc-span" data-sc-content="part-of-speech-info">${label}</span><ul class="gloss-sc-ul" data-sc-content="glossary">${glosses.map((gloss) => `<li class="gloss-sc-li">${gloss}</li>`).join('')}</ul></li>`;
        setBody(document, `<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content"><span class="structured-content"><ol class="gloss-sc-ol">${sense('noun', ['dismissal of class'])}${sense('noun', ['recess', 'break'])}</ol></span></span></li></ul></li></ol>`);
        const start = findText(document, 'noun');
        const end = findText(document, 'break');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('dismissal of class; recess, break');
    });

    test('keeps word boundaries between block elements', ({window}) => {
        const {document} = window;
        setBody(document, '<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content"><span class="structured-content"><div class="gloss-sc-div">first</div><div class="gloss-sc-div">second</div></span></span></li></ul></li></ol>');
        const start = findText(document, 'first');
        const end = findText(document, 'second');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('first second');
    });

    test('keeps word boundaries between a block element and following inline text', ({window}) => {
        const {document} = window;
        setBody(document, '<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content"><span class="structured-content"><div class="gloss-sc-div">first</div><span class="gloss-sc-span">sec</span><span class="gloss-sc-span">ond</span></span></span></li></ul></li></ol>');
        const start = findText(document, 'first');
        const end = findText(document, 'ond');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('first second');
    });

    test('keeps plain entries next to a structured entry with marked glossaries', ({window}) => {
        const {document} = window;
        setBody(document, '<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content">alpha</span></li><li class="gloss-item"><span class="gloss-content"><span class="structured-content"><span class="gloss-sc-span" data-sc-content="part-of-speech-info">noun</span><ul class="gloss-sc-ul" data-sc-content="glossary"><li class="gloss-sc-li">beta</li></ul></span></span></li></ul></li></ol>');
        const start = findText(document, 'alpha');
        const end = findText(document, 'beta');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('alpha; beta');
    });

    test('skips text hidden inside a closed details element', ({window}) => {
        const {document} = window;
        setBody(document, '<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content"><span class="structured-content">shown<details class="gloss-sc-details"><summary class="gloss-sc-summary">More</summary>hidden note</details>after</span></span></li></ul></li></ol>');
        const start = findText(document, 'shown');
        const end = findText(document, 'after');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('shown More after');
    });

    test('keeps selection order when a meaning recurs after another one', ({window}) => {
        const {document} = window;
        const structured = '<li class="gloss-item"><span class="gloss-content"><span class="structured-content"><ul class="gloss-sc-ul" data-sc-content="glossary"><li class="gloss-sc-li">beta</li></ul></span></span></li>';
        setBody(document, `<ol class="definition-list"><li class="definition-item"><ul class="gloss-list"><li class="gloss-item"><span class="gloss-content">alpha</span></li>${structured}<li class="gloss-item"><span class="gloss-content">gamma</span></li></ul></li></ol>`);
        const start = findText(document, 'alpha');
        const end = findText(document, 'gamma');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, separators)).toBe('alpha; beta; gamma');
    });

    test('uses the configured separators', ({window}) => {
        const {document} = window;
        setBody(document, `<ol class="definition-list">${simpleDefinition(['one'])}${simpleDefinition(['two', 'three'])}</ol>`);
        const start = findText(document, 'one');
        const end = findText(document, 'three');
        const selection = select(document, start, 0, end, end.length);
        expect(getGlossarySelectionText(selection, {sense: ' / ', gloss: ' | '})).toBe('one / two | three');
    });

    test('returns null when nothing inside a definition is selected', ({window}) => {
        const {document} = window;
        setBody(document, `<div><span class="headword">放課</span><ol class="definition-list">${simpleDefinition(['recess'])}</ol></div>`);
        const node = findText(document, '放課');
        const selection = select(document, node, 0, node, node.length);
        expect(getGlossarySelectionText(selection, separators)).toBeNull();
    });
});
