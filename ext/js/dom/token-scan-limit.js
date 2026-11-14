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
 * SubMiner draws each word of a subtitle as its own element and highlights that whole element on
 * hover. A scan that starts on the first character of such a word must not run past its end, or
 * the popup can show a longer word than the highlight (いいん/医院 for a highlighted いい).
 * Returns the word element when the scan starts at the word's first character, else null.
 * @param {import('text-source').TextSource} textSource
 * @param {?string} tokenSelector
 * @returns {?Element}
 */
export function getScanStartToken(textSource, tokenSelector) {
    if (tokenSelector === null || textSource.type !== 'range') { return null; }
    const {range} = /** @type {import('./text-source-range.js').TextSourceRange} */ (textSource);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE || range.startOffset !== 0) { return null; }

    const parent = node.parentElement;
    const token = parent !== null ? parent.closest(tokenSelector) : null;
    if (token === null) { return null; }

    // Only the token's first text node starts the word.
    const walker = token.ownerDocument.createTreeWalker(token, NodeFilter.SHOW_TEXT);
    return walker.nextNode() === node ? token : null;
}

/**
 * Shortens `textSource` (already extended to `length` characters, counted as code points) until it ends inside `token`.
 * Counting through the scanner itself keeps characters it skips (ruby text, hidden nodes) and
 * characters outside the BMP right.
 * @param {import('text-source').TextSource} textSource
 * @param {Element} token
 * @param {number} length
 * @param {boolean} layoutAwareScan
 */
export function constrainToToken(textSource, token, length, layoutAwareScan) {
    // The word can't hold more characters than its text, so start from there instead of the full scan length.
    const tokenLength = [...(token.textContent ?? '')].length;
    if (tokenLength < length) {
        length = tokenLength;
        textSource.setEndOffset(length, false, layoutAwareScan);
    }
    while (length > 0 && !textSource.getNodesInRange().every((node) => token.contains(node))) {
        --length;
        textSource.setEndOffset(length, false, layoutAwareScan);
    }
}
