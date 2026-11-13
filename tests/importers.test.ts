import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { parseCsv, parseLooseNumber, decodeCsvBytes, CsvFileError } from '../src/utils/csvCore';
import { pairFills, Fill } from '../src/utils/executionPairing';
import { parseBinanceExport, parseBinanceTime, detectBinanceFormat } from '../src/utils/binanceCsv';
import { parseBinanceCsv, SAMPLE_BINANCE_SPOT_CSV, SAMPLE_BINANCE_FUTURES_CSV } from '../src/utils/binanceParser';
import { parseBrokerCsv, normalizeDate, inferAssetClass, getSampleCsv } from '../src/utils/csvParsers';
import { buildDuplicateChecker } from '../src/utils/tradeDedupe';
import { localDateString } from '../src/utils/dateHelpers';
import type { Trade } from '../src/types/trade';

const dir = path.dirname(fileURLToPath(import.meta.url));
const fx = (n: string) => readFileSync(path.join(dir, 'fixtures', n), 'utf8');
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} !~ ${b}`);

// ------------------------------------------------------------------------------------------ csvCore
test('parseCsv: BOM, quoted commas/newlines, escaped quotes, CRLF, semicolons, tabs', () => {
  assert.deepEqual(parseCsv('\uFEFFa,b\r\n1,2\r\n'), [['a', 'b'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,b\n"x, y","line1\nline2"\n'), [['a', 'b'], ['x, y', 'line1\nline2']]);
  assert.deepEqual(parseCsv('a,b\n"say ""hi""",2'), [['a', 'b'], ['say "hi"', '2']]);
  assert.deepEqual(parseCsv('a;b\n1,5;2'), [['a', 'b'], ['1,5', '2']]);
  assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']]);
  assert.equal(parseCsv('a,b\n\n\n1,2').length, 2);
});

test('parseLooseNumber: units, separators, negatives, scientific', () => {
  assert.deepEqual(parseLooseNumber('0.00150000BTC'), { value: 0.0015, unit: 'BTC' });
  assert.deepEqual(parseLooseNumber('12.5 USDT'), { value: 12.5, unit: 'USDT' });
  assert.deepEqual(parseLooseNumber('"50,000,000PEPE"'.replace(/"/g, '')), { value: 50000000, unit: 'PEPE' });
  assert.deepEqual(parseLooseNumber('(15.2)'), { value: -15.2, unit: '' });
  assert.deepEqual(parseLooseNumber('-$1,234.50'), { value: -1234.5, unit: '' });
  assert.deepEqual(parseLooseNumber('1.5E-7'), { value: 1.5e-7, unit: '' });
  assert.deepEqual(parseLooseNumber('5ETH'), { value: 5, unit: 'ETH' });
  assert.equal(parseLooseNumber(''), null);
  assert.equal(parseLooseNumber('BTCUSDT'), null);
});

test('decodeCsvBytes: UTF-16 handled, .xlsx rejected with a helpful message', () => {
  const u16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from('a,b\n1,2', 'utf16le')]);
  assert.equal(decodeCsvBytes(u16.buffer.slice(u16.byteOffset, u16.byteOffset + u16.byteLength)), 'a,b\n1,2');
  const xlsx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0]);
  assert.throws(() => decodeCsvBytes(xlsx.buffer.slice(xlsx.byteOffset, xlsx.byteOffset + xlsx.byteLength)), CsvFileError);
});

// ------------------------------------------------------------------------------------------ pairing engine
const F = (o: Partial<Fill> & Pick<Fill, 'side' | 'qty' | 'price'>, i: number): Fill => ({ time: 1_000_000 + i * 60_000, symbol: 'X', fee: 0, seq: i, ...o });

test('pairing: scale-in / scale-out becomes one trade with correct average entry', () => {
  const r = pairFills([F({ side: 'buy', qty: 10, price: 100 }, 0), F({ side: 'buy', qty: 10, price: 110 }, 1), F({ side: 'sell', qty: 5, price: 120 }, 2), F({ side: 'sell', qty: 15, price: 130 }, 3)], { allowShort: false });
  assert.equal(r.trades.length, 1);
  const t = r.trades[0];
  near(t.entryPrice, 105); near(t.quantity, 20); near(t.netPnl, 5 * 15 + 15 * 25); // 450
});

test('pairing: derivatives flip closes the long and opens a short', () => {
  const r = pairFills([F({ side: 'buy', qty: 10, price: 100 }, 0), F({ side: 'sell', qty: 15, price: 110 }, 1), F({ side: 'buy', qty: 5, price: 105 }, 2)], { allowShort: true });
  assert.equal(r.trades.length, 2);
  assert.equal(r.trades[0].direction, 'long'); near(r.trades[0].netPnl, 100);
  assert.equal(r.trades[1].direction, 'short'); near(r.trades[1].netPnl, 25);
});

test('pairing: spot sell with no buy is an orphan, not a trade', () => {
  const r = pairFills([F({ side: 'sell', qty: 1, price: 100 }, 0)], { allowShort: false });
  assert.equal(r.trades.length, 0); assert.equal(r.orphans.length, 1);
});

test('pairing: partial exit of a still-open position gives a closed trade + an open remainder', () => {
  const r = pairFills([F({ side: 'buy', qty: 10, price: 100 }, 0), F({ side: 'sell', qty: 4, price: 110 }, 1)], { allowShort: false });
  assert.equal(r.trades.length, 2);
  const closed = r.trades.find((t) => t.status === 'closed')!; const open = r.trades.find((t) => t.status === 'open')!;
  near(closed.netPnl, 40); near(closed.quantity, 4); near(open.quantity, 6); near(open.entryPrice, 100);
});

test('pairing: random flat-to-flat sequences conserve cash (sum of net P&L == cash in - cash out - fees)', () => {
  let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  for (let n = 0; n < 200; n++) {
    const fills: Fill[] = []; let pos = 0; let cash = 0; let fees = 0; let i = 0;
    const legs = 2 + Math.floor(rnd() * 4);
    for (let l = 0; l < legs; l++) {
      const buy = l === 0 ? true : pos <= 0 ? true : rnd() < 0.35;
      const qty = buy ? 1 + Math.floor(rnd() * 9) : Math.min(pos, 1 + Math.floor(rnd() * 9));
      if (qty <= 0) continue;
      const price = 50 + rnd() * 100; const fee = rnd();
      fills.push(F({ side: buy ? 'buy' : 'sell', qty, price, fee }, i++));
      pos += buy ? qty : -qty; cash += buy ? -qty * price : qty * price; fees += fee;
    }
    if (pos > 0) { const price = 50 + rnd() * 100; fills.push(F({ side: 'sell', qty: pos, price, fee: 0.5 }, i++)); cash += pos * price; fees += 0.5; pos = 0; }
    const r = pairFills(fills, { allowShort: false });
    const sum = r.trades.filter((t) => t.status === 'closed').reduce((a, t) => a + t.netPnl, 0);
    near(sum, cash - fees, 1e-6);
  }
});

// ------------------------------------------------------------------------------------------ Binance
test('Binance: time formats', () => {
  assert.equal(parseBinanceTime('2026-11-02 09:10:05'), Date.UTC(2026, 10, 2, 9, 10, 5));
  assert.equal(parseBinanceTime('26-11-02 09:10:05'), Date.UTC(2026, 10, 2, 9, 10, 5));
  assert.equal(parseBinanceTime('2026-11-02T09:10:05Z'), Date.UTC(2026, 10, 2, 9, 10, 5));
  assert.equal(parseBinanceTime('1793610605000'), 1793610605000);
  assert.equal(parseBinanceTime('hello'), null);
});

test('Binance: format detection', () => {
  const h = (f: string) => detectBinanceFormat(fx(f).split('\n')[0].split(','));
  assert.equal(h('spot_trade_history.csv'), 'spot_trade_history');
  assert.equal(h('spot_order_history.csv'), 'spot_order_history');
  assert.equal(h('futures_trade_history.csv'), 'futures_trade_history');
  assert.equal(h('wallet_statement.csv'), 'wallet_statement');
  assert.equal(detectBinanceFormat(['Date', 'Symbol', 'Entry', 'Exit']), 'unknown');
});

test('Binance spot trade history: exact round-trip numbers (fees in base coin, split fills, micro prices, BNB fee, orphan, open)', () => {
  const r = parseBinanceExport(fx('spot_trade_history.csv'), { timezone: 'utc' });
  assert.equal(r.market, 'spot'); assert.equal(r.fillCount, 10);
  const by = (s: string) => r.trades.find((t) => t.symbol === s)!;
  const btc = by('BTCUSDT');
  near(btc.quantity, 0.00999); near(btc.entryPrice, 60000); near(btc.exitPrice, 62000);
  near(btc.grossPnl, 19.98, 1e-4); near(btc.fees, 1.21938, 1e-4); near(btc.netPnl, 18.7606, 1e-3);
  assert.equal(btc.date, '2026-11-02'); assert.equal(btc.time, '09:10'); assert.equal(btc.exitTime, '15:40');
  assert.equal(btc.assetClass, 'crypto'); assert.equal(btc.outcome, 'win');
  const eth = by('ETHUSDT'); near(eth.netPnl, -5.8971, 1e-3); assert.equal(eth.outcome, 'loss');
  const pepe = by('PEPEUSDT'); near(pepe.netPnl, 98.8006, 1e-3); near(pepe.entryPrice, 0.00001, 1e-12); near(pepe.exitPrice, 0.000012, 1e-12);
  const doge = by('DOGEUSDT'); assert.equal(doge.status, 'open'); assert.equal(doge.outcome, 'open'); near(doge.entryPrice, 0.15);
  assert.equal(r.trades.find((t) => t.symbol === 'SOLUSDT'), undefined);
  assert.equal(r.orphanCount, 1);
  assert.ok(r.warnings.some((w) => /BNB/.test(w)) && r.warnings.some((w) => /SOLUSDT/.test(w)) && r.warnings.some((w) => /still open/.test(w)));
  // honest import: no invented plan / psychology data
  assert.equal(btc.stopLoss, btc.entryPrice); assert.equal(btc.plannedRR, 0); assert.equal(btc.mistake, undefined);
});

test('Binance futures trade history: realized profit is the source of truth, entry derived, flips, unseen entry', () => {
  const r = parseBinanceExport(fx('futures_trade_history.csv'), { timezone: 'utc' });
  assert.equal(r.market, 'futures');
  const all = (s: string) => r.trades.filter((t) => t.symbol === s);
  const btc = all('BTCUSDT.P')[0];
  near(btc.entryPrice, 60100); near(btc.exitPrice, 61000); near(btc.quantity, 0.1); near(btc.grossPnl, 90); near(btc.fees, 6.055); near(btc.netPnl, 83.945);
  assert.equal(btc.assetClass, 'futures');
  const eth = all('ETHUSDT.P'); assert.equal(eth.length, 2);
  const ethShort = eth.find((t) => t.direction === 'short')!; near(ethShort.entryPrice, 3000); near(ethShort.netPnl, 47.025);
  const ethUnseen = eth.find((t) => t.direction === 'long')!; near(ethUnseen.entryPrice, 3110); near(ethUnseen.netPnl, -23.1);
  const sol = all('SOLUSDT.P'); assert.equal(sol.length, 2);
  near(sol.find((t) => t.direction === 'long')!.grossPnl, 50); near(sol.find((t) => t.direction === 'short')!.grossPnl, 15);
  assert.equal(all('BNBUSDT.P')[0].status, 'open');
  near(r.summary.netPnl, 83.945 + 47.025 - 23.1 + 48.476667 + 14.233333, 1e-3);
});

test('Binance spot order history: uses Average Price + fill time, ignores cancelled orders', () => {
  const r = parseBinanceExport(fx('spot_order_history.csv'), { timezone: 'utc' });
  assert.equal(r.format, 'spot_order_history'); assert.equal(r.trades.length, 1);
  near(r.trades[0].netPnl, 20); assert.equal(r.skippedRows, 1);
});

test('Binance wallet statement is rejected with guidance, not imported as garbage', () => {
  const r = parseBinanceExport(fx('wallet_statement.csv'));
  assert.equal(r.trades.length, 0); assert.match(r.error!, /Trade History/);
  const g = parseBrokerCsv(fx('wallet_statement.csv'), []);
  assert.equal(g.trades.length, 0); assert.ok(g.error);
});

test('Binance: ascending and descending files give identical trades; ids are deterministic (re-import is a duplicate)', () => {
  const lines = fx('futures_trade_history.csv').trim().split('\n');
  const asc = lines.join('\n'); const desc = [lines[0], ...lines.slice(1).reverse()].join('\n');
  const a = parseBinanceExport(asc, { timezone: 'utc' }); const d = parseBinanceExport(desc, { timezone: 'utc' });
  assert.deepEqual(a.trades.map((t) => [t.id, t.netPnl]).sort(), d.trades.map((t) => [t.id, t.netPnl]).sort());
  const isDup = buildDuplicateChecker(a.trades);
  assert.ok(d.trades.every((t) => isDup(t)));
});

test('Binance: BOM + CRLF + title line tolerated', () => {
  const txt = '\uFEFF' + fx('spot_trade_history.csv').replace(/\n/g, '\r\n');
  assert.equal(parseBinanceExport(txt, { timezone: 'utc' }).trades.length, 4);
});

test('Binance: legacy wrapper (sync modal) skips duplicates and uses the same engine', () => {
  const first = parseBinanceCsv(SAMPLE_BINANCE_SPOT_CSV, [], 'S', 'utc');
  assert.ok(first.trades.length >= 3 && first.error === undefined);
  const again = parseBinanceCsv(SAMPLE_BINANCE_SPOT_CSV, first.trades, 'S', 'utc');
  assert.equal(again.trades.length, 0); assert.equal(again.duplicatesCount, first.trades.length);
  assert.ok(parseBinanceCsv(SAMPLE_BINANCE_FUTURES_CSV, [], 'S', 'utc').trades.length >= 3);
});

test('Binance: timezone option converts UTC to local (and "utc" leaves it alone)', () => {
  const u = parseBinanceExport(fx('spot_trade_history.csv'), { timezone: 'utc' }).trades.find((t) => t.symbol === 'BTCUSDT')!;
  const l = parseBinanceExport(fx('spot_trade_history.csv'), { timezone: 'local' }).trades.find((t) => t.symbol === 'BTCUSDT')!;
  const expected = new Date(Date.UTC(2026, 10, 2, 9, 10, 5));
  assert.equal(u.time, '09:10');
  assert.equal(l.date, localDateString(expected));
  assert.equal(l.id, u.id); // same trade regardless of display timezone
});

// ------------------------------------------------------------------------------------------ generic / broker parsers
test('normalizeDate: no day shift, 2-digit years, text months; unparseable => "" (never today)', () => {
  assert.equal(normalizeDate('Nov 5, 2026'), '2026-11-05');
  assert.equal(normalizeDate('5-Nov-2026'), '2026-11-05');
  assert.equal(normalizeDate('10/24/26 09:35:12'), '2026-10-24');
  assert.equal(normalizeDate('24/10/2026'), '2026-10-24');
  assert.equal(normalizeDate('2026-10-24, 09:30:00'), '2026-10-24');
  assert.equal(normalizeDate('2026-10-24T09:30:00Z'), '2026-10-24');
  assert.equal(normalizeDate('not a date'), '');
  assert.equal(normalizeDate(''), '');
});

test('inferAssetClass: crypto pairs are not forex, "ES"/"CL" substrings are not futures', () => {
  assert.equal(inferAssetClass('SOLUSDT'), 'crypto'); assert.equal(inferAssetClass('BTCUSDT.P'), 'crypto');
  assert.equal(inferAssetClass('EURUSD'), 'forex'); assert.equal(inferAssetClass('ES'), 'futures'); assert.equal(inferAssetClass('MNQZ6'), 'futures');
  assert.equal(inferAssetClass('ESTC'), 'stocks'); assert.equal(inferAssetClass('CLF'), 'stocks'); assert.equal(inferAssetClass('TSLA'), 'stocks');
  assert.equal(inferAssetClass('AAPL261016C00230000'), 'options');
});

test('generic sample imports; wrong rows are skipped with a warning instead of invented values', () => {
  const ok = parseBrokerCsv(getSampleCsv('generic'), []);
  assert.equal(ok.trades.length, 5); near(ok.trades[0].netPnl, 468.5);
  const bad = parseBrokerCsv('Date,Symbol,EntryPrice,ExitPrice,Quantity\n2026-10-24,NVDA,100,110,10\nnot-a-date,AAPL,100,110,10\n2026-10-25,MSFT,,110,10\n2026-10-25,AMD,100,110,0', []);
  assert.equal(bad.trades.length, 1); assert.ok(bad.warnings.some((w) => /Skipped 3 rows/.test(w)));
  assert.equal(bad.trades[0].stopLoss, bad.trades[0].entryPrice); // not a fabricated +/-2% stop
});

test('IBKR sample (quoted Date/Time) maps columns correctly', () => {
  const r = parseBrokerCsv(getSampleCsv('ibkr'), []);
  assert.equal(r.detectedPlatform, 'ibkr'); assert.equal(r.trades.length, 3);
  assert.equal(r.trades[0].date, '2026-10-24'); assert.equal(r.trades[0].time, '09:30'); near(r.trades[0].quantity, 50);
});

test('ThinkorSwim executions are paired into trades with real P&L (was: each row a $0 "trade")', () => {
  const r = parseBrokerCsv(getSampleCsv('tos'), []);
  assert.equal(r.detectedPlatform, 'thinkorswim'); assert.equal(r.trades.length, 2);
  const nvda = r.trades.find((t) => t.symbol === 'NVDA')!; near(nvda.netPnl, 470); assert.equal(nvda.direction, 'long'); assert.equal(nvda.date, '2026-10-24');
  near(r.trades.find((t) => t.symbol === 'AAPL')!.netPnl, -300);
});

test('TradingView entry/exit rows are paired', () => {
  const r = parseBrokerCsv(getSampleCsv('tradingview'), []);
  assert.equal(r.detectedPlatform, 'tradingview'); assert.equal(r.trades.length, 2);
  near(r.trades[0].netPnl + r.trades[1].netPnl, 170);
});

test('parseBrokerCsv auto-detects Binance and exposes the binance result', () => {
  const r = parseBrokerCsv(fx('spot_trade_history.csv'), [], undefined, { binanceTimezone: 'utc' });
  assert.equal(r.detectedPlatform, 'binance'); assert.equal(r.trades.length, 4); assert.ok(r.binance); assert.match(r.formatLabel!, /Spot/);
});

test('duplicate checker: relative tolerance (sub-cent coins are not all "duplicates")', () => {
  const mk = (o: Partial<Trade>) => ({ id: 'a', date: '2026-11-04', symbol: 'PEPEUSDT', direction: 'long', entryPrice: 0.00001, quantity: 1000, ...o }) as Trade;
  const isDup = buildDuplicateChecker([mk({})]);
  assert.equal(isDup(mk({ id: 'b', entryPrice: 0.0000250 })), false); // a different trade, 2.5x the price
  assert.equal(isDup(mk({ id: 'b', entryPrice: 0.00001 })), true);
  assert.equal(isDup(mk({ id: 'a', entryPrice: 5 })), true); // same id
});
