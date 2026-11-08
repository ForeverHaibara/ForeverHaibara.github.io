import { useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import ToolReference from '../../features/geogebra/components/reference/ToolReference';

export default function GeoGebraToolReferencePage() {
  const { tool } = useParams();
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [tool]);
  return <div className="relative left-1/2 w-screen max-w-none -translate-x-1/2 px-4 sm:px-6 lg:px-8 xl:px-10">
    <div className="mx-auto w-full max-w-[1440px]">
      <ToolReference name={tool} />
    </div>
  </div>;
}
