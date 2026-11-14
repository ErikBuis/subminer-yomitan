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

import {fileURLToPath} from 'node:url';
import path from 'path';
import {afterAll, describe, expect, test} from 'vitest';
import {TextSourceElement} from '../ext/js/dom/text-source-element.js';
import {TextSourceRange} from '../ext/js/dom/text-source-range.js';
import {getTokenScanLimit} from '../ext/js/dom/token-scan-limit.js';
import {setupDomTest} from './fixtures/dom-test.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnv = await setupDomTest(path.join(dirname, 'data/html/token-scan-limit.html'));
const SELECTOR = '#subtitleRoot .word[data-token-index], #subtitleRootImage .word[data-token-index]';

describe('getTokenScanLimit', () => {
    const {window, teardown} = testEnv;
    afterAll(() => teardown(global));

    /**
     * @param {string} rootId
     * @param {number} tokenIndex
     * @param {number} offset
     * @returns {TextSourceRange}
     */
    function sourceAt(rootId, tokenIndex, offset) {
        const {document} = window;
        const token = /** @type {HTMLElement} */ (document.querySelector(`#${rootId} [data-token-index="${tokenIndex}"]`));
        const textNode = /** @type {Text} */ ([...token.childNodes].find((node) => node.nodeType === window.Node.TEXT_NODE));
        const range = document.createRange();
        range.setStart(textNode, offset);
        range.setEnd(textNode, offset);
        return TextSourceRange.create(range);
    }

    test('limits a scan from the first character to the word', () => {
        expect(getTokenScanLimit(sourceAt('subtitleRoot', 0, 0), SELECTOR)).toBe(2);
        expect(getTokenScanLimit(sourceAt('subtitleRoot', 2, 0), SELECTOR)).toBe(3);
    });

    test('leaves a scan from a later character alone', () => {
        expect(getTokenScanLimit(sourceAt('subtitleRoot', 0, 1), SELECTOR)).toBeNull();
    });

    test('counts only text when the word starts with a character image', () => {
        expect(getTokenScanLimit(sourceAt('subtitleRootImage', 0, 0), SELECTOR)).toBe(3);
    });

    test('ignores text outside the word elements and without a selector', () => {
        expect(getTokenScanLimit(sourceAt('other', 0, 0), SELECTOR)).toBeNull();
        expect(getTokenScanLimit(sourceAt('subtitleRoot', 0, 0), null)).toBeNull();
        const element = /** @type {HTMLElement} */ (window.document.querySelector('#subtitleRootImage img'));
        expect(getTokenScanLimit(TextSourceElement.create(element), SELECTOR)).toBeNull();
    });

    test('the limited scan text is the highlighted word', () => {
        const source = sourceAt('subtitleRoot', 0, 0);
        const clone = source.clone();
        clone.setEndOffset(16, false, false);
        expect(clone.text().trim()).toBe('いいんだろうか');
        const limited = source.clone();
        limited.setEndOffset(Math.min(16, /** @type {number} */ (getTokenScanLimit(source, SELECTOR))), false, false);
        expect(limited.text()).toBe('いい');
    });
});
