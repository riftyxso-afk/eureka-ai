import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseMomoLook, chooseMomoMood } from './momo-reaction.mjs';

test('chooses the character from the question before incidental words in the answer', () => {
  assert.equal(chooseMomoLook('Buat resep nasi goreng', 'Berikut jadwal dan resepnya.'), 'cook');
  assert.equal(chooseMomoLook('Mengapa kode Python error?', 'Mari kita jelaskan.'), 'bug');
  assert.equal(chooseMomoLook('Jelaskan fotosintesis', 'Tumbuhan mengubah cahaya.'), 'tutor');
  assert.equal(chooseMomoLook('Bantu desain UI', 'Ini contoh aplikasi.'), 'designer');
});

test('falls back to the answer and then the chosen mode', () => {
  assert.equal(chooseMomoLook('', 'Berikut rencana perjalanan wisata.'), 'traveller');
  assert.equal(chooseMomoLook('Halo', 'Halo!', 'deep'), 'investigate');
  assert.equal(chooseMomoLook('', '', 'fast'), 'coach');
});

test('expresses state and sensitive or celebratory responses', () => {
  assert.equal(chooseMomoMood('', { thinking: true }), 'thinking');
  assert.equal(chooseMomoMood('Selamat, kamu berhasil!'), 'happy');
  assert.equal(chooseMomoMood('Turut berduka atas kehilanganmu.'), 'concerned');
  assert.equal(chooseMomoMood('Berikut penjelasannya.'), 'neutral');
  assert.equal(chooseMomoMood('Selamat', { error: true }), 'concerned');
});
