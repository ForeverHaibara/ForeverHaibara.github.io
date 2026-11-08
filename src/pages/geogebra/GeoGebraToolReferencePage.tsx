import { useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import ToolReference from '../../features/geogebra/components/reference/ToolReference';

export default function GeoGebraToolReferencePage() {
  const { tool } = useParams();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tool]);
  return <ToolReference name={tool} />;
}
