"""Compact source hints and title families for unresolved-entry triage only."""
from collections import Counter, defaultdict
from difflib import SequenceMatcher
from html import unescape
import re


def entry_metadata(fragment):
    heading = re.search(r'<h3\b[^>]*>(.*?)</h3>',fragment,re.I|re.S)
    title = unescape(re.sub(r'<[^>]+>',' ',heading[1])) if heading else ''
    title = re.sub(r'^\s*X\s*\(\s*\d+\s*\)\s*=\s*','',title)
    features = []
    if re.search(r'\b(?:Barycentrics|Trilinears)\b',fragment,re.I):
        features.append('coordinates')
    if re.search(r'\blines?\s*:',fragment,re.I):
        features.append('line_description')
    return dict(title=re.sub(r'\s+',' ',title).strip(),source_features=features)


def normalized_title(title):
    title = re.sub(r'\bX\s*[\[(]\s*\d+\s*[\])]','X #',title,flags=re.I)
    title = re.sub(r'\b\d+(?:st|nd|rd|th)?\b','#',title,flags=re.I)
    return re.sub(r'[^\w#]+',' ',title.upper()).strip()


def title_groups(entries):
    """Heuristic families never create recipes or transfer source evidence."""
    grouped = defaultdict(list)
    for entry in entries:
        if key := normalized_title(entry.get('title','')):
            if key not in {'NAME PENDING','PENDING','NAME UNKNOWN'}:
                grouped[key].append(entry)
    keys = sorted(grouped)
    parent = {key:key for key in keys}
    def root(key):
        while parent[key] != key:
            parent[key] = parent[parent[key]]
            key = parent[key]
        return key
    # Shared opening words avoid comparisons between unrelated short titles.
    buckets = defaultdict(list)
    for key in keys:
        buckets[tuple(key.split()[:2])].append(key)
    for bucket in buckets.values():
        for i,key in enumerate(bucket):
            for other in bucket[i+1:]:
                if SequenceMatcher(None,key,other,autojunk=False).ratio() >= .9:
                    parent[root(other)] = root(key)
    families = defaultdict(list)
    for key,rows in grouped.items():
        families[root(key)].extend(rows)
    return [dict(normalized_title=key,ids=sorted(row['id'] for row in rows),
                 primary_counts=dict(Counter(row['primary'] for row in rows)))
            for key,rows in sorted(families.items(),key=lambda item:(-len(item[1]),item[0])) if len(rows)>1]
