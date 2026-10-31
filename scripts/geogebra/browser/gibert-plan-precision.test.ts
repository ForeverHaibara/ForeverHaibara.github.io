import {describe,it,expect} from 'vitest';
import {compileStudioPlan} from '../../../src/features/geogebra/commands/custom/commandCompiler';
import {enableExperimentalGibertCurve} from './gibert-experimental';
import {compareGibertResidual} from './gibert-residual';
import fixtures from './fixtures/gibert-pedal.json';

// Evaluate trusted compiler output only. This is not a native-rendering test.
const arithmetic=(text:string,values:Record<string,number>)=>Number(Function(...Object.keys(values),
  `return ${text.replace(/-\(([^()]*)\)\^(\d+)/gu,'-(($1)^$2)').replace(/\b([a-z]\w*)\^(\d+)\b/giu,'($1**$2)').replace(/\^/gu,'**')}`)(...Object.values(values)));
describe('compiled Gibert plans versus exact source fixtures',()=>{
  it.each([0,7,13,31,72,77,78,92,106])('checks every shape and boundary sample for Q%i',(id)=>{
    const key=`Q${String(id).padStart(3,'0')}`;
    enableExperimentalGibertCurve(key,true);
    const scope={objects:new Map([['A','point'],['B','point'],['C','point']] as const),macros:new Set<string>()};
    const plan=compileStudioPlan(`g=GibertCurve(A,B,C,${id})`,scope,'0123456789abcdef');
    const marker='ImplicitCurve(';
    const start=plan.output.indexOf(marker)+marker.length;
    let end=start,depth=1;
    for(;depth && end<plan.output.length;end++){
      if(plan.output[end]==='(')depth++;if(plan.output[end]===')')depth--;
    }
    expect(depth).toBe(0);
    const polynomial=plan.output.slice(start,end-1);
    const rejected:Array<{shape:string;point:number[];error:number}>=[];
    for(const shape of fixtures[key as keyof typeof fixtures]){
      const values:Record<string,number>={};
      for(const helper of plan.helpers){
        const expression=helper.expression.replace(/\b([xy])\(([ABC])\)/gu,(_,axis,vertex)=>
          `(${shape.vertices['ABC'.indexOf(vertex)][axis==='x'?0:1]})`);
        values[helper.name]=arithmetic(expression,values);
        expect(Number.isFinite(values[helper.name]),`${key}/${shape.name}/${helper.name}`).toBe(true);
      }
      const evaluate=([x,y]:number[])=>arithmetic(polynomial,{...values,x,y});
      const actual=shape.points.map(evaluate);
      const anchor=shape.expected.slice(0,4).reduce((best,v,i)=>Math.abs(v)>Math.abs(shape.expected[best])?i:best,0);
      const ratio=actual[anchor]/shape.expected[anchor];
      const scale=Math.max(...actual.slice(0,4).map(Math.abs));
      for(const [points,expected] of [[shape.points,shape.expected],[shape.vertices,shape.vertexExpected]] as const)
        points.forEach((point,i)=>{const result=compareGibertResidual(evaluate(point),expected[i]*ratio,scale);if(!result.accepted)rejected.push({shape:shape.name,point,error:result.normalizedError});});
    }
    if(id===106){
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected.every(sample=>sample.shape==='near-collinear' && sample.point[1]<-100)).toBe(true);
    }else expect(rejected,key).toEqual([]);
  });
});
