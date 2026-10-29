import { describe, expect, it, vi } from 'vitest';
import recipesJson from '../generated/relatedCurves.json';
import records from '../data/related-curves/curves.json';
import catalogue from '../data/related-curves/catalogue.json';
import { compileStudioCommand, compileStudioPlan } from '../commandCompiler';
import { createBindingCapture } from '../bindingPlan';
import { studioTools } from '../toolLibrary';
import { normalizeGibertId } from '../builders/relatedCurves';
import { executeCommandPipeline } from '../../commandPipeline';
import type { CommandEnvironment, ToolDefinition } from '../types';
import type { GeoGebraEngine } from '../../../types';

const scope = (): CommandEnvironment => ({objects: new Map([['A','point'],['B','point'],['C','point'],['n','number']]), macros: new Set()});
const plan = (id: string, mode: 'medium' | 'high' = 'medium') => compileStudioPlan(`out=GibertCurve(A,B,C,${id})`,scope(),'0123456789abcdef',mode);

describe('Gibert catalogue IDs and execution boundary', () => {
  it('compiles one selected recipe, with numeric and quoted literals sharing the implementation', () => {
    expect(plan('12')).toEqual(plan('"q012"'));
    expect(plan('((12))')).toEqual(plan('12'));
    expect(normalizeGibertId('2')).toBe('Q002');
    expect(normalizeGibertId('"Q035-A"')).toBe('Q035-A');
    const result = plan('39','high');
    expect(result.materialized).toBe(true);
    expect(result.requiresMaterialization).toBe(true);
    expect(result.helpers.every((h) => h.kind === 'number')).toBe(true);
    expect(result.helpers.length).toBeLessThan(80);
    expect(result.output).toContain('ImplicitCurve');
    expect(result.output).not.toContain('GibertCurve');
    expect(result.output).not.toMatch(/TriangleCenter|TriangleCurve|Sequence|Sum\(/u);
  });

  it('rejects nonliteral selectors and unsupported entries without sampling their values', () => {
    for (const id of ['n','6+6','12.0','1.2e1','floor(n)','012','0','-12','"Q012"+""'])
      expect(() => plan(id), id).toThrow(/literal/u);
    expect(() => plan('9007199254740993')).toThrow('Invalid Gibert');
    expect(() => plan('"Q035"')).toThrow('family');
    expect(() => plan('5')).toThrow('cubic');
    expect(() => plan('142')).toThrow('not implemented');
    expect(() => plan('"Q035-A"')).toThrow('not implemented');
    expect(() => plan('"arbitrary code"')).toThrow('Invalid Gibert');
  });

  it('keeps native commands and file-defined names authoritative', () => {
    expect(compileStudioCommand('TriangleCurve(A,B,C,(A-B)*(B-C)*(C-A)=0)',scope())).toBe('TriangleCurve(A,B,C,(A-B)*(B-C)*(C-A)=0)');
    const fileScope = scope(); fileScope.macros.add('gibertcurve');
    expect(compileStudioCommand('GibertCurve(A,B,C,n)',fileScope)).toBe('GibertCurve(A,B,C,n)');
  });

  it('preserves lexical ID provenance through hygienic compose bindings', () => {
    const wrapper: ToolDefinition = {name:'Example',description:'test',overloads:[{params:[{name:'A',type:'point'},{name:'B',type:'point'},{name:'C',type:'point'},{name:'id',type:'catalogId'}],returns:'implicitCurve',compose:'GibertCurve($A,$B,$C,$id)'}]};
    const tools = new Map<string,ToolDefinition>(studioTools); tools.set('example',wrapper);
    const capture = () => ({...createBindingCapture(),selected:[]});
    expect(compileStudioCommand('Example(A,B,C,"Q012")',scope(),tools,capture())).toContain('GGBBINDTOKEN');
    expect(() => compileStudioCommand('Example(A,B,C,n)',scope(),tools,capture())).toThrow('literal');
    const nativeWrapper = compileStudioPlan('f=LeftSide(GibertCurve(A,B,C,12))',scope(),'0123456789abcdef');
    expect(nativeWrapper.materialized).toBe(true);
    expect(nativeWrapper.output).toContain('LeftSide');
    expect(() => compileStudioPlan('Zip(GibertCurve(A,B,C,12),n,{1,2})',scope(),'0123456789abcdef')).toThrow('named numeric intermediates');
  });

  it('refuses known slow anonymous evaluation and unsafe output redefinition before mutation', async () => {
    expect(() => compileStudioCommand('GibertCurve(A,B,C,12)',scope())).toThrow('Medium or High');
    const executeCommand = vi.fn();
    const callApi = vi.fn(async (method: string, args: unknown[]) => {
      if (method === 'getAllObjectNames') return ['A','B','C','out'];
      if (method === 'getObjectType') return args[0] === 'out' ? 'implicitpoly' : 'point';
      if (method === 'getXML') return `<element type="point" label="${args[0]}"/>`;
      if (method === 'getFileJSON') return {archive:[]};
      throw new Error(`Unexpected API ${method}`);
    });
    const engine = {callApi,executeCommand} as unknown as GeoGebraEngine;
    const low = await executeCommandPipeline(engine,'GibertCurve(A,B,C,12)',{helperMode:'low'});
    expect(low.success).toBe(false); expect(low.error).toContain('Medium or High');
    const redefine = await executeCommandPipeline(engine,'out=GibertCurve(A,B,C,12)',{helperMode:'high'});
    expect(redefine.success).toBe(false); expect(redefine.error).toContain('new output label');
    expect(executeCommand).not.toHaveBeenCalled();
    expect(callApi.mock.calls.some(([method]) => ['getValue','getXcoord','getYcoord'].includes(method))).toBe(false);
  });
});

type Recipe = {locals: string[][];coefficients:string[];monomials:number[][];terms:Array<[number,number,string]>};
const recipes = recipesJson as unknown as Record<string,Recipe>;
// Test-only scalar evaluator for generated arithmetic. Production never uses eval.
const scalar = (text: string, values: Record<string,number>) => Number(Function(...Object.keys(values),`return ${text.replace(/\^/gu,'**')}`)(...Object.values(values)));
const reference = (id: string, side: number[], uvw: number[]) => {
  const sa = side.map((a,i) => (side[(i+1)%3]+side[(i+2)%3]-a)/2);
  const d = side.map((_,i) => side[(i+2)%3]*uvw[(i+1)%3]**2-side[(i+1)%3]*uvw[(i+2)%3]**2);
  return side.reduce((sum,a,i) => {
    const b=side[(i+1)%3],c=side[(i+2)%3],u=uvw[i],v=uvw[(i+1)%3],w=uvw[(i+2)%3];
    if (id==='Q002') return sum+a*a*sa[i]*(c*v*v-b*w*w)*v*w;
    if (id==='Q003') return sum+a*(sa[(i+1)%3]*v-sa[(i+2)%3]*w)*v*v*w*w;
    if (id==='Q012') return sum+a*v*w*(v-w)*(u*u-v*w);
    if (id==='Q033') return sum+a*sa[i]*(v*v-w*w)*v*w;
    return sum+(a*sa[i]-sa[(i+1)%3]*sa[(i+2)%3])*u*d[i]*4*uvw[0]*uvw[1]*uvw[2];
  },id==='Q039'?d[0]*d[1]*d[2]:0);
};

describe('offline curve coefficients versus independent barycentric definitions', () => {
  it('keeps the complete directory separate from the small supported database', () => {
    expect(catalogue).toHaveLength(203);
    expect(new Set(catalogue.map((r)=>r.id)).size).toBe(catalogue.length);
    expect(catalogue.find((r)=>r.id==='Q005')?.degree).toBe(3);
    expect(records.map((r)=>r.id)).toEqual(Object.keys(recipes));
  });

  it('reproduces the correct degree and world equation on general, reflected and transformed triangles', () => {
    for (const vertices of [ [[0,0],[6,0],[1,4]], [[-2,1],[5,2],[1,-3]], [[2,3],[1,7],[-4,4]], [[10,-7],[13,-7],[10.5,-5]] ]) {
      const side=vertices.map((_,i)=>{const b=vertices[(i+1)%3],c=vertices[(i+2)%3];return (b[0]-c[0])**2+(b[1]-c[1])**2;});
      const frame=vertices.flatMap((_,i)=>{const b=vertices[(i+1)%3],c=vertices[(i+2)%3];return [b[1]-c[1],c[0]-b[0],b[0]*c[1]-b[1]*c[0]];});
      for (const record of records) {
        const recipe=recipes[record.id];
        expect(recipe.monomials.every((m)=>m.reduce((a,b)=>a+b,0)===record.degree)).toBe(true);
        const values: Record<string,number> = {a2:side[0],b2:side[1],c2:side[2]};
        for (const [name,text] of recipe.locals) values[name]=scalar(text,values);
        recipe.coefficients.forEach((c,i)=>{values[`k${i}`]=scalar(c,values);});
        frame.forEach((v,i)=>{values[`p${i}`]=v;});
        const cs=recipe.terms.map(([, ,text])=>scalar(text,values));
        for (const [x,y] of [[.2,.3],[2,1],[-1,3],[4,-2]]) {
          const uvw=[0,1,2].map((i)=>frame[3*i]*x+frame[3*i+1]*y+frame[3*i+2]);
          const expected=reference(record.id,side,uvw);
          const contributions=recipe.terms.map(([i,j],k)=>cs[k]*x**i*y**j);
          const actual=contributions.reduce((a,b)=>a+b,0);
          const scale=Math.max(1,Math.abs(expected),contributions.reduce((a,b)=>a+Math.abs(b),0));
          expect(Math.abs(actual-expected)/scale,`${record.id} at ${x},${y}`).toBeLessThan(2e-12);
        }
      }
    }
  });
});
