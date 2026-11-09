async function request(method, password) {
  const response = await fetch('/api/auth', {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...(password === undefined ? {} : { body: JSON.stringify({ password }) }),
  });
  if (response.status === 503) throw new Error('관리자 인증 서버가 아직 설정되지 않았습니다.');
  if (response.status === 429) throw new Error('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) return false;
    throw new Error('인증 서버 요청에 실패했습니다.');
  }
  if (!response.headers.get('content-type')?.startsWith('application/json')) {
    throw new Error('인증 API 응답 형식이 올바르지 않습니다.');
  }
  const result = await response.json();
  if (method === 'DELETE' && result?.authenticated === false) return true;
  if (method === 'POST' && result?.authenticated === true &&
      Number.isInteger(result.expiresAt) && result.expiresAt * 1000 > Date.now()) {
    return result.expiresAt * 1000;
  }
  throw new Error('인증 API 응답 형식이 올바르지 않습니다.');
}

export const loginWithPassword = password => request('POST', password);
export const logoutSession = () => request('DELETE');
