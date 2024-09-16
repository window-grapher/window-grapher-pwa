// src/auth.js

// グローバル変数
export let authIdToken = null;
export let loggedInUser = null;

// ログインページへのリダイレクト
const redirectToLoginPage = () => {
  const loginPageUrl = 'https://takoyaki3-auth.web.app';
  window.location.href = `${loginPageUrl}?r=${encodeURIComponent(window.location.href)}`;
};

// JWTのデコード
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('JWTのデコード中にエラーが発生しました:', e);
    return null;
  }
};

// JWTの有効期限チェック
const isJwtExpired = (decodedToken) => {
  const currentTime = Math.floor(Date.now() / 1000);
  return decodedToken.exp < currentTime;
};

// JWTをローカルストレージに保存
const saveJwtToLocalStorage = (jwt) => {
  window.localStorage.setItem('authIdToken', jwt);
};

// URLからJWTを削除
const removeJwtFromUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete('jwt');
  window.history.replaceState({}, document.title, url.toString());
};

// 認証の初期化
export const initializeAuth = () => {
  const queryParams = new URLSearchParams(window.location.search);
  authIdToken = queryParams.get('jwt');

  if (!authIdToken) {
    authIdToken = window.localStorage.getItem('authIdToken');
    if (!authIdToken) {
      redirectToLoginPage();
      return;
    }
  }
  const decodedToken = decodeJwt(authIdToken);
  if (!decodedToken || isJwtExpired(decodedToken)) {
    console.error('認証トークンが無効または期限切れです。');
    redirectToLoginPage();
    return;
  }

  loggedInUser = { email: decodedToken.email };

  // JWTをローカルストレージに保存
  saveJwtToLocalStorage(authIdToken);
  removeJwtFromUrl();

  console.log('ユーザーは認証されています');
};
