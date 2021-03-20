import React from 'react';
import './loading.css';

function Loading({ cover = false }: LoadingProps): React.ReactElement {
  return (
    <div className={cover ? 'centered-loading' : ''}>
      <div className="lds-ring">
        <div></div>
        <div></div>
        <div></div>
        <div></div>
      </div>
    </div>
  );
}

interface LoadingProps {
  cover?: boolean
}

export default Loading;
