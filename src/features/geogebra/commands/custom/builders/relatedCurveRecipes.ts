import recipesJson from '../generated/relatedCurves.json';

interface Template {
  degree: number;
  monomials: number[][];
  terms: Array<[number, number, string]>;
}
interface CurveRecipe {
  template: string;
  locals: string[][];
  coefficients: string[];
}
interface RecipeData {
  templates: Record<string, Template>;
  curves: Record<string, CurveRecipe>;
}
export const relatedCurveRecipeData = recipesJson as unknown as RecipeData;

/** Resolve only the selected recipe. Formula arrays remain shared references. */
export const getRelatedCurveRecipe = (id: string) => {
  const curve = relatedCurveRecipeData.curves[id];
  if (!curve) return undefined;
  const template = relatedCurveRecipeData.templates[curve.template];
  if (!template) throw new Error(`${id}: missing related curve template ${curve.template}.`);
  return { ...template, locals: curve.locals, coefficients: curve.coefficients };
};
