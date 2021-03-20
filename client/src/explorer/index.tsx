import React, { useState } from 'react';
import Loading from '../common/components/loading';

function Explorer(props: any): React.ReactElement {
  const [loading, setLoading] = useState(true);
  return (
    <div id="explorer">
      {loading && <Loading cover={true} />}
    </div>
  );
}

export default Explorer;
