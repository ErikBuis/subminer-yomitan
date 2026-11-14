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
import {getScanStartToken} from '../ext/js/dom/token-scan-limit.js';
import {TextSourceGenerator} from '../ext/js/dom/text-source-generator.js';
import {setupDomTest} from './fixtures/dom-test.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnv = await setupDomTest(path.join(dirname, 'data/html/token-scan-limit.html'));
const SELECTOR = ['subtitleRoot', 'subtitleRootImage', 'subtitleRootRuby', 'subtitleRootAstral']
    .map((id) => `#${id} .word[data-token-index]`)
    .join(', ');

describe('hover scans stay inside the word they start on', () => {
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

    /**
     * @param {?string} tokenSelector
     * @returns {Promise<import('../ext/js/language/text-scanner.js').TextScanner>}
     */
    async function createScanner(tokenSelector) {
        const {TextScanner} = await import('../ext/js/language/text-scanner.js');
        const scanner = new TextScanner({
            api: /** @type {import('../ext/js/comm/api.js').API} */ (/** @type {unknown} */ ({})),
            node: /** @type {Window} */ (/** @type {unknown} */ (window)),
            getSearchContext: () => ({optionsContext: {index: 0}, detail: {documentTitle: ''}}),
            textSourceGenerator: new TextSourceGenerator(),
            browser: 'chrome',
        });
        scanner.tokenSelector = tokenSelector;
        return scanner;
    }

    test('finds the word only when the scan starts at its first character', () => {
        const {document} = window;
        expect(getScanStartToken(sourceAt('subtitleRoot', 0, 0), SELECTOR)).toBe(document.querySelector('#subtitleRoot [data-token-index="0"]'));
        expect(getScanStartToken(sourceAt('subtitleRoot', 0, 1), SELECTOR)).toBeNull();
        // A character image before the text doesn't count as a character.
        expect(getScanStartToken(sourceAt('subtitleRootImage', 0, 0), SELECTOR)).not.toBeNull();
        expect(getScanStartToken(sourceAt('other', 0, 0), SELECTOR)).toBeNull();
        expect(getScanStartToken(sourceAt('subtitleRoot', 0, 0), null)).toBeNull();
        const element = /** @type {HTMLElement} */ (document.querySelector('#subtitleRootImage img'));
        expect(getScanStartToken(TextSourceElement.create(element), SELECTOR)).toBeNull();
    });

    test('a mouse scan from the first character stops at the end of the word', async () => {
        const scanner = await createScanner(SELECTOR);
        for (const layoutAwareScan of [false, true]) {
            expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 16, layoutAwareScan, 'mouse')).toBe('いい');
            expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 2, 0), 16, layoutAwareScan, 'mouse')).toBe('だろう');
            expect(scanner.getTextSourceContent(sourceAt('subtitleRootImage', 0, 0), 16, layoutAwareScan, 'mouse')).toBe('ひとり');
            // Ruby text is skipped by the scanner, so the word is 漢字 and not 漢字じ.
            expect(scanner.getTextSourceContent(sourceAt('subtitleRootRuby', 0, 0), 16, layoutAwareScan, 'mouse')).toBe('漢字');
            // 𠮷 is two UTF-16 units but one character.
            expect(scanner.getTextSourceContent(sourceAt('subtitleRootAstral', 0, 0), 16, layoutAwareScan, 'mouse')).toBe('𠮷野');
        }
        expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 16, false, 'touch')).toBe('いい');
        expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 16, false, 'pen')).toBe('いい');
        expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 1, false, 'mouse')).toBe('い');
    });

    test('other scans are unchanged', async () => {
        const scanner = await createScanner(SELECTOR);
        // From a later character.
        expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 1), 6, false, 'mouse')).toBe('いんだろうか');
        // Keyboard lookups (script scans) search past the word on purpose.
        expect(scanner.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 7, false, 'script')).toBe('いいんだろうか');
        // Without a selector.
        const plain = await createScanner(null);
        expect(plain.getTextSourceContent(sourceAt('subtitleRoot', 0, 0), 7, false, 'mouse')).toBe('いいんだろうか');
    });
});
