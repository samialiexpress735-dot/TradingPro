import { MarketSession } from '../types/trade';

export interface HubSession {
  name: string;
  city: string;
  country: string;
  timeZone: string;
  openUtcHour: number;
  openUtcMin: number;
  closeUtcHour: number;
  closeUtcMin: number;
  flag: string;
}

export const GLOBAL_HUBS: HubSession[] = [
  {
    name: 'Sydney / Pacific',
    city: 'Sydney',
    country: 'Australia',
    timeZone: 'Australia/Sydney',
    openUtcHour: 21,
    openUtcMin: 0,
    closeUtcHour: 6,
    closeUtcMin: 0,
    flag: '🇦🇺',
  },
  {
    name: 'Tokyo / Asian',
    city: 'Tokyo',
    country: 'Japan',
    timeZone: 'Asia/Tokyo',
    openUtcHour: 0,
    openUtcMin: 0,
    closeUtcHour: 9,
    closeUtcMin: 0,
    flag: '🇯🇵',
  },
  {
    name: 'London / European',
    city: 'London',
    country: 'United Kingdom',
    timeZone: 'Europe/London',
    openUtcHour: 7,
    openUtcMin: 0,
    closeUtcHour: 15,
    closeUtcMin: 30,
    flag: '🇬🇧',
  },
  {
    name: 'New York / US Cash',
    city: 'New York',
    country: 'United States',
    timeZone: 'America/New_York',
    openUtcHour: 13,
    openUtcMin: 30,
    closeUtcHour: 20,
    closeUtcMin: 0,
    flag: '🇺🇸',
  },
];

export interface DetailedSessionClock {
  utcTime: string;
  localTime: string;
  localTimezone: string;
  nyTime: string;
  activeSession: string;
  activeKillZone: string;
  sessionStateNote: string;
  isOverlap: boolean;
  hubs: Array<{
    name: string;
    city: string;
    flag: string;
    isOpen: boolean;
    localTimeFormatted: string;
    statusText: string;
  }>;
}

/**
 * Calculates current market session and real-time clock across financial hubs
 */
export function getDetailedSessionClock(date = new Date()): DetailedSessionClock {
  const utcHours = date.getUTCHours();
  const utcMins = date.getUTCMinutes();
  const totalUtcMins = utcHours * 60 + utcMins;

  // Formatted clocks
  const utcTimeStr = `${String(utcHours).padStart(2, '0')}:${String(utcMins).padStart(2, '0')}:${String(
    date.getUTCSeconds()
  ).padStart(2, '0')} UTC`;

  const localTimeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const localTzStr = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local';

  const nyTimeStr = date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }) + ' EST/EDT';

  // Determine active primary session and high-volume killzones
  let activeSession = 'Asian Session (Tokyo)';
  let activeKillZone = 'Tokyo / Asian Session';
  let sessionStateNote = 'Asian range consolidation; monitor key highs and lows for London sweeps.';
  let isOverlap = false;

  // 12:00 to 15:30 UTC = London & NY overlap (peak daily volume)
  if (totalUtcMins >= 720 && totalUtcMins < 930) {
    activeSession = 'London / New York Overlap';
    activeKillZone = totalUtcMins >= 810 ? '🔥 NY AM Peak Volume Killzone' : '⚡ London & NY Overlap';
    sessionStateNote = 'Maximum global liquidity. Institutional order blocks, highest daily volatility.';
    isOverlap = true;
  }
  // 15:30 to 16:30 UTC = London Close & NY AM
  else if (totalUtcMins >= 930 && totalUtcMins < 990) {
    activeSession = 'London Close / NY Session';
    activeKillZone = '⚡ London Fixing / Close';
    sessionStateNote = 'European traders square daily books; institutional rebalancing flows.';
  }
  // 16:30 to 18:30 UTC = NY Mid-Day
  else if (totalUtcMins >= 990 && totalUtcMins < 1110) {
    activeSession = 'New York Mid-Day';
    activeKillZone = 'NY Lunch Consolidation';
    sessionStateNote = 'Volume thins out during NY lunch. Beware chop and false breakouts.';
  }
  // 18:30 to 20:00 UTC = NY Power Hour (14:30 - 16:00 EST)
  else if (totalUtcMins >= 1110 && totalUtcMins < 1200) {
    activeSession = 'New York PM Session';
    activeKillZone = '⚡ Power Hour / Cash Close';
    sessionStateNote = 'Heavy volume into market on-close imbalances (MOC). Trend continuations.';
  }
  // 20:00 to 22:00 UTC = After Hours / Pacific Pre-Market
  else if (totalUtcMins >= 1200 && totalUtcMins < 1320) {
    activeSession = 'After-Hours / Pacific Open';
    activeKillZone = 'Sydney Opening Session';
    sessionStateNote = 'Australian/NZ liquidity entering. Crypto and forex transition.';
  }
  // 22:00 to 00:00 UTC = Sydney Session
  else if (totalUtcMins >= 1320 || totalUtcMins < 0) {
    activeSession = 'Sydney / Asian Pre-Market';
    activeKillZone = 'Sydney Active Session';
    sessionStateNote = 'Pacing picks up as Tokyo interbank desks prepare for 00:00 UTC open.';
  }
  // 00:00 to 07:00 UTC = Tokyo / Asian Session
  else if (totalUtcMins >= 0 && totalUtcMins < 420) {
    activeSession = 'Tokyo / Asian Session';
    activeKillZone = totalUtcMins < 120 ? '⚡ Tokyo Open Killzone' : 'Standard Asian Range';
    sessionStateNote = 'Consolidation and range-building; ideal for defining liquidity sweeps.';
  }
  // 07:00 to 12:00 UTC = London Morning Session (08:00 - 13:00 London time)
  else if (totalUtcMins >= 420 && totalUtcMins < 720) {
    activeSession = 'London Morning Session';
    activeKillZone = totalUtcMins < 600 ? '⚡ London Open Killzone' : 'London European Mid-Day';
    sessionStateNote = 'High expansion volatility. Frequently triggers breakout rallies or liquidity runs.';
  }

  // Calculate each financial hub's open status and local time
  const hubs = GLOBAL_HUBS.map((hub) => {
    let isOpen = false;
    const openMins = hub.openUtcHour * 60 + hub.openUtcMin;
    const closeMins = hub.closeUtcHour * 60 + hub.closeUtcMin;

    if (openMins < closeMins) {
      isOpen = totalUtcMins >= openMins && totalUtcMins < closeMins;
    } else {
      // Crosses midnight UTC (e.g. Sydney 21:00 to 06:00 UTC)
      isOpen = totalUtcMins >= openMins || totalUtcMins < closeMins;
    }

    const hubLocalTime = date.toLocaleTimeString([], {
      timeZone: hub.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    return {
      name: hub.name,
      city: hub.city,
      flag: hub.flag,
      isOpen,
      localTimeFormatted: hubLocalTime,
      statusText: isOpen ? 'Open' : 'Closed',
    };
  });

  return {
    utcTime: utcTimeStr,
    localTime: localTimeStr,
    localTimezone: localTzStr,
    nyTime: nyTimeStr,
    activeSession,
    activeKillZone,
    sessionStateNote,
    isOverlap,
    hubs,
  };
}

/**
 * Returns the matching MarketSession enum value for trade logging
 */
export function detectAutoMarketSession(date = new Date()): MarketSession {
  const utcHours = date.getUTCHours();
  const utcMins = date.getUTCMinutes();
  const totalUtcMins = utcHours * 60 + utcMins;

  // NY Open (13:30 - 16:00 UTC / 09:30 - 12:00 EST)
  if (totalUtcMins >= 810 && totalUtcMins < 960) {
    return 'Market Open (NY)';
  }
  // NY Mid-Day (16:00 - 19:00 UTC / 12:00 - 15:00 EST)
  if (totalUtcMins >= 960 && totalUtcMins < 1140) {
    return 'Mid-Day';
  }
  // NY Power Hour (19:00 - 20:00 UTC / 15:00 - 16:00 EST)
  if (totalUtcMins >= 1140 && totalUtcMins < 1200) {
    return 'Power Hour';
  }
  // After-Hours (20:00 - 23:00 UTC)
  if (totalUtcMins >= 1200 && totalUtcMins < 1380) {
    return 'After-Hours';
  }
  // Asian Session (23:00 - 07:00 UTC)
  if (totalUtcMins >= 1380 || totalUtcMins < 420) {
    return 'Asian Session';
  }
  // London Session (07:00 - 12:30 UTC)
  if (totalUtcMins >= 420 && totalUtcMins < 750) {
    return 'London Session';
  }
  // Pre-Market NY (12:30 - 13:30 UTC)
  if (totalUtcMins >= 750 && totalUtcMins < 810) {
    return 'Pre-Market';
  }

  return 'Market Open (NY)';
}
