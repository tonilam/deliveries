import { LoadRow } from './load.types';

export type LoadAddressKind = 'collection' | 'delivery' | 'xdock';

const ADDRESS_LABEL_SEP = ' — ';

export interface LoadAddressParts {
  name: string | null;
  line: string | null;
}

export function loadAddressParts(row: LoadRow, kind: LoadAddressKind): LoadAddressParts {
  const nameKey = `${kind}_business_name` as keyof LoadRow;
  const lineKey = `${kind}_address_line` as keyof LoadRow;
  const name = row[nameKey];
  const line = row[lineKey];

  if (typeof name === 'string' || typeof line === 'string') {
    return {
      name: typeof name === 'string' && name !== '' ? name : null,
      line: typeof line === 'string' && line !== '' ? line : null,
    };
  }

  const label = row[kind];
  if (!label) {
    return { name: null, line: null };
  }

  const sep = label.indexOf(ADDRESS_LABEL_SEP);
  if (sep === -1) {
    return { name: label, line: null };
  }

  return {
    name: label.slice(0, sep) || null,
    line: label.slice(sep + ADDRESS_LABEL_SEP.length) || null,
  };
}

export function loadAddressFilterText(row: LoadRow, kind: LoadAddressKind): string {
  const { name, line } = loadAddressParts(row, kind);
  return [name, line].filter(Boolean).join(' ');
}

export function loadAddressListText(row: LoadRow, kind: LoadAddressKind): string {
  const { name, line } = loadAddressParts(row, kind);
  if (!name && !line) {
    return '—';
  }
  if (name && line) {
    return `${name}\n${line}`;
  }
  return name ?? line ?? '—';
}
