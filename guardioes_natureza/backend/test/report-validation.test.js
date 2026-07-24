const test = require('node:test');
const assert = require('node:assert/strict');
const { validateReport } = require('../app');

const validReport = {
  userId: 1,
  latitude: 37.74,
  longitude: -25.67,
  accuracy: 12,
  category: 'lixo',
  location: 'Margem da ribeira',
  description: 'Resíduos junto à água.',
};

test('aceita um reporte válido', () => {
  assert.equal(validateReport(validReport).error, undefined);
});

test('rejeita precisão fora do intervalo suportado', () => {
  assert.equal(validateReport({ ...validReport, accuracy: 51 }).error, 'A precisão GPS deve estar entre 0 e 50 metros.');
});

test('rejeita identificadores de utilizador não inteiros', () => {
  assert.equal(validateReport({ ...validReport, userId: 1.5 }).error, 'Utilizador inválido.');
});
