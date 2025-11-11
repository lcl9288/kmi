import React from 'react';
import { useLocation } from 'umi';

export default function About() {
  const location = useLocation();
  return <div>About {location.pathname}</div>;
};
