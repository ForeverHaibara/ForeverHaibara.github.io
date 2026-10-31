import { describe,expect,it } from 'vitest';
import { compileStudioPlan,compileStudioCommand } from '../../commandCompiler';
import { similarityCurveCircuits,RELATED_CURVE_BACKENDS,triangularBasis,rotateCurveCoefficients,translateCurveCoefficients } from '../../builders/relatedCurveBackends';
import records from '../../data/related-curves/curves.json';
import deferred from '../../data/related-curves/deferred.json';
import type { CommandEnvironment } from '../../types';

const scope=():CommandEnvironment=>({objects:new Map([['A','point'],['B','point'],['C','point']]),macros:new Set()});
describe('opt-in Gibert curve backends',()=>{
  it('keeps existing curves on their native-coefficient recipes and dispatches each opt-in explicitly',()=>{
    expect(compileStudioPlan('g=GibertCurve(A,B,C,12)',scope(),'0123456789abcdef').helpers.every(h=>h.kind==='number')).toBe(true);
    for(const identifier of Object.keys(similarityCurveCircuits)) {
      const id=Number(identifier.slice(1));
      const result=compileStudioPlan(`g=GibertCurve(A,B,C,${id})`,scope(),'0123456789abcdef');
      expect(result.materialized).toBe(true);expect(result.requiresMaterialization).toBe(true);
      expect(result.helpers.every(h=>h.kind==='number')).toBe(true);
      expect(result.helpers.length).toBeLessThan(240);
      const length=result.output.length+result.helpers.reduce((n,h)=>n+h.name.length+h.expression.length,0);
      expect(length,identifier).toBeLessThan(150_000);
      expect(result.output).toContain('ImplicitCurve');
      expect(result.output).not.toMatch(/CAS|Locus|Intersect|Orthocenter|TriangleCenter/u);
      expect(()=>compileStudioCommand(`GibertCurve(A,B,C,${id})`,scope())).toThrow('Medium or High');
      expect(compileStudioPlan(`g=GibertCurve(A,B,C,"${identifier}")`,scope(),'0123456789abcdef')).toEqual(result);
    }
    for(const record of records)if(record.backend)expect(RELATED_CURVE_BACKENDS[record.backend]).toBeDefined();
  });
  it('keeps numerically deferred definitions out of the production command catalogue',()=>{
    for(const record of deferred){
      expect(records.some(active=>active.id===record.id)).toBe(false);
      expect(similarityCurveCircuits[record.id]).toBeUndefined();
      expect(()=>compileStudioPlan(`g=GibertCurve(A,B,C,"${record.id}")`,scope(),'0123456789abcdef')).toThrow('not implemented');
    }
  });
  it('stores local coefficients independent of curve variables',()=>{
    for(const circuit of Object.values(similarityCurveCircuits)){
      for(const [,body] of circuit.scalars)expect(body).not.toMatch(/\b[xy]\b/u);
      for(const body of circuit.coefficients)expect(body).not.toMatch(/\b[xy]\b/u);
    }
  });
  it.each([7,8,9,10])('transforms arbitrary degree-%i polynomials by exact binomial identities',(degree)=>{
    const basis=triangularBasis(degree);
    const coefficients=basis.map((_,i)=>(i*13%17)-8);
    const evaluate=(expression:string)=>Number(Function(`return ${expression.replace(/\^/gu,'**')}`)());
    const polynomial=(cs:number[],x:number,y:number)=>basis.reduce((sum,[i,j],n)=>sum+cs[n]*x**i*y**j,0);
    for(const [ex,ey,ax,ay] of [[1,-1,1,1],[-1,1,-1,0],[1,0,0,0]]){
      const rotated=rotateCurveCoefficients(coefficients.map(String),basis,String(ex),String(ey)).map(evaluate);
      const world=translateCurveCoefficients(rotated.map(String),basis,String(ax),String(ay)).map(evaluate);
      for(const [x,y] of [[1,2],[-2,1],[0,-1]]){
        expect(polynomial(world,x,y)).toBe(polynomial(coefficients,ex*(x-ax)+ey*(y-ay),-ey*(x-ax)+ex*(y-ay)));
      }
    }
  });
});
