/*
 * Copyright (C) 2023-2026  Yomitan Authors
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

import {describe} from 'vitest';
import {createAnkiTemplateRendererTest} from './fixtures/anki-template-renderer-test.js';

const test = await createAnkiTemplateRendererTest();

describe('AnkiTemplateRenderer', () => {
    /** @type {import('template-renderer').CompositeRenderData} */
    const data = {
        marker: 'test',
        commonData: {
            dictionaryEntry: {
                type: 'kanji',
                character: 'c',
                dictionary: 'dictionary',
                dictionaryIndex: 0,
                dictionaryAlias: 'dictionaryAlias',
                onyomi: [],
                kunyomi: [],
                tags: [],
                stats: {},
                definitions: [],
                frequencies: [],
            },
            resultOutputMode: 'split',
            cardFormat: {
                type: 'term',
                name: 'test',
                deck: 'deck',
                model: 'model',
                fields: {},
                icon: 'big-circle',
            },
            glossaryLayoutMode: 'default',
            compactTags: false,
            context: {
                url: 'http://localhost/',
                documentTitle: 'documentTitle',
                query: 'query',
                fullQuery: 'query.full',
                sentence: {
                    text: 'sentence.query.full',
                    offset: 9,
                },
            },
            media: void 0,
            dictionaryStylesMap: new Map(),
        },
    };
    const testCases = [
        {
            name: 'regexMatch 1',
            template: '{{#regexMatch "test" "gu"}}this is a test of regexMatch{{/regexMatch}}',
            result: 'test',
        },
        {
            name: 'regexMatch 2',
            template: '{{regexMatch "test" "gu" "this is a test of regexMatch"}}',
            result: 'test',
        },
        {
            name: 'regexMatch 3',
            template: '{{#if (regexMatch "test" "gu" "this is a test of regexMatch")}}true{{else}}false{{/if}}',
            result: 'true',
        },
        {
            name: 'regexReplace 1',
            template: '{{#regexReplace "test" "TEST" "gu"}}this is a test of regexReplace{{/regexReplace}}',
            result: 'this is a TEST of regexReplace',
        },
        {
            name: 'regexReplace 2',
            template: '{{regexReplace "test" "TEST" "gu" "this is a test of regexReplace"}}',
            result: 'this is a TEST of regexReplace',
        },
        {
            name: 'regexReplace 3',
            template: '{{#if (regexReplace "test" "" "gu" "test")}}true{{else}}false{{/if}}',
            result: 'false',
        },
    ];
    describe.each(testCases)('$name', ({template, result: expectedResult}) => {
        test('Test', ({expect, ankiTemplateRenderer}) => {
            const {result} = ankiTemplateRenderer.templateRenderer.render(template, data, 'ankiNote');
            expect(result).toEqual(expectedResult);
        });
    });
});

describe('AnkiTemplateRenderer popupSelectionText', () => {
    /**
     * @param {import('anki-templates').Media|undefined} media
     * @param {string[]} [definitions]
     * @returns {import('template-renderer').CompositeRenderData}
     */
    function createData(media, definitions = []) {
        return {
            marker: 'test',
            commonData: {
                dictionaryEntry: {
                    type: 'kanji',
                    character: 'c',
                    dictionary: 'dictionary',
                    dictionaryIndex: 0,
                    dictionaryAlias: 'dictionaryAlias',
                    onyomi: [],
                    kunyomi: [],
                    tags: [],
                    stats: {},
                    definitions,
                    frequencies: [],
                },
                resultOutputMode: 'split',
                cardFormat: {
                    type: 'term',
                    name: 'test',
                    deck: 'deck',
                    model: 'model',
                    fields: {},
                    icon: 'big-circle',
                },
                glossaryLayoutMode: 'default',
                compactTags: false,
                context: {
                    url: 'http://localhost/',
                    documentTitle: 'documentTitle',
                    query: 'query',
                    fullQuery: 'query.full',
                    sentence: {
                        text: 'sentence.query.full',
                        offset: 9,
                    },
                },
                media,
                dictionaryStylesMap: new Map(),
            },
        };
    }
    // A custom marker that uses the selection and falls back to the definition when nothing is selected.
    const fallbackTemplate = '{{#if (hasMedia "popupSelectionText")}}{{{getMedia "popupSelectionText"}}}{{else}}fallback{{/if}}';
    const plainTemplate = '{{#if (hasMedia "popupSelectionText")}}{{{getMedia "popupSelectionText"}}}{{/if}}';
    const testCases = [
        {name: 'selected text', media: {popupSelectionText: {value: 'pretense, (false) show'}}, template: fallbackTemplate, result: 'pretense, (false) show'},
        {name: 'empty selection falls back', media: {popupSelectionText: {value: ''}}, template: fallbackTemplate, result: 'fallback'},
        {name: 'whitespace-only selection falls back', media: {popupSelectionText: {value: ' \n '}}, template: fallbackTemplate, result: 'fallback'},
        {name: 'empty selection with the default marker stays empty', media: {popupSelectionText: {value: ''}}, template: plainTemplate, result: ''},
        {name: 'getMedia of an empty selection is empty', media: {popupSelectionText: {value: ''}}, template: '[{{{getMedia "popupSelectionText"}}}]', result: '[]'},
    ];
    describe.each(testCases)('$name', ({media, template, result: expectedResult}) => {
        test('Test', ({expect, ankiTemplateRenderer}) => {
            const {result, requirements} = ankiTemplateRenderer.templateRenderer.render(template, createData(/** @type {import('anki-templates').Media} */ (media)), 'ankiNote');
            expect(result).toEqual(expectedResult);
            // An empty selection was injected, so it must not be requested again.
            expect(requirements).toEqual([]);
        });
    });

    describe('formatGlossaryFlat as the fallback for an empty selection', () => {
        const flatFallbackTemplate = '{{#if (hasMedia "popupSelectionText")}}{{{getMedia "popupSelectionText"}}}{{else}}{{{formatGlossaryFlat definition}}}{{/if}}';
        const flatTestCases = [
            {name: 'selected text wins', media: {popupSelectionText: {value: 'season'}}, template: flatFallbackTemplate, result: 'season'},
            {name: 'empty selection gives the whole definition on one line', media: {popupSelectionText: {value: ''}}, template: flatFallbackTemplate, result: 'time; <about>; toward'},
            {name: 'separators can be set', media: {popupSelectionText: {value: ''}}, template: '{{{formatGlossaryFlat definition senseSeparator=" / "}}}', result: 'time / <about> / toward'},
            {name: 'double braces do not escape twice', media: {popupSelectionText: {value: ''}}, template: '{{formatGlossaryFlat definition}}', result: 'time; <about>; toward'},
        ];
        describe.each(flatTestCases)('$name', ({media, template, result: expectedResult}) => {
            test('Test', ({expect, ankiTemplateRenderer}) => {
                const data = createData(/** @type {import('anki-templates').Media} */ (media), ['time', '<about>', 'toward']);
                const {result} = ankiTemplateRenderer.templateRenderer.render(template, data, 'ankiNote');
                expect(result).toEqual(expectedResult.replaceAll('<', '&lt;').replaceAll('>', '&gt;'));
            });
        });
    });
});
