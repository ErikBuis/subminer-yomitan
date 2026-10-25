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
import {SORT_FREQUENCY_DICTIONARY_AVERAGE} from '../../ext/js/language/frequency-sort.js';
import {Translator} from '../../ext/js/language/translator.js';

const termDictionary = 'Test Term Dictionary';
const frequencyDictionaryA = 'Frequency A';
const frequencyDictionaryB = 'Frequency B';
const occurrenceDictionary = 'Occurrence Frequency';

/** @type {Record<string, Record<string, import('dictionary-data').GenericFrequencyData|import('dictionary-data').GenericFrequencyData[]>>} */
const frequencyData = {
    [frequencyDictionaryA]: {あ: 100, い: 200, う: 300},
    [frequencyDictionaryB]: {あ: 90000, い: 150},
    [occurrenceDictionary]: {あ: 1, い: 1, う: 1000000},
};

/** @type {Record<string, (import('dictionary-importer').Summary['frequencyMode'])>} */
const frequencyModes = {
    [frequencyDictionaryA]: 'rank-based',
    [frequencyDictionaryB]: 'rank-based',
    [occurrenceDictionary]: 'occurrence-based',
};

/**
 * @param {string[]} termList
 * @returns {Promise<import('dictionary-database').TermEntry[]>}
 */
async function findTermsBulk(termList) {
    /** @type {import('dictionary-database').TermEntry[]} */
    const entries = [];
    let id = 0;
    for (const [index, text] of termList.entries()) {
        if (text !== 'test') { continue; }
        for (const term of ['あ', 'い', 'う']) {
            entries.push({
                index,
                matchType: 'exact',
                matchSource: 'term',
                term,
                reading: term,
                definitionTags: [],
                termTags: [],
                rules: [],
                definitions: [`${term} definition`],
                score: 0,
                dictionary: termDictionary,
                id: ++id,
                sequence: -1,
            });
        }
    }
    return entries;
}

/**
 * @param {string[]} termList
 * @param {import('translation').TermEnabledDictionaryMap} dictionaries
 * @returns {Promise<import('dictionary-database').TermMeta[]>}
 */
async function findTermMetaBulk(termList, dictionaries) {
    /** @type {import('dictionary-database').TermMeta[]} */
    const metas = [];
    for (const [index, term] of termList.entries()) {
        for (const dictionary of dictionaries.keys()) {
            const frequency = frequencyData[dictionary]?.[term];
            if (typeof frequency === 'undefined') { continue; }
            for (const data of (Array.isArray(frequency) ? frequency : [frequency])) {
                metas.push({index, term, mode: 'freq', data, dictionary});
            }
        }
    }
    return metas;
}

/**
 * @returns {Promise<import('dictionary-importer').Summary[]>}
 */
async function getDictionaryInfo() {
    return /** @type {import('dictionary-importer').Summary[]} */ (/** @type {unknown} */ (
        Object.entries(frequencyModes).map(([title, frequencyMode]) => ({title, frequencyMode}))
    ));
}

/**
 * @returns {Translator}
 */
function createTranslator() {
    const translator = new Translator(/** @type {import('../../ext/js/dictionary/dictionary-database.js').DictionaryDatabase} */ (/** @type {unknown} */ ({
        findTermsBulk,
        findTermMetaBulk,
        getDictionaryInfo,
    })));
    translator.prepare();
    return translator;
}

/**
 * @param {string[]} dictionaries
 * @returns {import('translation').TermEnabledDictionaryMap}
 */
function createEnabledDictionaryMap(dictionaries) {
    return new Map(dictionaries.map((dictionary, index) => [dictionary, {
        index,
        alias: dictionary,
        allowSecondarySearches: false,
        partsOfSpeechFilter: false,
        useDeinflections: false,
    }]));
}

/**
 * @param {import('translator').FindTermsMode} mode
 * @param {?string} sortFrequencyDictionary
 * @param {import('translation').FindTermsSortOrder} sortFrequencyDictionaryOrder
 * @param {string[]} frequencyDictionaries
 * @returns {Promise<string[]>}
 */
async function findSortedTerms(mode, sortFrequencyDictionary, sortFrequencyDictionaryOrder, frequencyDictionaries) {
    const translator = createTranslator();
    const {dictionaryEntries} = await translator.findTerms(mode, 'test', {
        matchType: 'exact',
        deinflect: false,
        mainDictionary: termDictionary,
        sortFrequencyDictionary,
        sortFrequencyDictionaryOrder,
        removeNonJapaneseCharacters: false,
        primaryReading: '',
        textReplacements: [null],
        enabledDictionaryMap: createEnabledDictionaryMap([termDictionary, ...frequencyDictionaries]),
        excludeDictionaryDefinitions: null,
        searchResolution: 'word',
        language: 'ja',
        useAllFrequencyDictionaries: false,
    });
    return dictionaryEntries.map(({headwords}) => headwords[0].term);
}

describe('Translator frequency sorting', () => {
    test('sorts by a single frequency dictionary', async () => {
        const terms = await findSortedTerms('simple', frequencyDictionaryA, 'ascending', [frequencyDictionaryA, frequencyDictionaryB]);
        expect(terms).toStrictEqual(['あ', 'い', 'う']);
    });

    test.each(/** @type {import('translator').FindTermsMode[]} */ (['simple', 'split']))('sorts by the average of all frequency dictionaries (%s)', async (mode) => {
        // Harmonic means: あ = floor(2 / (1/100 + 1/90000)) = 199, い = floor(2 / (1/200 + 1/150)) = 171, う = 300.
        // The occurrence-based dictionary is left out when sorting by rank.
        const terms = await findSortedTerms(mode, SORT_FREQUENCY_DICTIONARY_AVERAGE, 'ascending', [frequencyDictionaryA, frequencyDictionaryB, occurrenceDictionary]);
        expect(terms).toStrictEqual(['い', 'あ', 'う']);
    });

    test('average sorting in occurrence mode only uses occurrence-based dictionaries', async () => {
        const terms = await findSortedTerms('simple', SORT_FREQUENCY_DICTIONARY_AVERAGE, 'descending', [frequencyDictionaryA, frequencyDictionaryB, occurrenceDictionary]);
        expect(terms[0]).toBe('う');
    });

    test('average only uses the first value of each dictionary like the Average frequency tag', async () => {
        const original = frequencyData[frequencyDictionaryA];
        frequencyData[frequencyDictionaryA] = {あ: [0, 10], い: 50, う: 300};
        try {
            // Frequency A's first value for あ is 0, so like the Average tag it contributes nothing.
            // Harmonic means: あ = 90000 (Frequency B only), い = floor(2 / (1/50 + 1/150)) = 75, う = 300.
            const terms = await findSortedTerms('simple', SORT_FREQUENCY_DICTIONARY_AVERAGE, 'ascending', [frequencyDictionaryA, frequencyDictionaryB]);
            expect(terms).toStrictEqual(['い', 'う', 'あ']);
        } finally {
            frequencyData[frequencyDictionaryA] = original;
        }
    });

    test('average uses the leading number of the display value like the Average frequency tag', async () => {
        const original = frequencyData[frequencyDictionaryA];
        frequencyData[frequencyDictionaryA] = {あ: 100, い: {value: 999999, displayValue: '50㋕'}, う: 300};
        try {
            // Harmonic means: あ = 199, い = floor(2 / (1/50 + 1/150)) = 75, う = 300.
            const terms = await findSortedTerms('simple', SORT_FREQUENCY_DICTIONARY_AVERAGE, 'ascending', [frequencyDictionaryA, frequencyDictionaryB]);
            expect(terms).toStrictEqual(['い', 'あ', 'う']);
        } finally {
            frequencyData[frequencyDictionaryA] = original;
        }
    });
});
