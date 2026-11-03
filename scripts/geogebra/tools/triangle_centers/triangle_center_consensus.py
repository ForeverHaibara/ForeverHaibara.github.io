"""Read-only, dependency-aware property consensus for a requested ETC cohort.

Proposals are numerical evidence, not proofs or automatic source corrections.
They must pass the normal build before publication. No new recipe syntax.
"""
from __future__ import annotations

import argparse
from collections import ChainMap, Counter, defaultdict
from functools import lru_cache
import hashlib
from html import escape
from itertools import combinations, product
import json
import math
from pathlib import Path
import sys

import triangle_center_import as m
from triangle_center_diagnostics import normalized_title

TOLERANCE = 1e-7


def close(p, q, scale):
    return math.dist(p,q) <= TOLERANCE*max(scale,math.hypot(*p),math.hypot(*q))


def finite(p):
    return isinstance(p,tuple) and all(math.isfinite(v) for v in p)


def same_line(first, second, scale):
    p,d=first;q,v=second
    return (abs(d[0]*v[1]-d[1]*v[0]) <= TOLERANCE*math.hypot(*d)*math.hypot(*v)
            and abs(d[0]*(q[1]-p[1])-d[1]*(q[0]-p[0])) <= TOLERANCE*scale*math.hypot(*d))


@m.stage
def coordinate_snapshot(records,atlas,directions,cache_dir):
    """Cache numeric positions only, never votes, decisions or graph selection."""
    if cache_dir is None:return m.numeric_coordinates(records,atlas,directions)
    digest=hashlib.sha256('\n'.join(records[n].row() for n in sorted(records)).encode())
    digest.update(json.dumps([atlas,directions],sort_keys=True).encode())
    digest.update(m.support.extraction_source_fingerprint(Path(m.__file__).read_text(encoding='utf-8'),
                                                        roots=('numeric_coordinates',)).encode())
    digest.update(Path(m.__file__).with_name('triangle_center_coordinates.py').read_bytes())
    key=digest.hexdigest();path=cache_dir/f'{key}.json.gz'
    cached=m.support.read_cache(path)
    if isinstance(cached,dict) and cached.get('schema')==1 and cached.get('key')==key:
        try:
            positions={s:{int(n):(m.Ideal(*p['ideal']) if isinstance(p,dict) else tuple(p))
                          for n,p in ps.items()} for s,ps in cached['positions'].items()}
            if set(positions)!=set(atlas['triangles']):raise ValueError('cache shapes differ')
            if any((not all(math.isfinite(v) for v in (p.dx,p.dy)) or math.hypot(p.dx,p.dy)==0)
                   if isinstance(p,m.Ideal) else not finite(p) for ps in positions.values() for p in ps.values()):
                raise ValueError('cache has invalid coordinates')
        except (KeyError,ValueError,TypeError):pass
        else:
            m.report('consensus-coordinate-cache',hit=True,key=key)
            return positions
    m.report('consensus-coordinate-cache',hit=False,key=key)
    positions=m.numeric_coordinates(records,atlas,directions)
    payload={s:{n:(dict(ideal=[p.dx,p.dy]) if isinstance(p,m.Ideal) else p) for n,p in ps.items()} for s,ps in positions.items()}
    m.support.write_cache(path,dict(schema=1,key=key,positions=payload))
    return positions


@lru_cache(maxsize=4096)
def pending_geometry(number,title):
    if not title or normalized_title(title) in {'NAME PENDING','PENDING','NAME UNKNOWN'}:
        return False
    header=f'<h3>X({number}) = {escape(title)}</h3>'
    parsed=m.extract_entry(number,header,0,compact=True)
    return not bool(parsed.explicit if isinstance(parsed,m.RecipeCandidates) else parsed)


def dependency_weights(properties):
    """One total vote per connected shared-upstream component / formula family.

    Native-only independent lines keep separate votes. This is selected-DAG
    provenance, not a claim of mathematical independence of ETC statements.
    """
    parent=list(range(len(properties)))
    def root(i):
        while parent[i]!=i:
            parent[i]=parent[parent[i]];i=parent[i]
        return i
    owners={}
    for i,p in enumerate(properties):
        keys=[('upstream',n) for n in p['upstream']]
        if p.get('refs'):keys.append(('inputs',tuple(sorted(p['refs']))))
        if p['kind']=='coordinate':keys.append(('family','coordinates'))
        for key in keys:
            if key in owners:parent[root(i)]=root(owners[key])
            owners[key]=i
    counts=Counter(root(i) for i in range(len(properties)))
    return [1/counts[root(i)] for i in range(len(properties))]


def parallel_bound(properties, weights, shapes):
    """Conservative shared-line weight bound, O(n log n) per sample.

    Two different points can share only one geometric line on any sample
    where they differ. All near-parallel lines are included in this bound,
    including distinct offsets; this deliberately overestimates shared votes.
    """
    maximum=0
    for shape in shapes:
        angles=sorted((math.atan2(p['values'][shape][1][1],p['values'][shape][1][0])%math.pi,w)
                      for p,w in zip(properties,weights) if p['kind']=='line')
        extended=angles+[(a+math.pi,w) for a,w in angles]
        end=0;total=0
        for start in range(len(angles)):
            while end<start+len(angles) and extended[end][0]-extended[start][0]<=2e-6:
                total+=extended[end][1];end+=1
            maximum=max(maximum,total);total-=extended[start][1]
    return maximum


def admission_reason(graph,recipe,native_ideal):
    """Explain structural rejection separately from numerical/source evidence."""
    affected=graph.descendants({recipe.number})
    overlay=ChainMap({recipe.number:recipe},graph.records)
    try:metrics=graph._compute(affected,overlay)
    except ValueError as error:
        return 'cyclic_dependency' if 'Cyclic' in str(error) else 'missing_dependency'
    if graph.bad-affected:return 'preexisting_graph_budget_violation'
    for depth,length,conjugates in metrics.values():
        if depth>graph.limits[0]:return 'depth_budget'
        if graph.limits[1] is not None and length>graph.limits[1]:return 'length_budget'
        if conjugates>graph.limits[2]:return 'conjugate_budget'
    try:
        for target in affected:m.validate_recipe_inputs(overlay[target],overlay,native_ideal)
    except ValueError:return 'input_type'
    return None


def choose(properties, initial, scales, number):
    """Find point clusters; prune line pairs only with a dominance bound."""
    shapes=tuple(scales);first=shapes[0]
    weights=dependency_weights(properties)
    line_total=sum(w for p,w in zip(properties,weights) if p['kind']=='line')
    nonline_total=sum(weights)-line_total
    shared_bound=parallel_bound(properties,weights,shapes)
    groups=[];buckets=defaultdict(list)
    def key(points):
        x,y=points[first];s=scales[first];norm=math.hypot(x/s,y/s,1)
        return tuple(math.floor(v/(8*TOLERANCE)) for v in (x/s/norm,y/s/norm,1/norm))
    def add(points, recipe):
        if not all(finite(points.get(s)) for s in shapes):return
        cell=key(points)
        for offset in product((-1,0,1),repeat=3):
            for index in buckets.get(tuple(a+b for a,b in zip(cell,offset)),()):
                group=groups[index]
                if all(close(points[s],group['points'][s],scales[s]) for s in shapes):
                    if recipe and all(recipe.row()!=r.row() for r in group['recipes']):group['recipes'].append(recipe)
                    return
        matches=[]
        for prop in properties:
            if prop['kind']=='line':
                def on_line(s):
                    base,d=prop['values'][s];p=points[s]
                    distance=abs(d[0]*(p[1]-base[1])-d[1]*(p[0]-base[0]))/math.hypot(*d)
                    return distance<=TOLERANCE*max(scales[s],math.hypot(*p))
                matches.append(all(on_line(s) for s in shapes))
            else:matches.append(all(close(points[s],prop['values'][s],scales[s]) for s in shapes))
        group=dict(points=points,recipes=[recipe] if recipe else [],matches=matches,
                   score=sum(w for w,yes in zip(weights,matches) if yes),
                   line_score=sum(w for p,w,yes in zip(properties,weights,matches) if yes and p['kind']=='line'))
        buckets[cell].append(len(groups));groups.append(group)
    for points,recipe in initial:add(points,recipe)
    def certified():
        return any(g['line_score'] > line_total-g['line_score']+shared_bound+nonline_total+1e-9 for g in groups)
    lines=[p for p in properties if p['kind']=='line']
    possible=len(lines)*(len(lines)-1)//2;examined=0
    if not certified():
        for a,b in combinations(lines,2):
            examined+=1
            points={s:m.numeric_intersection([a['endpoints'][s][0],a['endpoints'][s][1],
                                               b['endpoints'][s][0],b['endpoints'][s][1]]) for s in shapes}
            shared=set(a['refs'])&set(b['refs'])
            recipe=(m.Recipe(number,'M',(next(iter(shared)),)*2) if len(shared)==1 else
                    m.Recipe(number,'J',(*a['refs'],*b['refs'])))
            add(points,recipe)
            if certified():break
            if examined%5000==0:m.report('consensus-pairs',id=number,examined=examined,possible=possible,clusters=len(groups))
    groups.sort(key=lambda g:-g['score'])
    pruned=examined<possible and certified()
    unseen_bound=(line_total-groups[0]['line_score']+shared_bound+nonline_total) if pruned and groups else 0
    construction_pairs=0
    if groups:
        winner=groups[0]
        supporting=[p for p,yes in zip(properties,winner['matches']) if yes and p['kind']=='line']
        # The location is already determined. Find a cheap four-point recipe
        # without enumerating alternative locations or demanding an optimum.
        for a,b in combinations(supporting,2):
            construction_pairs+=1
            points={s:m.numeric_intersection([*a['endpoints'][s],*b['endpoints'][s]]) for s in shapes}
            if all(finite(points[s]) and close(points[s],winner['points'][s],scales[s]) for s in shapes):
                shared=set(a['refs'])&set(b['refs'])
                recipe=(m.Recipe(number,'M',(next(iter(shared)),)*2) if len(shared)==1 else
                        m.Recipe(number,'J',(*a['refs'],*b['refs'])))
                if all(recipe.row()!=r.row() for r in winner['recipes']):winner['recipes'].append(recipe)
                break
    return groups,weights,dict(possible_pairs=possible,examined_pairs=examined,
                              dominance_bound=certified(),unseen_score_bound=unseen_bound,
                              construction_pairs=construction_pairs,
                              total_vote_weight=sum(weights))


class Review:
    def __init__(self, records, atlas, directions, fragments, seeds=(),coordinates=None):
        self.records=records;self.atlas=atlas;self.directions=directions;self.fragments=fragments;self.seeds=set(seeds)
        self.coordinates=coordinates if coordinates is not None else m.numeric_coordinates(records,atlas,directions)
        self.scales={s:max(math.dist(abc[i],abc[(i+1)%3]) for i in range(3)) for s,abc in atlas['triangles'].items()}
        self.shapes=tuple(self.scales)
        self._ancestors={};self._source_views={}

    def ancestors(self,n):
        if n<=m.NATIVE_MAX or n not in self.records:return frozenset()
        if n not in self._ancestors:
            self._ancestors[n]=frozenset({n}).union(*(self.ancestors(ref) for ref in self.records[n].references))
        return self._ancestors[n]

    def upstream(self,refs):
        return set().union(*(self.ancestors(ref) for ref in refs))

    def source_view(self,n):
        if n in self._source_views:return self._source_views[n]
        fragment=self.fragments[n]
        extracted=m.extract_entry(n,fragment,0,compact=True)
        options=extracted.explicit if isinstance(extracted,m.RecipeCandidates) else extracted
        self._source_views[n]=m.listed_lines(n,m.relation_lines(fragment),limit=None),options,m.entry_metadata(fragment)
        return self._source_views[n]

    def audit(self,n):
        fragment=self.fragments.get(n)
        if fragment is None:return dict(id=n,status='missing_source')
        if n in self.records and self.records[n].operation=='I':
            return self.audit_ideal(n)
        properties=[];initial=[];ignored=Counter()
        current={s:self.coordinates[s].get(n) for s in self.shapes}
        if all(finite(p) for p in current.values()):initial.append((current,self.records.get(n)))
        lines,options,metadata=self.source_view(n)
        for refs in lines:
            upstream=self.upstream(refs)
            if n in upstream:ignored['circular_line']+=1;continue
            endpoints={s:[self.coordinates[s].get(ref) for ref in refs] for s in self.shapes}
            if any(any(p is None for p in ps) for ps in endpoints.values()):ignored['unavailable_line']+=1;continue
            values={s:m.line_data(*ps) for s,ps in endpoints.items()}
            if any(line is None for line in values.values()):ignored['degenerate_line']+=1;continue
            if any(p['kind']=='line' and all(same_line(values[s],p['values'][s],self.scales[s]) for s in self.shapes) for p in properties):
                ignored['duplicate_line']+=1;continue
            properties.append(dict(kind='line',refs=refs,upstream=upstream,values=values,endpoints=endpoints,label=str(refs)))
        seen=set()
        for recipe in options:
            if recipe.row() in seen:continue
            seen.add(recipe.row())
            upstream=self.upstream(recipe.references)
            if n in upstream:ignored['circular_relation']+=1;continue
            if any(ref>m.NATIVE_MAX and ref not in self.records for ref in recipe.references):ignored['unclosed_relation']+=1;continue
            # Line-pair intersections are already represented by their two
            # incidences, not an extra independent vote for the same text.
            duplicate_intersection=(recipe.operation=='J' and all(tuple(sorted(pair)) in lines
                                    for pair in (recipe.references[:2],recipe.references[2:])))
            if recipe.operation=='I':ignored['ideal_relation']+=1;continue
            if recipe.operation=='B' and not recipe.references and not m.homogeneous_degree(recipe.formula)[0]:
                ignored['nonhomogeneous_coordinate']+=1;continue
            try:
                m.validate_recipe_inputs(recipe,self.records,set(self.directions))
                values=m.numeric_coordinates({n:recipe},self.atlas,self.directions,
                                             cached=self.coordinates,dirty={n},overlay=True)
                points={s:values[s].get(n) for s in self.shapes}
            except (ValueError,KeyError,OverflowError,ZeroDivisionError):
                ignored['invalid_relation']+=1;continue
            if not all(finite(p) for p in points.values()):ignored['partial_or_undefined_relation']+=1;continue
            initial.append((points,recipe))
            if duplicate_intersection:
                ignored['intersection_already_in_lines']+=1;continue
            kind='coordinate' if recipe.operation=='B' and not recipe.references else recipe.operation
            if kind=='coordinate' and any(p['kind']=='coordinate' and all(
                    close(points[s],p['values'][s],self.scales[s]) for s in self.shapes) for p in properties):
                ignored['duplicate_coordinate']+=1;continue
            properties.append(dict(kind=kind,refs=recipe.references,upstream=upstream,values=points,label=recipe.row()))
        groups,weights,metrics=choose(properties,initial,self.scales,n)
        row=dict(id=n,**metadata,current=self.records[n].row() if n in self.records else None,
                 ignored=dict(ignored),metrics=metrics,evidence_count=len(properties))
        if not groups:return dict(row,status='no_finite_candidate')
        winner=groups[0];runner=max(groups[1]['score'] if len(groups)>1 else 0,metrics['unseen_score_bound'])
        same_current=all(finite(current[s]) and close(current[s],winner['points'][s],self.scales[s]) for s in self.shapes)
        recipes=winner['recipes']
        def cost(r):return (*m.quality(r),len(r.row()),m.operation_priority(r),r.references)
        recipes=sorted(recipes,key=cost);chosen=recipes[0] if recipes else None
        strong=(winner['score']>sum(weights)/2+1e-9 and winner['score']>=2-1e-9 and winner['score']-runner>=1-1e-9)
        reason=('strict_majority_with_margin' if strong else
                'no_strict_majority' if winner['score']<=sum(weights)/2+1e-9 else
                'insufficient_independent_weight' if winner['score']<2-1e-9 else 'insufficient_margin')
        status=('confirmed' if same_current and strong else 'consistent_weak' if same_current else
                'reviewed_seed_conflict' if n in self.seeds else 'proposal' if strong and chosen else 'ambiguous')
        row.update(status=status,decision_reason=reason,proposed=chosen.row() if chosen else None,score=winner['score'],
                   alternatives=[r.row() for r in recipes],
                   runner_score=runner,support_fraction=winner['score']/sum(weights) if weights else 0,
                   samples=winner['points'],current_samples=current,
                   supporting=[dict(kind=p['kind'],label=p['label'],weight=w) for p,w,yes in zip(properties,weights,winner['matches']) if yes],
                   opposing=[dict(kind=p['kind'],label=p['label'],weight=w) for p,w,yes in zip(properties,weights,winner['matches']) if not yes])
        row['pending_geometry']=pending_geometry(n,row['title'])
        return row

    def audit_ideal(self,n):
        """Incidence at infinity is a direction test, not a distant finite point."""
        lines,_,metadata=self.source_view(n)
        vectors={s:self.coordinates[s].get(n) for s in self.shapes}
        base=dict(id=n,**metadata,current=self.records[n].row(),
                  source_is_ideal=m.is_infinite_entry(n,m.relation_lines(self.fragments[n])))
        if not all(isinstance(p,m.Ideal) for p in vectors.values()):
            return dict(base,status='ideal_direction_unavailable')
        supported=[];opposing=[];ignored=Counter()
        for refs in lines:
            if n in self.upstream(refs):ignored['circular_line']+=1;continue
            endpoints={s:[self.coordinates[s].get(ref) for ref in refs] for s in self.shapes}
            if any(any(p is None for p in ps) for ps in endpoints.values()):ignored['unavailable_line']+=1;continue
            affine={s:m.line_data(*ps) for s,ps in endpoints.items()}
            if any(line is None for line in affine.values()):ignored['non_affine_or_degenerate_line']+=1;continue
            agrees=all(abs(line[1][0]*vectors[s].dy-line[1][1]*vectors[s].dx)
                       <= TOLERANCE*math.hypot(*line[1])*math.hypot(vectors[s].dx,vectors[s].dy)
                       for s,line in affine.items())
            (supported if agrees else opposing).append(refs)
        status=('confirmed_ideal' if supported and not opposing else
                'ideal_direction_outliers' if supported else
                'ideal_direction_conflict' if opposing else 'ideal_direction_unavailable')
        return dict(base,status=status,direction_support=len(supported),direction_compared=len(supported)+len(opposing),
                    opposing_lines=opposing,ignored=dict(ignored))

    @m.stage
    def settle(self,ids):
        """Fix independent roots in memory, then re-vote affected positions.

        A node is provisionally locked after its first accepted change, so
        rounds terminate without oscillating. Later contrary majorities are
        reported as conflicts, never silently overriding reviewed decisions.
        """
        graph=m.SelectedGraph(self.records,m.NATIVE_MAX,m.estimated_recipe_length,(6,None,1),
            lambda r,rs:m.validate_recipe_inputs(r,rs,set(self.directions)))
        updates=[];rounds=[];initial=None;blocked={}
        while True:
            rows=[self.audit(n) for n in sorted(ids)]
            if initial is None:initial=rows
            proposals={r['id']:r for r in rows if r['status']=='proposal'}
            roots=[]
            for n,row in proposals.items():
                if (self.ancestors(n)-{n})&proposals.keys():continue
                alternatives=[from_row(text) for text in row['alternatives']]
                alternatives=[r for r in alternatives if not self.upstream(r.references)&proposals.keys()]
                if alternatives:roots.append((n,row,alternatives))
            changed=[]
            for n,row,alternatives in roots:
                snapshot=None;screen_reason=None
                def screen(records,affected):
                    nonlocal snapshot,screen_reason
                    snapshot=m.numeric_coordinates(records,self.atlas,self.directions,
                        cached=self.coordinates,dirty=affected)
                    for s in self.shapes:
                        for target in affected:
                            old=self.coordinates[s].get(target);new=snapshot[s].get(target)
                            if old is not None and new is None:
                                screen_reason='new_numeric_failure';return False
                            if old is not None and isinstance(old,m.Ideal)!=isinstance(new,m.Ideal):
                                screen_reason='numeric_type_change'
                                return False
                    return True
                recipe=None;reasons=set()
                for candidate in alternatives:
                    reason=admission_reason(graph,candidate,set(self.directions))
                    if reason:reasons.add(reason);continue
                    screen_reason=None
                    if graph.replace(candidate,screen):recipe=candidate;break
                    reasons.add(screen_reason or 'graph_rejected')
                if recipe is None:
                    blocked[n]=sorted(reasons);continue
                blocked.pop(n,None)
                self.coordinates=snapshot;self._ancestors.clear();self.seeds.add(n)
                updates.append(dict(id=n,before=row['current'],after=recipe.row(),review=dict(row,proposed=recipe.row())))
                changed.append(n)
            rounds.append(dict(proposals=len(proposals),accepted_roots=changed))
            m.report('consensus-round',round=len(rounds),proposals=len(proposals),accepted=changed)
            if not changed:break
        initial_by_id={r['id']:r for r in initial}
        pending=[]
        for row in rows:
            before=initial_by_id[row['id']]
            if (row.get('pending_geometry') and row['status']=='confirmed'
                    and before.get('current_samples') and any(
                        not finite(before['current_samples'].get(s)) or not close(
                            before['current_samples'][s],row['current_samples'][s],self.scales[s]) for s in self.shapes)):
                pending.append(row)
        for row in rows:
            if row['id'] in blocked:row['application_blocked']=blocked[row['id']]
        return rows,dict(applied_in_memory=updates,rounds=rounds,pending_geometry=pending)


def from_row(row):
    fields=row.split();n=int(fields[0]);op=fields[1]
    if op=='B':return m.Recipe(n,op,tuple(map(int,fields[2:-1])),formula=fields[-1])
    if op=='F':
        pairs=[f.split(':') for f in fields[2:]]
        return m.Recipe(n,op,tuple(int(p[0]) for p in pairs),formula='|'.join(p[1] for p in pairs))
    return m.Recipe(n,op,tuple(map(int,fields[2:])))


def write_markdown(rows,path,updates=(),pending=None):
    text='# TriangleCenter 批量性质审阅\n\n数值多数用于暂定选择，不等同几何证明。共享上游/坐标变体已降重；自身下游、未定义与部分样本证据不投反对票。候选须再通过正式构建。\n\n'
    proposals=[u['review'] for u in updates]+[r for r in rows if r['status']=='proposal']
    for title,subset in [('多数支持的变更建议',proposals),
                         ('仍待核验的文字几何定义与坐标',pending if pending is not None else [r for r in proposals if r.get('pending_geometry')]),
                         ('无法判定或与已审阅种子冲突',[r for r in rows if r['status'] in {'ambiguous','reviewed_seed_conflict'}])]:
        text+=f'## {title}\n\n| 点 | 标题 | 建议 | 支持/总权重 | 次选权重 |\n| --- | --- | --- | --- | --- |\n'
        for r in subset:
            recipe=r.get('proposed') or ''
            if len(recipe)>150:recipe=recipe.split()[1]+'（完整公式见 JSON）'
            text+=f"| {r['id']} | {r['title'].replace('|','/')} | `{recipe}` | {r.get('score',0):.3g}/{r['metrics']['total_vote_weight']:.3g} | {r.get('runner_score',0):.3g} |\n"
        text+='\n'
    ideals=[r for r in rows if r['status'].startswith('ideal_direction_')]
    if ideals:
        text+='## 理想方向待核验\n\n| 点 | 状态 | 支持/可比较线 | 反对线 |\n| --- | --- | --- | --- |\n'
        for r in ideals:
            text+=f"| {r['id']} | {r['status']} | {r.get('direction_support',0)}/{r.get('direction_compared',0)} | {r.get('opposing_lines',[])} |\n"
        text+='\n'
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(text,encoding='utf-8')


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--ids',type=int,nargs='+',default=[])
    parser.add_argument('--from-report',type=Path,action='append',default=[],help='Add IDs from entries/checks/intersection_title_hints in diagnostic JSON')
    parser.add_argument('--upstream',action='store_true',help='Also audit selected extended ancestors, without a depth cutoff')
    parser.add_argument('--settle',action='store_true',help='Re-vote after provisional root repairs IN MEMORY; never writes seeds or chunks')
    parser.add_argument('--no-coordinate-cache',action='store_true')
    parser.add_argument('--report',type=Path,required=True)
    parser.add_argument('--markdown',type=Path)
    args=parser.parse_args()
    records={n:r for p in (m.DATA/'chunks').glob('*.txt') for n,r in m.read_recipes(p).items()}
    skipped={};domains={};seeds=m.read_recipes(m.DATA/'seeds.txt',skipped,domains)
    ids=set(args.ids)
    for path in args.from_report:
        data=json.loads(path.read_text(encoding='utf-8'))
        for field in ['entries','checks','intersection_title_hints']:
            for row in data.get(field,[]):
                if isinstance(row,dict) and isinstance(row.get('id'),int):ids.add(row['id'])
    if not ids:parser.error('Use --ids or --from-report')
    requested=sorted(ids);pending=list(ids)
    if args.upstream:
        while pending:
            n=pending.pop()
            for ref in records[n].references if n in records else ():
                if ref>m.NATIVE_MAX and ref not in ids:ids.add(ref);pending.append(ref)
    ids={n for n in ids if n>m.NATIVE_MAX and n not in skipped and domains.get(n)!='nonreal'}
    fragments={};parts={}
    for part in range(1,38):
        source=m.prepare_source(part,(m.CACHE/f'sources/ETCPart{part}.html').read_text(encoding='utf-8',errors='replace'))
        for n,f in m.split_entries(source):
            if n in ids:
                if n in fragments:raise ValueError(f'Duplicate reviewed source X({n})')
                fragments[n]=f;parts[n]=part
    atlas=m.read_native_atlas(m.CACHE/'native/native-atlas.json')
    directions=m.read_native_status(m.DATA/'native-status.txt')[1]
    coordinates=coordinate_snapshot(records,atlas,directions,None if args.no_coordinate_cache else m.CACHE/'review-cache/coordinates')
    review=Review(records,atlas,directions,fragments,seeds,coordinates)
    extra={};rows=[]
    if args.settle:rows,extra=review.settle(ids)
    else:
        for i,n in enumerate(sorted(ids)):
            rows.append(review.audit(n))
            if i%20==0:m.report('consensus',completed=i+1,total=len(ids),id=n)
    digest=hashlib.sha256()
    for path in sorted((m.DATA/'chunks').glob('*.txt')):digest.update(path.read_bytes())
    result=dict(requested=requested,upstream=args.upstream,read_only=True,**extra,summary=dict(Counter(r['status'] for r in rows)),
                entries=rows,provenance=dict(samples=list(review.shapes),runtime_sha256=digest.hexdigest(),
                    python=sys.version.split()[0],parts=sorted(set(parts.values())),
                    review_script_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                    importer_sha256=hashlib.sha256(Path(m.__file__).read_bytes()).hexdigest(),
                    atlas_sha256=hashlib.sha256((m.CACHE/'native/native-atlas.json').read_bytes()).hexdigest(),
                    seeds_sha256=hashlib.sha256((m.DATA/'seeds.txt').read_bytes()).hexdigest(),
                    cohort_source_sha256=hashlib.sha256(''.join(fragments[n] for n in sorted(fragments)).encode()).hexdigest(),
                    proposal_limits=dict(max_depth=6,max_length=None,max_conjugates=1)))
    args.report.parent.mkdir(parents=True,exist_ok=True)
    args.report.write_text(json.dumps(result,ensure_ascii=False,indent=2,
        default=lambda p:dict(ideal=[p.dx,p.dy])),encoding='utf-8')
    if args.markdown:write_markdown(rows,args.markdown,extra.get('applied_in_memory',()),extra.get('pending_geometry'))
    print(json.dumps(result['summary']))


if __name__=='__main__':main()
