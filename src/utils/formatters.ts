/**
 * Binance-compatible precision formatters for crypto, stocks, forex, and futures.
 * Binance standard:
 * - Up to 8 decimal places for crypto quantity (Satoshi precision: 0.00000001 BTC).
 * - Up to 8 decimal places for micro-cap token prices (e.g. PEPE, SHIB: $0.00001845).
 * - Automatic precision scaling without trailing zeros.
 */

export function formatQuantity(qty: number, assetClass: string = 'crypto'): string {
  if (!qty || isNaN(qty)) return '0';
  
  if (assetClass === 'crypto') {
    // Up to 8 decimal places (Binance standard)
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8,
    });
  }

  if (assetClass === 'forex') {
    return qty.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    });
  }

  // Stocks, Futures, Options: integer shares or up to 4 decimal fractions
  return qty.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function formatPrice(price: number, currency: string = '$'): string {
  if (price === 0 || isNaN(price)) return `${currency}0.00`;
  const absPrice = Math.abs(price);
  const sign = price < 0 ? '-' : '';

  // Micro-price crypto assets (e.g. SHIB, PEPE, DOGE, BONK): $0.00001845
  if (absPrice < 0.001) {
    return `${sign}${currency}${absPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    })}`;
  }

  // Sub-dollar assets ($0.001 - $1.00): $0.4521
  if (absPrice < 1) {
    return `${sign}${currency}${absPrice.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  // Standard prices ($1.00+): $142.50, $68,450.00
  return `${sign}${currency}${absPrice.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

/**
 * Amount without currency/sign: whole dollars for large values, cents for small ones,
 * so a $0.20 result never collapses to "0".
 */
export function formatSmartAmount(value: number): string {
  if (!Number.isFinite(value)) return '0.00';
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : 2;
  return abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPnL(pnl: number, currency: string = '$'): string {
  if (isNaN(pnl)) return `${currency}0.00`;
  const sign = pnl > 0 ? '+' : pnl < 0 ? '-' : '';
  const absPnl = Math.abs(pnl);

  if (absPnl < 0.01 && absPnl > 0) {
    return `${sign}${currency}${absPnl.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  }

  return `${sign}${currency}${absPnl.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
