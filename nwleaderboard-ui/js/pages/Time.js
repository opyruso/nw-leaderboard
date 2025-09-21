import LeaderboardPage from './LeaderboardPage.js';
import { LangContext } from '../i18n.js';

function toSeconds(value) {
  if (value === undefined || value === null || value === '') {
    return Number.NaN;
  }
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  const stringValue = String(value).trim();
  if (!stringValue) {
    return Number.NaN;
  }
  const timeParts = stringValue.split(':');
  if (timeParts.length >= 2 && timeParts.length <= 3 && timeParts.every((part) => part.trim().length > 0)) {
    const parts = timeParts.map((part) => Number(part));
    if (parts.every((part) => Number.isFinite(part))) {
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (parts.length === 3) {
        [hours, minutes, seconds] = parts;
      } else {
        [minutes, seconds] = parts;
      }
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  const numeric = Number(stringValue);
  if (Number.isFinite(numeric)) {
    return numeric;
  }
  return Number.NaN;
}

function formatTime(value) {
  if (value === undefined || value === null || value === '') {
    return '—';
  }
  if (typeof value === 'string') {
    const timeParts = value.split(':');
    if (timeParts.length >= 2 && timeParts.length <= 3) {
      const padded = timeParts.map((part) => part.padStart(2, '0'));
      while (padded.length < 3) {
        padded.unshift('00');
      }
      return `${padded[0]}:${padded[1]}:${padded[2]}`;
    }
  }
  const seconds = toSeconds(value);
  if (Number.isNaN(seconds)) {
    return String(value);
  }
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function Time() {
  const { t } = React.useContext(LangContext);

  const getValue = React.useCallback((entry) => {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    if (entry.time !== undefined && entry.time !== null) {
      return entry.time;
    }
    if (entry.duration !== undefined && entry.duration !== null) {
      return entry.duration;
    }
    if (entry.value !== undefined && entry.value !== null) {
      return entry.value;
    }
    return null;
  }, []);

  const formatValue = React.useCallback((value) => formatTime(value), []);

  const getSortValue = React.useCallback((entry) => toSeconds(entry.value), []);

  return (
    <LeaderboardPage
      mode="time"
      pageTitle={t.timeTitle}
      getValue={getValue}
      formatValue={formatValue}
      getSortValue={getSortValue}
      sortDirection="asc"
    />
  );
}
