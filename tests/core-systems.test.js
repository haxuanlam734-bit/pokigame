const assert = require('assert');
const Utils = require('../src/utils.js');
const GameState = require('../src/game-state.js');

assert.strictEqual(Utils.formatMoney(1500), '$1.5K', 'formatMoney should abbreviate thousands');
assert.strictEqual(Utils.formatMoney(1200000), '$1.2M', 'formatMoney should abbreviate millions');

GameState.init();
assert.strictEqual(GameState.canBuildBuilding('tower'), true, 'tower should be buildable after wall');
GameState.money = 0;
assert.strictEqual(GameState.canBuildBuilding('tower'), false, 'tower should require enough money');

console.log('Core systems test: PASS');
