import test from 'node:test';
import assert from 'node:assert/strict';

import { getLang, getLangEnglish } from '../src/lib/i18n';
import { t } from '../src/lib/translations';
import { getCountryName } from '../src/lib/countries';
import { getCurrency, isEurozone, eurToLocal } from '../src/lib/currencies';

test('language mapping for country codes', () => {
  assert.equal(getLang('DE'), 'de');
  assert.equal(getLang('FR'), 'fr');
  assert.equal(getLang('XX'), 'en');
  assert.equal(getLangEnglish('PL'), 'Polish');
});

test('translations fallback to english and key fallback', () => {
  assert.equal(t('en', 'landing.title'), 'EU Hub');
  assert.equal(t('de', 'landing.title'), 'EU Hub');
  assert.equal(t('xx', 'landing.title'), 'EU Hub');
  assert.equal(t('en', 'missing.key.example'), 'missing.key.example');
});

test('country and currency metadata is consistent', () => {
  assert.equal(getCountryName('PL'), 'Poland');
  assert.equal(getCountryName('ZZ'), 'ZZ');

  assert.equal(isEurozone('DE'), true);
  assert.equal(isEurozone('PL'), false);
  assert.equal(getCurrency('PL').code, 'PLN');
  assert.equal(eurToLocal(100, 'PL'), 426);
});
