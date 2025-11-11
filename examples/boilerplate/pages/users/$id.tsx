import React from 'react';
import { useParams, useSearchParams } from 'umi';

export default function UsersId(props: any) {
  const params = useParams();
  const [searchParams] = useSearchParams();
  console.log(props, searchParams.get('foo'));
  return <h2>user: {params.id}</h2>;
};
