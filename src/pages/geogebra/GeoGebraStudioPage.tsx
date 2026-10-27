import React from 'react';
import GeoGebraStudioShell from '../../features/geogebra/components/studio/GeoGebraStudioShell';
import { useGeoGebraStudio } from '../../features/geogebra/studio/useGeoGebraStudio';

const GeoGebraStudioPage: React.FC = () => {
  const studio = useGeoGebraStudio();
  return <GeoGebraStudioShell {...studio} />;
};

export default GeoGebraStudioPage;
