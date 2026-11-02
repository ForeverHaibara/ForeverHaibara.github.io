"""Compact source hints for coverage triage and intersection-title review."""
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


def intersection_title_hints(candidates, metadata, records):
    """Structural review hints, including covered points; never rewrite a line.

    Uses the retained incidence families, not an exhaustive full-source audit.
    A shared endpoint with a changed partner is suspicious, but could also
    reflect an alias or a bad listed line, so this is not an error verdict.
    """
    point=r'X\s*\(\s*(\d+)\s*\)'
    pattern=re.compile(rf'{point}\s*{point}\s*∩\s*{point}\s*{point}[\s.;]*',re.I)
    output=[]
    for number,options in candidates.items():
        title=metadata.get(number,{}).get('title','')
        match=pattern.fullmatch(title)
        if not match:
            continue
        refs=tuple(map(int,match.groups()))
        pairs={tuple(sorted(pair)) for pair in getattr(options,'lines',())}
        changes=[]
        for pair in (tuple(sorted(refs[:2])),tuple(sorted(refs[2:]))):
            if pair in pairs:
                continue
            for listed in sorted(pairs):
                shared=set(pair)&set(listed)
                if len(shared)==1:
                    changes.append(dict(title_line=pair,listed_line=listed,shared_endpoint=next(iter(shared))))
        if changes:
            output.append(dict(id=number,title=title,selected=number in records,possible_endpoint_conflicts=changes))
    return sorted(output,key=lambda row:row['id'])


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
