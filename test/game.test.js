'use strict';

const {
  Game,
  ARENA_RADIUS,
  PLAYER_MAX_HP,
  BULLET_DAMAGE,
  STATE_LOBBY,
  STATE_ACTIVE,
  STATE_ROUND_END,
  MIN_PLAYERS_TO_START,
  RING_SHRINK_DURATION_MS,
  generateConvexPolygon,
  getPolygonCentroid,
  scalePolygonTowardCentroid,
  pointInConvexPolygon,
  clampPointToPolygon,
} = require('../server/game');

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    console.log(`  PASS: ${msg}`);
  } else {
    failed++;
    console.log(`  FAIL: ${msg}`);
  }
}

function test(name, fn) {
  console.log(`\n${name}`);
  fn();
}

// --- Polygon Utility Tests ---

test('generateConvexPolygon produces valid polygon', () => {
  for (let n = 5; n <= 10; n++) {
    const poly = generateConvexPolygon(n, ARENA_RADIUS);
    assert(poly.length === n, `polygon has ${n} vertices`);
    for (const v of poly) {
      const dist = Math.sqrt(v.x * v.x + v.y * v.y);
      assert(dist <= ARENA_RADIUS * 1.01, `vertex within radius (dist=${dist.toFixed(1)})`);
      assert(dist >= ARENA_RADIUS * 0.74, `vertex not too close to center (dist=${dist.toFixed(1)})`);
    }
  }
});

test('getPolygonCentroid returns center of polygon', () => {
  const square = [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 100, y: 100 },
    { x: -100, y: 100 },
  ];
  const c = getPolygonCentroid(square);
  assert(Math.abs(c.x) < 0.01, 'centroid x near zero');
  assert(Math.abs(c.y) < 0.01, 'centroid y near zero');
});

test('pointInConvexPolygon correctly classifies points', () => {
  // CCW square
  const square = [
    { x: -100, y: -100 },
    { x: -100, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: -100 },
  ];
  assert(pointInConvexPolygon(0, 0, square), 'center is inside');
  assert(pointInConvexPolygon(50, 50, square), 'interior point is inside');
  assert(!pointInConvexPolygon(200, 0, square), 'point far right is outside');
  assert(!pointInConvexPolygon(0, 200, square), 'point far below is outside');
  assert(!pointInConvexPolygon(-200, -200, square), 'point far top-left is outside');
});

test('scalePolygonTowardCentroid shrinks polygon', () => {
  const square = [
    { x: -100, y: -100 },
    { x: 100, y: -100 },
    { x: 100, y: 100 },
    { x: -100, y: 100 },
  ];
  const centroid = getPolygonCentroid(square);
  const scaled = scalePolygonTowardCentroid(square, centroid, 0.5);

  // Each vertex should be at half the distance from centroid
  for (let i = 0; i < square.length; i++) {
    const origDist = Math.sqrt(
      (square[i].x - centroid.x) ** 2 + (square[i].y - centroid.y) ** 2
    );
    const scaledDist = Math.sqrt(
      (scaled[i].x - centroid.x) ** 2 + (scaled[i].y - centroid.y) ** 2
    );
    assert(Math.abs(scaledDist - origDist * 0.5) < 0.01, `vertex ${i} scaled correctly`);
  }
});

test('clampPointToPolygon clamps outside points', () => {
  // CCW square
  const square = [
    { x: -100, y: -100 },
    { x: -100, y: 100 },
    { x: 100, y: 100 },
    { x: 100, y: -100 },
  ];

  // Point inside stays unchanged
  const inside = clampPointToPolygon(50, 50, square);
  assert(Math.abs(inside.x - 50) < 0.01, 'inside point x unchanged');
  assert(Math.abs(inside.y - 50) < 0.01, 'inside point y unchanged');

  // Point outside gets clamped to edge
  const outside = clampPointToPolygon(200, 0, square);
  assert(Math.abs(outside.x - 100) < 0.01, 'clamped x to edge');
  assert(Math.abs(outside.y - 0) < 0.01, 'clamped y to edge');
});

// --- Game Tests ---

test('Game initializes in lobby state with polygon arena', () => {
  const game = new Game();
  assert(game.state === STATE_LOBBY, 'state is lobby');
  assert(Array.isArray(game.arenaVertices), 'arenaVertices is array');
  assert(game.arenaVertices.length >= 5, 'at least 5 vertices');
  assert(game.arenaVertices.length <= 10, 'at most 10 vertices');
  assert(Array.isArray(game.ringVertices), 'ringVertices is array');
  assert(game.ringVertices.length === game.arenaVertices.length, 'ring matches arena vertex count');
  assert(game.arenaCentroid && typeof game.arenaCentroid.x === 'number', 'has centroid');
  assert(game.players.size === 0, 'no players');
});

test('Players can join and are assigned IDs', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  const id2 = game.addPlayer(mockWs2);
  assert(id1 !== id2, 'unique IDs');
  assert(game.players.size === 2, 'two players in game');
  assert(game.players.get(id1).alive, 'player 1 alive');
  assert(game.players.get(id2).alive, 'player 2 alive');
});

test('Players spawn inside polygon arena in lobby', () => {
  const game = new Game();
  const mockWs = { readyState: 1, send: () => {} };
  const id = game.addPlayer(mockWs);
  const player = game.players.get(id);
  const dist = Math.sqrt(player.x * player.x + player.y * player.y);
  assert(dist > 0, 'player spawned away from center');
  assert(
    pointInConvexPolygon(player.x, player.y, game.arenaVertices),
    'player within arena polygon'
  );
});

test('Players joining during active game become spectators', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  // Force game to active state
  game.startRound();
  assert(game.state === STATE_ACTIVE, 'game is active');

  const mockWs3 = { readyState: 1, send: () => {} };
  const id3 = game.addPlayer(mockWs3);
  assert(game.spectators.has(id3), 'new player is spectator');
  assert(!game.players.get(id3).alive, 'spectator not alive');
});

test('Player removal during active game checks win condition', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  const id2 = game.addPlayer(mockWs2);

  game.startRound();
  assert(game.state === STATE_ACTIVE, 'game active');

  game.removePlayer(id2);
  assert(game.state === STATE_ROUND_END, 'round ended after player disconnect');
  assert(game.winnerId === id1, 'remaining player wins');
});

test('Input handling updates player state', () => {
  const game = new Game();
  const mockWs = { readyState: 1, send: () => {} };
  const id = game.addPlayer(mockWs);

  game.handleInput(id, { keys: { up: true, down: false, left: false, right: false }, angle: 1.5 });
  const player = game.players.get(id);
  assert(player.input.up === true, 'up key set');
  assert(player.angle === 1.5, 'angle set');
});

test('Movement is clamped to polygon arena bounds', () => {
  const game = new Game();
  const mockWs = { readyState: 1, send: () => {} };
  const id = game.addPlayer(mockWs);
  const player = game.players.get(id);

  // Move player far outside polygon
  player.x = ARENA_RADIUS + 100;
  player.y = 0;
  player.input.right = true;

  game.movePlayer(player, 1);
  assert(
    pointInConvexPolygon(player.x, player.y, game.arenaVertices),
    'player clamped to polygon arena'
  );
});

test('Ring shrinks during active game (polygon contracts toward centroid)', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();
  const initialRingVertices = game.ringVertices.map((v) => ({ x: v.x, y: v.y }));

  // Simulate some time passing
  game.ringStartTime = Date.now() - RING_SHRINK_DURATION_MS / 2;
  game.tickActive(0.05, Date.now());

  // Ring vertices should be closer to centroid
  const centroid = game.arenaCentroid;
  let initialAvgDist = 0;
  let newAvgDist = 0;
  for (let i = 0; i < initialRingVertices.length; i++) {
    initialAvgDist += Math.sqrt(
      (initialRingVertices[i].x - centroid.x) ** 2 +
        (initialRingVertices[i].y - centroid.y) ** 2
    );
    newAvgDist += Math.sqrt(
      (game.ringVertices[i].x - centroid.x) ** 2 +
        (game.ringVertices[i].y - centroid.y) ** 2
    );
  }
  assert(newAvgDist < initialAvgDist, 'ring has shrunk toward centroid');
  assert(newAvgDist > 0, 'ring still has some size');
});

test('Ring damage applies to players outside ring polygon', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();
  // Shrink ring very small
  game.ringVertices = scalePolygonTowardCentroid(
    game.arenaVertices,
    game.arenaCentroid,
    0.98
  );
  const player = game.players.get(id1);
  // Place player at a known position outside the tiny ring but inside arena
  const v = game.arenaVertices[0];
  player.x = game.arenaCentroid.x + (v.x - game.arenaCentroid.x) * 0.5;
  player.y = game.arenaCentroid.y + (v.y - game.arenaCentroid.y) * 0.5;

  const hpBefore = player.hp;
  game.applyRingDamage(1);
  assert(player.hp < hpBefore, 'player took ring damage');
});

test('Shooting creates bullets', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();
  const player = game.players.get(id1);
  player.angle = 0;

  game.tryShoot(player);
  assert(game.bullets.length === 1, 'one bullet created');
  assert(game.bullets[0].ownerId === id1, 'bullet owned by shooter');
});

test('Bullets damage players on collision', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  const id2 = game.addPlayer(mockWs2);

  game.startRound();
  const p1 = game.players.get(id1);
  const p2 = game.players.get(id2);

  // Place bullet right on top of player 2
  game.bullets.push({
    id: 'test',
    ownerId: id1,
    x: p2.x,
    y: p2.y,
    vx: 0,
    vy: 0,
    radius: 4,
    damage: BULLET_DAMAGE,
    createdAt: Date.now(),
  });

  const hpBefore = p2.hp;
  game.updateBullets(0.05, Date.now());
  assert(p2.hp < hpBefore, 'player 2 took bullet damage');
  assert(game.bullets.length === 0, 'bullet consumed on hit');
});

test('Bullets removed when exiting polygon arena', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();
  // Place a bullet far outside the arena polygon
  game.bullets.push({
    id: 'outside',
    ownerId: 1,
    x: ARENA_RADIUS * 3,
    y: ARENA_RADIUS * 3,
    vx: 100,
    vy: 0,
    radius: 4,
    damage: BULLET_DAMAGE,
    createdAt: Date.now(),
  });

  game.updateBullets(0.05, Date.now());
  assert(game.bullets.length === 0, 'bullet outside polygon removed');
});

test('Game state serialization includes polygon vertices', () => {
  const game = new Game();
  const mockWs = { readyState: 1, send: () => {} };
  const id = game.addPlayer(mockWs);
  const state = game.getState(id);

  assert(state.type === 'state', 'has type');
  assert(state.gameState === STATE_LOBBY, 'has gameState');
  assert(Array.isArray(state.arenaVertices), 'has arenaVertices array');
  assert(state.arenaVertices.length >= 5, 'arenaVertices has 5+ vertices');
  assert(Array.isArray(state.ringVertices), 'has ringVertices array');
  assert(state.ringVertices.length >= 5, 'ringVertices has 5+ vertices');
  assert(Array.isArray(state.players), 'has players array');
  assert(Array.isArray(state.bullets), 'has bullets array');
  assert(state.yourId === id, 'has yourId');
});

test('Each new round generates a different polygon shape', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();
  const firstVertices = game.arenaVertices.map((v) => ({ x: v.x, y: v.y }));

  // Reset and start again
  game.state = STATE_ROUND_END;
  game.resetForNextRound();
  game.startRound();
  const secondVertices = game.arenaVertices;

  // Vertices should differ (extremely unlikely to be identical with random generation)
  let same = true;
  if (firstVertices.length !== secondVertices.length) {
    same = false;
  } else {
    for (let i = 0; i < firstVertices.length; i++) {
      if (
        Math.abs(firstVertices[i].x - secondVertices[i].x) > 0.01 ||
        Math.abs(firstVertices[i].y - secondVertices[i].y) > 0.01
      ) {
        same = false;
        break;
      }
    }
  }
  assert(!same, 'second round has different polygon vertices');
});

test('Spawned players are inside polygon after startRound', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  const id2 = game.addPlayer(mockWs2);

  game.startRound();
  const p1 = game.players.get(id1);
  const p2 = game.players.get(id2);

  assert(
    pointInConvexPolygon(p1.x, p1.y, game.arenaVertices),
    'player 1 spawned inside polygon'
  );
  assert(
    pointInConvexPolygon(p2.x, p2.y, game.arenaVertices),
    'player 2 spawned inside polygon'
  );
});

test('Round lifecycle: lobby -> active -> end -> reset', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  const id1 = game.addPlayer(mockWs1);
  const id2 = game.addPlayer(mockWs2);

  assert(game.state === STATE_LOBBY, 'starts in lobby');

  game.startRound();
  assert(game.state === STATE_ACTIVE, 'transitions to active');

  // Kill player 2
  const p2 = game.players.get(id2);
  p2.hp = 0;
  p2.alive = false;
  game.checkWinCondition();
  assert(game.state === STATE_ROUND_END, 'transitions to round_end');
  assert(game.winnerId === id1, 'player 1 wins');

  game.resetForNextRound();
  assert(game.state === STATE_LOBBY, 'resets to lobby');
  assert(game.players.get(id1).alive, 'player 1 alive after reset');
  assert(game.players.get(id2).alive, 'player 2 alive after reset');
  assert(game.spectators.size === 0, 'no spectators after reset');
});

test('Spectators become players after round reset', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  game.addPlayer(mockWs2);

  game.startRound();

  const mockWs3 = { readyState: 1, send: () => {} };
  const id3 = game.addPlayer(mockWs3);
  assert(game.spectators.has(id3), 'joined as spectator');

  // End round and reset
  game.state = STATE_ROUND_END;
  game.resetForNextRound();
  assert(!game.spectators.has(id3), 'no longer spectator after reset');
  assert(game.players.get(id3).alive, 'now alive and ready to play');
});

test('Shoot cooldown prevents rapid fire', () => {
  const game = new Game();
  const mockWs1 = { readyState: 1, send: () => {} };
  const mockWs2 = { readyState: 1, send: () => {} };
  game.addPlayer(mockWs1);
  const id = game.addPlayer(mockWs2);

  game.startRound();
  const player = game.players.get(id);

  game.tryShoot(player);
  assert(game.bullets.length === 1, 'first shot fires');

  game.tryShoot(player);
  assert(game.bullets.length === 1, 'second shot blocked by cooldown');
});

// --- Summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed!');
}
