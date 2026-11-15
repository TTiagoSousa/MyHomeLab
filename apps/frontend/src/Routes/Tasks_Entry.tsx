import { Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as Private_Page from '../Imports/privatePages';
import Legacy_Board_Redirect from './Legacy_Board_Redirect';

const BOARD_PARAMS = ['view', 'project'];

const Tasks_Entry = () => {
  const [searchParams] = useSearchParams();
  if (BOARD_PARAMS.some((param) => searchParams.has(param))) return <Legacy_Board_Redirect />;
  return (
    <Suspense fallback={null}>
      <Private_Page.Todos />
    </Suspense>
  );
};

export default Tasks_Entry;
