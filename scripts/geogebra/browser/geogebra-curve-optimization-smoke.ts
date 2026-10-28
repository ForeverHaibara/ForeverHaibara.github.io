import { GeoGebraEmbeddingAdapter } from '../../../src/features/geogebra/adapters/GeoGebraEmbeddingAdapter';
import { executeCommandPipeline } from '../../../src/features/geogebra/commands/commandPipeline';
import { verifyCubic } from './geogebra-cubic-smoke';
import { qaCu1Coefficients } from '../../../src/features/geogebra/commands/custom/builders/triangleCubics';

const engine = new GeoGebraEmbeddingAdapter();
const results = document.querySelector<HTMLPreElement>('#results')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
let initialized = false;
const report = (message: string) => { results.textContent += `${message}\n`; status.textContent = message; document.title = message.slice(0, 100); };
const api = (name: string, ...args: unknown[]) => engine.callApi(name, args);
const initialize = async () => {
  if (!initialized) { await engine.initialize(document.querySelector<HTMLDivElement>('#canvas')!); initialized = true; }
};
document.querySelector<HTMLButtonElement>('#probe')!.onclick = async () => {
  try {
    await initialize();
    for (const command of document.querySelector<HTMLTextAreaElement>('#commands')!.value.split('\n').filter(Boolean)) {
      report(`RUN ${command}`); await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const result = await executeCommandPipeline(engine, command);
      report(`${command}: ${JSON.stringify(result)}`);
      for (const name of result.labels ?? []) report(`${name}: ${await api('getObjectType', name)} / ${await api('getValueString', name)}`);
    }
  } catch (error) { report(`FAIL ${String(error)}`); }
};
document.querySelector<HTMLButtonElement>('#run')!.onclick = async () => {
  const button = document.querySelector<HTMLButtonElement>('#run')!;
  button.disabled = true; results.textContent = '';
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); report(`PASS ${message}`); };
  const value = async (s: string) => Number(await api('getValue', s));
  const run = async (s: string) => {
    const labels: string[] = [];
    for (const statement of s.split('\n').filter(Boolean)) {
      report(`RUN ${statement.slice(0, 100)}`);
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
      const result = await executeCommandPipeline(engine, statement);
      if (!result.success) throw new Error(`${statement}: ${result.error}\n${result.expandedCommand}`);
      for (const label of result.labels) await api('setVisible', label, false);
      labels.push(...result.labels);
    }
    return labels;
  };
  const type = async (label: string, expected: string) => check(String(await api('getXML', label)).includes(`type="${expected}"`), `${label} keeps ${expected} class`);
  const conicValues = async (label: string) => Promise.all(Array.from({ length: 6 }, (_, i) => value(`Element(Coefficients(${label}),${i + 1})`)));
  const near = async (s: string, message: string) => check(Math.abs(await value(s)) < 1e-6, message);
  const proportional = (a: number[], b: number[]) => {
    const sa = Math.max(...a.map(Math.abs)); const sb = Math.max(...b.map(Math.abs));
    const index = b.findIndex((v) => Math.abs(v) > sb / 2); const sign = Math.sign(a[index] * b[index]);
    return sa > 0 && sb > 0 && a.every((v, i) => Math.abs(v/sa - sign*b[i]/sb) < 2e-6);
  };
  const samePolynomial = async (label: string, expression: string, degree: number) => {
    // The reference is a function: constructing another high-degree curve here
    // would spend most of this algebra check plotting an unnecessary object.
    await run(`actualFunction=LeftSide(${label})-RightSide(${label})\nreferenceFunction(x,y)=${expression}`);
    const a: number[] = []; const b: number[] = [];
    for (let i = 0; i <= degree; i++) for (let j = 0; j <= degree - i; j++) {
      const x = i / 2 - 0.7; const y = j / 2 + 0.2;
      a.push(await value(`actualFunction(${x},${y})`)); b.push(await value(`referenceFunction(${x},${y})`));
    }
    check(proportional(a, b), `${label} matches independent degree-${degree} polynomial`);
  };
  try {
    report('Initializing'); await initialize(); report('Resetting'); await api('newConstruction');
    await api('setCoordSystem',-5,8,-4,6);
    report(`GeoGebra ${await api('getVersion')}`);
    const group = new URLSearchParams(location.search).get('group') ?? 'curves';
    if (group === 'cubic') { await verifyCubic(engine, report); }
    else if (group === 'zero') {
      await run('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(0,0)\nE=(-1,3)\nQA=QACu1(A,B,C,D)\nQuartic=QLQu3(A,B,C,E)');
      for (const label of ['QA','Quartic']) {
        await type(label,'implicitpoly'); check(!await api('isDefined',label),`${label} rejects the zero polynomial`);
      }
      await api('setCoords','D',-1,2); await api('setCoords','E',-1,2);
      for (const label of ['QA','Quartic']) check(await api('isDefined',label),`${label} recovers after dragging away from the zero polynomial`);
      await run('UndefinedPoint=(0/0,0/0)\nBadQA=QACu1(A,B,C,UndefinedPoint)\nBadOrtho=OrthopivotalCubic(A,B,C,UndefinedPoint)\nBadPivot=PivotalIsogonalCubic(A,B,C,UndefinedPoint)\nBadQuartic=QLQu3(A,B,C,UndefinedPoint)\nBadThree=QLCu1(UndefinedPoint,B,Line(A,B))');
      for (const label of ['BadQA','BadOrtho','BadPivot','BadQuartic','BadThree']) check(!await api('isDefined',label),`${label} rejects undefined inputs`);
    }
    else if (group === 'native-primitives') {
      await run('O=(0,0)\nS=(2,1)\nshift=1\nsourceCircle=Circle((shift,0),1)\nsourceLine=Line((shift,0),(shift,1))\nnativeCircleImage=Reflect(Reflect(sourceCircle,Line(O,S)),Circle(O,S))\nnativeLineImage=Reflect(Reflect(sourceLine,Line(O,S)),Circle(O,S))');
      for (const shift of [1,0,2]) {
        await api('setValue','shift',shift);
        for (const label of ['nativeCircleImage','nativeLineImage']) { await type(label,'conic'); check(await api('isDefined',label),`${label} defined at ${shift}`); }
      }
    }
    else if (group === 'mixed') {
      await run('A=(1,0)\nB=(0,1)\nC=(-1,0)\nD=(0,-1)\nE=(0.6,0.8)\nl:x+y=sqrt(2)\nm:2*x-y=sqrt(5)\nn:x-2*y=sqrt(5)\no:3*x+y=sqrt(10)\nr:x+3*y=sqrt(10)');
      const quad = (m: number[][], p: number[]) => p.reduce((sum, v, i) => sum + v*m[i].reduce((s, x, j) => s+x*p[j], 0), 0);
      const adj = (m: number[][]) => Array.from({ length: 3 }, (_, i) => Array.from({ length: 3 }, (_, j) => {
        const r = [0,1,2].filter((k) => k !== j); const c = [0,1,2].filter((k) => k !== i);
        return (-1)**(i+j)*(m[r[0]][c[0]]*m[r[1]][c[1]]-m[r[0]][c[1]]*m[r[1]][c[0]]);
      }));
      for (const [name, inputs, count] of [
        ['FivePoints','A,B,C,D,E',1], ['FourPoints','A,B,C,D,l',2], ['ThreePoints','A,B,C,l,m',4],
        ['TwoPoints','A,B,l,m,n',4], ['OnePoint','A,l,m,n,o',2], ['FiveLines','l,m,n,o,r',1],
      ] as const) {
        const before = (await api('getAllObjectNames') as string[]).length;
        const labels = await run(`${name}=Conic(${inputs})`);
        check(labels.length === count && (await api('getAllObjectNames') as string[]).length === before+count, `${name}: ${count} independent outputs, no helpers`);
        let circle = false;
        for (const label of labels) {
          await type(label, 'conic'); check(await api('isDefined', label), `${label} defined`);
          const raw = await conicValues(label); const scale = Math.max(...raw.map(Math.abs));
          const [a,b,f,h,d,e] = raw.map((v) => v/scale); const q = [[a,h/2,d/2],[h/2,b,e/2],[d/2,e/2,f]];
          circle ||= proportional(raw,[1,1,-1,0,0,0]);
          for (const input of inputs.split(',')) {
            const point = await api('getObjectType', input) === 'point';
            const v = await Promise.all((point ? [`x(${input})`,`y(${input})`,'1'] : [`x(${input})`,`y(${input})`,`z(${input})`]).map(value));
            check(Math.abs(quad(point ? q : adj(q),v))/(1+v.reduce((s,x)=>s+x*x,0)) < 1e-6, `${label} satisfies ${input}`);
          }
        }
        check(circle, `${name} contains unit circle`);
      }
      await run('Seed=(0.5,0.5)\nDormant=Conic(A,B,Seed,l,m)');
      check(!await api('isDefined','Dormant'), 'singular frame initially undefined');
      await api('setCoords','Seed',-1,0); check(await api('isDefined','Dormant'), 'empty slots recover after dragging');
      await api('setCoords','A',1.03,0.02);
      for (const label of ['ThreePoints','TwoPoints','OnePoint']) check(await api('isDefined',label), `${label} updates after dragging`);
    } else if (group === 'transform') {
      await run('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2)\nM=MiquelPoint(A,B,C,D)\nshape=2\nq=Conic({1,shape,-1,0,-2,0})\nP=(2.1,0.7)\nQ=QLTf1(A,B,C,D,P)\nBack=QLTf1(A,B,C,D,Q)\nImageConic=QLTf1(A,B,C,D,q)\ncircle=Circle(M+(1,0),1)\nImageCircle=QLTf1(A,B,C,D,circle)\nImageLine=QLTf1(A,B,C,D,Line(M,M+(1,2)))');
      await type('ImageConic','implicitpoly'); check(await api('isDefined','ImageConic'),'ImageConic defined');
      for (const label of ['ImageCircle','ImageLine']) { await type(label,'conic'); check(await api('isDefined',label),`${label} retains line limit`); }
      await near('Distance(P,Back)','point transform is involutory');
      // Test both the native and circular-factor fallback with the same output object.
      for (const shape of [1,0,2]) {
        report(`RUN conic shape ${shape}`);
        await api('setValue','shape',shape);
        await run('SourcePoint=(1+sqrt(2),0)\nTargetPoint=QLTf1(A,B,C,D,SourcePoint)\nImageFunction=LeftSide(ImageConic)-RightSide(ImageConic)');
        await near('ImageFunction(x(TargetPoint),y(TargetPoint))','conic image contains transformed source point');
        await type('ImageConic','implicitpoly');
      }
      await api('setCoords','D',-1.2,2.3); await near('Distance(P,Back)','point dependencies update');
    } else if (group === 'polynomial-transform') {
      await run('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2)\nF=ImplicitCurve(x^4+y-1)\nImageQuartic=QLTf1(A,B,C,D,F)\nTarget=QLTf1(A,B,C,D,(1,0))\nImageFunction=LeftSide(ImageQuartic)-RightSide(ImageQuartic)');
      await type('ImageQuartic','implicitpoly'); check(await api('isDefined','ImageQuartic'),'quartic image defined');
      const residual = await value('ImageFunction(x(Target),y(Target))');
      const scale = await value('Max(Zip(abs(probeCoefficient),probeCoefficient,Coefficients(ImageFunction(x,x^9))))');
      report(`Quartic residual ${residual}, coefficient scale ${scale}`);
      check(scale>0 && Number.isFinite(scale) && Math.abs(residual)/scale<2e-7,'quartic image contains transformed source point (normalized coefficients)');
      // M=(-8,-4), kappa=60+100i for this seed. Clear rho^4 in F(T(X)).
      const x='(x+8)', y='(y+4)', rho=`(${x}^2+${y}^2)`;
      await samePolynomial('ImageQuartic',`(-8*${rho}+60*${x}+100*${y})^4+(-5*${rho}+100*${x}-60*${y})*${rho}^3`,8);
      await run('Circular=ImplicitCurve((x^2+y^2)*(x+2*y)+x-1)\nCircularImage=QLTf1(A,B,C,D,Circular)\nCircularBack=QLTf1(A,B,C,D,CircularImage)');
      await samePolynomial('CircularBack','(x^2+y^2)*(x+2*y)+x-1',3);
      await run('TooHigh=ImplicitCurve(x^5+y-1)\nRejected=QLTf1(A,B,C,D,TooHigh)');
      check(!await api('isDefined','Rejected'),'degree greater than four rejected');
      await run('Collapsed=QLTf1(A,A,C,D,Circular)');
      check(!await api('isDefined','Collapsed'),'noninvertible quadrilateral remains undefined');
    } else {
      await run('A=(0,0)\nB=(4,0)\nC=(3,3)\nD=(-1,2)\nP=(1,1)\nl:x+2*y=3\nNine=NinePointConic(A,B,C,D)\nOrtho=OrthopolarConic(A,B,C,P)\nInner=InconicWithCenter(A,B,C,P)\nIso=IsogonalConjugate(A,B,C,l)\nIsot=IsotomicConjugate(A,B,C,l)\nStam=StammlerHyperbola(A,B,C)\nAp=ApolloniusCircle(A,B,C)\nQA=QACu1(A,B,C,D)\nOrthocubic=OrthopivotalCubic(A,B,C,P)\nPivot=PivotalIsogonalCubic(A,B,C,P)\nQuartic=QLQu3(A,B,C,D)');
      for (const label of ['Nine','Ortho','Inner','Iso','Isot','Stam','Ap','QA','Orthocubic','Pivot','Quartic']) check(await api('isDefined',label),`${label} defined`);
      for (const pair of ['A,B','A,C','A,D','B,C','B,D','C,D']) await near(`Distance(Midpoint(${pair}),Nine)`, `nine-point incidence ${pair}`);
      for (const side of ['A,B','A,C','B,C']) await near(`Distance(ClosestPoint(Line(${side}),P),Ortho)`, `orthopolar pedal incidence ${side}`);
      await near('Distance(Center(Inner),P)','inconic has requested center');
      await samePolynomial('Quartic','2*(x^2+y^2)^2+(x+54*y)*(x^2+y^2)-117*x^2-210*x*y-267*y^2+324*x+252*y',4);
      // Independent native barycentric conversion checks signs and coordinate substitution.
      const s = ['10','18','16']; const p = ['8','0','4'];
      const q = ['13','-9','8']; // D in ABC: cross(B-D,C-D), cross(C-D,A-D), cross(A-D,B-D).
      const qaT = q.map((v,i) => { const j=(i+1)%3,k=(i+2)%3; return `${s[i]}*(${v}+${q[j]})*(${v}+${q[k]})-${s[j]}*${v}*(${v}+${q[j]})-${s[k]}*${v}*(${v}+${q[k]})`; });
      const qa = qaCu1Coefficients(s,q,qaT); const xyz=['A','B','C'];
      await run(`NativeQA=TriangleCurve(A,B,C,${[0,1,2].flatMap((i) => [`(${qa[2*i]})*${xyz[(i+1)%3]}^2*${xyz[(i+2)%3]}`,`(${qa[2*i+1]})*${xyz[(i+1)%3]}*${xyz[(i+2)%3]}^2`]).join('+')}=0)`);
      await run('nativeFunction=LeftSide(NativeQA)-RightSide(NativeQA)'); await samePolynomial('QA','nativeFunction(x,y)',3);
      await run(`NativePivot=TriangleCurve(A,B,C,${p[2]}*${s[1]}*A^2*C-${p[2]}*${s[0]}*B^2*C-${p[1]}*${s[2]}*A^2*B+${p[1]}*${s[0]}*B*C^2+${p[0]}*${s[2]}*A*B^2-${p[0]}*${s[1]}*A*C^2=0)\nnativeFunction=LeftSide(NativePivot)-RightSide(NativePivot)`);
      await samePolynomial('Pivot','nativeFunction(x,y)',3);
      await run('NativeOrtho=TriangleCurve(A,B,C,96*A*B^2-144*A*C^2-96*B*C^2+96*B*A^2+72*C*A^2+24*C*B^2=0)\nnativeFunction=LeftSide(NativeOrtho)-RightSide(NativeOrtho)');
      await samePolynomial('Orthocubic','nativeFunction(x,y)',3);
      await run('M=MiquelPoint(A,B,C,D)\nFixed=QL2P3(A,B,C,D,1)\nNewton=Line((A+C)/2,(B+D)/2)\nThree=QLCu1(M,Fixed,Newton)\nFour=QLCu1(A,B,C,D)\nnativeFunction=LeftSide(Four)-RightSide(Four)');
      await samePolynomial('Three','nativeFunction(x,y)',3);
      await api('setCoords','D',1,3); check(await api('isDefined','Quartic'),'quartic survives one infinite diagonal intersection');
      await api('setCoords','D',-1,2); await api('setCoords','C',0,4);
      for (const label of ['QA','Orthocubic','Pivot','Quartic','Nine']) check(await api('isDefined',label),`${label} updates after dragging`);
    }
    const before = await api('getAllObjectNames') as string[];
    const blob = await engine.exportGgb(); await engine.importGgb(new File([blob], 'curve-optimization.ggb'));
    check((await api('getAllObjectNames') as string[]).length === before.length,'export/reopen retains objects');
    if (group === 'curves') {
      await api('setCoords','C',2,4);
      await near('Distance(Midpoint(A,C),Nine)+Distance(Midpoint(B,C),Nine)+Distance(Midpoint(C,D),Nine)','conic dependencies update after reopening');
      for (const label of ['QA','Orthocubic','Pivot','Quartic','Three','Four']) check(await api('isDefined',label),`${label} updates after reopening`);
    } else if (group === 'mixed') {
      await api('setCoords','A',1.02,0.01);
      const cs = await conicValues('ThreePoints'); const [a,b,f,h,d,e] = cs;
      check(Math.abs(a*1.02**2+b*0.01**2+f+h*1.02*0.01+d*1.02+e*0.01)/Math.max(...cs.map(Math.abs))<1e-6,'mixed conic constraints update after reopening');
    } else if (group === 'transform') {
      await api('setCoords','P',2.3,-0.4); await near('Distance(P,Back)','QL transform updates after reopening');
    }
    report('COMPLETE');
  } catch (error) { report(`FAIL ${String(error)}`); }
  finally { await api('setRepaintingActive',true); button.disabled = false; }
};


