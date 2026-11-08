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

import {describe, expect, test} from 'vitest';
import {getFlatGlossaryText, getSplitTermDefinitions} from '../ext/js/templates/flat-glossary.js';

const defaultOptions = {dictionary: null, senseSeparator: '; ', glossSeparator: ', '};

/**
 * @param {string} name
 * @returns {{name: string}}
 */
function tag(name) {
    return {name};
}

// The JMdict (yomitan-import) entries for 頃 (ころ): one definition per sense plus a "forms" definition with a forms table.
const koroDefinitions = [
    {
        dictionary: 'JMdict',
        definitionTags: [tag('1'), tag('n'), tag('adv'), tag('n-suf'), tag('uk')],
        glossary: [{
            type: 'structured-content',
            content: [
                {
                    tag: 'ul',
                    data: {content: 'glossary'},
                    content: [
                        {tag: 'li', content: '(approximate) time'},
                        {tag: 'li', content: 'around'},
                        {tag: 'li', content: 'about'},
                        {tag: 'li', content: 'toward'},
                    ],
                },
                {tag: 'ul', data: {content: 'notes'}, content: {tag: 'li', content: 'ごろ when used as a suffix'}},
            ],
        }],
    },
    {
        dictionary: 'JMdict',
        definitionTags: [tag('2'), tag('n'), tag('adv'), tag('n-suf')],
        glossary: [{
            type: 'structured-content',
            content: [
                {tag: 'ul', data: {content: 'glossary'}, content: {tag: 'li', content: 'suitable time (or condition)'}},
                {
                    tag: 'ul',
                    data: {content: 'references'},
                    content: {
                        tag: 'li',
                        content: [
                            'see: ',
                            {tag: 'a', href: '?query=食べ頃&wildcards=off', content: '食べ頃'},
                            {tag: 'span', data: {content: 'refGlosses'}, content: ' good for eating; ripe enough for eating; in season'},
                        ],
                    },
                },
            ],
        }],
    },
    {
        dictionary: 'JMdict',
        definitionTags: [tag('3'), tag('n'), tag('adv'), tag('n-suf')],
        glossary: [{
            type: 'structured-content',
            content: {
                tag: 'ul',
                data: {content: 'glossary'},
                content: [
                    {tag: 'li', content: 'time of year'},
                    {tag: 'li', content: 'season'},
                ],
            },
        }],
    },
    {
        dictionary: 'JMdict',
        definitionTags: [tag('forms')],
        glossary: [{
            type: 'structured-content',
            content: {
                tag: 'table',
                data: {content: 'formsTable'},
                content: [
                    {tag: 'tr', content: [{tag: 'th', content: ''}, {tag: 'th', content: '頃'}, {tag: 'th', content: '比'}]},
                    {tag: 'tr', content: [{tag: 'th', content: 'ころ'}, {tag: 'td', content: '★'}, {tag: 'td', content: '㊒'}]},
                    {tag: 'tr', content: [{tag: 'th', content: 'ごろ'}, {tag: 'td', content: '★'}, {tag: 'td', content: '㊒'}]},
                ],
            },
        }],
    },
];

describe('getFlatGlossaryText', () => {
    test('joins JMdict senses with "; " and their glosses with ", ", without notes, references or forms', () => {
        const definition = {type: 'termGrouped', definitions: koroDefinitions};
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe(
            '(approximate) time, around, about, toward; suitable time (or condition); time of year, season',
        );
    });

    test('uses the given separators', () => {
        const definition = {type: 'termGrouped', definitions: koroDefinitions};
        expect(getFlatGlossaryText(definition, {dictionary: null, senseSeparator: ' / ', glossSeparator: ' | '})).toBe(
            '(approximate) time | around | about | toward / suitable time (or condition) / time of year | season',
        );
    });

    test('a forms table without a "forms" tag is still left out because it has no glossary', () => {
        const forms = {...koroDefinitions[3], definitionTags: []};
        const definition = {type: 'termGrouped', definitions: [koroDefinitions[2], forms]};
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('time of year, season');
    });

    test('forms definitions with plain string glossaries are left out', () => {
        const definition = {
            type: 'termGrouped',
            definitions: [
                {dictionary: 'JMdict', definitionTags: [tag('n')], glossary: [{type: 'structured-content', content: {tag: 'ul', data: {content: 'glossary'}, content: [{tag: 'li', content: 'time'}, {tag: 'li', content: 'period'}]}}]},
                {dictionary: 'JMdict', definitionTags: [tag('forms')], glossary: ['頃おい', '比おい', '頃', '比']},
            ],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('time, period');
    });

    test('only uses the given dictionary', () => {
        const other = {dictionary: 'Other', definitionTags: [], glossary: ['other meaning']};
        const definition = {type: 'termGrouped', definitions: [...koroDefinitions, other]};
        expect(getFlatGlossaryText(definition, {...defaultOptions, dictionary: 'Other'})).toBe('other meaning');
        expect(getFlatGlossaryText(definition, {...defaultOptions, dictionary: 'JMdict'})).toBe(
            '(approximate) time, around, about, toward; suitable time (or condition); time of year, season',
        );
    });

    test('plain string glosses of one definition are synonyms, separate definitions are senses', () => {
        const definition = {
            type: 'termMerged',
            definitions: [
                {dictionary: 'd', definitionTags: [], glossary: ['pretense', '(false) show']},
                {dictionary: 'd', definitionTags: [], glossary: [{type: 'text', text: 'facade'}]},
            ],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('pretense, (false) show; facade');
    });

    test('a single term definition', () => {
        expect(getFlatGlossaryText({type: 'term', ...koroDefinitions[0]}, defaultOptions)).toBe('(approximate) time, around, about, toward');
    });

    test('a split term keeps its glossaries even though its combined tags include "forms"', () => {
        const definition = {
            type: 'term',
            dictionary: 'JMdict',
            definitionTags: koroDefinitions.flatMap(({definitionTags}) => definitionTags),
            glossary: [...koroDefinitions[0].glossary, ...koroDefinitions[2].glossary],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('(approximate) time, around, about, toward; time of year, season');
    });

    test('a split term read from its dictionary entry gives the same result as a grouped one', () => {
        const dictionaryEntry = {
            type: 'term',
            definitions: koroDefinitions.map(({dictionary, definitionTags, glossary}) => ({dictionary, tags: definitionTags, entries: glossary})),
        };
        const definition = getSplitTermDefinitions(dictionaryEntry);
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe(
            '(approximate) time, around, about, toward; suitable time (or condition); time of year, season',
        );
        expect(getSplitTermDefinitions({type: 'kanji'})).toBe(null);
    });

    test('structured content with several glossaries (Jitendex style) gives one sense per glossary', () => {
        const definition = {
            type: 'term',
            dictionary: 'Jitendex',
            definitionTags: [],
            glossary: [{
                type: 'structured-content',
                content: {
                    tag: 'ol',
                    content: [
                        {
                            tag: 'li',
                            data: {content: 'sense'},
                            content: [
                                {tag: 'span', data: {content: 'part-of-speech-info'}, content: 'noun'},
                                {tag: 'ul', data: {content: 'glossary'}, content: [{tag: 'li', content: 'cat'}, {tag: 'li', content: 'kitty'}]},
                            ],
                        },
                        {
                            tag: 'li',
                            data: {content: 'sense'},
                            content: [
                                {tag: 'ul', data: {content: 'glossary'}, content: {tag: 'li', content: 'geisha'}},
                                {tag: 'div', data: {content: 'example-sentence'}, content: '猫を飼う'},
                            ],
                        },
                    ],
                },
            }],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('cat, kitty; geisha');
    });

    test('unmarked structured content uses its list items, or all of its text', () => {
        const definition = {
            type: 'termGrouped',
            definitions: [
                {dictionary: 'd', definitionTags: [], glossary: [{type: 'structured-content', content: {tag: 'ul', content: [{tag: 'li', content: 'one'}, {tag: 'li', content: ['two', {tag: 'br'}, 'lines']}]}}]},
                {dictionary: 'd', definitionTags: [], glossary: [{type: 'structured-content', content: [{tag: 'div', content: 'block'}, {tag: 'div', content: ['text ', {tag: 'ruby', content: ['漢', {tag: 'rt', content: 'かん'}]}]}]}]},
            ],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('one, two lines; block text 漢');
    });

    test('kanji meanings are separate senses', () => {
        expect(getFlatGlossaryText({type: 'kanji', glossary: ['time', 'about', 'toward']}, defaultOptions)).toBe('time; about; toward');
    });

    test('images and empty glossaries give nothing', () => {
        const definition = {
            type: 'termGrouped',
            definitions: [{dictionary: 'd', definitionTags: [], glossary: [{type: 'image', path: 'a.png'}, '  ']}],
        };
        expect(getFlatGlossaryText(definition, defaultOptions)).toBe('');
        expect(getFlatGlossaryText(null, defaultOptions)).toBe('');
    });
});
