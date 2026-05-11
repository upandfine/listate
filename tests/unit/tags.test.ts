import { describe, expect, it } from 'vitest';
import { normalizeTags, parseTags, tagsToString } from '@/lib/tags';

describe('parseTags', () => {
  it('null und leerer String ergeben []', () => {
    expect(parseTags(null)).toEqual([]);
    expect(parseTags(undefined)).toEqual([]);
    expect(parseTags('')).toEqual([]);
  });

  it('trimmt, lowercase-t und filtert leere Einträge', () => {
    expect(parseTags(' a , B,, c-D ,')).toEqual(['a', 'b', 'c-d']);
  });

  it('akzeptiert auch ungültige Zeichen — parseTags validiert NICHT', () => {
    // parseTags ist der Lesepfad aus der DB. Validation passiert beim
    // Schreiben über normalizeTags. Daher dürfen hier auch „komische"
    // Werte zurückkommen.
    expect(parseTags('foo,bar!')).toEqual(['foo', 'bar!']);
  });
});

describe('normalizeTags', () => {
  it('lowercase-t und ersetzt Whitespace durch Bindestrich', () => {
    expect(normalizeTags('Hello World, Foo')).toEqual(['hello-world', 'foo']);
  });

  it('dedupliziert', () => {
    expect(normalizeTags('foo, FOO, foo, bar')).toEqual(['foo', 'bar']);
  });

  it('verwirft Tags mit unzulässigen Zeichen', () => {
    expect(normalizeTags('ok, bad!, also-ok, b@d, nice')).toEqual([
      'ok',
      'also-ok',
      'nice',
    ]);
  });

  it('verwirft zu lange Tags (> 32 Zeichen)', () => {
    const long = 'a'.repeat(33);
    expect(normalizeTags(`ok, ${long}, fine`)).toEqual(['ok', 'fine']);
  });

  it('akzeptiert genau 32-Zeichen-Tag (Grenzfall)', () => {
    const max = 'a'.repeat(32);
    expect(normalizeTags(`${max}`)).toEqual([max]);
  });

  it('begrenzt auf 8 Tags', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `t${i}`).join(',');
    expect(normalizeTags(ten)).toHaveLength(8);
  });

  it('leere Eingabe ergibt leeres Array', () => {
    expect(normalizeTags('')).toEqual([]);
    expect(normalizeTags(' , ,  , ')).toEqual([]);
  });
});

describe('tagsToString', () => {
  it('joint mit Komma', () => {
    expect(tagsToString(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it('liefert null statt leerem String', () => {
    expect(tagsToString([])).toBeNull();
  });
});
